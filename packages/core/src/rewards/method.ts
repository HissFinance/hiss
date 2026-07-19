// SPDX-License-Identifier: Apache-2.0
/**
 * HISS_REWARD_METHOD_V2 — the public methodology object plus pure, facts-only
 * allocation formulas for the vault-contributor and vault-provider reward legs.
 *
 * V2 splits verified $HISS trading fees 50/15/15/10/10 (xHISS stakers / vault
 * providers / vault contributors / treasury / economic burn). "Vault
 * contributors" is the current name for the former depositor cohort; the
 * allocation methodology (share-seconds) is unchanged. V1 (50/30/10/10, no
 * burn) is historical.
 *
 * NO performance inputs anywhere: no PnL, APY, return, rank, or volatility.
 * Vault-contributor rewards are share-seconds (deposit participation). Vault-
 * provider rewards are quality-weighted (40/30/20/10) and dominance-capped
 * (25%). Contributor rewards vest linearly over 30 days; provider rewards over
 * 90 days. The economic-burn leg is transferred to the canonical dead address
 * (does NOT reduce totalSupply).
 *
 * All timestamps and hashers are injected — the module performs no I/O.
 */

import {
  VAULT_CONTRIBUTOR_BPS,
  VAULT_PROVIDER_BPS,
  TREASURY_BPS,
  BURN_BPS,
  XHISS_STAKER_BPS,
  splitEligibleHiss,
} from "./split.js";
import { proRata, toBase, waterfillCap } from "./math.js";

export const HISS_REWARD_METHOD_VERSION = "HISS_REWARD_METHOD_V2";

/** Vault-contributor leg: 30-day linear vest (seconds). */
export const VAULT_CONTRIBUTOR_VEST_SECONDS = 30 * 24 * 60 * 60;
/** Vault-provider leg: 90-day linear vest (seconds). */
export const PROVIDER_VEST_SECONDS = 90 * 24 * 60 * 60;

/** Provider component sub-pool split (bps of the provider pool; sum 10000). */
export const PROVIDER_COMPONENT_BPS = Object.freeze({
  equalBps: 4000,
  externalTvlBps: 3000,
  retentionBps: 2000,
  operationalBps: 1000,
});

/** Max share of the provider pool any single provider group may take (25%). */
export const PROVIDER_DOMINANCE_CAP_BPS = 2500;

/** The frozen public methodology bundle. */
export const HISS_REWARD_METHOD_V2 = Object.freeze({
  version: HISS_REWARD_METHOD_VERSION,
  split: Object.freeze({
    xHissStakerBps: XHISS_STAKER_BPS,
    vaultProviderBps: VAULT_PROVIDER_BPS,
    vaultContributorBps: VAULT_CONTRIBUTOR_BPS,
    treasuryBps: TREASURY_BPS,
    burnBps: BURN_BPS,
  }),
  vaultContributor: Object.freeze({
    basis: "share_seconds",
    vestSeconds: VAULT_CONTRIBUTOR_VEST_SECONDS,
    dustPolicy: "unallocated_rolls_to_treasury_after_deadline",
  }),
  vaultProvider: Object.freeze({
    components: PROVIDER_COMPONENT_BPS,
    dominanceCapBps: PROVIDER_DOMINANCE_CAP_BPS,
    vestSeconds: PROVIDER_VEST_SECONDS,
    dustPolicy: "rollover_to_next_epoch",
    performanceInputsForbidden: true,
  }),
  burn: Object.freeze({
    kind: "economic_burn",
    sink: "0x000000000000000000000000000000000000dEaD",
    reducesTotalSupply: false,
  }),
  authorization: Object.freeze({ finalizationRequiresSafe: true, safeThreshold: 2 }),
} as const);

export type HissRewardMethodV2 = typeof HISS_REWARD_METHOD_V2;

// ---------------------------------------------------------------------------
// Pool breakdown
// ---------------------------------------------------------------------------

export type EpochPoolBreakdown = {
  totalEligibleHiss: string;
  xHissStakerPool: string;
  vaultProviderPool: string;
  vaultContributorPool: string;
  treasuryPool: string;
  burnPool: string;
};

/** Split an epoch's eligible HISS into the five pools (canonical split math). */
export function epochPoolBreakdown(totalEligibleHiss: string): EpochPoolBreakdown {
  const s = splitEligibleHiss(totalEligibleHiss);
  return {
    totalEligibleHiss: s.totalEligibleHiss,
    xHissStakerPool: s.xHissStakerAmount,
    vaultProviderPool: s.vaultProviderAmount,
    vaultContributorPool: s.vaultContributorAmount,
    treasuryPool: s.treasuryAmount,
    burnPool: s.burnAmount,
  };
}

// ---------------------------------------------------------------------------
// Vault-contributor rewards — share-seconds
// ---------------------------------------------------------------------------

/** One constant-balance interval of vault shares held by a contributor. */
export type VaultContributorShareInterval = {
  contributor: string;
  /** Vault shares held over the interval, base units (decimal string). */
  shares: string;
  /** Interval start (unix seconds, inclusive). */
  startTime: number;
  /** Interval end (unix seconds, exclusive). */
  endTime: number;
};

export type VaultContributorAllocation = {
  contributor: string;
  amount: string;
  shareSeconds: string;
  vestStart: number;
  vestEnd: number;
};

export type VaultContributorAllocationResult = {
  version: typeof HISS_REWARD_METHOD_VERSION;
  poolAmount: string;
  totalShareSeconds: string;
  allocations: VaultContributorAllocation[];
  /** Floor-division remainder, unallocated. */
  dust: string;
};

/**
 * Allocate the vault-contributor pool pro-rata by share-seconds (Σ shares ×
 * seconds held) over the epoch. Deterministic ordering (address ascending);
 * floor division per contributor; the remainder is returned as dust
 * (unallocated).
 */
export function allocateVaultContributorRewards(input: {
  poolAmount: string;
  intervals: VaultContributorShareInterval[];
  vestStart: number;
}): VaultContributorAllocationResult {
  const pool = toBase("poolAmount", input.poolAmount);

  const byContributor = new Map<string, bigint>();
  for (const iv of input.intervals) {
    if (iv.endTime <= iv.startTime) continue;
    const shares = toBase("shares", iv.shares);
    const seconds = BigInt(iv.endTime - iv.startTime);
    const key = iv.contributor.toLowerCase();
    byContributor.set(key, (byContributor.get(key) ?? 0n) + shares * seconds);
  }

  const entries = [...byContributor.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const weights = entries.map(([, ss]) => ss);
  const { amounts, dust } = proRata(pool, weights);
  const totalShareSeconds = weights.reduce((sum, w) => sum + w, 0n);
  const vestEnd = input.vestStart + VAULT_CONTRIBUTOR_VEST_SECONDS;

  const allocations: VaultContributorAllocation[] = entries.map(([contributor, ss], i) => ({
    contributor,
    amount: amounts[i]!.toString(),
    shareSeconds: ss.toString(),
    vestStart: input.vestStart,
    vestEnd,
  }));

  return {
    version: HISS_REWARD_METHOD_VERSION,
    poolAmount: pool.toString(),
    totalShareSeconds: totalShareSeconds.toString(),
    allocations,
    dust: dust.toString(),
  };
}

// ---------------------------------------------------------------------------
// Vault-provider rewards — 40/30/20/10 quality score, 25% dominance cap
// ---------------------------------------------------------------------------

/** Facts-only provider group input (exclusions already applied upstream). */
export type ProviderGroupInput = {
  registryKey: string;
  eligible: boolean;
  /** Σ external vault value × days over the epoch, base units (decimal string). */
  externalTvlDays: string;
  /** Retention score, any consistent scaled unit (decimal string). */
  retentionScore: string;
  /** Operational-quality score in basis points [0, 10000]. */
  operationalBps: number;
};

export type ProviderAllocation = {
  registryKey: string;
  amount: string;
  capApplied: boolean;
  vestStart: number;
  vestEnd: number;
};

export type ProviderAllocationResult = {
  version: typeof HISS_REWARD_METHOD_VERSION;
  poolAmount: string;
  eligibleGroupCount: number;
  allocations: ProviderAllocation[];
  /** Amount that could not be placed under the cap — rolls to the next epoch. */
  rolloverToNextEpoch: string;
};

/**
 * Allocate the vault-provider pool by the 40/30/20/10 quality score (equal /
 * external-TVL-days / retention / operational), then apply the 25% dominance
 * cap with water-fill redistribution. Ineligible groups get zero. No
 * performance inputs exist. Overflow that cannot be placed rolls to the next
 * epoch (never back to the capped group, never to treasury).
 */
export function allocateProviderRewards(input: {
  poolAmount: string;
  groups: ProviderGroupInput[];
  vestStart: number;
}): ProviderAllocationResult {
  const pool = toBase("poolAmount", input.poolAmount);
  const eligible = input.groups.filter((g) => g.eligible);
  const vestEnd = input.vestStart + PROVIDER_VEST_SECONDS;

  if (eligible.length === 0 || pool === 0n) {
    return {
      version: HISS_REWARD_METHOD_VERSION,
      poolAmount: pool.toString(),
      eligibleGroupCount: eligible.length,
      allocations: eligible.map((g) => ({
        registryKey: g.registryKey,
        amount: "0",
        capApplied: false,
        vestStart: input.vestStart,
        vestEnd,
      })),
      rolloverToNextEpoch: pool.toString(),
    };
  }

  const equalPool = (pool * BigInt(PROVIDER_COMPONENT_BPS.equalBps)) / 10_000n;
  const tvlPool = (pool * BigInt(PROVIDER_COMPONENT_BPS.externalTvlBps)) / 10_000n;
  const retentionPool = (pool * BigInt(PROVIDER_COMPONENT_BPS.retentionBps)) / 10_000n;
  const operationalPool = (pool * BigInt(PROVIDER_COMPONENT_BPS.operationalBps)) / 10_000n;

  const equalWeights = eligible.map(() => 1n);
  const tvlWeights = eligible.map((g) => toBase("externalTvlDays", g.externalTvlDays));
  const retentionWeights = eligible.map((g) => toBase("retentionScore", g.retentionScore));
  const operationalWeights = eligible.map((g) => BigInt(g.operationalBps));

  const equal = proRata(equalPool, equalWeights).amounts;
  const tvl = proRata(tvlPool, tvlWeights).amounts;
  const retention = proRata(retentionPool, retentionWeights).amounts;
  const operational = proRata(operationalPool, operationalWeights).amounts;

  const raw = eligible.map((_g, i) => equal[i]! + tvl[i]! + retention[i]! + operational[i]!);

  const cap = (pool * BigInt(PROVIDER_DOMINANCE_CAP_BPS)) / 10_000n;
  const { capped, unplaceable } = waterfillCap(raw, cap);

  const allocations: ProviderAllocation[] = eligible.map((g, i) => ({
    registryKey: g.registryKey,
    amount: capped[i]!.toString(),
    capApplied: raw[i]! > cap,
    vestStart: input.vestStart,
    vestEnd,
  }));

  return {
    version: HISS_REWARD_METHOD_VERSION,
    poolAmount: pool.toString(),
    eligibleGroupCount: eligible.length,
    allocations,
    rolloverToNextEpoch: unplaceable.toString(),
  };
}

// ---------------------------------------------------------------------------
// Linear vesting (mirrors the on-chain distributor for the contributor leg)
// ---------------------------------------------------------------------------

/**
 * The vested (unlocked) portion of `total` at `now`, linear between
 * `vestStart` and `vestEnd`. 0 before start, `total` at/after end. Pure
 * bigint floor division.
 */
export function linearVested(total: bigint, vestStart: number, vestEnd: number, now: number): bigint {
  if (vestEnd <= vestStart) throw new Error(`linearVested: invalid window [${vestStart}, ${vestEnd})`);
  if (total < 0n) throw new Error("linearVested: total must be non-negative");
  if (now < vestStart) return 0n;
  if (now >= vestEnd) return total;
  return (total * BigInt(now - vestStart)) / BigInt(vestEnd - vestStart);
}
