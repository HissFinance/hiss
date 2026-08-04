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
  /**
   * HISS Vault V2 (HissUsdGVaultV2) — the CANONICAL new-deposit vault.
   * Deposits settle through the request queue (epoch batch settlement), not a
   * direct ERC-4626 `deposit`. Queue/keeper/pause state is a live chain read.
   */
  vaultV2: "0x432e90b1b35995ebe46ed93b4db369abfc230e69",
  /** HissRequestQueue — the V2 deposit/USDG-redemption escrow + epoch queue. */
  vaultV2RequestQueue: "0x317d1eec013a91a316858e80bf782496f231729a",
  /** HissBatchSettler — the V2 settlement/keeper/rebalance authority flags. */
  vaultV2BatchSettler: "0x32a60abb48235b158dd515b84c5b039f6dc4f7dd",
  /** HissLiveness — permissionless chain-liveness evidence for V2 execution. */
  vaultV2Liveness: "0x424b634aa340832cf548bb501204a6cf8a6d9136",
  /** HissPriceMeshV2 — side-aware safe-notional capacity evidence for V2. */
  vaultV2PriceMesh: "0xd57e9fc8ff8b1ace73a7d6c32f1101879fdef3c6",
  /**
   * LEGACY flagship "HISS Vault" (V1) — closed to new deposits since the V2
   * cutover; existing balances withdraw/redeem here. Never the default
   * deposit target. Live state (supply, deposit acceptance) is a chain read.
   */
  flagshipVault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
  /** VaultFactory — creates USDG Creator Vaults. */
  vaultFactory: "0x278d237c6890a5f7101296a9021ed9d26c821810",
  /** VaultAssetRegistry — on-chain allow-list of vault-holdable assets. */
  vaultAssetRegistry: "0xcf9609b30f565813b87d1998c8b3b2ad073a4ce1",
  /** xHISS staking vault (share token for staked $HISS). */
  xhissVault: "0x699861d2c546ab86a7f2ae97ffc7af89f3ff67be",
} as const;

/**
 * Vault lifecycle truth: which vault takes NEW deposits (canonical) and which
 * is legacy. Static protocol facts only — supply, queue, pause, and capacity
 * state are ALWAYS live chain reads, never values baked in here.
 */
export const VAULT_LIFECYCLE = {
  /** The canonical new-deposit vault (V2, queue-routed epoch settlement). */
  canonicalDepositVault: ADDRESSES.vaultV2,
  canonicalLabel: "HISS Vault V2 — canonical new-deposit vault (queue-routed epoch settlement, 24/7 lanes)",
  /** The legacy V1 flagship — returned separately, never as the deposit default. */
  legacyV1Vault: ADDRESSES.flagshipVault,
  legacyLabel:
    "HISS Vault (flagship V1) — LEGACY: closed to new deposits; existing balances withdraw/redeem here",
} as const;

/**
 * Owner-declared V2 rebalance policy. Rebalancing on the canonical V2 vault is
 * INACTIVE BY POLICY — an owner decision, NOT a fault state (never render it
 * as degraded). If the on-chain settler flag reads `rebalanceActive == true`,
 * the live read wins over this declaration.
 */
export const VAULT_V2_REBALANCE_POLICY = {
  state: "INACTIVE_BY_POLICY",
  label: "Inactive by policy",
  reason:
    "AAPL is currently the only execution-grade Stock Token asset. Initial public operation uses settlement-driven allocation and preserves the current USDG cash reserve.",
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
