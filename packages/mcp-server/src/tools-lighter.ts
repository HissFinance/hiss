/**
 * Lighter (Robinhood instance) — the 6 canonical MCP tool DEFINITIONS.
 *
 * Three READS over PUBLIC market data (markets, orderbook, depth) and three
 * PREPAREs that emit a typed UNSIGNED intent (prepare_order, prepare_cancel,
 * prepare_modify). Every handler resolves the READ client from the injected
 * `ToolContext.lighter`, falling back to a default `fetch`-backed client over
 * the public Lighter REST API so the package is self-contained; tests inject a
 * fixture-fetch client.
 *
 * HARD BOUNDARY: READ + PREPARE only. HISS holds NO Lighter API private key,
 * auth token, user nonce, or order authority. A prepared intent is ALWAYS
 * `signed:false` and is never evidence that anything reached the venue. Signing
 * + submission happen ONLY in the user-controlled local runtime (official
 * Python/Go SDK — there is no TS/JS signer). Nothing here is a guaranteed
 * return; a resting order can fill adversely, and market data can be stale.
 */

import type { JsonRecord } from "./lib/types.js";
import type { ToolContext, ToolDefinition, ToolOutcome } from "./tools.js";
import { ToolInputError } from "./tools.js";
import {
  LighterReadClient,
  type FetchLike,
  type LighterMarket,
  type LighterReadResult,
  LIGHTER_CURRENT_RUNG,
  prepareOrderIntent,
  prepareCancelIntent,
  prepareModifyIntent,
  type LighterOrderTypeName,
  type LighterTimeInForceName,
  type LighterSide,
} from "./lib/lighter/index.js";

// ---------------------------------------------------------------------------
// default fetch-backed client (public market data; no key, no auth token)
// ---------------------------------------------------------------------------

const runtimeFetch: FetchLike = async (url, init) => {
  // Public market data only — no key, no auth token, no account data.
  const res = await fetch(url, { signal: init?.signal, headers: init?.headers });
  return { ok: res.ok, status: res.status, json: () => res.json() };
};

function clientOf(ctx: ToolContext): LighterReadClient {
  return ctx.lighter ?? new LighterReadClient({ fetchImpl: runtimeFetch, timeoutMs: 4000 });
}

// ---------------------------------------------------------------------------
// input helpers
// ---------------------------------------------------------------------------

function reqString(args: JsonRecord, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new ToolInputError(`\`${key}\` is required and must be a non-empty string.`);
  }
  return v;
}

function optString(args: JsonRecord, key: string): string | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new ToolInputError(`\`${key}\` must be a string.`);
  return v;
}

function optInt(args: JsonRecord, key: string): number | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new ToolInputError(`\`${key}\` must be an integer.`);
  }
  return v;
}

function reqInt(args: JsonRecord, key: string): number {
  const v = optInt(args, key);
  if (v === undefined) throw new ToolInputError(`\`${key}\` is required and must be an integer.`);
  return v;
}

function numberOrString(args: JsonRecord, key: string): string | number {
  const v = args[key];
  if (typeof v === "number" || (typeof v === "string" && v.length > 0)) return v;
  throw new ToolInputError(`\`${key}\` is required and must be a number or numeric string.`);
}

function optNumberOrString(args: JsonRecord, key: string): string | number | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" || (typeof v === "string" && v.length > 0)) return v;
  throw new ToolInputError(`\`${key}\` must be a number or numeric string.`);
}

function optBool(args: JsonRecord, key: string): boolean | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") throw new ToolInputError(`\`${key}\` must be a boolean.`);
  return v;
}

/** A market selector accepted by every Lighter tool (exactly one is required). */
function marketSelector(args: JsonRecord): { symbol?: string; ticker?: string; marketId?: number } {
  const symbol = optString(args, "symbol");
  const ticker = optString(args, "ticker");
  const marketId = optInt(args, "marketId");
  if (!symbol && !ticker && marketId === undefined) {
    throw new ToolInputError("one of `symbol`, `ticker`, or `marketId` is required.");
  }
  return { symbol, ticker, marketId };
}

/** Resolve a market or throw a typed, fail-closed tool error (never fabricate). */
async function resolveMarketOrThrow(
  ctx: ToolContext,
  sel: { symbol?: string; ticker?: string; marketId?: number },
): Promise<LighterMarket> {
  const res = await clientOf(ctx).resolveMarket(sel);
  if (!res.ok) {
    throw new ToolInputError(`Lighter market unavailable: ${res.status} — ${res.reason}`, [
      { code: res.status, message: res.reason },
    ]);
  }
  return res.data;
}

/** Shared JSON-schema fragment for the market selector. */
const MARKET_SELECTOR_PROPS = {
  symbol: { type: "string", description: 'Full market symbol, e.g. "AAPL/USDG".' },
  ticker: { type: "string", description: 'Stock ticker, resolved to its /USDG spot market, e.g. "AAPL".' },
  marketId: { type: "integer", description: "Numeric Lighter market id, e.g. 2049." },
} as const;

// A prepared intent carries this discipline note for auditability.
const PREPARE_NOTE =
  "UNSIGNED, prepare-only Lighter intent (signed:false). HISS holds no Lighter key, token, or nonce and " +
  "submits nothing. Sign + submit ONLY in your own local runtime with the official Lighter Python/Go SDK. " +
  "This is not a completed order and not a guaranteed return — a resting order can fill adversely.";

// ---------------------------------------------------------------------------
// READ tools
// ---------------------------------------------------------------------------

const READ: ToolDefinition[] = [
  {
    name: "hiss_lighter_markets",
    title: "List Lighter markets",
    kind: "read",
    description:
      "READ public Lighter (Robinhood instance) markets from the unauthenticated REST API. Classifies " +
      "Robinhood Stock-Token /USDG spot pairs. Fail-closed: a failed read is DEGRADED, never fabricated. " +
      "No key, no auth token, no account data.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        stockTokensOnly: {
          type: "boolean",
          description: "When true, return only Robinhood Stock-Token /USDG spot markets.",
        },
      },
    },
    handler: async (args, ctx): Promise<ToolOutcome> => {
      const stockOnly = optBool(args, "stockTokensOnly") ?? false;
      const res = await clientOf(ctx).getMarkets();
      if (!res.ok) return degraded("market list", res);
      const all = res.data;
      const stock = all.filter((m) => m.isStockToken);
      const markets = stockOnly ? stock : all;
      return {
        summary: `Listed ${markets.length} Lighter market(s)${stockOnly ? "" : ` (${stock.length} stock-token /USDG spot)`} — public market data (${res.status}).`,
        structured: {
          ok: true,
          status: res.status,
          rail: LIGHTER_CURRENT_RUNG,
          source: res.source,
          capturedAtIso: res.capturedAtIso,
          count: markets.length,
          stockTokenCount: stock.length,
          markets: markets as unknown as JsonRecord[],
        },
      };
    },
  },
  {
    name: "hiss_lighter_orderbook",
    title: "Read a Lighter orderbook",
    kind: "read",
    description:
      "READ + normalize one Lighter market's orderbook (bid/ask levels, best bid/ask, mid, spread, spreadBps, " +
      "per-side depth). Fail-closed: an empty/one-sided book reports null (UNKNOWN), never a fabricated mid; a " +
      "failed read is DEGRADED. Public data only — no key, no signing.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...MARKET_SELECTOR_PROPS,
        maxLevels: { type: "integer", description: "Truncate each side to N levels after canonical sort." },
      },
    },
    handler: async (args, ctx): Promise<ToolOutcome> => {
      const sel = marketSelector(args);
      const maxLevels = optInt(args, "maxLevels");
      const market = await resolveMarketOrThrow(ctx, sel);
      const ob = await clientOf(ctx).getOrderbook(market, maxLevels ? { maxLevels } : {});
      if (!ob.ok) return degraded(`orderbook for ${market.symbol}`, ob);
      const q = ob.data.quote;
      return {
        summary: `Lighter orderbook for ${market.symbol}: bid ${fmt(q.bestBid)} / ask ${fmt(q.bestAsk)} / mid ${fmt(q.mid)} (${q.bidDepth} bid × ${q.askDepth} ask levels) — public read (${ob.status}).`,
        structured: {
          ok: true,
          status: ob.status,
          rail: LIGHTER_CURRENT_RUNG,
          source: ob.source,
          capturedAtIso: ob.data.capturedAtIso,
          symbol: market.symbol,
          marketId: market.marketId,
          isStockToken: market.isStockToken,
          bids: ob.data.bids as unknown as JsonRecord[],
          asks: ob.data.asks as unknown as JsonRecord[],
          quote: ob.data.quote as unknown as JsonRecord,
          depth: ob.data.depth as unknown as JsonRecord,
        },
      };
    },
  },
  {
    name: "hiss_lighter_depth",
    title: "Read Lighter top-of-book + depth",
    kind: "read",
    description:
      "Compact READ: top-of-book quote (bid/ask/mid/spread) + aggregate per-side depth for one Lighter market, " +
      "without the full level ladder. Fail-closed exactly like the orderbook read. Public data only — no key, no signing.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { ...MARKET_SELECTOR_PROPS },
    },
    handler: async (args, ctx): Promise<ToolOutcome> => {
      const sel = marketSelector(args);
      const market = await resolveMarketOrThrow(ctx, sel);
      const ob = await clientOf(ctx).getOrderbook(market);
      if (!ob.ok) return degraded(`depth for ${market.symbol}`, ob);
      const q = ob.data.quote;
      return {
        summary: `Lighter top-of-book + depth for ${market.symbol}: mid ${fmt(q.mid)}, spread ${fmt(q.spreadBps)} bps, ${ob.data.depth.bidLevels} bid × ${ob.data.depth.askLevels} ask levels — public read (${ob.status}).`,
        structured: {
          ok: true,
          status: ob.status,
          rail: LIGHTER_CURRENT_RUNG,
          source: ob.source,
          capturedAtIso: ob.data.capturedAtIso,
          symbol: market.symbol,
          marketId: market.marketId,
          isStockToken: market.isStockToken,
          quote: ob.data.quote as unknown as JsonRecord,
          depth: ob.data.depth as unknown as JsonRecord,
        },
      };
    },
  },
];

// ---------------------------------------------------------------------------
// PREPARE tools (typed unsigned intents)
// ---------------------------------------------------------------------------

const PREPARE: ToolDefinition[] = [
  {
    name: "hiss_lighter_prepare_order",
    title: "Prepare an unsigned Lighter order intent",
    kind: "prepare",
    description:
      "PREPARE a typed UNSIGNED Lighter order intent: precision-scaled integer base amount + price for the " +
      "resolved market, order-type / time-in-force codes, expiry-bound validation, optional partner attribution, " +
      "the HISS risk envelope, and a deterministic intent hash. signed:false — HISS holds no key and submits " +
      "nothing. Fail-closed: any validation failure returns an error, never a partial intent.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["side", "size", "price", "orderType", "timeInForce", "clientOrderIndex"],
      properties: {
        ...MARKET_SELECTOR_PROPS,
        side: { type: "string", enum: ["buy", "sell"] },
        size: { type: ["string", "number"], description: "Human base amount (shares), e.g. 1.5." },
        price: {
          type: ["string", "number"],
          description:
            "Human limit price. For MARKET/IOC takers this is the WORST acceptable price and is required.",
        },
        orderType: {
          type: "string",
          enum: [
            "LIMIT",
            "MARKET",
            "STOP_LOSS",
            "STOP_LOSS_LIMIT",
            "TAKE_PROFIT",
            "TAKE_PROFIT_LIMIT",
            "TWAP",
          ],
        },
        timeInForce: { type: "string", enum: ["IMMEDIATE_OR_CANCEL", "GOOD_TILL_TIME", "POST_ONLY"] },
        clientOrderIndex: {
          type: "integer",
          description: "Caller-owned uint48 idempotency key (0..2^48-1).",
        },
        expiryMs: {
          type: "integer",
          description: "Absolute ms timestamp; required for GOOD_TILL_TIME (5min..30d).",
        },
        reduceOnly: { type: "boolean" },
        maxNotional: { type: ["number", "null"], description: "HISS risk envelope: max notional." },
        maxInventory: { type: ["number", "null"], description: "HISS risk envelope: max inventory." },
      },
    },
    handler: async (args, ctx): Promise<ToolOutcome> => {
      const sel = marketSelector(args);
      const market = await resolveMarketOrThrow(ctx, sel);
      const side = reqString(args, "side") as LighterSide;
      const out = prepareOrderIntent({
        market,
        side,
        size: numberOrString(args, "size"),
        price: numberOrString(args, "price"),
        orderType: reqString(args, "orderType") as LighterOrderTypeName,
        timeInForce: reqString(args, "timeInForce") as LighterTimeInForceName,
        clientOrderIndex: reqInt(args, "clientOrderIndex"),
        expiryMs: optInt(args, "expiryMs"),
        reduceOnly: optBool(args, "reduceOnly"),
        maxNotional: (optNumberOrString(args, "maxNotional") as number | undefined) ?? null,
        maxInventory: (optNumberOrString(args, "maxInventory") as number | undefined) ?? null,
        nowMs: nowMsOf(ctx),
      });
      return prepareOutcome(
        out.ok,
        out.errors,
        out.intent as unknown as JsonRecord | null,
        "order",
        market.symbol,
      );
    },
  },
  {
    name: "hiss_lighter_prepare_cancel",
    title: "Prepare an unsigned Lighter cancel intent",
    kind: "prepare",
    description:
      "PREPARE a typed UNSIGNED Lighter cancel intent for one resting order (by numeric orderIndex) on the " +
      "resolved market, with a deterministic intent hash. signed:false — HISS holds no key and submits nothing. " +
      "Fail-closed on a malformed order index.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["orderIndex"],
      properties: {
        ...MARKET_SELECTOR_PROPS,
        orderIndex: { type: "string", description: "Numeric order index to cancel (string of digits)." },
      },
    },
    handler: async (args, ctx): Promise<ToolOutcome> => {
      const sel = marketSelector(args);
      const market = await resolveMarketOrThrow(ctx, sel);
      const out = prepareCancelIntent({
        market,
        orderIndex: reqString(args, "orderIndex"),
        nowMs: nowMsOf(ctx),
      });
      return prepareOutcome(
        out.ok,
        out.errors,
        out.intent as unknown as JsonRecord | null,
        "cancel",
        market.symbol,
      );
    },
  },
  {
    name: "hiss_lighter_prepare_modify",
    title: "Prepare an unsigned Lighter modify intent",
    kind: "prepare",
    description:
      "PREPARE a typed UNSIGNED Lighter modify intent for one resting order (new size and/or new price, " +
      "precision-scaled to the resolved market) with a deterministic intent hash. signed:false — HISS holds no " +
      "key and submits nothing. Fail-closed when neither a new size nor a new price is supplied.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["orderIndex"],
      properties: {
        ...MARKET_SELECTOR_PROPS,
        orderIndex: { type: "string", description: "Numeric order index to modify (string of digits)." },
        newSize: { type: ["string", "number"], description: "New human base amount." },
        newPrice: { type: ["string", "number"], description: "New human limit price." },
      },
    },
    handler: async (args, ctx): Promise<ToolOutcome> => {
      const sel = marketSelector(args);
      const market = await resolveMarketOrThrow(ctx, sel);
      const out = prepareModifyIntent({
        market,
        orderIndex: reqString(args, "orderIndex"),
        newSize: optNumberOrString(args, "newSize"),
        newPrice: optNumberOrString(args, "newPrice"),
        nowMs: nowMsOf(ctx),
      });
      return prepareOutcome(
        out.ok,
        out.errors,
        out.intent as unknown as JsonRecord | null,
        "modify",
        market.symbol,
      );
    },
  },
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function fmt(v: number | null): string {
  return v === null ? "UNKNOWN" : String(v);
}

/** The context clock as epoch ms — threads the deterministic tool clock into
 *  intent preparation (preparedAtIso, GTT expiry bounds, intent hash). */
function nowMsOf(ctx: ToolContext): number {
  const t = Date.parse(ctx.nowIso);
  return Number.isFinite(t) ? t : Date.now();
}

/** Map a fail-closed READ result into a guarded DEGRADED outcome (never throws). */
function degraded(label: string, res: Extract<LighterReadResult<unknown>, { ok: false }>): ToolOutcome {
  return {
    summary: `Lighter ${label} is ${res.status} — ${res.reason}. Public market data reported honestly, no value fabricated.`,
    structured: {
      ok: false,
      status: res.status,
      rail: LIGHTER_CURRENT_RUNG,
      source: res.source,
      reason: res.reason,
    },
  };
}

/** Turn a prepare result into a guarded outcome; fail-closed maps to a typed error. */
function prepareOutcome(
  ok: boolean,
  errors: string[],
  intent: JsonRecord | null,
  opLabel: string,
  symbol: string,
): ToolOutcome {
  if (!ok || !intent) {
    throw new ToolInputError(
      `Refusing to prepare ${opLabel} for ${symbol}: fail-closed.`,
      errors.map((e) => ({ code: "LIGHTER_PREPARE", message: e })),
    );
  }
  return {
    summary: `Prepared an UNSIGNED Lighter ${opLabel} intent for ${symbol} (signed:false). Nothing was signed and nothing was sent.`,
    // `signed:false` comes from the intent; `liveTransactionSent:false` mirrors
    // the base + Stock-Premium prepare invariant (nothing reached any venue).
    structured: { ok: true, liveTransactionSent: false, ...intent, note: PREPARE_NOTE },
  };
}

/**
 * The 6 Lighter READ/PREPARE tools. Count is folded dynamically into
 * `HISS_TOOLS.length` — never hard-code the total.
 */
export const LIGHTER_TOOLS: ToolDefinition[] = [...READ, ...PREPARE];
