/**
 * Risk fuses for vault candidates.
 *
 * A fuse is a declarative guardrail attached to a vault's strategy: a bound
 * the strategy promises to stay inside (max weight per asset, max slippage on
 * a rebalance, oracle-staleness ceiling, and so on). Fuses here are
 * descriptive metadata a creator attaches to a candidate — they are compiled
 * into a strategy hash, not executed by this package. Nothing here trades.
 */

/** The kinds of fuse a candidate may declare. */
export type FuseKind =
  | "maxAssetWeightBps"
  | "minAssetWeightBps"
  | "maxAssetsCount"
  | "maxSlippageBps"
  | "maxRebalanceTurnoverBps"
  | "oracleMaxStalenessSeconds"
  | "maxDrawdownBps"
  | "depegHaltBps"
  | "minReserveBps";

/** A single declared fuse. */
export interface Fuse {
  kind: FuseKind;
  /** The threshold. Interpreted per-kind (bps for *Bps kinds, seconds, count). */
  value: number;
}

interface FuseSpec {
  unit: "bps" | "seconds" | "count";
  min: number;
  max: number;
  describe: (value: number) => string;
}

const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

const FUSE_SPECS: Record<FuseKind, FuseSpec> = {
  maxAssetWeightBps: {
    unit: "bps",
    min: 0,
    max: 10_000,
    describe: (v) => `No single asset may exceed ${pct(v)} of the vault.`,
  },
  minAssetWeightBps: {
    unit: "bps",
    min: 0,
    max: 10_000,
    describe: (v) => `Any included asset must hold at least ${pct(v)} of the vault.`,
  },
  maxAssetsCount: {
    unit: "count",
    min: 1,
    max: 100,
    describe: (v) => `The vault holds at most ${v} distinct assets.`,
  },
  maxSlippageBps: {
    unit: "bps",
    min: 0,
    max: 10_000,
    describe: (v) => `A rebalance trade is rejected if slippage would exceed ${pct(v)}.`,
  },
  maxRebalanceTurnoverBps: {
    unit: "bps",
    min: 0,
    max: 10_000,
    describe: (v) => `A single rebalance may move at most ${pct(v)} of the book.`,
  },
  oracleMaxStalenessSeconds: {
    unit: "seconds",
    min: 0,
    max: 86_400,
    describe: (v) => `Pricing is treated as stale (and actions blocked) after ${v}s without an update.`,
  },
  maxDrawdownBps: {
    unit: "bps",
    min: 0,
    max: 10_000,
    describe: (v) => `The strategy flags a breach if drawdown from the high-water mark exceeds ${pct(v)}.`,
  },
  depegHaltBps: {
    unit: "bps",
    min: 0,
    max: 10_000,
    describe: (v) => `Rebalancing halts if the base asset depegs by more than ${pct(v)}.`,
  },
  minReserveBps: {
    unit: "bps",
    min: 0,
    max: 10_000,
    describe: (v) => `At least ${pct(v)} is kept in the base reserve asset.`,
  },
};

/** Build (and validate) a single fuse. Throws on an out-of-range value. */
export function buildFuse(kind: FuseKind, value: number): Fuse {
  const spec = FUSE_SPECS[kind];
  if (!spec) throw new Error(`buildFuse: unknown fuse kind "${kind}"`);
  if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
    throw new Error(
      `buildFuse: ${kind} must be an integer in [${spec.min}, ${spec.max}] ${spec.unit}, got ${value}`,
    );
  }
  return { kind, value };
}

/** Assemble a fuse set from a map, de-duplicating by kind. */
export function buildFuseSet(fuses: Partial<Record<FuseKind, number>>): Fuse[] {
  return (Object.entries(fuses) as [FuseKind, number][])
    .filter(([, v]) => v !== undefined)
    .map(([kind, value]) => buildFuse(kind, value));
}

/** The unit a fuse's value is expressed in. */
export function fuseUnit(kind: FuseKind): "bps" | "seconds" | "count" {
  return FUSE_SPECS[kind].unit;
}

/** A plain-language description of a single fuse. */
export function describeFuse(fuse: Fuse): string {
  return FUSE_SPECS[fuse.kind].describe(fuse.value);
}

/** Plain-language descriptions for a fuse set, in declared order. */
export function describeFuses(fuses: readonly Fuse[]): string[] {
  return fuses.map(describeFuse);
}

/** Validate a fuse set, returning any range violations (does not throw). */
export function validateFuses(fuses: readonly Fuse[]): string[] {
  const issues: string[] = [];
  for (const f of fuses) {
    const spec = FUSE_SPECS[f.kind];
    if (!spec) {
      issues.push(`Unknown fuse kind "${f.kind}".`);
      continue;
    }
    if (!Number.isInteger(f.value) || f.value < spec.min || f.value > spec.max) {
      issues.push(`Fuse ${f.kind} value ${f.value} is outside [${spec.min}, ${spec.max}] ${spec.unit}.`);
    }
  }
  return issues;
}
