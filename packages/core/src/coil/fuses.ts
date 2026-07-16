// SPDX-License-Identifier: Apache-2.0
/**
 * Risk fuses — typed, checkable constraints on what a compiled artifact may
 * instruct. A fuse either bounds an instruction or defines a hard stop. A
 * FuseSet is the collection carried by a Coil; execution-capsule compilation
 * requires a minimum fuse coverage.
 */

export type RiskFuse =
  | { kind: "maxPositionWeight"; maxBps: number }
  | { kind: "maxSingleOrderNotional"; maxUsd: number }
  | { kind: "maxDailyTurnover"; maxBps: number }
  | { kind: "maxDrawdownAlert"; alertPct: number }
  | { kind: "restrictedSymbols"; symbols: string[] }
  | { kind: "marketHoursOnly" }
  | { kind: "earningsBlackout"; daysBefore: number; daysAfter: number }
  | { kind: "manualConfirmAboveNotional"; thresholdUsd: number }
  | { kind: "noOptions" }
  | { kind: "noMargin" }
  | { kind: "stopIfOracleUnhealthy" }
  | { kind: "stopIfReceiptMismatch" };

export type RiskFuseKind = RiskFuse["kind"];

/** A Coil's collection of fuses. */
export type FuseSet = RiskFuse[];

/** Fuses every execution capsule must include before it can compile. */
export const REQUIRED_CAPSULE_FUSES: readonly RiskFuseKind[] = [
  "maxPositionWeight",
  "maxSingleOrderNotional",
  "maxDailyTurnover",
  "noOptions",
  "noMargin",
];

/** Sensible conservative defaults for a new Coil. */
export function defaultFuses(): FuseSet {
  return [
    { kind: "maxPositionWeight", maxBps: 4000 },
    { kind: "maxSingleOrderNotional", maxUsd: 500 },
    { kind: "maxDailyTurnover", maxBps: 2000 },
    { kind: "manualConfirmAboveNotional", thresholdUsd: 100 },
    { kind: "marketHoursOnly" },
    { kind: "noOptions" },
    { kind: "noMargin" },
    { kind: "stopIfOracleUnhealthy" },
    { kind: "stopIfReceiptMismatch" },
  ];
}

export type FuseIssue = { code: string; message: string };

const TICKER_PATTERN = /^[A-Z][A-Z0-9.]{0,9}$/;

/** Validate a FuseSet. Empty result means valid. */
export function validateFuses(fuses: FuseSet, forCapsule = false): FuseIssue[] {
  const issues: FuseIssue[] = [];
  const kinds = new Set(fuses.map((f) => f.kind));

  if (kinds.size !== fuses.length) {
    issues.push({ code: "DUPLICATE_FUSE", message: "Each fuse kind may appear at most once." });
  }

  for (const fuse of fuses) {
    if (fuse.kind === "maxPositionWeight" && (fuse.maxBps <= 0 || fuse.maxBps > 10_000)) {
      issues.push({ code: "FUSE_BOUNDS", message: "maxPositionWeight must be in (0, 10000] bps." });
    }
    if (fuse.kind === "maxSingleOrderNotional" && fuse.maxUsd <= 0) {
      issues.push({ code: "FUSE_BOUNDS", message: "maxSingleOrderNotional must be positive." });
    }
    if (fuse.kind === "maxDailyTurnover" && (fuse.maxBps <= 0 || fuse.maxBps > 10_000)) {
      issues.push({ code: "FUSE_BOUNDS", message: "maxDailyTurnover must be in (0, 10000] bps." });
    }
    if (fuse.kind === "restrictedSymbols") {
      for (const symbol of fuse.symbols) {
        if (!TICKER_PATTERN.test(symbol)) {
          issues.push({
            code: "FUSE_SYMBOL",
            message: `Restricted symbol "${symbol}" is not a plain ticker.`,
          });
        }
      }
    }
  }

  if (forCapsule) {
    for (const required of REQUIRED_CAPSULE_FUSES) {
      if (!kinds.has(required)) {
        issues.push({
          code: "MISSING_REQUIRED_FUSE",
          message: `Execution capsules require the "${required}" fuse.`,
        });
      }
    }
  }

  return issues;
}
