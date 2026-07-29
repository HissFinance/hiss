/**
 * Lighter market list — parsing, classification, and the verified Stock-Token
 * manifest.
 *
 * §13 CAPABILITY VERDICT (verified 2026-07-28 against live
 * https://api.rh.lighter.xyz/api/v1/orderBooks): Robinhood Stock-Token markets
 * EXIST. They are `market_type:"spot"` pairs quoted in USDG (quote_asset_id 3)
 * — 26 spot markets at capture time, e.g. AAPL/USDG (2049), TSLA/USDG (2055),
 * NVDA/USDG (2054). There are ALSO equity *perpetual* markets (e.g. INTC,
 * AMZN). This is NOT the ETH-perp example the docs lead with — the Stock-Token
 * model here is the USDG-quoted spot book. USDG is HISS's own vault asset, so
 * these are the directly relevant venues.
 *
 * The manifest below is a captured snapshot for offline/degraded parsing and
 * for a stable test baseline. LIVE reads always win; the manifest is a fallback
 * labelled STALE, never presented as live. If a caller asks for a stock market
 * that is neither live nor in the manifest, the result is MARKET_NOT_AVAILABLE
 * — we never fabricate a market.
 */

import { LIGHTER_MARKET_TYPE, LIGHTER_USDG_QUOTE_ASSET_ID } from "./constants.js";
import type { LighterMarket, LighterRawOrderBookEntry, LighterRawOrderBooksResponse } from "./types.js";

/** Provenance for the captured manifest. */
export const LIGHTER_MANIFEST_SOURCE = {
  endpoint: "https://api.rh.lighter.xyz/api/v1/orderBooks",
  capturedAtIso: "2026-07-28T18:05:24Z",
  fixtureSha256Prefix: "d8c1909677a30e29",
} as const;

/** True when a raw market entry is a Robinhood Stock-Token spot pair (/USDG). */
export function isStockTokenEntry(e: LighterRawOrderBookEntry): boolean {
  return (
    e.market_type === LIGHTER_MARKET_TYPE.SPOT &&
    e.quote_asset_id === LIGHTER_USDG_QUOTE_ASSET_ID &&
    e.symbol.endsWith("/USDG")
  );
}

/** Normalize + classify one raw orderBooks entry. */
export function normalizeMarket(e: LighterRawOrderBookEntry): LighterMarket {
  const stock = isStockTokenEntry(e);
  const [baseSymbol, quoteSymbol] = e.symbol.includes("/") ? e.symbol.split("/") : [e.symbol, null];
  return {
    symbol: e.symbol,
    marketId: e.market_id,
    marketType: e.market_type,
    isStockToken: stock,
    baseSymbol,
    quoteSymbol: quoteSymbol ?? null,
    baseAssetId: e.base_asset_id,
    quoteAssetId: e.quote_asset_id,
    status: e.status,
    active: e.status === "active",
    priceDecimals: e.supported_price_decimals,
    sizeDecimals: e.supported_size_decimals,
    quoteDecimals: e.supported_quote_decimals,
    minBaseAmount: e.min_base_amount,
    minQuoteAmount: e.min_quote_amount,
    takerFee: e.taker_fee,
    makerFee: e.maker_fee,
  };
}

/** Parse a full orderBooks response into normalized markets (fail-closed). */
export function parseMarkets(res: LighterRawOrderBooksResponse): LighterMarket[] {
  if (!res || res.code !== 200 || !Array.isArray(res.order_books)) {
    throw new Error(`unexpected orderBooks response (code=${res?.code})`);
  }
  return res.order_books.map(normalizeMarket);
}

/** Filter helpers. */
export function stockTokenMarkets(markets: LighterMarket[]): LighterMarket[] {
  return markets.filter((m) => m.isStockToken);
}
export function findMarketBySymbol(markets: LighterMarket[], symbol: string): LighterMarket | undefined {
  const s = symbol.toUpperCase();
  return markets.find((m) => m.symbol.toUpperCase() === s);
}
export function findMarketById(markets: LighterMarket[], marketId: number): LighterMarket | undefined {
  return markets.find((m) => m.marketId === marketId);
}

/**
 * Resolve a user-supplied stock ticker (e.g. "AAPL") to its /USDG spot market.
 * Returns undefined when no such stock-token market exists (→ caller emits
 * MARKET_NOT_AVAILABLE, never a fabricated market).
 */
export function resolveStockTokenMarket(markets: LighterMarket[], ticker: string): LighterMarket | undefined {
  const want = `${ticker.toUpperCase()}/USDG`;
  return markets.find((m) => m.isStockToken && m.symbol.toUpperCase() === want);
}

/**
 * Captured Stock-Token spot manifest (26 markets, 2026-07-28). Fields limited
 * to what a degraded/offline path needs. LIVE reads supersede this; it is
 * always labelled STALE when served.
 */
export const LIGHTER_STOCK_TOKEN_MANIFEST: ReadonlyArray<{
  symbol: string;
  marketId: number;
  baseSymbol: string;
  baseAssetId: number;
  priceDecimals: number;
  sizeDecimals: number;
  minBaseAmount: string;
  minQuoteAmount: string;
}> = [
  {
    symbol: "ETH/USDG",
    marketId: 2048,
    baseSymbol: "ETH",
    baseAssetId: 1,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0050",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "AAPL/USDG",
    marketId: 2049,
    baseSymbol: "AAPL",
    baseAssetId: 4,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0200",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "AMZN/USDG",
    marketId: 2050,
    baseSymbol: "AMZN",
    baseAssetId: 5,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0250",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "GOOGL/USDG",
    marketId: 2051,
    baseSymbol: "GOOGL",
    baseAssetId: 6,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0200",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "META/USDG",
    marketId: 2052,
    baseSymbol: "META",
    baseAssetId: 7,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0200",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "MSFT/USDG",
    marketId: 2053,
    baseSymbol: "MSFT",
    baseAssetId: 8,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0200",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "NVDA/USDG",
    marketId: 2054,
    baseSymbol: "NVDA",
    baseAssetId: 9,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0400",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "TSLA/USDG",
    marketId: 2055,
    baseSymbol: "TSLA",
    baseAssetId: 10,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0200",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "ORCL/USDG",
    marketId: 2056,
    baseSymbol: "ORCL",
    baseAssetId: 11,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0400",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "SPCX/USDG",
    marketId: 2057,
    baseSymbol: "SPCX",
    baseAssetId: 12,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0400",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "BABA/USDG",
    marketId: 2058,
    baseSymbol: "BABA",
    baseAssetId: 13,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0400",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "BE/USDG",
    marketId: 2059,
    baseSymbol: "BE",
    baseAssetId: 14,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0300",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "USAR/USDG",
    marketId: 2060,
    baseSymbol: "USAR",
    baseAssetId: 15,
    priceDecimals: 3,
    sizeDecimals: 3,
    minBaseAmount: "0.300",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "USO/USDG",
    marketId: 2061,
    baseSymbol: "USO",
    baseAssetId: 16,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0500",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "COIN/USDG",
    marketId: 2062,
    baseSymbol: "COIN",
    baseAssetId: 17,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0025",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "CRCL/USDG",
    marketId: 2063,
    baseSymbol: "CRCL",
    baseAssetId: 18,
    priceDecimals: 3,
    sizeDecimals: 3,
    minBaseAmount: "0.100",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "QQQ/USDG",
    marketId: 2064,
    baseSymbol: "QQQ",
    baseAssetId: 19,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0100",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "SPY/USDG",
    marketId: 2065,
    baseSymbol: "SPY",
    baseAssetId: 20,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0100",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "SGOV/USDG",
    marketId: 2066,
    baseSymbol: "SGOV",
    baseAssetId: 21,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0500",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "SLV/USDG",
    marketId: 2067,
    baseSymbol: "SLV",
    baseAssetId: 22,
    priceDecimals: 3,
    sizeDecimals: 3,
    minBaseAmount: "0.100",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "AMD/USDG",
    marketId: 2068,
    baseSymbol: "AMD",
    baseAssetId: 23,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0300",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "INTC/USDG",
    marketId: 2069,
    baseSymbol: "INTC",
    baseAssetId: 24,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0500",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "MU/USDG",
    marketId: 2070,
    baseSymbol: "MU",
    baseAssetId: 25,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0100",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "SNDK/USDG",
    marketId: 2071,
    baseSymbol: "SNDK",
    baseAssetId: 26,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0100",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "CRWV/USDG",
    marketId: 2072,
    baseSymbol: "CRWV",
    baseAssetId: 27,
    priceDecimals: 2,
    sizeDecimals: 4,
    minBaseAmount: "0.0400",
    minQuoteAmount: "10.000000",
  },
  {
    symbol: "PLTR/USDG",
    marketId: 2073,
    baseSymbol: "PLTR",
    baseAssetId: 28,
    priceDecimals: 3,
    sizeDecimals: 3,
    minBaseAmount: "0.050",
    minQuoteAmount: "10.000000",
  },
] as const;

/** Symbols HISS considers first-class Stock-Token venues (from the manifest). */
export const LIGHTER_STOCK_TOKEN_SYMBOLS: readonly string[] = LIGHTER_STOCK_TOKEN_MANIFEST.filter(
  (m) => m.baseSymbol !== "ETH",
).map((m) => m.symbol);
