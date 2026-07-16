// SPDX-License-Identifier: Apache-2.0
/**
 * Deterministic canonical JSON + content hashing.
 *
 * Canonicalization: object keys are recursively sorted, whitespace is
 * removed, arrays keep their given order, and `undefined` values are dropped.
 * Two structurally-equal values always serialize to the same string, so the
 * SHA-256 fingerprint is stable across machines and runtimes.
 */

import { sha256Hex } from "../crypto/sha256.js";
import { keccak256 } from "../crypto/keccak256.js";

/** Canonical (sorted-key, whitespace-free) JSON serialization. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
  }
  return value;
}

/** SHA-256 (hex) of the canonical JSON of any value. */
export function hashCanonical(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

/** Keccak-256 (0x-hex) of the canonical JSON of any value. */
export function keccakCanonical(value: unknown): string {
  return keccak256(canonicalJson(value));
}

/** Stable string form used when a keccak-of-string hash of a payload is needed. */
export function stableStringify(value: unknown): string {
  return canonicalJson(value);
}
