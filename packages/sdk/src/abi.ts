/**
 * Minimal, hand-authored ABIs for the HISS contracts this SDK reads from and
 * encodes calldata against. Each entry is only the fragments the SDK needs —
 * enough to read public state and to build unsigned action calldata. These
 * are re-authored from the public contract interfaces on Robinhood Chain.
 */

/** Standard ERC-20 fragments used for USDG / $HISS reads and approvals. */
export const ERC20_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

/** USDG Creator Vault (flagship + factory clones) read + action fragments. */
export const VAULT_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pricePerShare",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "acceptingPublicDeposits",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "depositWithAcks",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "riskAckHash", type: "bytes32" },
      { name: "jurisdictionAckHash", type: "bytes32" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "sharesOwner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "sharesOwner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    type: "function",
    name: "setPaused",
    stateMutability: "nonpayable",
    inputs: [{ name: "paused", type: "bool" }],
    outputs: [],
  },
] as const;

/**
 * HISS Vault V2 (HissUsdGVaultV2) fragments — the canonical new-deposit vault.
 * V2 has NO public ERC-4626 `deposit`: deposits settle through the request
 * queue. `pricePerShare` returns (pps, availability); exits are the
 * unconditional pro-rata `inKindRedeem` or the vault-side redeem FIFO.
 * Re-authored from the verified frozen-RC read surface.
 */
export const VAULT_V2_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "navUsdg", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "usdgCash",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "queueActive",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "heldAssetCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "heldAssets",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "pricePerShare",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "pps", type: "uint256" },
      { name: "agg", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "pendingRedeemCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "inKindRedeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "sharesOwner", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "requestRedeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "deadlineUnix", type: "uint64" },
    ],
    outputs: [{ name: "id", type: "bytes32" }],
  },
] as const;

/**
 * HissRequestQueue fragments — the V2 deposit / USDG-redemption escrow queue.
 * `enqueue` takes the full QueuedRequest struct; the id MUST equal
 * keccak256(abi.encode("HISS_REQUEST_QUEUE_V1", vault, owner, flow, nonce))
 * (the contract re-derives and rejects a mismatch). Enqueue is idempotent by
 * id — a replayed request never escrows twice.
 */
export const VAULT_V2_QUEUE_ABI = [
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "pendingCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingDepositUsdg",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingRedemptionShares",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "deriveId",
    stateMutability: "pure",
    inputs: [
      { name: "vault", type: "address" },
      { name: "owner", type: "address" },
      { name: "flow", type: "uint8" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [{ name: "id", type: "bytes32" }],
  },
  {
    type: "function",
    name: "enqueue",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "req",
        type: "tuple",
        components: [
          { name: "id", type: "bytes32" },
          { name: "owner", type: "address" },
          { name: "flow", type: "uint8" },
          { name: "amount", type: "uint256" },
          { name: "minOut", type: "uint256" },
          { name: "deadlineUnix", type: "uint64" },
          { name: "seq", type: "uint64" },
          { name: "epochId", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "evidenceHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "seq", type: "uint64" }],
  },
] as const;

/** HissBatchSettler authority flags (settlement / keeper / rebalance lanes). */
export const VAULT_V2_SETTLER_ABI = [
  {
    type: "function",
    name: "settlementActive",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "keeperActive",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "rebalanceActive",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;

/** HissLiveness — permissionless chain-liveness evidence report. */
export const VAULT_V2_LIVENESS_ABI = [
  {
    type: "function",
    name: "liveness",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "state", type: "uint8" },
          { name: "executionAllowed", type: "bool" },
          { name: "displayAllowed", type: "bool" },
          { name: "observedChainId", type: "uint256" },
          { name: "ageSeconds", type: "uint256" },
          { name: "producedBlocks", type: "uint256" },
          { name: "reason", type: "string" },
        ],
      },
    ],
  },
] as const;

/** HissPriceMeshV2 — side-aware safe-notional capacity reads (USDG 6-dec). */
export const VAULT_V2_PRICE_MESH_ABI = [
  {
    type: "function",
    name: "maxSafeBuyNotionalUsdg",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "known", type: "bool" },
      { name: "notionalUsdg", type: "uint256" },
      { name: "zeroReason", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "maxSafeSellNotionalUsdg",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "known", type: "bool" },
      { name: "notionalUsdg", type: "uint256" },
      { name: "zeroReason", type: "uint8" },
    ],
  },
] as const;

/** VaultFactory create fragment (CreateVaultParams tuple). */
export const VAULT_FACTORY_ABI = [
  {
    type: "function",
    name: "createVault",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "feeRecipient", type: "address" },
          { name: "referral", type: "address" },
          { name: "referralBps", type: "uint16" },
          { name: "performanceFeeBps", type: "uint16" },
          { name: "lockupSeconds", type: "uint32" },
          { name: "minSkinBps", type: "uint16" },
          { name: "strategyHash", type: "bytes32" },
          { name: "strategyNoticePeriod", type: "uint32" },
          { name: "usPersonsRestricted", type: "bool" },
          { name: "requiredRiskAckHash", type: "bytes32" },
          { name: "requiredJurisdictionAckHash", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "vault", type: "address" }],
  },
  {
    type: "function",
    name: "isVault",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

/**
 * VaultAssetRegistry read fragments — the on-chain allow-list of
 * vault-holdable assets (enumerable via assetCount/assetList) plus per-asset
 * policy. Authored from the verified interface `IVaultAssetRegistry`.
 */
export const VAULT_ASSET_REGISTRY_ABI = [
  {
    type: "function",
    name: "assetCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "assetList",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "isEnabled",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getAssetPolicy",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "enabled", type: "bool" },
          { name: "liveRebalanceEnabled", type: "bool" },
          { name: "maxAllocationBps", type: "uint16" },
          { name: "oracleFeed", type: "address" },
          { name: "stalenessLimitSeconds", type: "uint64" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
] as const;

/** xHISS staking vault read + action fragments. */
export const XHISS_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "hiss", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "xShares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToShares",
    stateMutability: "view",
    inputs: [{ name: "hissAmount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "previewRedeem",
    stateMutability: "view",
    inputs: [{ name: "xShares", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "cooldownOf",
    stateMutability: "view",
    inputs: [{ name: "staker", type: "address" }],
    outputs: [
      { name: "shares", type: "uint256" },
      { name: "readyAt", type: "uint64" },
      { name: "windowEndsAt", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "isInjector",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [{ name: "hissAmount", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "startCooldown",
    stateMutability: "nonpayable",
    inputs: [{ name: "xShares", type: "uint256" }],
    outputs: [{ name: "readyAt", type: "uint64" }],
  },
  {
    type: "function",
    name: "restartCooldown",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "readyAt", type: "uint64" }],
  },
  { type: "function", name: "cancelCooldown", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "xShares", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "hissOut", type: "uint256" }],
  },
] as const;
