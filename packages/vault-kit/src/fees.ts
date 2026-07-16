/**
 * Worked fee-example calculators for vault candidates.
 *
 * These are illustrative, deterministic calculators a creator can use to
 * preview how a fee configuration behaves — a performance fee charged only on
 * gains, a high-water-mark that never double-charges the same profit, and the
 * creator "skin in the game" minimum. They operate on integer token units
 * (bigint) to stay exact; they do not read chain state, quote prices, or
 * forecast returns. Historical or hypothetical numbers are not predictions.
 */

import { TOTAL_BPS } from "./bps";

function assertBps(name: string, bps: number, max: number = TOTAL_BPS): void {
  if (!Number.isInteger(bps) || bps < 0 || bps > max) {
    throw new Error(`${name} must be an integer in [0, ${max}] bps, got ${bps}`);
  }
}

function assertNonNegative(name: string, value: bigint): void {
  if (value < 0n) throw new Error(`${name} must be non-negative, got ${value}`);
}

/** floor(amount * bps / 10000) using bigint math. */
export function applyBps(amount: bigint, bps: number): bigint {
  assertBps("bps", bps);
  return (amount * BigInt(bps)) / BigInt(TOTAL_BPS);
}

/** Result of {@link performanceFeeExample}. */
export interface PerformanceFeeExample {
  profitUnits: bigint;
  feeBps: number;
  feeUnits: bigint;
  netToDepositorsUnits: bigint;
}

/**
 * Performance fee charged on realized profit only. On zero or negative profit
 * the fee is zero.
 */
export function performanceFeeExample(params: {
  profitUnits: bigint;
  feeBps: number;
}): PerformanceFeeExample {
  const { profitUnits, feeBps } = params;
  assertBps("feeBps", feeBps);
  const gain = profitUnits > 0n ? profitUnits : 0n;
  const feeUnits = applyBps(gain, feeBps);
  return {
    profitUnits,
    feeBps,
    feeUnits,
    netToDepositorsUnits: profitUnits - feeUnits,
  };
}

/** Result of {@link highWaterMarkFeeExample}. */
export interface HighWaterMarkExample {
  priorHighWaterMark: bigint;
  currentValue: bigint;
  feeBps: number;
  /** Value above the prior high-water mark that is fee-eligible. */
  newProfitUnits: bigint;
  feeUnits: bigint;
  /** The high-water mark after this period (never decreases). */
  nextHighWaterMark: bigint;
}

/**
 * High-water-mark performance fee. A fee is only charged on value ABOVE the
 * prior high-water mark, so a recovery back to a previous peak is never
 * charged twice. The mark ratchets up but never down.
 */
export function highWaterMarkFeeExample(params: {
  priorHighWaterMark: bigint;
  currentValue: bigint;
  feeBps: number;
}): HighWaterMarkExample {
  const { priorHighWaterMark, currentValue, feeBps } = params;
  assertNonNegative("priorHighWaterMark", priorHighWaterMark);
  assertNonNegative("currentValue", currentValue);
  assertBps("feeBps", feeBps);

  const newProfitUnits = currentValue > priorHighWaterMark ? currentValue - priorHighWaterMark : 0n;
  const feeUnits = applyBps(newProfitUnits, feeBps);
  const nextHighWaterMark = currentValue > priorHighWaterMark ? currentValue : priorHighWaterMark;

  return { priorHighWaterMark, currentValue, feeBps, newProfitUnits, feeUnits, nextHighWaterMark };
}

/** Result of {@link creatorSkinExample}. */
export interface CreatorSkinExample {
  totalAssetsUnits: bigint;
  minSkinBps: number;
  /** Minimum creator stake required to satisfy the skin floor. */
  requiredSkinUnits: bigint;
  currentSkinUnits: bigint;
  /** How far short the creator is (0 when satisfied). */
  shortfallUnits: bigint;
  satisfied: boolean;
}

/**
 * Creator "skin in the game": the creator must hold at least `minSkinBps` of
 * the vault's total assets as their own deposit. Returns the required floor
 * and any shortfall against a current stake.
 */
export function creatorSkinExample(params: {
  totalAssetsUnits: bigint;
  minSkinBps: number;
  currentSkinUnits?: bigint;
}): CreatorSkinExample {
  const { totalAssetsUnits, minSkinBps } = params;
  const currentSkinUnits = params.currentSkinUnits ?? 0n;
  assertNonNegative("totalAssetsUnits", totalAssetsUnits);
  assertNonNegative("currentSkinUnits", currentSkinUnits);
  assertBps("minSkinBps", minSkinBps);

  const requiredSkinUnits = applyBps(totalAssetsUnits, minSkinBps);
  const shortfallUnits = currentSkinUnits >= requiredSkinUnits ? 0n : requiredSkinUnits - currentSkinUnits;

  return {
    totalAssetsUnits,
    minSkinBps,
    requiredSkinUnits,
    currentSkinUnits,
    shortfallUnits,
    satisfied: shortfallUnits === 0n,
  };
}
