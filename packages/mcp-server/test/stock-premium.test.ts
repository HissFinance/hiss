/**
 * Stock Premium engine-bridge suite: the 11 tools exercised through the direct
 * handler (server) path, with 11 positive + 11 negative vectors, the §4 output
 * field contract, the §5 prepare binding + typed rejections, and the
 * signed:false / liveTransactionSent:false + guard invariants on every prepare.
 */

import { describe, it, expect } from "vitest";
import { callHissTool } from "../src/server.js";
import { getTool } from "../src/tools.js";
import { stockPremiumFixtureEngine } from "../src/lib/stock-premium.js";
import { mockClient } from "./helpers/mockClient.js";
import { STOCK_PREMIUM_ARGS, STOCK_PREMIUM_NEGATIVE } from "./helpers/stockPremiumArgs.js";
import type { JsonRecord } from "../src/lib/types.js";

const deps = { client: mockClient(), nowIso: () => "2026-07-24T00:00:00.000Z" };

const READ_TOOLS = [
  "hiss_stock_token_registry",
  "hiss_stock_premium_scan",
  "hiss_stock_premium_explain",
  "hiss_lp_ladder_preview",
  "hiss_lp_position_read",
  "hiss_lp_verify_receipt",
];
const PREPARE_TOOLS = [
  "hiss_lp_prepare_mint",
  "hiss_lp_prepare_increase",
  "hiss_lp_prepare_withdraw",
  "hiss_lp_prepare_collect",
  "hiss_lp_prepare_close",
];
const ALL = [...READ_TOOLS, ...PREPARE_TOOLS];

describe("the 11 Stock-Premium tools are registered read/prepare", () => {
  it("all 11 exist with the right kinds", () => {
    for (const n of READ_TOOLS) expect(getTool(n)?.kind).toBe("read");
    for (const n of PREPARE_TOOLS) expect(getTool(n)?.kind).toBe("prepare");
    expect(ALL).toHaveLength(11);
  });
});

describe("11 positive vectors — every tool returns a guarded, non-error DEMO result", () => {
  for (const name of ALL) {
    it(`${name} succeeds and carries dataMode:"DEMO"`, async () => {
      const result = await callHissTool(name, STOCK_PREMIUM_ARGS[name] ?? {}, deps);
      expect(result.isError ?? false).toBe(false);
      const sc = result.structuredContent as JsonRecord;
      expect(sc).toBeDefined();
      // DEMO provenance appears on the result (directly or on the prepare payload).
      const json = JSON.stringify(sc);
      expect(json).toContain("DEMO");
    });
  }
});

describe("11 negative vectors — every tool rejects bad input with a typed error", () => {
  for (const name of ALL) {
    const vectors = STOCK_PREMIUM_NEGATIVE[name] ?? [];
    it(`${name} has at least one negative vector`, () => expect(vectors.length).toBeGreaterThan(0));
    vectors.forEach((args, i) => {
      it(`${name} [neg ${i}] -> typed error, never a raw throw`, async () => {
        const result = await callHissTool(name, args, deps);
        expect(result.isError).toBe(true);
        const sc = result.structuredContent as JsonRecord;
        const err = sc.error as JsonRecord | undefined;
        expect(typeof err?.code).toBe("string");
        expect(Array.isArray(result.structuredContent)).toBe(false);
      });
    });
  }
});

describe("§4 output contract — scan + explain carry the full evidence surface", () => {
  const FIELDS = [
    "symbol",
    "token",
    "usdgAddress",
    "poolAddress",
    "feeTier",
    "codeHashState",
    "observedBlock",
    "observedUnix",
    "rawBidE18",
    "rawAskE18",
    "multiplierE18",
    "multiplierApplied",
    "multiplierApplicationSemantics",
    "adjustedReferenceE18",
    "exactInput",
    "simulatedOutput",
    "executablePriceE18",
    "premiumBps",
    "expectedImpactBps",
    "twapDivergenceBps",
    "referenceFreshness",
    "liveness",
    "corporateAction",
    "usdgPeg",
    "dynamicCapacityUsdg",
    "confidence",
    "fuseVerdict",
    "reasonCodes",
    "evidenceHash",
    "policyVersion",
  ];

  it("explain(buy) exposes every §4 field", async () => {
    const result = await callHissTool("hiss_stock_premium_explain", { symbol: "AAPL" }, deps);
    const sc = result.structuredContent as JsonRecord;
    const buy = sc.buy as JsonRecord;
    for (const f of FIELDS) expect(buy).toHaveProperty(f);
    expect(sc.dataMode).toBe("DEMO");
  });

  it("UNKNOWN is never zero — an unsupported explain returns null, not 0", async () => {
    const result = await callHissTool("hiss_stock_premium_explain", { symbol: "ZZZZ" }, deps);
    const sc = result.structuredContent as JsonRecord;
    expect(sc.buy).toBeNull();
    expect(sc.sell).toBeNull();
  });

  it("scan rows carry rank + the premium observation surface", async () => {
    const result = await callHissTool("hiss_stock_premium_scan", {}, deps);
    const sc = result.structuredContent as JsonRecord;
    expect(sc.dataMode).toBe("DEMO");
    const rows = sc.rows as JsonRecord[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty("rankScore");
      expect(row).toHaveProperty("evidenceHash");
      expect(row).toHaveProperty("dynamicCapacityUsdg");
    }
  });
});

describe("§5 prepare binding + unsigned invariants on every prepare", () => {
  const BINDING_FIELDS = [
    "chainId",
    "authority",
    "recipient",
    "positionManager",
    "positionManagerCodeHash",
    "factory",
    "factoryCodeHash",
    "pool",
    "token0",
    "token1",
    "feeTier",
    "tickSpacing",
    "strategyVersion",
    "registryVersion",
    "riskPolicyVersion",
    "priceMeshEvidenceHash",
    "fuseChecksum",
    "intentNonce",
    "deadlineUnix",
    "poolCodeHash",
  ];

  for (const name of PREPARE_TOOLS) {
    it(`${name} is signed:false + liveTransactionSent:false + preparedByHiss:true`, async () => {
      const result = await callHissTool(name, STOCK_PREMIUM_ARGS[name] ?? {}, deps);
      expect(result.isError ?? false).toBe(false);
      const sc = result.structuredContent as JsonRecord;
      const intent = sc.intent as JsonRecord;
      expect(intent.signed).toBe(false);
      expect(intent.liveTransactionSent).toBe(false);
      expect(intent.preparedByHiss).toBe(true);
      expect((sc.receipt as JsonRecord).liveTransactionSent).toBe(false);
      expect((sc.signatureReview as JsonRecord).liveTransactionSent).toBe(false);
      // The summary admits nothing was sent, and never trips the execution guard.
      const text = (result.content as Array<{ text: string }>)[0]?.text ?? "";
      expect(text).toContain("Nothing was signed and nothing was sent");
      expect(JSON.stringify(result.content)).not.toContain("OUTPUT_GUARD");
    });
  }

  it("mint binding binds the full §5 identity + parameter set", async () => {
    const result = await callHissTool("hiss_lp_prepare_mint", STOCK_PREMIUM_ARGS.hiss_lp_prepare_mint, deps);
    const sc = result.structuredContent as JsonRecord;
    const binding = (sc.intent as JsonRecord).binding as JsonRecord;
    for (const f of BINDING_FIELDS) expect(binding).toHaveProperty(f);
    expect(binding.chainId).toBe(4663);
    // recipient == authority (no arbitrary recipient).
    expect((binding.recipient as string).toLowerCase()).toBe(
      ((binding.authority as JsonRecord).address as string).toLowerCase(),
    );
    // Approvals are exact (never unbounded), with residual revoke.
    for (const a of (sc.intent as JsonRecord).approvals as JsonRecord[]) {
      expect(a.isExact).toBe(true);
      expect(a.revokesResidual).toBe(true);
    }
    // mint carries per-rung desired + min amounts and a tick range.
    const rungs = (sc.intent as JsonRecord).rungs as JsonRecord[];
    expect(rungs.length).toBeGreaterThan(0);
    for (const r of rungs) {
      expect(r).toHaveProperty("tickLower");
      expect(r).toHaveProperty("tickUpper");
      expect(r).toHaveProperty("amount0Desired");
      expect(r).toHaveProperty("amount0Min");
    }
  });

  it("typed rejections cover the §5 fail-closed cases", async () => {
    const cases: Array<{ args: JsonRecord; reason: string; tool: string }> = [
      {
        tool: "hiss_lp_prepare_mint",
        reason: "arbitrary_target",
        args: {
          ...STOCK_PREMIUM_ARGS.hiss_lp_prepare_mint,
          assertPositionManager: "0x9999999999999999999999999999999999999999",
          intentNonce: "rej-1",
        },
      },
      {
        tool: "hiss_lp_prepare_mint",
        reason: "unbounded_approval",
        args: {
          ...STOCK_PREMIUM_ARGS.hiss_lp_prepare_mint,
          totalCapital: ((1n << 256n) - 1n).toString(),
          intentNonce: "rej-2",
        },
      },
      {
        tool: "hiss_lp_prepare_close",
        reason: "unsupported_token",
        args: { ...STOCK_PREMIUM_ARGS.hiss_lp_prepare_close, symbol: "NOPE", intentNonce: "rej-3" },
      },
    ];
    for (const c of cases) {
      const result = await callHissTool(c.tool, c.args, deps);
      expect(result.isError).toBe(true);
      const issues = JSON.stringify((result.structuredContent as JsonRecord).error);
      expect(issues).toContain(c.reason);
    }
  });
});

describe("credential + engine-injection", () => {
  it("every Stock-Premium tool refuses a credential-shaped field", async () => {
    for (const name of ALL) {
      const result = await callHissTool(name, { privateKey: "0x" + "a".repeat(64) }, deps);
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("CREDENTIAL_REJECTED");
    }
  });

  it("an injected engine overrides the fixture fallback", async () => {
    let called = false;
    const spy = {
      ...stockPremiumFixtureEngine,
      registry: () => {
        called = true;
        return { dataMode: "DEMO" as const, sourceLabel: "spy", builtAtUnix: 1, chainId: 4663, entries: [] };
      },
    };
    const result = await callHissTool("hiss_stock_token_registry", {}, { ...deps, stockPremium: spy });
    expect(called).toBe(true);
    expect(result.isError ?? false).toBe(false);
  });
});

describe("verify_receipt truth: a preparation receipt is not settlement", () => {
  it("round-trips a prepared receipt and never reports onchainConfirmed", async () => {
    const prepared = await callHissTool(
      "hiss_lp_prepare_mint",
      STOCK_PREMIUM_ARGS.hiss_lp_prepare_mint,
      deps,
    );
    const receipt = (prepared.structuredContent as JsonRecord).receipt as JsonRecord;
    const verified = await callHissTool("hiss_lp_verify_receipt", { receipt }, deps);
    const sc = verified.structuredContent as JsonRecord;
    expect(sc.ok).toBe(true);
    expect(sc.onchainConfirmed).toBe(false);
    expect(sc.liveTransactionSent).toBe(false);
  });

  it("a receipt claiming liveTransactionSent:true fails verification", async () => {
    const result = await callHissTool(
      "hiss_lp_verify_receipt",
      { receipt: { stage: "preparation", liveTransactionSent: true } },
      deps,
    );
    const sc = result.structuredContent as JsonRecord;
    expect(sc.ok).toBe(false);
  });
});
