/**
 * useReceiptVerification — validates a HISS paper receipt's structure and,
 * when you supply a content-hash function, recomputes the hash and compares it
 * to the receipt's `manifestHash`.
 *
 * This is an integrity check on a LOCAL/PAPER object. A receipt is never an
 * on-chain anchor, a signature, or a performance claim — this hook does not
 * assert otherwise. Without a hash function, `hashMatches` is `null` (the
 * check was structure-only), never `true`.
 */

import { useMemo } from "react";
import type { ReceiptLike, ReceiptVerification } from "../types";

export type UseReceiptVerificationOptions = {
  /**
   * Recomputes the canonical content hash from the receipt. Supply the hasher
   * from `@hiss-finance/core` (or your own) to enable hash comparison. The
   * function receives the receipt with `manifestHash`/`shareUrl` omitted.
   */
  computeHash?: (receiptWithoutHash: Record<string, unknown>) => string;
};

const REQUIRED_FIELDS = ["receiptId", "kind", "anchoring", "manifestHash", "generatedAt"] as const;

export function useReceiptVerification(
  receipt: ReceiptLike | undefined,
  options: UseReceiptVerificationOptions = {},
): ReceiptVerification {
  const computeHash = options.computeHash;
  return useMemo<ReceiptVerification>(() => {
    const issues: string[] = [];
    if (!receipt) {
      return { wellFormed: false, hashMatches: null, issues: ["no receipt provided"] };
    }
    for (const field of REQUIRED_FIELDS) {
      if (receipt[field] == null || receipt[field] === "") {
        issues.push(`missing required field: ${field}`);
      }
    }
    if (receipt.anchoring !== "paper") {
      issues.push('anchoring must be "paper" (receipts are local proofs, not on-chain anchors)');
    }
    if (receipt.manifestHash && !/^0x[0-9a-fA-F]+$/.test(receipt.manifestHash)) {
      issues.push("manifestHash must be a 0x-prefixed hex string");
    }

    let hashMatches: boolean | null = null;
    if (computeHash && receipt.manifestHash) {
      const { manifestHash, shareUrl, ...rest } = receipt;
      void shareUrl;
      try {
        const recomputed = computeHash(rest as Record<string, unknown>);
        hashMatches = recomputed.toLowerCase() === manifestHash.toLowerCase();
        if (!hashMatches) issues.push("recomputed content hash does not match manifestHash");
      } catch (err) {
        issues.push(`hash recomputation failed: ${err instanceof Error ? err.message : String(err)}`);
        hashMatches = false;
      }
    }

    return { wellFormed: issues.length === 0, hashMatches, issues };
  }, [receipt, computeHash]);
}
