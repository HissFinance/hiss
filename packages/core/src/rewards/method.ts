// SPDX-License-Identifier: Apache-2.0
/**
 * HISS_REWARD_METHOD_V1 — the public methodology object plus pure, facts-only
 * allocation formulas for the depositor and provider reward legs.
 *
 * NO performance inputs anywhere: no PnL, APY, return, rank, or volatility.
 * Depositor rewards are share-seconds (deposit participation). Provider
 * rewards are quality-weighted (40/30/20/10) and dominance-capped (25%).
 * Depositor rewards vest linearly over 30 days; provider rewards over 90 days.
 *
 * All timestamps and hashers are injected — the module performs no I/O.
 */

import {
  DEPOSITOR_VESTING_BPS,
  PROVIDER_REWARDS_BPS,
  TREASURY_BPS,
  XHISS_STAKER_BPS,
  splitEligibleHiss,
} from "./split.js";
import { proRata, toBase, waterfillCap } from "./math.js";

export const HISS_REWARD_METHOD_VERSION = "HISS_REWARD_METHOD_V1";

/** Depositor leg: 30-day linear vest (seconds). */
export const DEPOSITOR_VEST_SECONDS = 30 * 24 * 60 * 60;
/** Provider leg: 90-day linear vest (seconds). */
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
export const HISS_REWARD_METHOD_V1 = Object.freeze({
  version: HISS_REWARD_METHOD_VERSION,
  split: Object.freeze({
    xHissStakerBps: XHISS_STAKER_BPS,
    depositorBps: DEPOSITOR_VESTING_BPS,
    providerBps: PROVIDER_REWARDS_BPS,
    treasuryBps: TREASURY_BPS,
  }),
  depositor: Object.freeze({
    basis: "share_seconds",
    vestSeconds: DEPOSITOR_VEST_SECONDS,
    dustPolicy: "unallocated_rolls_to_treasury_after_deadline",
  }),
  provider: Object.freeze({
    components: PROVIDER_COMPONENT_BPS,
    dominanceCapBps: PROVIDER_DOMINANCE_CAP_BPS,
    vestSeconds: PROVIDER_VEST_SECONDS,
    dustPolicy: "rollover_to_next_epoch",
    performanceInputsForbidden: true,
  }),
  authorization: Object.freeze({ finalizationRequiresSafe: true, safeThreshold: 2 }),
} as const);

export type HissRewardMethodV1 = typeof HISS_REWARD_METHOD_V1;

// ---------------------------------------------------------------------------
// Pool breakdown
// ---------------------------------------------------------------------------

export type EpochPoolBreakdown = {
  totalEligibleHiss: string;
  xHissStakerPool: string;
  depositorPool: string;
  providerPool: string;
  treasuryPool: string;
};

/** Split an epoch's eligible HISS into the four pools (canonical split math). */
export function epochPoolBreakdown(totalEligibleHiss: string): EpochPoolBreakdown {
  const s = splitEligibleHiss(totalEligibleHiss);
  return {
    totalEligibleHiss: s.totalEligibleHiss,
    xHissStakerPool: s.xHissStakerAmount,
    depositorPool: s.depositorVestingAmount,
    providerPool: s.providerRewardsAmount,
    treasuryPool: s.treasuryAmount,
  };
}

// ---------------------------------------------------------------------------
// Depositor rewards — share-seconds
// ---------------------------------------------------------------------------

/** One constant-balance interval of vault shares held by a depositor. */
export type DepositorShareInterval = {
  depositor: string;
  /** Vault shares held over the interval, base units (decimal string). */
  shares: string;
  /** Interval start (unix seconds, inclusive). */
  startTime: number;
  /** Interval end (unix seconds, exclusive). */
  endTime: number;
};

export type DepositorAllocation = {
  depositor: string;
  amount: string;
  shareSeconds: string;
  vestStart: number;
  vestEnd: number;
};

export type DepositorAllocationResult = {
  version: typeof HISS_REWARD_METHOD_VERSION;
  poolAmount: string;
  totalShareSeconds: string;
  allocations: DepositorAllocation[];
  /** Floor-division remainder, unallocated. */
  dust: string;
};

/**
 * Allocate the depositor pool pro-rata by share-seconds (Σ shares × seconds
 * held) over the epoch. Deterministic ordering (address ascending); floor
 * division per depositor; the remainder is returned as dust (unallocated).
 */
export function allocateDepositorRewards(input: {
  poolAmount: string;
  intervals: DepositorShareInterval[];
  vestStart: number;
}): DepositorAllocationResult {
  const pool = toBase("poolAmount", input.poolAmount);

  const byDepositor = new Map<string, bigint>();
  for (const iv of input.intervals) {
    if (iv.endTime <= iv.startTime) continue;
    const shares = toBase("shares", iv.shares);
    const seconds = BigInt(iv.endTime - iv.startTime);
    const key = iv.depositor.toLowerCase();
    byDepositor.set(key, (byDepositor.get(key) ?? 0n) + shares * seconds);
  }

  const entries = [...byDepositor.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const weights = entries.map(([, ss]) => ss);
  const { amounts, dust } = proRata(pool, weights);
  const totalShareSeconds = weights.reduce((sum, w) => sum + w, 0n);
  const vestEnd = input.vestStart + DEPOSITOR_VEST_SECONDS;

  const allocations: DepositorAllocation[] = entries.map(([depositor, ss], i) => ({
    depositor,
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
// Provider rewards — 40/30/20/10 quality score, 25% dominance cap
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
 * Allocate the provider pool by the 40/30/20/10 quality score (equal /
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
// Linear vesting (mirrors the on-chain distributor for the depositor leg)
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
