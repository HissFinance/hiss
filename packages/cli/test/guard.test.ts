import { describe, it, expect } from "vitest";
import { assertNoExecutionClaim, findExecutionClaim, ExecutionClaimError } from "../src/lib/guard.js";

describe("execution-claim guard", () => {
  it("blocks unqualified completion claims", () => {
    for (const claim of [
      "Deposited 100 USDG into the vault.",
      "Successfully staked your HISS.",
      "The withdrawal executed on chain.",
      "Vault deployed at 0xabc.",
    ]) {
      expect(findExecutionClaim(claim)).not.toBeNull();
      expect(() => assertNoExecutionClaim(claim)).toThrow(ExecutionClaimError);
    }
  });

  it("tolerates honest negations and prepare language", () => {
    for (const ok of [
      "Prepared an unsigned deposit. Nothing was sent.",
      "No transaction was submitted by HISS.",
      "This will deposit once you submit it yourself.",
      "Nothing was staked; this is a plan only.",
    ]) {
      expect(findExecutionClaim(ok)).toBeNull();
      expect(() => assertNoExecutionClaim(ok)).not.toThrow();
    }
  });

  it("permits completion claims only when a receipt is verified", () => {
    const claim = "Deposited 100 USDG (confirmed on chain).";
    expect(() => assertNoExecutionClaim(claim)).toThrow();
    expect(() => assertNoExecutionClaim(claim, { receiptVerified: true })).not.toThrow();
  });
});
