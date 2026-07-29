/**
 * Lighter public market-data READ client (Layer A).
 *
 * Reads ONLY public, unauthenticated endpoints — the hosted-safe surface. It
 * takes an injected `fetch` so it is pure and testable against recorded
 * fixtures, and every method returns a fail-closed `LighterReadResult`: a
 * failed / malformed read is DEGRADED with a precise reason, never a fabricated
 * value. No credential, key, or auth token is ever sent.
 */

import { LIGHTER_REST_BASE_URL } from "./constants.js";
import { findMarketById, findMarketBySymbol, parseMarkets, resolveStockTokenMarket } from "./markets.js";
import { normalizeOrderbook } from "./orderbook.js";
import type {
  LighterMarket,
  LighterOrderbook,
  LighterRawOrderBookOrdersResponse,
  LighterRawOrderBooksResponse,
  LighterRawRecentTradesResponse,
  LighterReadResult,
  LighterTradePrint,
} from "./types.js";

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface LighterClientOptions {
  fetchImpl: FetchLike;
  baseUrl?: string;
  timeoutMs?: number;
  now?: () => Date;
}

const DEFAULT_TIMEOUT_MS = 4000;

export class LighterReadClient {
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly now: () => Date;

  constructor(opts: LighterClientOptions) {
    this.fetchImpl = opts.fetchImpl;
    this.baseUrl = (opts.baseUrl ?? LIGHTER_REST_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = opts.now ?? (() => new Date());
  }

  private async getJson(path: string): Promise<unknown> {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : undefined;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        signal: controller?.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private iso(): string {
    return this.now().toISOString();
  }

  /** List all markets (public). */
  async getMarkets(): Promise<LighterReadResult<LighterMarket[]>> {
    const source = `${this.baseUrl}/api/v1/orderBooks`;
    try {
      const raw = (await this.getJson("/api/v1/orderBooks")) as LighterRawOrderBooksResponse;
      const markets = parseMarkets(raw);
      return { ok: true, status: "LIVE", data: markets, source, capturedAtIso: this.iso() };
    } catch (e) {
      return {
        ok: false,
        status: "DEGRADED",
        reason: `market list read failed: ${e instanceof Error ? e.message : String(e)}`,
        source,
      };
    }
  }

  /** Resolve a market by symbol OR stock ticker; MARKET_NOT_AVAILABLE if none. */
  async resolveMarket(query: {
    symbol?: string;
    ticker?: string;
    marketId?: number;
  }): Promise<LighterReadResult<LighterMarket>> {
    const list = await this.getMarkets();
    if (!list.ok) return list;
    let m: LighterMarket | undefined;
    if (query.marketId != null) m = findMarketById(list.data, query.marketId);
    else if (query.symbol) m = findMarketBySymbol(list.data, query.symbol);
    else if (query.ticker) m = resolveStockTokenMarket(list.data, query.ticker);
    if (!m) {
      return {
        ok: false,
        status: "MARKET_NOT_AVAILABLE",
        reason: `no market for ${JSON.stringify(query)}`,
        source: list.source,
      };
    }
    return { ok: true, status: "LIVE", data: m, source: list.source, capturedAtIso: this.iso() };
  }

  /** Fetch + normalize a market's orderbook. */
  async getOrderbook(
    market: LighterMarket,
    opts: { maxLevels?: number } = {},
  ): Promise<LighterReadResult<LighterOrderbook>> {
    const source = `${this.baseUrl}/api/v1/orderBookOrders?market_id=${market.marketId}`;
    try {
      const raw = (await this.getJson(
        `/api/v1/orderBookOrders?market_id=${market.marketId}&limit=50`,
      )) as LighterRawOrderBookOrdersResponse;
      const book = normalizeOrderbook(market.symbol, market.marketId, raw, {
        capturedAtIso: this.iso(),
        maxLevels: opts.maxLevels,
      });
      return { ok: true, status: "LIVE", data: book, source, capturedAtIso: this.iso() };
    } catch (e) {
      return {
        ok: false,
        status: "DEGRADED",
        reason: `orderbook read failed for ${market.symbol}: ${e instanceof Error ? e.message : String(e)}`,
        source,
      };
    }
  }

  /** Fetch + normalize recent trades. */
  async getRecentTrades(market: LighterMarket, limit = 20): Promise<LighterReadResult<LighterTradePrint[]>> {
    const source = `${this.baseUrl}/api/v1/recentTrades?market_id=${market.marketId}`;
    try {
      const raw = (await this.getJson(
        `/api/v1/recentTrades?market_id=${market.marketId}&limit=${limit}`,
      )) as LighterRawRecentTradesResponse;
      if (!raw || raw.code !== 200 || !Array.isArray(raw.trades)) {
        throw new Error(`unexpected recentTrades response (code=${raw?.code})`);
      }
      const trades: LighterTradePrint[] = raw.trades.map((t) => ({
        tradeId: t.trade_id_str ?? String(t.trade_id),
        marketId: t.market_id,
        price: Number(t.price),
        size: Number(t.size),
        usdAmount: Number(t.usd_amount),
        isMakerAsk: t.is_maker_ask,
        timestampMs: t.timestamp,
      }));
      return { ok: true, status: "LIVE", data: trades, source, capturedAtIso: this.iso() };
    } catch (e) {
      return {
        ok: false,
        status: "DEGRADED",
        reason: `recent-trades read failed for ${market.symbol}: ${e instanceof Error ? e.message : String(e)}`,
        source,
      };
    }
  }
}
