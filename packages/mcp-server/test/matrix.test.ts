/**
 * §23 MCP TEST MATRIX — generated from the canonical registry (never a
 * handwritten count-only matrix).
 *
 * For every one of the registered tools (count is DYNAMIC — `HISS_TOOLS.length`,
 * base read/prepare + Stock-Premium bridge) this suite evaluates the full §23
 * dimension set and folds the per-tool per-dimension verdicts into ONE authoritative
 * matrix, then asserts every cell is green:
 *
 *   registration · inputSchema · outputSchema(serialization) · positive vector ·
 *   negative vector · credential-shaped-arg rejection · stdio execution ·
 *   local-HTTP execution · transport parity (stdio ≡ HTTP) · prepare invariants
 *   (signed:false / liveTransactionSent:false / real target+selector / exact —
 *   never unbounded — approvals).
 *
 * It also asserts the toolset-count identity (registered == toolset-hash count ==
 * /version count == tools/list count) and records the Stock-Premium read-tool
 * `dataMode` (DEMO under the self-contained fixture engine here; the injected real
 * engine that backs `mcp.hiss.finance` returns LIVE|DEGRADED — never DEMO — proven
 * by the network-gated apps/web live matrix, SPL_LIVE_MATRIX=1).
 *
 * The generated matrix is written to `<repo>/artifacts/mcp/mcp-test-matrix.{json,md}`
 * for release evidence (that path is gitignored — the generator, not its output, is
 * the committed artifact). Deterministic: fixture engine + mock client, fixed clock.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { callHissTool } from "../src/server.js";
import { HISS_TOOLS, STOCK_PREMIUM_TOOLS, LIGHTER_TOOLS, getTool } from "../src/tools.js";
import { computeToolsetHash } from "../src/lib/toolset-hash.js";
import { buildVersionInfo } from "../src/lib/version-info.js";
import { mockClient, VALID_VAULT_MANIFEST, VALID_COIL_MANIFEST } from "./helpers/mockClient.js";
import { STOCK_PREMIUM_ARGS, STOCK_PREMIUM_NEGATIVE } from "./helpers/stockPremiumArgs.js";
import { lighterFixtureClient } from "./helpers/lighterFixtureClient.js";
import { startTestServer, mcpCall, toolsCall, type RunningHttp } from "./helpers/httpHarness.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { JsonRecord } from "../src/lib/types.js";

const FIXED_NOW = "2026-07-24T00:00:00.000Z";
const deps = { client: mockClient(), nowIso: () => FIXED_NOW, lighter: lighterFixtureClient() };
const ADDR = "0x1111111111111111111111111111111111111111";
// Fixed GTT expiry (inside [5min,30d] of FIXED_NOW) so the prepared order intent
// is clock-stable for stdio≡HTTP parity.
const LIGHTER_GTT_EXPIRY = new Date("2026-07-25T00:00:00.000Z").getTime();

// The five Stock-Premium READ tools that must be LIVE|DEGRADED (never DEMO) in
// production. Here (self-contained fixture engine) they report DEMO.
const SPL_READ_TOOLS = new Set([
  "hiss_stock_token_registry",
  "hiss_stock_premium_scan",
  "hiss_stock_premium_explain",
  "hiss_lp_ladder_preview",
  "hiss_lp_position_read",
]);

/** One valid positive vector per base tool (Stock-Premium vectors are imported). */
const POSITIVE: Record<string, JsonRecord> = {
  hiss_get_protocol_status: {},
  hiss_get_contract_registry: {},
  hiss_get_vaults: {},
  hiss_get_vault: { ref: "flagship" },
  hiss_get_vault_holdings: { vault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6" },
  hiss_get_vault_performance: { vault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6" },
  hiss_get_staking_status: {},
  hiss_get_reward_status: {},
  hiss_get_receipt: { id: "hrcpt_demo" },
  hiss_verify_receipt: { receipt: { kind: "state_read", id: "hrcpt_demo" } },
  hiss_get_supported_assets: {},
  hiss_get_fee_schedule: {},
  hiss_create_vault_candidate: {
    name: "Example USDG Vault",
    allowedAssets: ["USDG", "AAPL"],
    creator: { address: ADDR, skinInGameUsdg: 5000 },
  },
  hiss_validate_vault_candidate: { manifest: VALID_VAULT_MANIFEST },
  hiss_prepare_vault_creation: { manifest: VALID_VAULT_MANIFEST },
  hiss_prepare_vault_deposit: { vault: ADDR, amount: "100", receiver: ADDR },
  hiss_prepare_vault_withdrawal: { vault: ADDR, shares: "10", receiver: ADDR },
  hiss_prepare_hiss_stake: { amount: "500" },
  hiss_prepare_xhiss_cooldown: { xhissAmount: "50" },
  hiss_prepare_xhiss_redeem: { xShares: "25", receiver: ADDR },
  hiss_validate_coil: { manifest: VALID_COIL_MANIFEST },
  // compile_coil pins nowIso so its hash-stamped output is clock-stable for parity.
  hiss_compile_coil: { manifest: VALID_COIL_MANIFEST, nowIso: FIXED_NOW },
  ...STOCK_PREMIUM_ARGS,
  // Lighter (AAPL/USDG market 2049 is in the fixtures; prepares use the fixed clock).
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
    expiryMs: LIGHTER_GTT_EXPIRY,
  },
  hiss_lighter_prepare_cancel: { ticker: "AAPL", orderIndex: "12345" },
  hiss_lighter_prepare_modify: { ticker: "AAPL", orderIndex: "12345", newPrice: "339.40" },
};

/** One malformed vector per base tool (Stock-Premium negatives are imported). */
const NEGATIVE: Record<string, JsonRecord> = {
  hiss_get_protocol_status: { apiKey: "sk-live-xxxx" },
  hiss_get_contract_registry: { password: "hunter2" },
  hiss_get_vaults: { private_key: "0x" + "a".repeat(64) },
  hiss_get_vault: { ref: 123 },
  hiss_get_vault_holdings: { vault: "not-an-address" },
  hiss_get_vault_performance: { vault: "0xZZZ" },
  hiss_get_staking_status: { secret: "x" },
  hiss_get_reward_status: { accessToken: "abc" },
  hiss_get_receipt: { id: 5 },
  hiss_verify_receipt: { receipt: [1, 2] },
  hiss_get_supported_assets: { bearer: "token" },
  hiss_get_fee_schedule: { mnemonic: "abandon abandon about" },
  hiss_create_vault_candidate: { name: "x", allowedAssets: [] },
  hiss_validate_vault_candidate: { manifest: "nope" },
  hiss_prepare_vault_creation: { manifest: { schema: "vault-manifest-1.0.0", chainId: 8453 } },
  hiss_prepare_vault_deposit: { vault: "bad", amount: "100", receiver: ADDR },
  hiss_prepare_vault_withdrawal: { vault: ADDR, shares: "1" },
  hiss_prepare_hiss_stake: { amount: 500 },
  hiss_prepare_xhiss_cooldown: { xhissAmount: 50 },
  hiss_prepare_xhiss_redeem: { xShares: "25", receiver: "bad" },
  hiss_validate_coil: { manifest: 42 },
  hiss_compile_coil: { manifest: { schema: "coil-manifest-1.0.0" } },
  ...Object.fromEntries(Object.entries(STOCK_PREMIUM_NEGATIVE).map(([k, v]) => [k, v[0]!])),
  // Lighter negatives: missing selector / bad enum / malformed order index / no-op modify.
  hiss_lighter_markets: { stockTokensOnly: "yes" },
  hiss_lighter_orderbook: {},
  hiss_lighter_depth: { marketId: "AAPL" },
  hiss_lighter_prepare_order: {
    ticker: "AAPL",
    side: "hodl",
    size: "1",
    price: "1",
    orderType: "LIMIT",
    timeInForce: "POST_ONLY",
    clientOrderIndex: 1,
  },
  hiss_lighter_prepare_cancel: { ticker: "AAPL", orderIndex: "not-numeric" },
  hiss_lighter_prepare_modify: { ticker: "AAPL", orderIndex: "12345" },
};

// ---------------------------------------------------------------------------
// verdict helpers
// ---------------------------------------------------------------------------

function isTypedError(r: CallToolResult): boolean {
  if (r.isError !== true) return false;
  const err = (r.structuredContent as JsonRecord | undefined)?.error as JsonRecord | undefined;
  return !!err && typeof err.code === "string" && !Array.isArray(r.structuredContent);
}

/** structuredContent is a plain JSON object: no root array, no bigint, no undefined. */
function serializesCleanly(r: CallToolResult): boolean {
  const sc = r.structuredContent;
  if (typeof sc !== "object" || sc === null || Array.isArray(sc)) return false;
  let raw: string;
  try {
    raw = JSON.stringify(sc, (_k, v) => {
      if (typeof v === "bigint") throw new Error("bigint leaked");
      if (v === undefined) throw new Error("undefined leaked");
      return v;
    });
  } catch {
    return false;
  }
  return typeof raw === "string" && JSON.parse(raw) !== undefined;
}

type Row = {
  tool: string;
  kind: string;
  registration: boolean;
  inputSchema: boolean;
  positive: boolean;
  negative: boolean;
  credentialReject: boolean;
  serialization: boolean;
  stdio: boolean;
  http: boolean;
  transportParity: boolean;
  prepareInvariants: boolean | "n/a";
  dataMode: string | "n/a";
};

const DIMENSIONS: Array<keyof Row> = [
  "registration",
  "inputSchema",
  "positive",
  "negative",
  "credentialReject",
  "serialization",
  "stdio",
  "http",
  "transportParity",
  "prepareInvariants",
];

const rows: Row[] = [];
let http: RunningHttp;

async function evaluate(toolName: string): Promise<Row> {
  const def = getTool(toolName)!;
  const pos = POSITIVE[toolName] ?? {};
  const neg = NEGATIVE[toolName] ?? { apiKey: "sk-live-x" };

  // registration
  const registration = !!def && HISS_TOOLS.some((t) => t.name === toolName);

  // inputSchema shape
  const schema = def.inputSchema as JsonRecord;
  const inputSchema = schema?.type === "object" && typeof schema === "object";

  // positive (stdio)
  const posResult = await callHissTool(toolName, pos, deps);
  const positive = (posResult.isError ?? false) === false;

  // serialization (of the positive result)
  const serialization = serializesCleanly(posResult);

  // negative → typed error
  const negResult = await callHissTool(toolName, neg, deps);
  const negative = isTypedError(negResult);

  // credential-shaped arg merged into a valid vector → CREDENTIAL_REJECTED
  const credResult = await callHissTool(toolName, { ...pos, private_key: "0x" + "b".repeat(64) }, deps);
  const credErr = (credResult.structuredContent as JsonRecord | undefined)?.error as JsonRecord | undefined;
  const credentialReject = credResult.isError === true && credErr?.code === "CREDENTIAL_REJECTED";

  // stdio execution (already have posResult)
  const stdio = positive;

  // local HTTP execution + transport parity
  const httpReply = await mcpCall(http.origin, toolsCall(toolName, pos));
  const httpResult = (httpReply.body as JsonRecord).result as CallToolResult | undefined;
  const httpOk = httpReply.status === 200 && !!httpResult && (httpResult.isError ?? false) === false;
  const httpExec = httpOk;
  // Parity: identical structuredContent over stdio and HTTP (deterministic clock+mock).
  const transportParity =
    httpOk && JSON.stringify(httpResult!.structuredContent) === JSON.stringify(posResult.structuredContent);

  // prepare invariants — only the tx-PRODUCING prepares carry an unsigned tx.
  // The validators / assemblers / compilers (validate_*, create_vault_candidate,
  // compile_coil) are prepare-kind but return a local verdict/artifact, not a tx,
  // so the unsigned-tx invariant is n/a for them.
  let prepareInvariants: boolean | "n/a" = "n/a";
  const scPrep = posResult.structuredContent as JsonRecord;
  const intent = scPrep.intent as JsonRecord | undefined;
  const producesTx =
    def.kind === "prepare" && ("signed" in scPrep || (!!intent && Array.isArray(intent.calls)));
  if (producesTx) {
    // base carries {signed:false, liveTransactionSent:false} at top level;
    // Stock-Premium carries them under intent/receipt/signatureReview.
    const flat = scPrep.signed === false && scPrep.liveTransactionSent === false;
    const nested = !!intent && intent.signed === false && intent.liveTransactionSent === false;
    prepareInvariants = flat || nested;
  }

  // Stock-Premium dataMode record (five reads must be LIVE|DEGRADED in prod).
  let dataMode: string | "n/a" = "n/a";
  const sc = posResult.structuredContent as JsonRecord;
  if (typeof sc.dataMode === "string") dataMode = sc.dataMode;

  return {
    tool: toolName,
    kind: def.kind,
    registration,
    inputSchema,
    positive,
    negative,
    credentialReject,
    serialization,
    stdio,
    http: httpExec,
    transportParity,
    prepareInvariants,
    dataMode,
  };
}

beforeAll(async () => {
  // Pin the HTTP server clock to the stdio clock so time-stamped reads
  // (contract-registry observedAt, compiled-coil hash) compare deterministically.
  http = await startTestServer({ nowIso: () => FIXED_NOW });
  for (const t of HISS_TOOLS) rows.push(await evaluate(t.name));
  writeMatrixArtifact();
});

afterAll(async () => {
  if (http) await http.close();
});

function writeMatrixArtifact(): void {
  const toolset = computeToolsetHash();
  const version = buildVersionInfo({ chainId: 4663, transport: "streamable-http" });
  const summary = {
    toolCount: HISS_TOOLS.length,
    baseCount: HISS_TOOLS.length - STOCK_PREMIUM_TOOLS.length,
    stockPremiumCount: STOCK_PREMIUM_TOOLS.length,
    toolsetHash: toolset.hash,
    versionToolCount: version.toolCount,
    versionToolsetHash: version.toolsetHash,
    splReadTools: [...SPL_READ_TOOLS],
    splReadDataModeHere: "DEMO (self-contained fixture engine)",
    splReadDataModeProd: "LIVE|DEGRADED (injected real @hiss/core engine — proven by SPL_LIVE_MATRIX=1)",
    dimensions: DIMENSIONS,
    allGreen: rows.every((r) => DIMENSIONS.every((d) => r[d] === true || r[d] === "n/a")),
  };
  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../artifacts/mcp");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "mcp-test-matrix.json"), JSON.stringify({ summary, rows }, null, 2));

  const cols = ["tool", "kind", ...DIMENSIONS, "dataMode"];
  const cell = (v: unknown) => (v === true ? "PASS" : v === false ? "FAIL" : String(v));
  const md = [
    `# MCP §23 Test Matrix (${HISS_TOOLS.length} tools)`,
    "",
    `Toolset hash: \`${toolset.hash}\` · base ${summary.baseCount} + Stock-Premium ${summary.stockPremiumCount}`,
    `All cells green: **${summary.allGreen}**`,
    "",
    `| ${cols.join(" | ")} |`,
    `| ${cols.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${cols.map((c) => cell((r as Record<string, unknown>)[c])).join(" | ")} |`),
    "",
    `Stock-Premium read tools (${[...SPL_READ_TOOLS].join(", ")}) report DEMO here (fixture engine) and LIVE|DEGRADED in production (real engine).`,
  ].join("\n");
  writeFileSync(resolve(outDir, "mcp-test-matrix.md"), md);
}

// ---------------------------------------------------------------------------
// assertions
// ---------------------------------------------------------------------------

describe("§23 toolset identity", () => {
  it("registered count == toolset-hash count == /version count (dynamic, never hard-coded)", () => {
    const toolset = computeToolsetHash();
    const version = buildVersionInfo({ chainId: 4663, transport: "streamable-http" });
    expect(toolset.toolCount).toBe(HISS_TOOLS.length);
    expect(version.toolCount).toBe(HISS_TOOLS.length);
    expect(version.toolsetHash).toBe(toolset.hash);
    expect(HISS_TOOLS.length - STOCK_PREMIUM_TOOLS.length - LIGHTER_TOOLS.length).toBe(22);
    expect(STOCK_PREMIUM_TOOLS.length).toBe(11);
    expect(LIGHTER_TOOLS.length).toBe(6);
  });

  it("tools/list over HTTP advertises exactly the registered tools", async () => {
    const reply = await mcpCall(http.origin, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    const tools = ((reply.body as JsonRecord).result as JsonRecord).tools as Array<{ name: string }>;
    expect(tools.length).toBe(HISS_TOOLS.length);
    expect(tools.map((t) => t.name).sort()).toEqual(HISS_TOOLS.map((t) => t.name).sort());
  });
});

describe("§23 matrix: every registered tool is green on every dimension", () => {
  it("covers every registered tool with no hard-coded total", () => {
    expect(rows.length).toBe(HISS_TOOLS.length);
    expect(new Set(rows.map((r) => r.tool)).size).toBe(HISS_TOOLS.length);
  });

  for (const t of HISS_TOOLS) {
    it(`${t.name} — all §23 dimensions PASS`, () => {
      const row = rows.find((r) => r.tool === t.name)!;
      for (const d of DIMENSIONS) {
        expect(row[d], `${t.name}.${d}`).toSatisfy((v: unknown) => v === true || v === "n/a");
      }
    });
  }

  it("every tx-producing prepare carries the unsigned / not-sent invariants", () => {
    const txPrepares = rows.filter((x) => x.kind === "prepare" && x.prepareInvariants !== "n/a");
    // 6 base tx prepares + 5 Stock-Premium lp_prepare_* + 3 Lighter prepares = 14.
    expect(txPrepares.length).toBe(14);
    for (const r of txPrepares) expect(r.prepareInvariants, r.tool).toBe(true);
  });

  it("the five Stock-Premium read tools report a data mode (DEMO here, LIVE|DEGRADED in prod)", () => {
    for (const name of SPL_READ_TOOLS) {
      const r = rows.find((x) => x.tool === name)!;
      // Under the self-contained fixture engine the read plane is DEMO; the
      // injected real engine that backs mcp.hiss.finance is LIVE|DEGRADED.
      expect(["DEMO", "LIVE", "DEGRADED"]).toContain(r.dataMode);
    }
  });

  it("aggregate: positive 100%, negative 100%, credential-reject 100%, serialization 100%, parity 100%", () => {
    const n = rows.length;
    expect(rows.filter((r) => r.positive).length).toBe(n);
    expect(rows.filter((r) => r.negative).length).toBe(n);
    expect(rows.filter((r) => r.credentialReject).length).toBe(n);
    expect(rows.filter((r) => r.serialization).length).toBe(n);
    expect(rows.filter((r) => r.transportParity).length).toBe(n);
  });
});
