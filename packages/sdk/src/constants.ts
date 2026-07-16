/**
 * Public, verifiable constants for HISS Finance on Robinhood Chain.
 *
 * Every address here is a public, on-chain contract. Nothing secret lives in
 * this file. Deposit/staking state (open, paused, balances, rates) is always a
 * LIVE chain read — never a value baked in here.
 */

/** Robinhood Chain mainnet id. */
export const ROBINHOOD_CHAIN_MAINNET = 4663;
/** Robinhood Chain testnet id. */
export const ROBINHOOD_CHAIN_TESTNET = 46630;

/** The chain ids this SDK will prepare actions for. */
export const SUPPORTED_CHAIN_IDS = [ROBINHOOD_CHAIN_MAINNET, ROBINHOOD_CHAIN_TESTNET] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

/** Default public JSON-RPC endpoint for Robinhood Chain mainnet (no key). */
export const ROBINHOOD_MAINNET_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";

/** Public Blockscout explorer base for Robinhood Chain mainnet. */
export const ROBINHOOD_MAINNET_EXPLORER = "https://robinhoodchain.blockscout.com";

/**
 * Canonical public contract addresses (chain 4663), stored lowercase so
 * viem's `getAddress` checksums them deterministically without ever throwing.
 * These are the verifiable anchors for reads and for encoding action calldata.
 */
export const ADDRESSES = {
  /** USDG settlement asset (6 decimals). */
  usdg: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
  /** $HISS protocol token (18 decimals). */
  hiss: "0x47162135cc8fb253f939bd70e3d2b83075eaeba3",
  /** Flagship "HISS Vault" — a live EIP-1167 proxy (deposit target). */
  flagshipVault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
  /** VaultFactory — creates USDG Creator Vaults. */
  vaultFactory: "0x278d237c6890a5f7101296a9021ed9d26c821810",
  /** xHISS staking vault (share token for staked $HISS). */
  xhissVault: "0x699861d2c546ab86a7f2ae97ffc7af89f3ff67be",
} as const;

/** Known token decimals for the canonical assets. */
export const DECIMALS = {
  usdg: 6,
  hiss: 18,
  /** xHISS shares and most vault shares are 18-decimal. */
  shares: 18,
} as const;

/** xHISS timing constants (immutable in the deployed contract). */
export const XHISS_TIMING = {
  /** Cooldown before a redeem window opens (72h). */
  cooldownSeconds: 259_200,
  /** Redeem window length once cooldown elapses (2 days). */
  redeemWindowSeconds: 172_800,
  /** Linear drip period for injected rewards (24h). */
  dripSeconds: 86_400,
} as const;

/** The two on-chain ack slots a `depositWithAcks` call presents. */
export const DEPOSIT_ACK_VERSIONS = {
  risk: "hiss-vault-depositor-risk-ack-v1",
  sourceDisclosure: "hiss-vault-source-disclosure-ack-v1",
} as const;

/** True when `chainId` is a chain this SDK supports. */
export function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(chainId);
}
