/**
 * Client contract shared by CLI command handlers.
 *
 * This interface is intentionally free of any import from `@hiss-finance/sdk`
 * so command handlers (and their tests) depend only on the shape, not the
 * transport. The real implementation is built from the SDK in `client.ts`;
 * tests inject a mock. Every method is READ or PREPARE — none signs, submits,
 * or broadcasts a transaction.
 */

/** An unsigned transaction the user may review and submit with their own wallet. */
export interface UnsignedTx {
  /** Robinhood Chain id the transaction targets. */
  chainId: number;
  /** Target contract address — always shown, never hidden. */
  to: string;
  /** ABI-encoded calldata. */
  data: string;
  /** Wei value, as a decimal string. */
  value: string;
  /** Human description of exactly what submitting this would do. */
  description: string;
  /** Always false — HISS prepares, it never sends. */
  signed: false;
  /** Human-readable function signature (optional; surfaced from the SDK plan). */
  function?: string;
  /** Decoded, human-readable arguments (optional; surfaced from the SDK plan). */
  decodedArgs?: Record<string, string>;
  /** Deterministic plan hash over the execution-relevant fields (optional). */
  planHash?: string;
  /** Non-fatal cautions to read before signing (optional). */
  warnings?: string[];
  /** Acknowledgements affirmed by signing (optional, verbatim). */
  requiredAcknowledgments?: string[];
}

export type JsonRecord = Record<string, unknown>;

/** Read + prepare surface over HISS Finance. No method ever executes. */
export interface HissClient {
  // ---- reads ----
  getProtocolStatus(): Promise<JsonRecord>;
  /**
   * The contract registry as a JSON OBJECT: `{ chainId, observedAt, entries }`.
   * Never a bare array. `observedAt` may be supplied for deterministic output.
   */
  getContractRegistry(observedAt?: string): Promise<JsonRecord>;
  listVaults(): Promise<JsonRecord[]>;
  getVault(ref: string): Promise<JsonRecord>;
  /**
   * OPTIONAL: live lane/status snapshot for the canonical V2 vault (queue,
   * keeper, rebalancing-by-policy, capacity, block + source). Absent on
   * clients that predate V2.
   */
  getVaultV2Status?(): Promise<JsonRecord>;
  getVaultHoldings(vault: string): Promise<JsonRecord>;
  getVaultPerformance(vault: string): Promise<JsonRecord>;
  getStakingStatus(): Promise<JsonRecord>;
  getRewardStatus(): Promise<JsonRecord>;
  getVaultContributorReward(address: string): Promise<JsonRecord>;
  getProviderReward(groupId: string): Promise<JsonRecord>;
  getReceipt(id: string): Promise<JsonRecord>;
  getSupportedAssets(): Promise<JsonRecord>;
  getFeeSchedule(): Promise<JsonRecord>;
  // ---- prepares (unsigned only) ----
  prepareVaultCreation(manifest: JsonRecord): Promise<UnsignedTx>;
  /**
   * `opts` (all optional, V2 queue routing only): `nonce`, `deadlineUnix`,
   * `minOutShares` (decimal shares string). Ignored on V1-style vaults.
   */
  prepareVaultDeposit(
    vault: string,
    amount: string,
    receiver?: string,
    opts?: JsonRecord,
  ): Promise<UnsignedTx>;
  /**
   * `opts` (all optional, V2 only): `mode` ("in_kind" default | "queue_usdg"),
   * `minOutUsdg` (decimal USDG string), `nonce`, `deadlineUnix`.
   */
  prepareVaultWithdrawal(
    vault: string,
    shares: string,
    receiver?: string,
    opts?: JsonRecord,
  ): Promise<UnsignedTx>;
  prepareHissStake(amount: string): Promise<UnsignedTx>;
  prepareXhissCooldown(xhissAmount: string): Promise<UnsignedTx>;
  prepareXhissRedeem(xShares?: string, receiver?: string): Promise<UnsignedTx>;
}
