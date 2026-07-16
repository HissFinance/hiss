/**
 * Coils: compile-only strategy specifications.
 *
 * A "coil" is a declarative, verifiable strategy manifest that HISS compiles
 * and validates but never executes. `compileCoil` is deterministic — the same
 * coil always produces the same compiled output and hash (timestamps
 * excluded) — and the compiled result is always `executable: false`. Nothing
 * here places an order or sends a transaction.
 *
 * Hashing reuses the shared @hiss-finance canonical hasher (via
 * @hiss-finance/vault-kit) so coil hashes match the rest of the toolkit.
 */

import { hashCanonical, TOTAL_BPS, sumBps, isValidBps } from "@hiss-finance/vault-kit";

/** Compile-only execution posture. A coil never enables live order routing. */
export type CoilMode = "paper_only" | "preview_only" | "human_confirm";

/** Schema version for the coil manifest. */
export const COIL_SCHEMA_VERSION = "hiss-coil-1.0.0";
/** Compiler version stamped onto compiled output. */
export const COIL_COMPILER_VERSION = "hiss-coil-compiler-1.0.0";

/** A single weighted leg of a coil. */
export interface CoilAsset {
  symbol: string;
  weightBps: number;
}

/** A coil strategy manifest. */
export interface Coil {
  schemaVersion?: string;
  name: string;
  mode: CoilMode;
  assets: CoilAsset[];
  policy?: {
    maxAssets?: number;
    rebalanceCadence?: "daily" | "weekly" | "monthly" | "quarterly" | "manual";
    maxSlippageBps?: number;
  };
  notes?: string[];
}

/** A single validation finding. */
export interface CoilIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

/** Result of {@link validateCoil}. */
export interface CoilValidation {
  valid: boolean;
  issues: CoilIssue[];
}

/**
 * Validate a coil. Fail-closed: weights must be valid bps summing to exactly
 * 10,000, the mode must be a compile-only posture, and at least one asset is
 * required.
 */
export function validateCoil(coil: Coil): CoilValidation {
  const issues: CoilIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  if (!coil.name || coil.name.trim().length === 0) err("coil.name", "A coil name is required.");

  const modes: CoilMode[] = ["paper_only", "preview_only", "human_confirm"];
  if (!modes.includes(coil.mode)) {
    err("coil.mode", `mode must be one of ${modes.join(", ")} (compile-only postures).`);
  }

  if (!Array.isArray(coil.assets) || coil.assets.length === 0) {
    err("coil.assets", "At least one asset is required.");
  } else {
    const weights = coil.assets.map((a) => a.weightBps);
    if (!weights.every(isValidBps)) err("coil.weights", "Every weight must be an integer in [0, 10000] bps.");
    const total = sumBps(weights);
    if (total !== TOTAL_BPS) err("coil.weightsSum", `Weights must sum to ${TOTAL_BPS} bps, got ${total}.`);
    if (coil.policy?.maxAssets !== undefined && coil.assets.length > coil.policy.maxAssets) {
      err(
        "coil.maxAssets",
        `Coil has ${coil.assets.length} assets, over the policy max of ${coil.policy.maxAssets}.`,
      );
    }
    for (const a of coil.assets) {
      if (a.weightBps === 0) warn("coil.zeroWeight", `Asset "${a.symbol}" has 0 bps.`);
    }
  }

  if (coil.policy?.maxSlippageBps !== undefined && !isValidBps(coil.policy.maxSlippageBps)) {
    err("coil.slippage", "policy.maxSlippageBps must be an integer in [0, 10000] bps.");
  }

  return { valid: issues.every((i) => i.severity !== "error"), issues };
}

/** Deterministic compiled coil. Always `executable: false`. */
export interface CompiledCoil {
  compilerVersion: string;
  schemaVersion: string;
  name: string;
  mode: CoilMode;
  assets: CoilAsset[];
  /** Canonical hash of the compile-relevant content (no timestamps). */
  coilHash: string;
  /** A compiled coil is never executable — HISS compiles and verifies only. */
  executable: false;
  validation: CoilValidation;
  warnings: string[];
}

/**
 * Compile a coil deterministically. Throws (fail-closed) if the coil fails
 * validation. The output is pure: the same coil always yields the same hash.
 */
export function compileCoil(coil: Coil): CompiledCoil {
  const validation = validateCoil(coil);
  if (!validation.valid) {
    const codes = validation.issues.filter((i) => i.severity === "error").map((i) => i.code);
    throw new Error(`compileCoil: coil is invalid — ${codes.join(", ")}`);
  }

  const normalized = {
    schemaVersion: coil.schemaVersion ?? COIL_SCHEMA_VERSION,
    name: coil.name,
    mode: coil.mode,
    assets: coil.assets.map((a) => ({ symbol: a.symbol, weightBps: a.weightBps })),
    policy: coil.policy ?? {},
  };

  return {
    compilerVersion: COIL_COMPILER_VERSION,
    schemaVersion: normalized.schemaVersion,
    name: normalized.name,
    mode: normalized.mode,
    assets: normalized.assets,
    coilHash: hashCanonical(normalized),
    executable: false,
    validation,
    warnings: validation.issues.filter((i) => i.severity === "warning").map((i) => i.message),
  };
}
