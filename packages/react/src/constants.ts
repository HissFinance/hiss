/**
 * Public, well-known constants for the HISS Finance protocol on Robinhood
 * Chain. These are addresses and network values published for the mainnet
 * deployment (chain 4663). They contain no secrets and no keyed endpoints.
 *
 * On-chain state (balances, share rates, deposit availability) is always a
 * live read — never infer live state from these constants alone.
 */

export const ROBINHOOD_CHAIN_ID = 4663 as const;
export const ROBINHOOD_CHAIN_NAME = "Robinhood Chain" as const;

/** Public JSON-RPC endpoint (no API key). */
export const ROBINHOOD_PUBLIC_RPC_URL = "https://rpc.mainnet.chain.robinhood.com" as const;

/** Public block explorer base URL. */
export const ROBINHOOD_EXPLORER_URL = "https://robinhoodchain.blockscout.com" as const;

/** Well-known protocol addresses on chain 4663. */
export const HISS_ADDRESSES = {
  /** $HISS ERC-20 token (18 decimals, fixed supply). */
  hissToken: "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3",
  /** xHISS single-asset staking vault (share token, 18 decimals). */
  xhissVault: "0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be",
  /** Flagship USDG Creator Vault. */
  flagshipVault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
  /** USDG settlement asset used by Creator Vaults. */
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
} as const;

/**
 * xHISS timing constants, mirrored from the deployed vault for display.
 * These are immutable contract parameters; treat them as read-only labels,
 * not as a promise about any particular position.
 */
export const XHISS_TIMING = {
  /** Cooldown before a redeem window opens. */
  cooldownSeconds: 72 * 3600,
  /** Window during which redeem is allowed after cooldown completes. */
  redeemWindowSeconds: 2 * 24 * 3600,
  /** Duration over which a funded reward injection drips into share value. */
  rewardDripSeconds: 24 * 3600,
  shareSymbol: "xHISS",
  shareName: "Staked HISS",
} as const;

/**
 * Approved, mechanical xHISS framing. Render verbatim where you surface
 * staking copy. Staking is not a yield product and these strings never
 * promise a return.
 */
export const XHISS_COPY = {
  headline:
    "Stake HISS, receive xHISS. Fee-funded HISS injections increase the HISS-per-xHISS share value over time.",
  disclaimer: "Not a performance claim.",
  historicalNote: "Historical fee distributions are not forecasts.",
  exitNote:
    "Exits require a 72-hour cooldown, then a 2-day redeem window. Injections drip into the share value over 24 hours.",
} as const;

/** Build a block-explorer URL for an address on the given chain. */
export function explorerAddressUrl(
  address: string,
  explorerBaseUrl: string = ROBINHOOD_EXPLORER_URL,
): string {
  return `${explorerBaseUrl.replace(/\/$/, "")}/address/${address}`;
}

/** Build a block-explorer URL for a transaction hash. */
export function explorerTxUrl(txHash: string, explorerBaseUrl: string = ROBINHOOD_EXPLORER_URL): string {
  return `${explorerBaseUrl.replace(/\/$/, "")}/tx/${txHash}`;
}
