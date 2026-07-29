/**
 * Lighter (Robinhood instance) — TypeScript types.
 *
 * Two families of types live here:
 *   1. Raw wire shapes as returned by the public REST API (prefixed `LighterRaw*`),
 *      captured from live reads (see __fixtures__/*.raw.json).
 *   2. Normalized HISS-facing shapes that the market-data layer produces and the
 *      API routes / MCP read tools return.
 *
 * All numeric prices/sizes cross the boundary as strings or already-scaled
 * numbers; we never silently coerce precision (see precision.ts).
 */

import type { LighterMarketType } from "./constants.js";

// ---------------------------------------------------------------------------
// Raw wire shapes (subset of fields HISS reads) — verified against live JSON.
// ---------------------------------------------------------------------------

export interface LighterRawOrderBookEntry {
  symbol: string;
  market_id: number;
  market_type: LighterMarketType;
  base_asset_id: number;
  quote_asset_id: number;
  status: string; // "active" | ...
  taker_fee: string;
  maker_fee: string;
  is_taker_fee_enabled: boolean;
  is_maker_fee_enabled: boolean;
  min_base_amount: string;
  min_quote_amount: string;
  order_quote_limit: string;
  supported_size_decimals: number;
  supported_price_decimals: number;
  supported_quote_decimals: number;
  created_at: string;
  multiplier: string;
}

export interface LighterRawOrderBooksResponse {
  code: number;
  order_books: LighterRawOrderBookEntry[];
}

export interface LighterRawDepthOrder {
  order_index: number;
  order_id: string;
  owner_account_index: number;
  initial_base_amount: string;
  remaining_base_amount: string;
  price: string;
  order_expiry: number;
  transaction_time: number;
}

export interface LighterRawOrderBookOrdersResponse {
  code: number;
  total_asks: number;
  asks: LighterRawDepthOrder[];
  total_bids: number;
  bids: LighterRawDepthOrder[];
}

export interface LighterRawTrade {
  trade_id: number;
  trade_id_str: string;
  market_id: number;
  size: string;
  price: string;
  usd_amount: string;
  is_maker_ask: boolean;
  block_height: number;
  timestamp: number; // ms
}

export interface LighterRawRecentTradesResponse {
  code: number;
  trades: LighterRawTrade[];
}

// ---------------------------------------------------------------------------
// Normalized HISS-facing shapes.
// ---------------------------------------------------------------------------

/** A single tradable market on Lighter, normalized + classified. */
export interface LighterMarket {
  symbol: string;
  marketId: number;
  marketType: LighterMarketType;
  /** True when this is a Robinhood Stock-Token spot pair quoted in USDG. */
  isStockToken: boolean;
  /** Underlying ticker (e.g. "AAPL") for stock tokens, else the base symbol. */
  baseSymbol: string;
  quoteSymbol: string | null;
  baseAssetId: number;
  quoteAssetId: number;
  status: string;
  active: boolean;
  priceDecimals: number;
  sizeDecimals: number;
  quoteDecimals: number;
  minBaseAmount: string;
  minQuoteAmount: string;
  takerFee: string;
  makerFee: string;
}

/** A price level in a normalized orderbook. */
export interface LighterLevel {
  /** Human-readable decimal price. */
  price: number;
  /** Human-readable decimal size (base amount). */
  size: number;
}

/**
 * Normalized top-of-book + spread for one market. Any field may be null when
 * the book is empty / one-sided — HISS reports UNKNOWN, never a fabricated
 * price.
 */
export interface LighterQuote {
  symbol: string;
  marketId: number;
  bestBid: number | null;
  bestAsk: number | null;
  mid: number | null;
  spread: number | null;
  spreadBps: number | null;
  bidDepth: number; // number of bid levels observed
  askDepth: number; // number of ask levels observed
}

/** Normalized orderbook snapshot with levels + derived quote. */
export interface LighterOrderbook {
  symbol: string;
  marketId: number;
  bids: LighterLevel[]; // sorted best (highest) first
  asks: LighterLevel[]; // sorted best (lowest) first
  quote: LighterQuote;
  /** Aggregated notional (price*size) within N levels, per side. */
  depth: LighterDepthSummary;
  capturedAtIso: string;
}

/** Aggregated depth stats over the observed levels. */
export interface LighterDepthSummary {
  bidLevels: number;
  askLevels: number;
  /** Sum of size across observed bid levels. */
  bidBaseTotal: number;
  askBaseTotal: number;
  /** Sum of price*size across observed bid levels (quote notional). */
  bidQuoteTotal: number;
  askQuoteTotal: number;
}

/** Normalized recent trade. */
export interface LighterTradePrint {
  tradeId: string;
  marketId: number;
  price: number;
  size: number;
  usdAmount: number;
  isMakerAsk: boolean;
  timestampMs: number;
}

/**
 * A fail-closed read result. Every read returns one of these; a failed read is
 * DEGRADED with a precise reason, NEVER a fabricated value and NEVER silently
 * empty. `stale` marks a value served from a recorded fixture / last-known.
 */
export type LighterReadResult<T> =
  | { ok: true; status: "LIVE" | "STALE"; data: T; source: string; capturedAtIso: string }
  | { ok: false; status: "DEGRADED" | "MARKET_NOT_AVAILABLE"; reason: string; source: string };
