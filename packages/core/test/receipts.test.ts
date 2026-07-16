// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { canonicalJson, hashCanonical } from "../src/receipts/canonical.js";
import {
  validateExecutionReceipt,
  computeExecutionReceiptHash,
  EXECUTION_RECEIPT_VERSION,
  type ExecutionReceipt,
} from "../src/receipts/execution.js";
import {
  validateActionPlan,
  computeActionPlanHash,
  ACTION_PLAN_VERSION,
  type ActionPlan,
} from "../src/actions/plan.js";
import { xhissCopyViolations, XHISS_STAKING_PARAMS, XHISS_STAKING_COPY } from "../src/staking/xhiss.js";
import { resolveStatus } from "../src/status/public.js";
import { HISS_ERROR_CODES, HissError, isHissError } from "../src/errors/codes.js";

describe("canonical JSON determinism", () => {
  it("is key-order independent", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(hashCanonical({ b: 1, a: 2 })).toBe(hashCanonical({ a: 2, b: 1 }));
  });
  it("drops undefined values", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});

describe("execution receipt", () => {
  const base: ExecutionReceipt = {
    receiptVersion: EXECUTION_RECEIPT_VERSION,
    receiptId: "r1",
    planHash: "abc",
    chainId: 4663,
    status: "onchain_confirmed",
    txHash: "0xdead",
    blockNumber: 123,
    observedAt: "2026-01-01T00:00:00.000Z",
  };

  it("hashes deterministically ignoring the hash field", () => {
    const h1 = computeExecutionReceiptHash(base);
    const h2 = computeExecutionReceiptHash({ ...base, receiptHash: "whatever" });
    expect(h1).toBe(h2);
  });

  it("requires tx + block for onchain_confirmed", () => {
    expect(validateExecutionReceipt(base)).toEqual([]);
    const missing = validateExecutionReceipt({ ...base, txHash: undefined, blockNumber: undefined });
    expect(missing.some((i) => i.code === "CONFIRMED_TX")).toBe(true);
    expect(missing.some((i) => i.code === "CONFIRMED_BLOCK")).toBe(true);
  });

  it("forbids a paper receipt from carrying a txHash", () => {
    const issues = validateExecutionReceipt({ ...base, status: "paper" });
    expect(issues.some((i) => i.code === "STATUS_TX_MISMATCH")).toBe(true);
  });
});

describe("action plan", () => {
  const plan: ActionPlan = {
    planVersion: ACTION_PLAN_VERSION,
    planId: "p1",
    sourceManifestHash: "srchash",
    chainId: 4663,
    executionMode: "preview_only",
    steps: [
      {
        kind: "order_preview",
        instrument: "NVDA",
        side: "buy",
        fuseChecks: ["maxPositionWeight"],
        abortConditions: ["stopIfOracleUnhealthy"],
        reason: "rebalance",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("validates a well-formed plan", () => {
    expect(validateActionPlan(plan)).toEqual([]);
  });

  it("rejects an unguarded step", () => {
    const issues = validateActionPlan({
      ...plan,
      steps: [{ ...plan.steps[0]!, fuseChecks: [] }],
    });
    expect(issues.some((i) => i.code === "STEP_UNGUARDED")).toBe(true);
  });

  it("hashes deterministically ignoring the hash field", () => {
    expect(computeActionPlanHash(plan)).toBe(computeActionPlanHash({ ...plan, planHash: "x" }));
  });
});

describe("xhiss staking copy + params", () => {
  it("exposes the immutable timing constants", () => {
    expect(XHISS_STAKING_PARAMS.cooldownSeconds).toBe(72 * 3600);
    expect(XHISS_STAKING_PARAMS.redeemWindowSeconds).toBe(2 * 24 * 3600);
    expect(XHISS_STAKING_PARAMS.rewardDripSeconds).toBe(24 * 3600);
  });
  it("approved copy is clean; banned phrasing is caught", () => {
    expect(xhissCopyViolations(XHISS_STAKING_COPY.headline)).toEqual([]);
    expect(xhissCopyViolations("guaranteed yield, passive income")).toContain("passive-income");
  });
});

describe("public status precedence", () => {
  it("collapses an unproven positive claim to unknown", () => {
    expect(resolveStatus({ subject: "vault", requestedLevel: "live", evidence: "none" }).level).toBe(
      "unknown",
    );
    expect(
      resolveStatus({ subject: "vault", requestedLevel: "live", evidence: "fresh_chain_read" }).level,
    ).toBe("live");
  });
  it("requires no-bytecode evidence for a not_deployed claim", () => {
    expect(resolveStatus({ subject: "x", requestedLevel: "not_deployed", evidence: "none" }).level).toBe(
      "unknown",
    );
    expect(
      resolveStatus({ subject: "x", requestedLevel: "not_deployed", evidence: "no_bytecode_read" }).level,
    ).toBe("not_deployed");
  });
});

describe("public errors", () => {
  it("carries a stable code", () => {
    const e = new HissError(HISS_ERROR_CODES.WRONG_CHAIN, "nope");
    expect(isHissError(e)).toBe(true);
    expect(e.code).toBe("WRONG_CHAIN");
  });
});
