/**
 * Local receipt verification.
 *
 * A HISS receipt is a self-describing record of a state read or a prepared
 * artifact. Verification recomputes the canonical hash over the receipt body
 * and confirms it matches the stated hash — it proves integrity, NOT that any
 * transaction was executed. On-chain confirmation is a separate, explicit
 * field (`onchainConfirmed`) that is only ever true when a real chain receipt
 * backs it.
 */

import { canonicalHash } from "./hash.js";

export interface ReceiptVerification {
  ok: boolean;
  kind: string | null;
  computedHash: string | null;
  statedHash: string | null;
  /** True only when the receipt itself carries proof of on-chain settlement. */
  onchainConfirmed: boolean;
  issues: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Verify a receipt's integrity hash. The `hash` field is excluded from the
 * hashed body so a receipt can carry its own hash.
 */
export function verifyReceipt(receipt: unknown): ReceiptVerification {
  const issues: string[] = [];
  if (!isRecord(receipt)) {
    return {
      ok: false,
      kind: null,
      computedHash: null,
      statedHash: null,
      onchainConfirmed: false,
      issues: ["Receipt must be a JSON object."],
    };
  }

  const kind = typeof receipt.kind === "string" ? receipt.kind : null;
  if (!kind) issues.push("Receipt is missing a string `kind`.");

  const statedHash = typeof receipt.hash === "string" ? receipt.hash : null;
  if (!statedHash) issues.push("Receipt is missing a string `hash`.");

  const { hash: _omit, ...body } = receipt as Record<string, unknown>;
  const computedHash = canonicalHash(body);

  if (statedHash && statedHash !== computedHash) {
    issues.push("Hash mismatch: recomputed canonical hash does not match the stated hash.");
  }

  // On-chain confirmation is opt-in and requires an explicit proof field.
  const onchainConfirmed =
    receipt.onchainConfirmed === true &&
    typeof receipt.txHash === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(receipt.txHash);

  return {
    ok: issues.length === 0,
    kind,
    computedHash,
    statedHash,
    onchainConfirmed,
    issues,
  };
}
