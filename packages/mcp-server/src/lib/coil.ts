/**
 * Local CoilOps manifest validation + deterministic compilation.
 *
 * A "coil" is a bounded, rule-based trading playbook. Validation and
 * compilation here are pure and deterministic: the same manifest always
 * compiles to the same artifact and hash. Nothing in this module places,
 * modifies, or cancels an order — a compiled coil is a planning artifact that
 * the user's own execution surface may later act on under their own controls.
 */

import { canonicalHash } from "./hash.js";
import type { ValidationIssue, ValidationVerdict } from "./validate.js";

export const COIL_MANIFEST_SCHEMA = "coil-manifest-1.0.0";
export const COMPILED_COIL_SCHEMA = "coil-compiled-1.0.0";

/** Risk fuses every coil must declare. Fuses are binding and never bypassable. */
export const REQUIRED_COIL_FUSES = ["maxPositionBps", "maxGrossExposureBps", "allowShorting"] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function validateCoil(manifest: unknown): ValidationVerdict {
  const issues: ValidationIssue[] = [];
  const push = (code: string, message: string, path: string) => issues.push({ code, message, path });

  if (!isRecord(manifest)) {
    return {
      ok: false,
      schema: COIL_MANIFEST_SCHEMA,
      issues: [{ code: "NOT_AN_OBJECT", message: "Coil manifest must be a JSON object.", path: "" }],
    };
  }

  if (manifest.schema !== COIL_MANIFEST_SCHEMA) {
    push("SCHEMA_MISMATCH", `Expected schema "${COIL_MANIFEST_SCHEMA}".`, "schema");
  }
  if (typeof manifest.name !== "string" || manifest.name.trim().length === 0) {
    push("NAME_REQUIRED", "A non-empty coil name is required.", "name");
  }

  const universe = manifest.universe;
  if (
    !Array.isArray(universe) ||
    universe.length === 0 ||
    !universe.every((s) => typeof s === "string" && s.length > 0)
  ) {
    push("UNIVERSE_INVALID", "universe must be a non-empty array of instrument symbols.", "universe");
  }

  const rules = manifest.rules;
  if (!Array.isArray(rules) || rules.length === 0) {
    push("RULES_REQUIRED", "rules must be a non-empty array.", "rules");
  }

  const fuses = manifest.fuses;
  if (!isRecord(fuses)) {
    push("FUSES_REQUIRED", "A fuses object is required — risk fuses are mandatory.", "fuses");
  } else {
    if (num(fuses.maxPositionBps) === null) {
      push("FUSE_INVALID", "fuses.maxPositionBps must be numeric.", "fuses.maxPositionBps");
    }
    if (num(fuses.maxGrossExposureBps) === null) {
      push("FUSE_INVALID", "fuses.maxGrossExposureBps must be numeric.", "fuses.maxGrossExposureBps");
    }
    if (typeof fuses.allowShorting !== "boolean") {
      push("FUSE_INVALID", "fuses.allowShorting must be a boolean.", "fuses.allowShorting");
    }
  }

  return { ok: issues.length === 0, schema: COIL_MANIFEST_SCHEMA, issues };
}

export interface CompiledCoil {
  schema: typeof COMPILED_COIL_SCHEMA;
  sourceSchema: string;
  name: string;
  universe: string[];
  ruleCount: number;
  fuses: Record<string, unknown>;
  /** Canonical hash of the compiled artifact — deterministic and replayable. */
  coilHash: string;
  compiledAtIso: string;
  /** Always false — a compiled coil is a plan, not an executed order. */
  executed: false;
}

/**
 * Compile a validated coil into a deterministic artifact. Throws if the
 * manifest does not validate (fail-closed).
 */
export function compileCoil(manifest: unknown, nowIso = new Date().toISOString()): CompiledCoil {
  const verdict = validateCoil(manifest);
  if (!verdict.ok) {
    throw new CoilCompileError("Coil manifest failed validation.", verdict.issues);
  }
  const m = manifest as Record<string, unknown>;
  const body: Omit<CompiledCoil, "coilHash" | "compiledAtIso" | "executed"> = {
    schema: COMPILED_COIL_SCHEMA,
    sourceSchema: COIL_MANIFEST_SCHEMA,
    name: m.name as string,
    universe: m.universe as string[],
    ruleCount: (m.rules as unknown[]).length,
    fuses: m.fuses as Record<string, unknown>,
  };
  return {
    ...body,
    coilHash: canonicalHash(body),
    compiledAtIso: nowIso,
    executed: false,
  };
}

export class CoilCompileError extends Error {
  constructor(
    message: string,
    public readonly issues: ValidationIssue[],
  ) {
    super(message);
    this.name = "CoilCompileError";
  }
}
