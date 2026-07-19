/**
 * SDK integration seam.
 *
 * This is the ONLY module in the CLI that imports `@hiss-finance/sdk`. It
 * builds a concrete {@link HissClient} from the public SDK so that command
 * handlers stay transport-agnostic and unit-testable with a mock. The SDK is
 * read-and-prepare only: it never signs, submits, or holds keys, and every
 * prepared transaction is returned unsigned.
 */

import { createHissClient as createSdkClient } from "@hiss-finance/sdk";
import type { HissClient, JsonRecord, UnsignedTx } from "./types.js";

export interface ClientOptions {
  /** JSON-RPC endpoint for Robinhood Chain. Read-only usage. */
  rpcUrl?: string;
  /** Robinhood Chain id (4663 mainnet default, 46630 testnet). */
  chainId?: number;
}

/** Normalize any SDK-prepared transaction into a strictly-unsigned shape. */
function asUnsigned(tx: JsonRecord): UnsignedTx {
  return {
    chainId: Number(tx.chainId ?? 4663),
    to: String(tx.to ?? ""),
    data: String(tx.data ?? "0x"),
    value: String(tx.value ?? "0"),
    description: String(tx.description ?? "Unsigned HISS transaction."),
    signed: false,
  };
}

/**
 * Build a HissClient backed by the public SDK. The SDK client is expected to
 * expose the same read + prepare surface; results are passed through
 * unchanged for reads and normalized to unsigned transactions for prepares.
 */
export function createHissClient(opts: ClientOptions = {}): HissClient {
  type SdkFn = (...args: unknown[]) => Promise<unknown>;
  const sdk = createSdkClient({
    rpcUrl: opts.rpcUrl,
    chainId: opts.chainId ?? 4663,
  }) as unknown as Record<string, SdkFn | undefined>;

  const invoke = async (method: string, ...args: unknown[]): Promise<unknown> => {
    const fn = sdk[method];
    if (typeof fn !== "function") {
      throw new Error(`@hiss-finance/sdk client does not implement "${method}".`);
    }
    return fn(...args);
  };
  const call = async (method: string, ...args: unknown[]): Promise<JsonRecord> =>
    (await invoke(method, ...args)) as JsonRecord;
  const callList = async (method: string, ...args: unknown[]): Promise<JsonRecord[]> =>
    (await invoke(method, ...args)) as JsonRecord[];
  const prepare = async (method: string, ...args: unknown[]): Promise<UnsignedTx> =>
    asUnsigned((await invoke(method, ...args)) as JsonRecord);

  return {
    getProtocolStatus: () => call("getProtocolStatus"),
    getContractRegistry: () => call("getContractRegistry"),
    listVaults: () => callList("listVaults"),
    getVault: (ref) => call("getVault", ref),
    getVaultHoldings: (vault) => call("getVaultHoldings", vault),
    getVaultPerformance: (vault) => call("getVaultPerformance", vault),
    getStakingStatus: () => call("getStakingStatus"),
    getRewardStatus: () => call("getRewardStatus"),
    getVaultContributorReward: (address) => call("getVaultContributorReward", address),
    getProviderReward: (groupId) => call("getProviderReward", groupId),
    getReceipt: (id) => call("getReceipt", id),
    getSupportedAssets: () => callList("getSupportedAssets"),
    getFeeSchedule: () => call("getFeeSchedule"),
    prepareVaultCreation: (manifest) => prepare("prepareVaultCreation", manifest),
    prepareVaultDeposit: (vault, amount) => prepare("prepareVaultDeposit", vault, amount),
    prepareVaultWithdrawal: (vault, shares) => prepare("prepareVaultWithdrawal", vault, shares),
    prepareHissStake: (amount) => prepare("prepareHissStake", amount),
    prepareXhissCooldown: (xhissAmount) => prepare("prepareXhissCooldown", xhissAmount),
    prepareXhissRedeem: () => prepare("prepareXhissRedeem"),
  };
}
