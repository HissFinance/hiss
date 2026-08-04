/**
 * Shared types for the HISS SDK: the typed ActionPlan returned by every
 * `prepare*` method, and the fail-soft envelopes returned by reads.
 */

import type { Hex } from "viem";

/**
 * A typed, UNSIGNED plan describing exactly one on-chain call. An ActionPlan
 * is data for review and signing by the caller's own wallet or Safe. This SDK
 * never signs it and never submits it.
 */
export interface ActionPlan {
  /** Chain the call is intended for. */
  chainId: number;
  /** Contract the call targets. */
  target: `0x${string}`;
  /** Human-readable function signature, e.g. "depositWithAcks(uint256,address,bytes32,bytes32)". */
  function: string;
  /** Decoded, human-readable arguments (bigints rendered as decimal strings). */
  decodedArgs: Record<string, string>;
  /** ABI-encoded calldata to place in the transaction's `data` field. */
  calldata: Hex;
  /** Native value to send, in wei, as a decimal string (usually "0"). */
  value: string;
  /** One-line description of what signing this plan does. */
  summary: string;
  /** Non-fatal cautions the caller should read before signing. */
  warnings: string[];
  /** Acknowledgements the caller is affirming by signing (verbatim). */
  requiredAcknowledgments: string[];
  /** keccak256 over the execution-relevant fields (time-independent). */
  planHash: Hex;
  /** Optional advisory expiry (ISO-8601); not part of the plan hash. */
  expiry: string | null;
}

/** A read either resolved from chain, or is explicitly degraded — never faked. */
export type ReadState = "live" | "degraded";

/**
 * A fail-soft read envelope. On success `state` is "live" and `value` holds
 * the chain read. On failure `state` is "degraded", `value` is null, and
 * `error` explains why. Callers must treat "degraded" as UNKNOWN — never as a
 * zero, and never as "not deployed" or "live".
 */
export interface ReadResult<T> {
  state: ReadState;
  value: T | null;
  error?: string;
  /** The block the read was taken at, when known. */
  blockNumber?: string;
}

/** Protocol-level status snapshot. */
export interface ProtocolStatus {
  chainId: number;
  rpcUrl: string;
  reachable: boolean;
  blockNumber: string | null;
  /** Static vault lifecycle facts: canonical V2 new-deposit vault + legacy V1. */
  vaults?: {
    canonicalDepositVault: string;
    canonicalLabel: string;
    legacyV1Vault: string;
    legacyLabel: string;
    note: string;
  };
  note?: string;
}

/** A single canonical contract registry entry. */
export interface ContractRegistryEntry {
  key: string;
  address: `0x${string}`;
  description: string;
}

/** Deployment status of a registry entry derived from its runtime bytecode. */
export type ContractDeploymentStatus = "deployed" | "no_bytecode" | "unknown";

/**
 * A registry entry enriched with a live runtime-bytecode observation. Fail-soft:
 * a degraded `eth_getCode` read yields `status: "unknown"` and a null
 * `runtimeCodeHash` — never a fabricated hash and never a false "no_bytecode".
 */
export interface ContractRegistryReportEntry {
  /** Stable machine name (the registry key, e.g. "flagshipVault"). */
  name: string;
  /** Contract address, always shown. */
  address: `0x${string}`;
  /** keccak256 of the runtime bytecode when observed live; null when degraded or absent. */
  runtimeCodeHash: `0x${string}` | null;
  /** deployed | no_bytecode | unknown (degraded). */
  status: ContractDeploymentStatus;
}

/**
 * The contract registry as a JSON OBJECT (never a bare array): the observed
 * chain id, an ISO-8601 observation timestamp, and the enriched entries. This
 * is the object shape MCP `structuredContent` requires.
 */
export interface ContractRegistryReport {
  chainId: number;
  observedAt: string;
  entries: ContractRegistryReportEntry[];
}

/** Static lifecycle designation for a known HISS vault. */
export type VaultLifecycle = "canonical_v2" | "legacy_v1" | "unknown";

/** A vault's public read surface. */
export interface VaultReads {
  address: `0x${string}`;
  chainId: number;
  name: ReadResult<string>;
  symbol: ReadResult<string>;
  asset: ReadResult<`0x${string}`>;
  totalAssets: ReadResult<string>;
  totalSupply: ReadResult<string>;
  pricePerShare: ReadResult<string>;
  /** V1-style direct-deposit gate; absent/degraded on V2 (queue-routed). */
  acceptingPublicDeposits: ReadResult<boolean>;
  /**
   * Static lifecycle designation: `canonical_v2` = the canonical new-deposit
   * vault; `legacy_v1` = the legacy flagship (closed to new deposits, returned
   * separately, never the deposit default). Live numbers stay chain reads.
   */
  lifecycle?: VaultLifecycle;
  /** How deposits route: "request_queue" (V2) or "erc4626_deposit" (V1-style). */
  depositRoute?: "request_queue" | "erc4626_deposit";
  /** V2 only: whether the vault's queue lane is owner-armed (live read). */
  queueActive?: ReadResult<boolean>;
  /** V2 only: whether the vault is paused (live read). */
  paused?: ReadResult<boolean>;
  /** Honest, static context for this entry (never a claim about live state). */
  note?: string;
}

/** One asset's side-aware capacity answer from the V2 price mesh. */
export interface VaultV2AssetCapacity {
  token: `0x${string}`;
  symbol: ReadResult<string>;
  buyKnown: boolean | null;
  /** maxSafeBuyNotionalUsdg in USDG base units (6 dec); null = unknown. */
  buyNotionalUsdg: string | null;
  buyZeroReason: number | null;
  sellKnown: boolean | null;
  sellNotionalUsdg: string | null;
  sellZeroReason: number | null;
}

/**
 * The canonical V2 vault's live lane/status snapshot. Every leg is fail-soft:
 * a failed read is null/degraded (UNKNOWN) — never fabricated, never rendered
 * as live or as "not deployed".
 */
export interface VaultV2Status {
  vault: `0x${string}`;
  chainId: number;
  /** Where the reads came from (the RPC endpoint) — always disclosed. */
  source: { rpcUrl: string; blockNumber: string | null; blockTimestampUnix: number | null };
  vaultReads: {
    paused: ReadResult<boolean>;
    totalSupply: ReadResult<string>;
    totalAssets: ReadResult<string>;
    usdgCash: ReadResult<string>;
    queueActive: ReadResult<boolean>;
    pendingRedeemCount: ReadResult<string>;
  };
  queue: {
    address: `0x${string}`;
    paused: ReadResult<boolean>;
    pendingCount: ReadResult<string>;
    pendingDepositUsdg: ReadResult<string>;
    pendingRedemptionShares: ReadResult<string>;
  };
  keeper: {
    /** HEALTHY = keeperActive + fresh liveness; DEGRADED = active but stale evidence. */
    state: "HEALTHY" | "DEGRADED" | "INACTIVE" | "UNKNOWN";
    keeperActive: ReadResult<boolean>;
    settlementActive: ReadResult<boolean>;
    reason: string;
  };
  rebalancing: {
    /** Live settler flag; null = unread. */
    active: boolean | null;
    /** True when inactive by the owner-declared policy (never a fault state). */
    byPolicy: boolean;
    reason: string;
  };
  liveness: {
    state: "UNKNOWN" | "UNAVAILABLE" | "STALE" | "DEGRADED" | "OK" | null;
    executionAllowed: boolean | null;
    ageSeconds: string | null;
  };
  capacity: {
    /** Min over held-asset buy sides, USDG base units; null = unknown. */
    immediateDepositCapacityUsdg: string | null;
    /** Min(sell side, USDG cash), USDG base units; null = unknown. */
    immediateUsdgRedemptionCapacityUsdg: string | null;
    perAsset: VaultV2AssetCapacity[];
  };
  note: string;
}

/** xHISS staking status reads. */
export interface StakingStatus {
  vault: `0x${string}`;
  chainId: number;
  hissToken: ReadResult<`0x${string}`>;
  totalStaked: ReadResult<string>;
  totalShares: ReadResult<string>;
  paused: ReadResult<boolean>;
}

/** A single staker's xHISS position reads. */
export interface StakingPosition {
  vault: `0x${string}`;
  account: `0x${string}`;
  shares: ReadResult<string>;
  redeemableHiss: ReadResult<string>;
  cooldownShares: ReadResult<string>;
  cooldownReadyAt: ReadResult<string>;
  cooldownWindowEndsAt: ReadResult<string>;
}
