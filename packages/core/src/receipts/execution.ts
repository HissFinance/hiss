// SPDX-License-Identifier: Apache-2.0
/**
 * ExecutionReceipt — a deterministic, content-addressed record of an observed
 * outcome.
 *
 * A receipt is the ONLY place a "confirmed" state exists. It is written after
 * the caller observes an on-chain result (or records a paper simulation). The
 * status ladder is strict: an unconfirmed on-chain submission is never
 * `onchain_confirmed`, and a failed read is `unknown`, never a positive or
 * negative claim. Receipts are local fingerprints, not signatures.
 */

import { hashCanonical } from "../receipts/canonical.js";

export const EXECUTION_RECEIPT_VERSION = "execution-receipt-1.0.0";

/**
 * paper           — simulated only; no chain interaction.
 * preview         — a plan was shown; nothing was submitted.
 * submitted       — a transaction was broadcast; NOT yet confirmed.
 * onchain_confirmed — an on-chain receipt was observed (the only settled state).
 * failed          — the transaction reverted or was rejected.
 * unknown         — the outcome could not be read (never assume success/failure).
 */
export type ExecutionStatus = "paper" | "preview" | "submitted" | "onchain_confirmed" | "failed" | "unknown";

export const EXECUTION_STATUSES: readonly ExecutionStatus[] = [
  "paper",
  "preview",
  "submitted",
  "onchain_confirmed",
  "failed",
  "unknown",
];

export type ExecutionReceipt = {
  receiptVersion: typeof EXECUTION_RECEIPT_VERSION;
  receiptId: string;
  /** The plan this receipt records the outcome of. */
  planHash: string;
  chainId: number;
  status: ExecutionStatus;
  /** Present only when status is submitted / onchain_confirmed / failed. */
  txHash?: string;
  /** Present only when status is onchain_confirmed. */
  blockNumber?: number;
  observedAt: string;
  /** Freeform, non-authoritative notes (never a performance claim). */
  notes?: string[];
  /** Content hash of the receipt payload (excluding this field). */
  receiptHash?: string;
};

export type ExecutionReceiptIssue = { code: string; message: string };

/** Validate an ExecutionReceipt's status/field invariants. Empty = valid. */
export function validateExecutionReceipt(receipt: ExecutionReceipt): ExecutionReceiptIssue[] {
  const issues: ExecutionReceiptIssue[] = [];
  if (receipt.receiptVersion !== EXECUTION_RECEIPT_VERSION) {
    issues.push({
      code: "RECEIPT_VERSION",
      message: `receiptVersion must be "${EXECUTION_RECEIPT_VERSION}".`,
    });
  }
  if (!receipt.planHash) {
    issues.push({ code: "PLAN_HASH", message: "planHash is required (a receipt records a plan's outcome)." });
  }
  if (!EXECUTION_STATUSES.includes(receipt.status)) {
    issues.push({
      code: "STATUS_INVALID",
      message: `status must be one of: ${EXECUTION_STATUSES.join(", ")}.`,
    });
  }
  // A confirmed receipt must carry the chain evidence for the claim.
  if (receipt.status === "onchain_confirmed") {
    if (!receipt.txHash)
      issues.push({ code: "CONFIRMED_TX", message: "onchain_confirmed requires a txHash." });
    if (typeof receipt.blockNumber !== "number") {
      issues.push({ code: "CONFIRMED_BLOCK", message: "onchain_confirmed requires a blockNumber." });
    }
  }
  // Paper/preview/unknown must NOT masquerade as an on-chain outcome.
  if (
    (receipt.status === "paper" || receipt.status === "preview" || receipt.status === "unknown") &&
    receipt.txHash
  ) {
    issues.push({
      code: "STATUS_TX_MISMATCH",
      message: `status "${receipt.status}" must not carry a txHash.`,
    });
  }
  return issues;
}

/** The hashed payload: the receipt minus its own hash field. */
export function executionReceiptHashPayload(
  receipt: ExecutionReceipt,
): Omit<ExecutionReceipt, "receiptHash"> {
  const { receiptHash: _omit, ...payload } = receipt;
  return payload;
}

/**
 * Compute the deterministic content hash of a receipt. Deterministic:
 * structurally-equal receipts (ignoring the hash field) hash identically.
 */
export function computeExecutionReceiptHash(receipt: ExecutionReceipt): string {
  return hashCanonical(executionReceiptHashPayload(receipt));
}
