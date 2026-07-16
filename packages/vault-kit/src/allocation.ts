/**
 * Allocation builders for HISS vault candidates.
 *
 * Every builder returns allocations whose `weightBps` sum to exactly
 * {@link TOTAL_BPS} (10,000). Builders are pure and deterministic — no chain
 * reads, no randomness — so a creator can compose a full target basket
 * entirely locally.
 */

import { TOTAL_BPS, normalizeToTotalBps, sumBps } from "./bps";

/** One line of a vault's target allocation. */
export interface Allocation {
  /** Human ticker/label, e.g. "USDG", "TSLA-x". */
  symbol: string;
  /** Token contract address (lowercased on normalize). */
  address: string;
  /** Target weight in basis points; the set sums to 10,000. */
  weightBps: number;
  /** When true, the weight is pinned and normalization flows around it. */
  locked?: boolean;
}

/** Input to {@link buildAllocation}: relative weights that need normalizing. */
export interface AllocationInput {
  symbol: string;
  address: string;
  /** Any non-negative relative weight; normalized to bps for you. */
  weight: number;
  locked?: boolean;
}

function normAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Equal-weight allocation across the given assets, summing to exactly 10,000
 * bps (largest-remainder rounding gives the leftover bps to the earliest
 * entries).
 */
export function equalWeightAllocation(assets: readonly { symbol: string; address: string }[]): Allocation[] {
  if (assets.length === 0) throw new Error("equalWeightAllocation: need at least one asset");
  const weights = normalizeToTotalBps(assets.map(() => 1));
  return assets.map((a, i) => ({
    symbol: a.symbol,
    address: normAddress(a.address),
    weightBps: weights[i]!,
  }));
}

/**
 * Build an allocation from arbitrary relative weights, normalized to exactly
 * 10,000 bps.
 */
export function buildAllocation(inputs: readonly AllocationInput[]): Allocation[] {
  if (inputs.length === 0) throw new Error("buildAllocation: need at least one asset");
  const weights = normalizeToTotalBps(inputs.map((i) => i.weight));
  return inputs.map((input, i) => ({
    symbol: input.symbol,
    address: normAddress(input.address),
    weightBps: weights[i]!,
    ...(input.locked ? { locked: true } : {}),
  }));
}

/**
 * Normalize an allocation while respecting `locked` weights. Locked entries
 * keep their exact bps; the remaining budget (10,000 − sum of locked) is
 * distributed proportionally across the unlocked entries. Throws if locked
 * weights already exceed the total.
 */
export function normalizeWithLocks(allocations: readonly Allocation[]): Allocation[] {
  if (allocations.length === 0) throw new Error("normalizeWithLocks: empty allocation");

  const lockedSum = sumBps(allocations.filter((a) => a.locked).map((a) => a.weightBps));
  if (lockedSum > TOTAL_BPS) {
    throw new Error(`normalizeWithLocks: locked weights sum to ${lockedSum} bps, over 10,000`);
  }

  const unlocked = allocations.filter((a) => !a.locked);
  if (unlocked.length === 0) {
    if (lockedSum !== TOTAL_BPS) {
      throw new Error(`normalizeWithLocks: all weights locked but sum to ${lockedSum}, not 10,000`);
    }
    return allocations.map((a) => ({ ...a, address: normAddress(a.address) }));
  }

  const budget = TOTAL_BPS - lockedSum;
  const unlockedWeights = normalizeToTotalBps(
    unlocked.map((a) => (a.weightBps > 0 ? a.weightBps : 1)),
    budget,
  );

  let u = 0;
  return allocations.map((a) => {
    const address = normAddress(a.address);
    if (a.locked) return { ...a, address };
    return { ...a, address, weightBps: unlockedWeights[u++]! };
  });
}

/**
 * Carve a reserve leg (typically the base asset held as dry powder) out of an
 * allocation. The existing allocations are rescaled to fill (10,000 −
 * reserveBps) and a reserve entry is appended (or merged if the reserve asset
 * is already present).
 */
export function withReserve(
  allocations: readonly Allocation[],
  reserve: { symbol: string; address: string; reserveBps: number },
): Allocation[] {
  const { reserveBps } = reserve;
  if (!Number.isInteger(reserveBps) || reserveBps < 0 || reserveBps > TOTAL_BPS) {
    throw new Error(`withReserve: reserveBps must be an integer in [0, 10000], got ${reserveBps}`);
  }
  if (reserveBps === TOTAL_BPS) {
    return [{ symbol: reserve.symbol, address: normAddress(reserve.address), weightBps: TOTAL_BPS }];
  }

  const budget = TOTAL_BPS - reserveBps;
  const rescaled = normalizeToTotalBps(
    allocations.map((a) => a.weightBps),
    budget,
  );
  const out: Allocation[] = allocations.map((a, i) => ({
    ...a,
    address: normAddress(a.address),
    weightBps: rescaled[i]!,
  }));

  const reserveAddr = normAddress(reserve.address);
  const existing = out.find((a) => a.address === reserveAddr);
  if (existing) {
    existing.weightBps += reserveBps;
  } else {
    out.push({ symbol: reserve.symbol, address: reserveAddr, weightBps: reserveBps });
  }
  return out;
}

/** A single drift line comparing a target weight to the current weight. */
export interface AllocationDrift {
  symbol: string;
  address: string;
  targetBps: number;
  currentBps: number;
  /** currentBps − targetBps (positive = overweight). */
  driftBps: number;
}

/** Result of {@link compareAllocations}. */
export interface AllocationComparison {
  entries: AllocationDrift[];
  /** Largest absolute drift across all entries, in bps. */
  maxAbsDriftBps: number;
  /** Sum of absolute drifts / 2 — the fraction of the book that must move. */
  turnoverBps: number;
}

/**
 * Compare a target allocation against a current allocation (by address).
 * Assets present in only one side are compared against an implied 0 bps.
 */
export function compareAllocations(
  target: readonly Allocation[],
  current: readonly Allocation[],
): AllocationComparison {
  const byAddr = new Map<string, { symbol: string; targetBps: number; currentBps: number }>();

  for (const a of target) {
    const addr = normAddress(a.address);
    byAddr.set(addr, { symbol: a.symbol, targetBps: a.weightBps, currentBps: 0 });
  }
  for (const a of current) {
    const addr = normAddress(a.address);
    const row = byAddr.get(addr);
    if (row) row.currentBps = a.weightBps;
    else byAddr.set(addr, { symbol: a.symbol, targetBps: 0, currentBps: a.weightBps });
  }

  const entries: AllocationDrift[] = [...byAddr.entries()]
    .map(([address, r]) => ({
      symbol: r.symbol,
      address,
      targetBps: r.targetBps,
      currentBps: r.currentBps,
      driftBps: r.currentBps - r.targetBps,
    }))
    .sort((a, b) => Math.abs(b.driftBps) - Math.abs(a.driftBps) || (a.address < b.address ? -1 : 1));

  const maxAbsDriftBps = entries.reduce((m, e) => Math.max(m, Math.abs(e.driftBps)), 0);
  const turnoverBps = Math.round(entries.reduce((s, e) => s + Math.abs(e.driftBps), 0) / 2);

  return { entries, maxAbsDriftBps, turnoverBps };
}
