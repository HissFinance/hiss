/**
 * Local receipt verification.
 *
 * A receipt is a signed-off record of something that happened locally — a
 * candidate validated, a manifest hashed, an allocation compiled. Each carries
 * a `contentHash` over its payload so anyone can re-derive it and confirm the
 * receipt was not altered. These are LOCAL fingerprints, not on-chain anchors.
 */

import { hashCanonical } from "./canonical";

/** The kinds of receipt this kit issues. */
export type ReceiptKind = "vault_candidate" | "manifest_hash" | "allocation_normalized" | "readiness_check";

/** A verifiable local receipt. */
export interface VaultKitReceipt<T = unknown> {
  kind: ReceiptKind;
  /** ISO timestamp when the receipt was produced. */
  issuedAt: string;
  /** The receipt payload the hash is computed over. */
  payload: T;
  /** `sha256:`-prefixed hash of the canonicalized payload. */
  contentHash: string;
}

/** Build a receipt, computing its content hash over the payload. */
export function buildReceipt<T>(kind: ReceiptKind, payload: T, issuedAt: string): VaultKitReceipt<T> {
  return {
    kind,
    issuedAt,
    payload,
    contentHash: hashCanonical(payload),
  };
}

/** Recompute the content hash for a receipt's payload. */
export function receiptHash(receipt: Pick<VaultKitReceipt, "payload">): string {
  return hashCanonical(receipt.payload);
}

/** True when a receipt's `contentHash` matches its payload. */
export function verifyReceipt(receipt: VaultKitReceipt): boolean {
  return receiptHash(receipt) === receipt.contentHash;
}

/** Verify a receipt's hash against an independently supplied expected value. */
export function verifyReceiptHash(receipt: VaultKitReceipt, expectedHash: string): boolean {
  return receipt.contentHash === expectedHash && verifyReceipt(receipt);
}
