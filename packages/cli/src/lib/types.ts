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
}

export type JsonRecord = Record<string, unknown>;

/** Read + prepare surface over HISS Finance. No method ever executes. */
export interface HissClient {
  // ---- reads ----
  getProtocolStatus(): Promise<JsonRecord>;
  getContractRegistry(): Promise<JsonRecord>;
  listVaults(): Promise<JsonRecord[]>;
  getVault(ref: string): Promise<JsonRecord>;
  getVaultHoldings(vault: string): Promise<JsonRecord>;
  getVaultPerformance(vault: string): Promise<JsonRecord>;
  getStakingStatus(): Promise<JsonRecord>;
  getRewardStatus(): Promise<JsonRecord>;
  getDepositorReward(address: string): Promise<JsonRecord>;
  getProviderReward(groupId: string): Promise<JsonRecord>;
  getReceipt(id: string): Promise<JsonRecord>;
  getSupportedAssets(): Promise<JsonRecord[]>;
  getFeeSchedule(): Promise<JsonRecord>;
  // ---- prepares (unsigned only) ----
  prepareVaultCreation(manifest: JsonRecord): Promise<UnsignedTx>;
  prepareVaultDeposit(vault: string, amount: string): Promise<UnsignedTx>;
  prepareVaultWithdrawal(vault: string, shares: string): Promise<UnsignedTx>;
  prepareHissStake(amount: string): Promise<UnsignedTx>;
  prepareXhissCooldown(xhissAmount: string): Promise<UnsignedTx>;
  prepareXhissRedeem(): Promise<UnsignedTx>;
}
