/**
 * Lighter orderbook normalization + derived market microstructure.
 *
 * The public REST `orderBookOrders` endpoint returns individual resting orders
 * (not aggregated levels), so we aggregate by price into levels, sort each side
 * canonically (bids high→low, asks low→high), and derive bestBid/bestAsk/mid/
 * spread/spreadBps + per-side depth.
 *
 * FAIL-CLOSED: an empty or one-sided book yields null derived values — HISS
 * reports UNKNOWN, never a fabricated mid. `size` uses `remaining_base_amount`
 * (the still-fillable quantity), not the initial amount.
 */

import type {
  LighterDepthSummary,
  LighterLevel,
  LighterOrderbook,
  LighterQuote,
  LighterRawDepthOrder,
  LighterRawOrderBookOrdersResponse,
} from "./types.js";

/** Aggregate raw orders into price levels using remaining base amount. */
function aggregate(orders: LighterRawDepthOrder[]): Map<number, number> {
  const byPrice = new Map<number, number>();
  for (const o of orders) {
    const price = Number(o.price);
    const size = Number(o.remaining_base_amount);
    if (!Number.isFinite(price) || !Number.isFinite(size) || size <= 0) continue;
    byPrice.set(price, (byPrice.get(price) ?? 0) + size);
  }
  return byPrice;
}

function toLevels(byPrice: Map<number, number>, side: "bid" | "ask"): LighterLevel[] {
  const levels: LighterLevel[] = [...byPrice.entries()].map(([price, size]) => ({ price, size }));
  levels.sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price));
  return levels;
}

function depthOf(bids: LighterLevel[], asks: LighterLevel[]): LighterDepthSummary {
  const sum = (ls: LighterLevel[], f: (l: LighterLevel) => number) => ls.reduce((acc, l) => acc + f(l), 0);
  return {
    bidLevels: bids.length,
    askLevels: asks.length,
    bidBaseTotal: sum(bids, (l) => l.size),
    askBaseTotal: sum(asks, (l) => l.size),
    bidQuoteTotal: sum(bids, (l) => l.size * l.price),
    askQuoteTotal: sum(asks, (l) => l.size * l.price),
  };
}

/** Derive top-of-book quote (null-safe). */
export function deriveQuote(
  symbol: string,
  marketId: number,
  bids: LighterLevel[],
  asks: LighterLevel[],
): LighterQuote {
  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  let mid: number | null = null;
  let spread: number | null = null;
  let spreadBps: number | null = null;
  if (bestBid !== null && bestAsk !== null) {
    mid = (bestBid + bestAsk) / 2;
    spread = bestAsk - bestBid;
    spreadBps = mid > 0 ? (spread / mid) * 10_000 : null;
  }
  return {
    symbol,
    marketId,
    bestBid,
    bestAsk,
    mid,
    spread,
    spreadBps,
    bidDepth: bids.length,
    askDepth: asks.length,
  };
}

/**
 * Normalize a REST orderBookOrders response into a HISS orderbook. `maxLevels`
 * (optional) truncates each side AFTER sorting for depth/quote symmetry.
 */
export function normalizeOrderbook(
  symbol: string,
  marketId: number,
  res: LighterRawOrderBookOrdersResponse,
  opts: { capturedAtIso: string; maxLevels?: number } = { capturedAtIso: new Date().toISOString() },
): LighterOrderbook {
  if (!res || res.code !== 200) {
    throw new Error(`unexpected orderBookOrders response (code=${res?.code})`);
  }
  let bids = toLevels(aggregate(res.bids ?? []), "bid");
  let asks = toLevels(aggregate(res.asks ?? []), "ask");
  if (opts.maxLevels && opts.maxLevels > 0) {
    bids = bids.slice(0, opts.maxLevels);
    asks = asks.slice(0, opts.maxLevels);
  }
  return {
    symbol,
    marketId,
    bids,
    asks,
    quote: deriveQuote(symbol, marketId, bids, asks),
    depth: depthOf(bids, asks),
    capturedAtIso: opts.capturedAtIso,
  };
}
