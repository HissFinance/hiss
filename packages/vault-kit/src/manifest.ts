/**
 * The vault-candidate manifest: the complete, local description of a vault a
 * creator intends to deploy. Building and hashing a manifest requires no
 * database, API key, or private key — it is pure data plus a deterministic
 * fingerprint.
 */

import { hashCanonical } from "./canonical";
import type { Allocation } from "./allocation";
import { TOTAL_BPS, isNormalized, sumBps } from "./bps";
import type { Fuse } from "./fuses";
import { ROBINHOOD_CHAIN_MAINNET } from "./assets";

/** Schema version for the vault-candidate manifest shape. */
export const VAULT_MANIFEST_SCHEMA_VERSION = "hiss-vault-candidate-1.0.0";

/** How a vault decides when to rebalance. */
export type RebalanceMethod = "calendar" | "drift" | "hybrid" | "manual" | "agent-suggested";

/** Fee configuration for a candidate. */
export interface VaultFees {
  /** Performance fee in bps, charged on profit above the high-water mark. */
  performanceFeeBps: number;
  /** Optional referral fee in bps routed to `referral`. */
  referralBps?: number;
  /** Optional referral recipient address. */
  referral?: string;
}

/** Jurisdiction / acknowledgement configuration. */
export interface VaultJurisdiction {
  usPersonsRestricted: boolean;
  /** keccak256 of the required risk-ack text stored on VaultAccessPolicy. */
  requiredRiskAckHash?: string;
  /** keccak256 of the required source-disclosure (jurisdiction) ack text. */
  requiredJurisdictionAckHash?: string;
}

/** Strategy metadata. */
export interface VaultStrategy {
  summary: string;
  rebalanceMethod: RebalanceMethod;
  /** Notice period, in seconds, before a strategy change takes effect. */
  noticePeriodSeconds: number;
}

/** The base (settlement) asset of the vault. */
export interface VaultBaseAsset {
  symbol: string;
  address: string;
  decimals: number;
}

/** A complete, hashable vault candidate. */
export interface VaultCandidate {
  schemaVersion: string;
  chainId: number;
  name: string;
  symbol: string;
  asset: VaultBaseAsset;
  allocations: Allocation[];
  fees: VaultFees;
  /** Minimum creator skin-in-the-game, in bps of total assets. */
  minSkinBps: number;
  /** Depositor lockup, in seconds. */
  lockupSeconds: number;
  strategy: VaultStrategy;
  jurisdiction: VaultJurisdiction;
  fuses: Fuse[];
  notes?: string[];
  /** Free-form timestamp; excluded from the manifest hash. */
  createdAt?: string;
  /** Free-form timestamp; excluded from the manifest hash. */
  updatedAt?: string;
}

/** Input to {@link createVaultManifest}; sensible defaults fill the rest. */
export interface CreateVaultManifestInput {
  name: string;
  symbol: string;
  asset: VaultBaseAsset;
  allocations: Allocation[];
  fees: VaultFees;
  minSkinBps: number;
  lockupSeconds: number;
  strategy: VaultStrategy;
  jurisdiction: VaultJurisdiction;
  fuses?: Fuse[];
  notes?: string[];
  chainId?: number;
  createdAt?: string;
}

function normAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Assemble a normalized {@link VaultCandidate}. Addresses are lowercased and
 * the schema version is stamped; the allocations are NOT re-normalized here
 * (use the allocation builders first) but their sum is validated.
 */
export function createVaultManifest(input: CreateVaultManifestInput): VaultCandidate {
  const allocations = input.allocations.map((a) => ({ ...a, address: normAddress(a.address) }));
  const sum = sumBps(allocations.map((a) => a.weightBps));
  if (sum !== TOTAL_BPS) {
    throw new Error(
      `createVaultManifest: allocations must sum to ${TOTAL_BPS} bps, got ${sum} — normalize first`,
    );
  }

  return {
    schemaVersion: VAULT_MANIFEST_SCHEMA_VERSION,
    chainId: input.chainId ?? ROBINHOOD_CHAIN_MAINNET,
    name: input.name,
    symbol: input.symbol,
    asset: { ...input.asset, address: normAddress(input.asset.address) },
    allocations,
    fees: {
      ...input.fees,
      ...(input.fees.referral ? { referral: normAddress(input.fees.referral) } : {}),
    },
    minSkinBps: input.minSkinBps,
    lockupSeconds: input.lockupSeconds,
    strategy: input.strategy,
    jurisdiction: input.jurisdiction,
    fuses: input.fuses ?? [],
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  };
}

/**
 * Deterministic fingerprint of a candidate's identity-bearing content.
 * Timestamps (`createdAt`, `updatedAt`) are excluded so re-serializing an
 * unchanged candidate yields the same hash.
 */
export function manifestHash(candidate: VaultCandidate): string {
  const { createdAt: _c, updatedAt: _u, ...content } = candidate;
  return hashCanonical(content);
}

/** Recompute the hash and compare it against an expected value. */
export function verifyManifestHash(candidate: VaultCandidate, expectedHash: string): boolean {
  return manifestHash(candidate) === expectedHash;
}

/** True when the candidate's allocations are valid bps summing to 10,000. */
export function hasNormalizedAllocations(candidate: VaultCandidate): boolean {
  return isNormalized(candidate.allocations.map((a) => a.weightBps));
}
