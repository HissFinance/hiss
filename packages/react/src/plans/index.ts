/**
 * Pure action-plan builders. Each takes plain inputs and returns a
 * {@link PlanResult}: a validated description of a transaction the user MAY
 * choose to sign. None of these functions sign, encode private data, or
 * execute anything — `executed` is always false and `requiresSignature` is
 * always true.
 */

import { ROBINHOOD_CHAIN_ID, XHISS_TIMING } from "../constants";
import type { ActionPlan, PlanResult } from "../types";

function isPositiveBaseUnits(value: string): boolean {
  return /^\d+$/.test(value) && BigInt(value) > 0n;
}

// ---------------------------------------------------------------------------
// Vault deposit
// ---------------------------------------------------------------------------

export type VaultDepositInput = {
  vaultAddress: string;
  /** Settlement-asset amount to deposit, base units (decimal string). */
  amountBaseUnits: string;
  /** Depositor account (for the plan summary). */
  account: string;
  chainId?: number;
  assetSymbol?: string;
};

export function buildVaultDepositPlan(input: VaultDepositInput): PlanResult<VaultDepositInput> {
  const errors: string[] = [];
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_ID;
  if (!input.vaultAddress?.startsWith("0x")) errors.push("vaultAddress must be a 0x address.");
  if (!input.account?.startsWith("0x")) errors.push("account must be a 0x address.");
  if (!isPositiveBaseUnits(input.amountBaseUnits)) {
    errors.push("amountBaseUnits must be a positive integer string.");
  }
  if (errors.length > 0) {
    return { input, plan: null, valid: false, errors };
  }
  const sym = input.assetSymbol ?? "the settlement asset";
  const plan: ActionPlan = {
    kind: "vault-deposit",
    title: "Deposit into HISS vault",
    steps: [
      {
        summary: `Approve ${sym} spend for the vault, then deposit ${input.amountBaseUnits} base units.`,
        chainId,
        to: input.vaultAddress,
        value: "0",
      },
    ],
    requiresSignature: true,
    executed: false,
    notes: [
      "Deposit availability is a live on-chain read; confirm the vault is open before signing.",
      "You sign this transaction in your own wallet. This library never sends transactions.",
    ],
  };
  return { input, plan, valid: true, errors: [] };
}

// ---------------------------------------------------------------------------
// Vault creation candidate
// ---------------------------------------------------------------------------

export type VaultCreateInput = {
  /** Human-readable vault name. */
  name: string;
  /** Manifest slug (kebab-case identifier). */
  slug: string;
  /** Target weights in basis points; must sum to 10000. */
  weights: Array<{ symbol: string; weightBps: number }>;
  account: string;
  chainId?: number;
};

export function buildVaultCreatePlan(input: VaultCreateInput): PlanResult<VaultCreateInput> {
  const errors: string[] = [];
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_ID;
  if (!input.name?.trim()) errors.push("name is required.");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug ?? "")) {
    errors.push("slug must be kebab-case (a-z, 0-9, hyphens).");
  }
  if (!input.account?.startsWith("0x")) errors.push("account must be a 0x address.");
  if (!input.weights || input.weights.length === 0) {
    errors.push("at least one weight is required.");
  } else {
    const total = input.weights.reduce((sum, w) => sum + w.weightBps, 0);
    if (total !== 10_000) {
      errors.push(`weights must sum to 10000 bps (got ${total}).`);
    }
    if (input.weights.some((w) => w.weightBps <= 0)) {
      errors.push("each weight must be positive.");
    }
  }
  if (errors.length > 0) {
    return { input, plan: null, valid: false, errors };
  }
  const plan: ActionPlan = {
    kind: "vault-create",
    title: `Create vault candidate "${input.name}"`,
    steps: [
      {
        summary: `Submit a vault-creation transaction for slug "${input.slug}" with ${input.weights.length} weighted positions.`,
        chainId,
        value: "0",
      },
    ],
    requiresSignature: true,
    executed: false,
    notes: [
      "This is a candidate manifest. Creation is subject to on-chain registry checks and eligibility rules.",
      "You sign this transaction in your own wallet. This library never sends transactions.",
    ],
  };
  return { input, plan, valid: true, errors: [] };
}

// ---------------------------------------------------------------------------
// Stake HISS → xHISS
// ---------------------------------------------------------------------------

export type StakeInput = {
  /** HISS amount to stake, base units. */
  amountBaseUnits: string;
  account: string;
  chainId?: number;
  /** Current HISS-per-xHISS rate as a decimal string, when known (display). */
  shareRate?: string;
};

export function buildStakePlan(input: StakeInput): PlanResult<StakeInput> {
  const errors: string[] = [];
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_ID;
  if (!input.account?.startsWith("0x")) errors.push("account must be a 0x address.");
  if (!isPositiveBaseUnits(input.amountBaseUnits)) {
    errors.push("amountBaseUnits must be a positive integer string.");
  }
  if (errors.length > 0) {
    return { input, plan: null, valid: false, errors };
  }
  const rateNote = input.shareRate
    ? `At the current rate (~${input.shareRate} HISS/xHISS) the exact xHISS minted is computed on-chain at execution.`
    : "The exact xHISS minted is computed on-chain at execution using the live rate.";
  const plan: ActionPlan = {
    kind: "stake",
    title: "Stake HISS for xHISS",
    steps: [
      {
        summary: `Approve HISS, then stake ${input.amountBaseUnits} base units to receive xHISS shares.`,
        chainId,
        value: "0",
      },
    ],
    requiresSignature: true,
    executed: false,
    notes: [
      rateNote,
      "Staking is not a performance claim. Exiting requires a 72-hour cooldown, then a 2-day redeem window.",
      "You sign this transaction in your own wallet. This library never sends transactions.",
    ],
  };
  return { input, plan, valid: true, errors: [] };
}

// ---------------------------------------------------------------------------
// Cooldown
// ---------------------------------------------------------------------------

export type CooldownInput = {
  /** xHISS shares to place in cooldown, base units. */
  shareBaseUnits: string;
  account: string;
  chainId?: number;
  /** Unix seconds "now", for projecting window timing (defaults to Date.now). */
  nowSeconds?: number;
};

export function buildCooldownPlan(input: CooldownInput): PlanResult<CooldownInput> & {
  /** Projected timing if signed at `nowSeconds` (display only). */
  projected?: { cooldownEndsAt: number; redeemWindowEndsAt: number };
} {
  const errors: string[] = [];
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_ID;
  if (!input.account?.startsWith("0x")) errors.push("account must be a 0x address.");
  if (!isPositiveBaseUnits(input.shareBaseUnits)) {
    errors.push("shareBaseUnits must be a positive integer string.");
  }
  if (errors.length > 0) {
    return { input, plan: null, valid: false, errors };
  }
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const cooldownEndsAt = now + XHISS_TIMING.cooldownSeconds;
  const redeemWindowEndsAt = cooldownEndsAt + XHISS_TIMING.redeemWindowSeconds;
  const plan: ActionPlan = {
    kind: "cooldown",
    title: "Start xHISS cooldown",
    steps: [
      {
        summary: `Escrow ${input.shareBaseUnits} xHISS base units and start the 72-hour cooldown.`,
        chainId,
        to: undefined,
        value: "0",
      },
    ],
    requiresSignature: true,
    executed: false,
    notes: [
      "Cooldown is additive: starting again restarts the 72-hour timer for the escrowed amount.",
      "Cooldown can be cancelled at any time before redeeming.",
      "Projected timing below is an estimate for the moment you sign; the contract records the actual timestamps.",
    ],
  };
  return {
    input,
    plan,
    valid: true,
    errors: [],
    projected: { cooldownEndsAt, redeemWindowEndsAt },
  };
}

// ---------------------------------------------------------------------------
// Redeem
// ---------------------------------------------------------------------------

export type RedeemInput = {
  /** xHISS shares to redeem, base units. */
  shareBaseUnits: string;
  account: string;
  /** Receiver of the redeemed HISS. */
  receiver: string;
  chainId?: number;
  /** Unix seconds the redeem window opened, when known (for validation). */
  redeemWindowOpensAt?: number;
  redeemWindowClosesAt?: number;
  nowSeconds?: number;
};

export function buildRedeemPlan(input: RedeemInput): PlanResult<RedeemInput> {
  const errors: string[] = [];
  const chainId = input.chainId ?? ROBINHOOD_CHAIN_ID;
  if (!input.account?.startsWith("0x")) errors.push("account must be a 0x address.");
  if (!input.receiver?.startsWith("0x")) errors.push("receiver must be a 0x address.");
  if (!isPositiveBaseUnits(input.shareBaseUnits)) {
    errors.push("shareBaseUnits must be a positive integer string.");
  }
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const notes: string[] = [
    "Redeem is only valid inside the 2-day window after cooldown completes.",
    "If the window is missed, restart the cooldown before redeeming again.",
    "You sign this transaction in your own wallet. This library never sends transactions.",
  ];
  if (input.redeemWindowOpensAt != null && now < input.redeemWindowOpensAt) {
    errors.push("redeem window has not opened yet (cooldown still in progress).");
  }
  if (input.redeemWindowClosesAt != null && now > input.redeemWindowClosesAt) {
    errors.push("redeem window has closed; restart cooldown.");
  }
  if (errors.length > 0) {
    return { input, plan: null, valid: false, errors };
  }
  const plan: ActionPlan = {
    kind: "redeem",
    title: "Redeem xHISS for HISS",
    steps: [
      {
        summary: `Redeem ${input.shareBaseUnits} xHISS base units to ${input.receiver}.`,
        chainId,
        value: "0",
      },
    ],
    requiresSignature: true,
    executed: false,
    notes,
  };
  return { input, plan, valid: true, errors: [] };
}
