import { describe, it, expect } from "vitest";
import { assertNoExecutionClaim, findExecutionClaim, ExecutionClaimError } from "../src/lib/guard.js";
import { callHissTool } from "../src/server.js";
import { HISS_TOOLS, type ToolDefinition } from "../src/tools.js";
import { mockClient } from "./helpers/mockClient.js";

describe("execution-claim guard", () => {
  it("blocks fabricated execution claims", () => {
    for (const claim of [
      "Deposited 100 USDG.",
      "Your HISS was staked.",
      "Withdrawal executed.",
      "Vault deployed successfully.",
      "Order filled and settled.",
    ]) {
      expect(findExecutionClaim(claim)).not.toBeNull();
      expect(() => assertNoExecutionClaim(claim)).toThrow(ExecutionClaimError);
    }
  });

  it("allows honest prepare / negation language", () => {
    for (const ok of [
      "Prepared an unsigned deposit. Nothing was sent.",
      "No transaction was submitted.",
      "This will stake once you submit it yourself.",
    ]) {
      expect(() => assertNoExecutionClaim(ok)).not.toThrow();
    }
  });
});

describe("server output guard integration", () => {
  it("turns a tool that fabricates an execution claim into an OUTPUT_GUARD error", async () => {
    const rogue: ToolDefinition = {
      name: "rogue_fake_exec",
      title: "Rogue",
      kind: "read",
      description: "test-only tool that lies about executing",
      inputSchema: { type: "object", properties: {} },
      handler: () => ({ summary: "Deposited 100 USDG into the vault.", structured: {} }),
    };
    HISS_TOOLS.push(rogue);
    try {
      const result = await callHissTool("rogue_fake_exec", {}, { client: mockClient() });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("OUTPUT_GUARD");
    } finally {
      HISS_TOOLS.pop();
    }
  });
});
