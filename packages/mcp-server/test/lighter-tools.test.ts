/**
 * Lighter READ/PREPARE tool boundary suite.
 *
 * Proves the load-bearing safety properties of the 6 Lighter tools beyond the
 * generic §23 matrix: deterministic fixture-backed reads, fail-closed DEGRADED
 * (never fabricated), UNSIGNED prepare intents (signed:false, nothing sent), and
 * that NO tool ever emits a private key, auth token, or nonce field.
 */

import { describe, it, expect } from "vitest";
import { callHissTool } from "../src/server.js";
import { LIGHTER_TOOLS } from "../src/tools.js";
import { mockClient } from "./helpers/mockClient.js";
import { lighterFixtureClient } from "./helpers/lighterFixtureClient.js";
import type { JsonRecord } from "../src/lib/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const FIXED_NOW = "2026-07-28T18:00:00.000Z";
const deps = { client: mockClient(), nowIso: () => FIXED_NOW, lighter: lighterFixtureClient() };
const degradedDeps = {
  client: mockClient(),
  nowIso: () => FIXED_NOW,
  lighter: lighterFixtureClient({ fail: true }),
};

function sc(r: CallToolResult): JsonRecord {
  return r.structuredContent as JsonRecord;
}

describe("Lighter rail is exactly 6 READ/PREPARE tools with the hiss_lighter_ prefix", () => {
  it("exposes markets/orderbook/depth (read) + prepare_order/cancel/modify (prepare)", () => {
    expect(LIGHTER_TOOLS.map((t) => t.name).sort()).toEqual([
      "hiss_lighter_depth",
      "hiss_lighter_markets",
      "hiss_lighter_orderbook",
      "hiss_lighter_prepare_cancel",
      "hiss_lighter_prepare_modify",
      "hiss_lighter_prepare_order",
    ]);
    expect(
      LIGHTER_TOOLS.filter((t) => t.kind === "read")
        .map((t) => t.name)
        .sort(),
    ).toEqual(["hiss_lighter_depth", "hiss_lighter_markets", "hiss_lighter_orderbook"]);
    expect(LIGHTER_TOOLS.every((t) => t.kind === "read" || t.kind === "prepare")).toBe(true);
    // No hosted execution/signing tool exists on this rail — ever.
    for (const t of LIGHTER_TOOLS) {
      for (const frag of ["sign", "submit", "execute", "send", "broadcast", "key"]) {
        expect(t.name).not.toContain(frag);
      }
    }
  });
});

describe("Lighter READ tools are deterministic + classify stock tokens", () => {
  it("markets: reads the fixture list and classifies /USDG spot pairs", async () => {
    const r = await callHissTool("hiss_lighter_markets", { stockTokensOnly: true }, deps);
    expect(r.isError ?? false).toBe(false);
    const s = sc(r);
    expect(s.status).toBe("LIVE");
    expect(Number(s.stockTokenCount)).toBeGreaterThan(20);
    expect((s.markets as JsonRecord[]).every((m) => m.isStockToken === true)).toBe(true);
  });

  it("orderbook: derives bid/ask/mid from the AAPL/USDG fixture", async () => {
    const r = await callHissTool("hiss_lighter_orderbook", { ticker: "AAPL" }, deps);
    const q = sc(r).quote as JsonRecord;
    expect(q.bestBid).toBe(339.27);
    expect(q.bestAsk).toBe(339.89);
    expect(sc(r).symbol).toBe("AAPL/USDG");
  });

  it("depth: compact top-of-book + depth summary, no full ladder", async () => {
    const r = await callHissTool("hiss_lighter_depth", { ticker: "AAPL" }, deps);
    expect(sc(r).depth).toBeDefined();
    expect(sc(r).bids).toBeUndefined();
  });

  it("fails closed to DEGRADED on a transport error — never fabricates", async () => {
    const r = await callHissTool("hiss_lighter_markets", {}, degradedDeps);
    expect(r.isError ?? false).toBe(false); // honest DEGRADED, not a thrown error
    expect(sc(r).ok).toBe(false);
    expect(sc(r).status).toBe("DEGRADED");
  });

  it("MARKET_NOT_AVAILABLE for an unknown ticker — never a fabricated market", async () => {
    const r = await callHissTool("hiss_lighter_orderbook", { ticker: "NOTREAL" }, deps);
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toContain("MARKET_NOT_AVAILABLE");
  });
});

describe("Lighter PREPARE tools emit UNSIGNED intents and never a key", () => {
  const order = {
    ticker: "AAPL",
    side: "buy",
    size: "1.0000",
    price: "339.50",
    orderType: "LIMIT",
    timeInForce: "GOOD_TILL_TIME",
    clientOrderIndex: 7,
    expiryMs: new Date("2026-07-29T18:00:00.000Z").getTime(),
  } as const;

  it("prepare_order: signed:false, liveTransactionSent:false, scaled integers, deterministic hash", async () => {
    const r = await callHissTool("hiss_lighter_prepare_order", { ...order }, deps);
    const s = sc(r);
    expect(s.signed).toBe(false);
    expect(s.liveTransactionSent).toBe(false);
    expect(typeof s.baseAmount).toBe("number");
    expect(typeof s.price).toBe("number");
    expect(String(s.intentHash)).toMatch(/^0x[0-9a-f]{64}$/);
    const text = (r.content as Array<{ text: string }>)[0]?.text ?? "";
    expect(text.toLowerCase()).toContain("nothing was sent");
    // Deterministic under the fixed clock.
    const r2 = await callHissTool("hiss_lighter_prepare_order", { ...order }, deps);
    expect(sc(r2).intentHash).toBe(s.intentHash);
  });

  it("prepare_cancel / prepare_modify are unsigned intents", async () => {
    const c = await callHissTool("hiss_lighter_prepare_cancel", { ticker: "AAPL", orderIndex: "42" }, deps);
    expect(sc(c).signed).toBe(false);
    const m = await callHissTool(
      "hiss_lighter_prepare_modify",
      { ticker: "AAPL", orderIndex: "42", newPrice: "339.40" },
      deps,
    );
    expect(sc(m).signed).toBe(false);
  });

  it("fail-closed: a sub-minimum order is refused with a typed error, no partial intent", async () => {
    const r = await callHissTool(
      "hiss_lighter_prepare_order",
      { ...order, size: "0.0001", timeInForce: "POST_ONLY", expiryMs: undefined },
      deps,
    );
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toContain("INVALID_INPUT");
  });

  it("a credential-shaped field is rejected before any prepare runs", async () => {
    const r = await callHissTool(
      "hiss_lighter_prepare_order",
      { ...order, privateKey: "0x" + "a".repeat(64) } as JsonRecord,
      deps,
    );
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toContain("CREDENTIAL_REJECTED");
  });

  it("no prepared intent ever contains a key/token/nonce field", async () => {
    const r = await callHissTool("hiss_lighter_prepare_order", { ...order }, deps);
    const blob = JSON.stringify(sc(r)).toLowerCase();
    for (const banned of [
      "privatekey",
      "private_key",
      "authtoken",
      "auth_token",
      '"nonce"',
      '"secret"',
      "mnemonic",
    ]) {
      expect(blob).not.toContain(banned);
    }
  });
});
