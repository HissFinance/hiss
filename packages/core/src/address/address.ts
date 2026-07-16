// SPDX-License-Identifier: Apache-2.0
/**
 * EVM address validation and EIP-55 checksum helpers.
 *
 * `Address` is a nominal-ish `0x${string}` alias; the runtime guards and the
 * checksum functions are the source of truth. Canonical HISS contract
 * addresses are stored in their EIP-55 checksummed form and validated against
 * these helpers in the test suite.
 */

import { keccak256Hex } from "../crypto/keccak256.js";

export type Address = `0x${string}`;

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** True when `value` is a 0x-prefixed 40-hex string (any casing). */
export function isAddress(value: unknown): value is Address {
  return typeof value === "string" && ADDRESS_PATTERN.test(value);
}

/**
 * EIP-55 checksummed form of an address. Throws on a malformed address.
 * All-lowercase and all-uppercase inputs are accepted and re-cased.
 */
export function toChecksumAddress(address: string): Address {
  if (!ADDRESS_PATTERN.test(address)) {
    throw new Error(`invalid EVM address: ${address}`);
  }
  const lower = address.toLowerCase().replace(/^0x/, "");
  const hash = keccak256Hex(lower);
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    out += parseInt(hash[i]!, 16) >= 8 ? lower[i]!.toUpperCase() : lower[i]!;
  }
  return out as Address;
}

/**
 * True when a MIXED-CASE address carries a valid EIP-55 checksum. All-lower
 * and all-upper addresses are structurally valid but not checksum-verified,
 * so this returns false for them — use {@link isAddress} for shape-only checks.
 */
export function isChecksumAddress(address: string): boolean {
  if (!ADDRESS_PATTERN.test(address)) return false;
  const body = address.slice(2);
  const hasMixedCase = body !== body.toLowerCase() && body !== body.toUpperCase();
  if (!hasMixedCase) return false;
  return toChecksumAddress(address) === address;
}

/** Normalize to lowercase 0x form (identity comparison key). Throws if malformed. */
export function normalizeAddress(address: string): Address {
  if (!ADDRESS_PATTERN.test(address)) {
    throw new Error(`invalid EVM address: ${address}`);
  }
  return address.toLowerCase() as Address;
}

/** Case-insensitive address equality. Non-addresses are never equal. */
export function addressesEqual(a: string, b: string): boolean {
  return isAddress(a) && isAddress(b) && a.toLowerCase() === b.toLowerCase();
}

/** The zero address. */
export const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
