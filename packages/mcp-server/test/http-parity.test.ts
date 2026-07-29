import { describe, it, expect, afterEach } from "vitest";
import { startTestServer, mcpCall, toolsCall, type RunningHttp } from "./helpers/httpHarness.js";
import { callHissTool } from "../src/server.js";
import { HISS_TOOLS } from "../src/tools.js";
import { mockClient, VALID_VAULT_MANIFEST, VALID_COIL_MANIFEST } from "./helpers/mockClient.js";
import { STOCK_PREMIUM_ARGS } from "./helpers/stockPremiumArgs.js";
import { lighterFixtureClient } from "./helpers/lighterFixtureClient.js";
import type { JsonRecord } from "../src/lib/types.js";

const TOOL_COUNT = HISS_TOOLS.length;

const FIXED_NOW = "2026-07-24T00:00:00.000Z";
const ADDR = "0x1111111111111111111111111111111111111111";
const VAULT = "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6";

/** Deterministic valid args per tool (compile_coil pins nowIso for parity). */
const ARGS: Record<string, JsonRecord> = {
  hiss_get_protocol_status: {},
  hiss_get_contract_registry: {},
  hiss_get_vaults: {},
  hiss_get_vault: { ref: "flagship" },
  hiss_get_vault_holdings: { vault: VAULT },
  hiss_get_vault_performance: { vault: VAULT },
  hiss_get_staking_status: {},
  hiss_get_reward_status: {},
  hiss_get_receipt: { id: "r-1" },
  hiss_verify_receipt: { receipt: { kind: "state_read", hash: "0x00" } },
  hiss_get_supported_assets: {},
  hiss_get_fee_schedule: {},
  hiss_create_vault_candidate: {
    name: "Draft",
    allowedAssets: ["USDG"],
    creator: { address: ADDR, skinInGameUsdg: 1 },
  },
  hiss_validate_vault_candidate: { manifest: VALID_VAULT_MANIFEST },
  hiss_prepare_vault_creation: { manifest: VALID_VAULT_MANIFEST },
  hiss_prepare_vault_deposit: { vault: VAULT, amount: "100", receiver: ADDR },
  hiss_prepare_vault_withdrawal: { vault: VAULT, shares: "10", receiver: ADDR },
  hiss_prepare_hiss_stake: { amount: "500" },
  hiss_prepare_xhiss_cooldown: { xhissAmount: "50" },
  hiss_prepare_xhiss_redeem: { xShares: "25", receiver: ADDR },
  hiss_validate_coil: { manifest: VALID_COIL_MANIFEST },
  hiss_compile_coil: { manifest: VALID_COIL_MANIFEST, nowIso: FIXED_NOW },
  ...STOCK_PREMIUM_ARGS,
  hiss_lighter_markets: {},
  hiss_lighter_orderbook: { ticker: "AAPL" },
  hiss_lighter_depth: { ticker: "AAPL" },
  hiss_lighter_prepare_order: {
    ticker: "AAPL",
    side: "buy",
    size: "1.0000",
    price: "339.50",
    orderType: "LIMIT",
    timeInForce: "GOOD_TILL_TIME",
    clientOrderIndex: 1,
    // 1 day past FIXED_NOW — inside the [5min, 30d] GTT window, clock-stable.
    expiryMs: new Date("2026-07-25T00:00:00.000Z").getTime(),
  },
  hiss_lighter_prepare_cancel: { ticker: "AAPL", orderIndex: "12345" },
  hiss_lighter_prepare_modify: { ticker: "AAPL", orderIndex: "12345", newPrice: "339.40" },
};

let running: RunningHttp | undefined;
afterEach(async () => {
  await running?.close();
  running = undefined;
});

describe("stdio ≡ HTTP tool parity (hardening changed no tool behavior)", () => {
  for (const tool of HISS_TOOLS) {
    it(`${tool.name} produces identical results over stdio and HTTP`, async () => {
      // Both transports share the SAME fixed clock so time-stamped reads
      // (e.g. the contract registry's `observedAt`) compare deterministically.
      running = await startTestServer({ nowIso: () => FIXED_NOW });
      const args = ARGS[tool.name] ?? {};

      // Reference: the in-process guarded caller (the stdio path).
      const reference = await callHissTool(tool.name, args, {
        client: mockClient(),
        nowIso: () => FIXED_NOW,
        // Same fixture-backed Lighter client the HTTP harness uses → parity.
        lighter: lighterFixtureClient(),
      });

      // HTTP: the same tool over Streamable HTTP.
      const { status, body } = await mcpCall(running.origin, toolsCall(tool.name, args));
      expect(status).toBe(200);
      const result = body.result as JsonRecord;

      expect(result.isError ?? false).toBe(reference.isError ?? false);
      expect(result.structuredContent).toEqual(reference.structuredContent);
    });
  }
});

describe("concurrent stateless requests", () => {
  it("serves 25 concurrent tools/list calls, each with all TOOL_COUNT tools", async () => {
    running = await startTestServer();
    const calls = Array.from({ length: 25 }, (_, i) =>
      mcpCall(running!.origin, { jsonrpc: "2.0", id: i, method: "tools/list" }),
    );
    const results = await Promise.all(calls);
    for (const { status, body } of results) {
      expect(status).toBe(200);
      expect((body.result as { tools: unknown[] }).tools).toHaveLength(TOOL_COUNT);
    }
  });

  it("serves concurrent tools/call requests without cross-request bleed", async () => {
    running = await startTestServer();
    const names = ["hiss_get_protocol_status", "hiss_get_vaults", "hiss_get_staking_status"];
    const calls = Array.from({ length: 30 }, (_, i) =>
      mcpCall(running!.origin, toolsCall(names[i % names.length]!, {})),
    );
    const results = await Promise.all(calls);
    for (const { status, body } of results) {
      expect(status).toBe(200);
      expect((body.result as JsonRecord).isError ?? false).toBe(false);
    }
  });
});
