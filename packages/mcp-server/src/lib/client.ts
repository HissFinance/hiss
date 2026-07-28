/**
 * SDK integration seam.
 *
 * This is the ONLY module in the CLI that imports `@hiss-finance/sdk`. It
 * builds a concrete {@link HissClient} facade from the public SDK so that
 * command handlers stay transport-agnostic and unit-testable with a mock.
 *
 * The SDK is read-and-prepare only: it never signs, submits, or holds keys,
 * and every prepared transaction is returned unsigned. This facade reconciles
 * the two real surfaces the SDK exposes:
 *
 *   1. A read client (the `HissClient` CLASS) with instance methods
 *      (`getProtocolStatus`, `getContractRegistry`, `getVaults`, `getVault`,
 *      `getVaultHoldings`, `getVaultPerformance`, `getStakingStatus`,
 *      `getRewardStatus`, `getRewardMethod`, `getReceipts`). These must be
 *      called ON the instance — invoking a detached reference loses `this`
 *      and crashes on `this.chainId`.
 *
 *   2. Module-level `prepare*` FUNCTIONS returning a typed, UNSIGNED
 *      `ActionPlan`. They are not methods on the read client; we import them
 *      directly and normalize their output to the CLI's `UnsignedTx` shape.
 *
 * Where the SDK genuinely has no public source for a read (per-receipt
 * lookup, reward scoring, an enumerated tradable-asset registry) this facade
 * returns a typed, honest response — never a fabricated value and never a
 * crash.
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
  ROBINHOOD_CHAIN_MAINNET,
  type ActionPlan,
} from "@hiss-finance/sdk";
import { assertRealizableUnsignedTx } from "./txguard.js";
import type { HissClient, JsonRecord, UnsignedTx } from "./types.js";

export interface ClientOptions {
  /** JSON-RPC endpoint for Robinhood Chain. Read-only usage. */
  rpcUrl?: string;
  /** Robinhood Chain id (4663 mainnet default, 46630 testnet). */
  chainId?: number;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function asAddress(value: string, label: string): `0x${string}` {
  if (!ADDRESS_RE.test(value)) {
    throw new Error(`${label} must be a 0x-prefixed 20-byte address, got "${value}".`);
  }
  return value as `0x${string}`;
}

/**
 * Convert a human decimal string (e.g. "100.5") to integer base units without
 * pulling in a big-decimal dependency. Fail-closed on a malformed amount.
 */
function toBaseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`amount must be a non-negative decimal string, got "${value}".`);
  }
  const parts = trimmed.split(".");
  const whole = parts[0] ?? "0";
  const frac = parts[1] ?? "";
  if (frac.length > decimals) {
    throw new Error(`amount "${value}" has more than ${decimals} decimal places.`);
  }
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac || "0").padEnd(decimals, "0"));
}

/**
 * Normalize an SDK ActionPlan into the CLI's strictly-unsigned shape. Fail
 * CLOSED: a prepare must never return a success-shaped result with an empty or
 * zero target, or empty / selector-less calldata (see {@link assertRealizableUnsignedTx}).
 */
function planToUnsigned(plan: ActionPlan): UnsignedTx {
  assertRealizableUnsignedTx(plan.target, plan.calldata);
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

/** True when a value carries the vault-kit VaultCandidate shape createVault needs. */
export function isCompleteVaultCandidate(v: unknown): v is JsonRecord {
  if (typeof v !== "object" || v === null) return false;
  const c = v as JsonRecord;
  return (
    typeof c.symbol === "string" &&
    typeof c.minSkinBps === "number" &&
    Array.isArray(c.allocations) &&
    typeof c.asset === "object" &&
    c.asset !== null &&
    typeof c.strategy === "object" &&
    c.strategy !== null &&
    typeof c.jurisdiction === "object" &&
    c.jurisdiction !== null
  );
}

/**
 * Build a HissClient facade backed by the public SDK. Read methods are called
 * on a single SDK read-client INSTANCE (preserving `this`); prepare methods
 * map minimal CLI inputs onto the SDK's typed prepare functions.
 */
export function createHissClient(opts: ClientOptions = {}): HissClient {
  const chainId = opts.chainId ?? ROBINHOOD_CHAIN_MAINNET;
  const read = createSdkReadClient({ rpcUrl: opts.rpcUrl, chainId });

  return {
    // ---- reads ----
    getProtocolStatus: () => read.getProtocolStatus() as unknown as Promise<JsonRecord>,

    // The MCP tool result schema requires a JSON OBJECT (never a bare array).
    // The SDK's detailed report is exactly that: `{ chainId, observedAt,
    // entries: [{ name, address, runtimeCodeHash, status }] }`, where each
    // entry carries a live, fail-soft runtime-bytecode observation.
    getContractRegistry: async (observedAt) =>
      (await read.getContractRegistryDetailed(observedAt)) as unknown as JsonRecord,

    listVaults: () => read.getVaults() as unknown as Promise<JsonRecord[]>,

    getVault: async (ref) => {
      const isAddr = ADDRESS_RE.test(ref);
      const address = isAddr ? (ref as `0x${string}`) : ADDRESSES.flagshipVault;
      const reads = (await read.getVault(address)) as unknown as JsonRecord;
      return {
        ...reads,
        requestedRef: ref,
        ...(isAddr
          ? {}
          : {
              note: `Resolved to the flagship vault (${ADDRESSES.flagshipVault}). This public SDK build resolves only the flagship vault by slug — pass a 0x vault address to read a specific vault.`,
            }),
      };
    },

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
    // and verified locally with verify_receipt. Honest, typed empty.
    getReceipt: async (id) => {
      const { note } = read.getReceipts();
      return { id, receipt: null, note };
    },

    // Real canonical set: USDG base + HISS + the live on-chain VaultAssetRegistry
    // stock-token allow-list (chain 4663). Fail-soft inside the SDK.
    getSupportedAssets: async () => (await read.getSupportedAssets()) as unknown as JsonRecord,

    // Fee schedule = the protocol reward-split constants (a real SDK source)
    // plus a note that per-vault fees are set at creation and read per-vault.
    getFeeSchedule: async () => ({
      rewardSplit: read.getRewardMethod(),
      note: "Per-vault fees (management/performance/referral) are set at vault creation and read per-vault. The reward-split legs above are protocol constants. No guaranteed yield or APY.",
    }),

    // ---- prepares (unsigned only) ----
    prepareVaultCreation: async (manifest) => {
      // The simplified vault-manifest (validate.ts schema) does not carry the
      // on-chain fields createVault needs (share symbol, allocation addresses +
      // weightBps, minSkinBps, strategy, jurisdiction). If the caller supplies a
      // complete vault-kit VaultCandidate we build a real plan; otherwise we
      // decline honestly rather than fabricate deploy parameters.
      const candidate = isCompleteVaultCandidate(manifest.candidate) ? manifest.candidate : manifest;
      if (!isCompleteVaultCandidate(candidate)) {
        throw new Error(
          "prepareVaultCreation requires a complete VaultCandidate (allocations with addresses + weightBps, share symbol, asset, minSkinBps, strategy, jurisdiction). The simplified vault-manifest does not carry on-chain deploy parameters — supply a full candidate.",
        );
      }
      const feeRecipient =
        (typeof manifest.feeRecipient === "string" && manifest.feeRecipient) ||
        (typeof (candidate as JsonRecord).feeRecipient === "string" &&
          ((candidate as JsonRecord).feeRecipient as string)) ||
        undefined;
      if (!feeRecipient) {
        throw new Error("prepareVaultCreation requires a `feeRecipient` address alongside the candidate.");
      }
      const plan = sdkPrepareVaultCreation({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candidate: candidate as any,
        feeRecipient,
        chainId,
      });
      return planToUnsigned(plan);
    },

    prepareVaultDeposit: async (vault, amount, receiver) => {
      if (!receiver) {
        throw new Error("prepareVaultDeposit requires a `receiver` address to mint the vault shares to.");
      }
      const plan = sdkPrepareVaultDeposit({
        vault: asAddress(vault, "vault"),
        amountUnits: toBaseUnits(amount, DECIMALS.usdg),
        receiver: asAddress(receiver, "receiver"),
        chainId,
      });
      return planToUnsigned(plan);
    },

    prepareVaultWithdrawal: async (vault, shares, receiver) => {
      if (!receiver) {
        throw new Error(
          "prepareVaultWithdrawal requires a `receiver` address to send the withdrawn USDG to.",
        );
      }
      const plan = sdkPrepareVaultWithdrawal({
        vault: asAddress(vault, "vault"),
        sharesUnits: toBaseUnits(shares, DECIMALS.shares),
        receiver: asAddress(receiver, "receiver"),
        chainId,
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
