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
  note?: string;
}

/** A single canonical contract registry entry. */
export interface ContractRegistryEntry {
  key: string;
  address: `0x${string}`;
  description: string;
}

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
  acceptingPublicDeposits: ReadResult<boolean>;
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
