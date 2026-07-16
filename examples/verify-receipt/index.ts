/**
 * verify-receipt — recompute a paper receipt's content hash and compare it.
 *
 * A receipt is a LOCAL, content-addressed proof of what was generated. It is
 * NOT anchored on-chain, NOT a signature, and NOT a performance claim. This
 * example recomputes the canonical hash and shows both a match and a tamper.
 */
import { hashCanonical } from "@hiss-finance/core";

// The content that a receipt fingerprints (everything except its own hash).
const content = {
  receiptId: "example-0001",
  kind: "validation",
  anchoring: "paper",
  basketSlug: "sample-semiconductor-basket",
  validationStatus: "valid",
  generatedAt: "2026-07-16T00:00:00.000Z",
};

// A well-formed receipt carries the canonical hash of its content.
const manifestHash = hashCanonical(content);
const receipt = { ...content, manifestHash };

function verify(r: typeof receipt): boolean {
  const { manifestHash: claimed, ...rest } = r;
  return hashCanonical(rest).toLowerCase() === claimed.toLowerCase();
}

console.log(`Receipt id:   ${receipt.receiptId}`);
console.log(`Anchoring:    ${receipt.anchoring} (local proof, not on-chain)`);
console.log(`Hash:         ${receipt.manifestHash}`);
console.log(`Verified:     ${verify(receipt)}`);

// Tamper with the content and show the hash no longer matches.
const tampered = { ...receipt, validationStatus: "invalid" as const };
console.log(`Tampered ok:  ${verify(tampered)}  (expected false)`);
