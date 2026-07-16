// SPDX-License-Identifier: Apache-2.0
/**
 * Ergonomic compatibility aliases over the canonical public API. These provide
 * friendlier names used across the SDK examples; they add no new behavior.
 */
import { validateVaultManifest, type VaultManifest } from "./vault/manifest.js";
import { keccak256Hex } from "./crypto/keccak256.js";

/** Validate a vault "basket" manifest (alias of validateVaultManifest). */
export const validateBasketManifest = validateVaultManifest;

/** A vault/basket manifest (alias of VaultManifest). */
export type HissBasketManifest = VaultManifest;

/** A URL/id-safe slug derived from a human-readable name. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A deterministic short id from parts — keccak-derived, never random. */
export function deterministicId(...parts: string[]): string {
  return keccak256Hex(parts.join(" ")).slice(0, 18);
}
