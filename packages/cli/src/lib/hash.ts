/**
 * Deterministic canonical hashing used for manifest / receipt integrity.
 * Pure and dependency-free (node:crypto only) so it is identical across the
 * CLI, the MCP server, and any verifier.
 */

import { createHash } from "node:crypto";

/** Stable JSON: object keys sorted recursively, no incidental whitespace. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** `0x`-prefixed sha256 of the canonical form of `value`. */
export function canonicalHash(value: unknown): string {
  return "0x" + createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}
