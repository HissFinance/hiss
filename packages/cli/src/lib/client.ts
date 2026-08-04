/**
 * SDK integration seam.
 *
 * This is the ONLY module in the CLI that imports `@hiss-finance/sdk`. It
 * builds a concrete {@link HissClient} facade from the public SDK so command
 * handlers stay transport-agnostic and unit-testable with a mock.
 *
 * The SDK is read-and-prepare only: it never signs, submits, or holds keys,
 * and every prepared transaction is returned unsigned. Two real SDK surfaces
 * are reconciled here:
 *
 *   1. A read client (the `HissClient` CLASS) with instance methods
 *      (`getProtocolStatus`, `getContractRegistry`, `getVaults`, `getVault`,
 *      `getVaultV2Status`, `getVaultHoldings`, `getVaultPerformance`,
 *      `getStakingStatus`, `getRewardStatus`, `getRewardMethod`,
 *      `getReceipts`). These must be called ON the instance — a detached
 *      reference loses `this` and crashes on `this.chainId`.
 *
 *   2. Module-level `prepare*` FUNCTIONS returning a typed, UNSIGNED
 *      `ActionPlan`. They are not methods on the read client; we import them
 *      directly and normalize their output to the CLI's `UnsignedTx` shape.
 *
 * Vault truth: the CANONICAL new-deposit vault is HISS Vault V2
 * (queue-routed epoch settlement); the V1 flagship is LEGACY (closed to new deposits,
 * returned separately, never the deposit default). Live state is always a
 * chain read. Where the SDK genuinely has no public source for a read
 * (per-receipt lookup, reward scoring) this facade returns a typed, honest
 * response — never a fabricated value and never a crash.
 */

import {
  createHissClient as createSdkReadClient,
  prepareVaultCreation as sdkPrepareVaultCreation,
  prepareVaultDeposit as sdkPrepareVaultDeposit,
  prepareVaultWithdrawal as sdkPrepareVaultWithdrawal,
  prepareHissStake as sdkPrepareHissStake,
  prepareXhissCooldown as sdkPrepareXhissCooldown,
  prepareXhissRedeem as sdkPrepareXhissRedeem,
  ADDRESSES,
  DECIMALS,
  type ActionPlan,
} from "@hiss-finance/sdk";
import type { HissClient, JsonRecord, PrepareVaultOpts, UnsignedTx } from "./types.js";

export interface ClientOptions {
  /** JSON-RPC endpoint for Robinhood Chain. Read-only usage. */
  rpcUrl?: string;
  /** Robinhood Chain id (4663 mainnet default, 46630 testnet). */
  chainId?: number;
}

/** Public Robinhood Chain RPC endpoints — read-only, no embedded credentials. */
const DEFAULT_RPC_URL: Record<number, string> = {
  4663: "https://rpc.mainnet.chain.robinhood.com",
  46630: "https://rpc.testnet.chain.robinhood.com",
};

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function asAddress(value: string, label: string): `0x${string}` {
  if (!ADDRESS_RE.test(value)) {
    throw new Error(`${label} must be a 0x-prefixed 20-byte address, got "${value}".`);
  }
  return value as `0x${string}`;
}

/**
 * Convert a human decimal string (e.g. "100.5") to integer base units.
 * Fail-closed on a malformed amount — never a JS float.
 */
function toBaseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`amount must be a non-negative decimal string, got "${value}".`);
  }
  const [whole = "0", frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`amount "${value}" has more than ${decimals} decimal places.`);
  }
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac || "0").padEnd(decimals, "0"));
}

/** Normalize an SDK ActionPlan into the CLI's strictly-unsigned shape. */
function planToUnsigned(plan: ActionPlan): UnsignedTx {
  return {
    chainId: plan.chainId,
    to: plan.target,
    data: plan.calldata,
    value: plan.value ?? "0",
    description: plan.summary,
    signed: false,
    function: plan.function,
    decodedArgs: plan.decodedArgs,
    planHash: plan.planHash,
    warnings: plan.warnings,
    requiredAcknowledgments: plan.requiredAcknowledgments,
  };
}

/**
 * Build a HissClient facade backed by the public SDK. Read methods are called
 * on a single SDK read-client INSTANCE (preserving `this`); prepare methods
 * map CLI inputs onto the SDK's typed prepare functions.
 *
 * When no `rpcUrl` is configured (a fresh global install with no flags/env),
 * default to the public read-only RPC for the selected chain so basic reads
 * (`hiss status`, `hiss vault list`, …) work out of the box.
 */
export function createHissClient(opts: ClientOptions = {}): HissClient {
  const chainId = opts.chainId ?? 4663;
  const read = createSdkReadClient({
    rpcUrl: opts.rpcUrl ?? DEFAULT_RPC_URL[chainId] ?? DEFAULT_RPC_URL[4663],
    chainId,
  });

  return {
    // ---- reads ----
    getProtocolStatus: () => read.getProtocolStatus() as unknown as Promise<JsonRecord>,

    getContractRegistry: async () => (await read.getContractRegistryDetailed()) as unknown as JsonRecord,

    // Canonical V2 vault first; the legacy V1 flagship separately labeled.
    listVaults: () => read.getVaults() as unknown as Promise<JsonRecord[]>,

    getVault: async (ref) => {
      const isAddr = ADDRESS_RE.test(ref);
      const wantsLegacy = !isAddr && /legacy|v1|flagship/i.test(ref);
      const address = isAddr
        ? (ref as `0x${string}`)
        : wantsLegacy
          ? ADDRESSES.flagshipVault
          : ADDRESSES.vaultV2;
      const reads = (await read.getVault(address)) as unknown as JsonRecord;
      return {
        ...reads,
        requestedRef: ref,
        ...(isAddr
          ? {}
          : {
              resolutionNote: wantsLegacy
                ? `Resolved "${ref}" to the LEGACY V1 flagship vault (${ADDRESSES.flagshipVault}) — closed to new deposits; existing balances withdraw/redeem here.`
                : `Resolved "${ref}" to the canonical V2 vault (${ADDRESSES.vaultV2}). Pass a 0x address to read a specific vault; "legacy"/"v1"/"flagship" resolves the legacy V1 flagship.`,
            }),
      };
    },

    getVaultV2Status: async () => (await read.getVaultV2Status()) as unknown as JsonRecord,

    getVaultHoldings: (vault) =>
      read.getVaultHoldings(asAddress(vault, "vault")) as unknown as Promise<JsonRecord>,

    getVaultPerformance: (vault) =>
      read.getVaultPerformance(asAddress(vault, "vault")) as unknown as Promise<JsonRecord>,

    getStakingStatus: () => read.getStakingStatus() as unknown as Promise<JsonRecord>,

    getRewardStatus: async () => read.getRewardStatus() as unknown as JsonRecord,

    // No public per-cohort reward-scoring source in this SDK build; scoring and
    // claimability are owner-gated and chain-verified. Honest, typed empty.
    getVaultContributorReward: async (address) => ({
      address,
      status: "not_available",
      note: "Vault-contributor reward scoring/claimability is owner-gated and chain-verified. It is not exposed by this public SDK build. planned != funded != claimable.",
    }),
    getProviderReward: async (groupId) => ({
      groupId,
      status: "not_available",
      note: "Provider reward scoring/claimability is owner-gated and chain-verified. It is not exposed by this public SDK build. planned != funded != claimable.",
    }),

    // The SDK has no per-id receipt store; receipts are produced by HISS APIs
    // and verified locally with `hiss receipt verify`. Honest, typed empty.
    getReceipt: async (id) => {
      const { note } = read.getReceipts();
      return { id, receipt: null, note };
    },

    getSupportedAssets: async () => (await read.getSupportedAssets()) as unknown as JsonRecord,

    getFeeSchedule: async () => ({
      rewardSplit: read.getRewardMethod(),
      note: "Per-vault fees (management/performance/referral) are set at vault creation and read per-vault. The reward-split legs above are protocol constants. No guaranteed yield or APY.",
    }),

    // ---- prepares (unsigned only) ----
    prepareVaultCreation: async (manifest) => {
      const feeRecipient = typeof manifest.feeRecipient === "string" ? manifest.feeRecipient : undefined;
      if (!feeRecipient) {
        throw new Error(
          "prepareVaultCreation requires a complete vault-kit candidate with a `feeRecipient` address — the simplified draft manifest does not carry on-chain deploy parameters.",
        );
      }
      const plan = sdkPrepareVaultCreation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candidate: manifest as any,
        feeRecipient,
        chainId,
      });
      return planToUnsigned(plan);
    },

    prepareVaultDeposit: async (vault, amount, receiver, prepOpts?: PrepareVaultOpts) => {
      if (!receiver) {
        throw new Error("prepareVaultDeposit requires a `receiver` address to mint the vault shares to.");
      }
      const plan = sdkPrepareVaultDeposit({
        vault: asAddress(vault, "vault"),
        amountUnits: toBaseUnits(amount, DECIMALS.usdg),
        receiver: asAddress(receiver, "receiver"),
        chainId,
        ...(prepOpts?.nonce ? { nonce: BigInt(prepOpts.nonce) } : {}),
        ...(prepOpts?.deadlineUnix ? { deadlineUnix: BigInt(prepOpts.deadlineUnix) } : {}),
        ...(prepOpts?.minOutShares
          ? { minOutShares: toBaseUnits(prepOpts.minOutShares, DECIMALS.shares) }
          : {}),
      });
      return planToUnsigned(plan);
    },

    prepareVaultWithdrawal: async (vault, shares, receiver, prepOpts?: PrepareVaultOpts) => {
      if (!receiver) {
        throw new Error(
          "prepareVaultWithdrawal requires a `receiver` address to send the withdrawn assets to.",
        );
      }
      const plan = sdkPrepareVaultWithdrawal({
        vault: asAddress(vault, "vault"),
        sharesUnits: toBaseUnits(shares, DECIMALS.shares),
        receiver: asAddress(receiver, "receiver"),
        chainId,
        ...(prepOpts?.mode === "queue_usdg" ? { mode: "queue_usdg" as const } : {}),
        ...(prepOpts?.minOutUsdg ? { minOutUsdg: toBaseUnits(prepOpts.minOutUsdg, DECIMALS.usdg) } : {}),
        ...(prepOpts?.nonce ? { nonce: BigInt(prepOpts.nonce) } : {}),
        ...(prepOpts?.deadlineUnix ? { deadlineUnix: BigInt(prepOpts.deadlineUnix) } : {}),
      });
      return planToUnsigned(plan);
    },

    prepareHissStake: async (amount) => {
      const plan = sdkPrepareHissStake({
        amountUnits: toBaseUnits(amount, DECIMALS.hiss),
        chainId,
      });
      return planToUnsigned(plan);
    },

    prepareXhissCooldown: async (xhissAmount) => {
      const plan = sdkPrepareXhissCooldown({
        action: "start",
        xShares: toBaseUnits(xhissAmount, DECIMALS.shares),
        chainId,
      });
      return planToUnsigned(plan);
    },

    prepareXhissRedeem: async (xShares, receiver) => {
      if (!xShares || !receiver) {
        throw new Error(
          "prepareXhissRedeem requires `xShares` (share amount) and a `receiver` address for the redeemed HISS.",
        );
      }
      const plan = sdkPrepareXhissRedeem({
        xShares: toBaseUnits(xShares, DECIMALS.shares),
        receiver: asAddress(receiver, "receiver"),
        chainId,
      });
      return planToUnsigned(plan);
    },
  };
}
