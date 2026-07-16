/**
 * Basis-point (bps) math for vault allocations.
 *
 * A HISS vault allocation must sum to EXACTLY 10,000 bps (100%). Floating
 * weights rarely divide cleanly, so normalization uses the largest-remainder
 * (Hamilton) method: floor every share, then hand the leftover bps one at a
 * time to the entries with the largest fractional remainder. The result is a
 * set of integers that sums to exactly the target with minimal rounding bias.
 */

/** Total basis points representing 100%. */
export const TOTAL_BPS = 10_000;

/** A single integer bps value is valid when it is a whole number in [0, 10000]. */
export function isValidBps(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= TOTAL_BPS;
}

/** Sum of a list of bps values. */
export function sumBps(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** True when the values are all valid bps and sum to exactly `total`. */
export function isNormalized(values: readonly number[], total: number = TOTAL_BPS): boolean {
  return values.every(isValidBps) && sumBps(values) === total;
}

/**
 * Distribute `total` bps across `weights` (any non-negative relative numbers)
 * so the result is integers summing to exactly `total`. Uses largest-remainder
 * rounding. Zero weights receive zero. Throws if every weight is zero or any
 * weight is negative / non-finite.
 */
export function normalizeToTotalBps(weights: readonly number[], total: number = TOTAL_BPS): number[] {
  if (weights.length === 0) return [];
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`normalizeToTotalBps: weights must be finite and non-negative, got ${w}`);
    }
  }
  if (!Number.isInteger(total) || total < 0) {
    throw new Error(`normalizeToTotalBps: total must be a non-negative integer, got ${total}`);
  }

  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  if (weightSum <= 0) {
    throw new Error("normalizeToTotalBps: at least one weight must be positive");
  }

  const exact = weights.map((w) => (w / weightSum) * total);
  const floored = exact.map((v) => Math.floor(v));
  let remainder = total - floored.reduce((acc, v) => acc + v, 0);

  // Hand out the remaining bps to the largest fractional parts, breaking ties
  // by original index so the output is fully deterministic.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = floored.slice();
  for (let k = 0; k < order.length && remainder > 0; k++) {
    result[order[k]!.i]! += 1;
    remainder -= 1;
  }
  return result;
}

/**
 * Rescale an already-normalized set of bps into a smaller budget (e.g. after
 * carving out a reserve), preserving proportions and re-summing to `target`.
 */
export function rescaleBps(values: readonly number[], target: number): number[] {
  return normalizeToTotalBps(values, target);
}
