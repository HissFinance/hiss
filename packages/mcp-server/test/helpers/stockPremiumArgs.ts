import type { JsonRecord } from "../../src/lib/types.js";

/** Deterministic valid args for the 11 Stock-Premium tools (DEMO fixture engine). */
const ADDR = "0x1111111111111111111111111111111111111111";
const AAPL_POOL = "0x783c9bbb765047cfdd2b84b92b2ca9f11d34b7ed";
// AAPL demo spot is $320 → spot(18) = 320e18; a BUY floor must sit below spot.
const BUY_FLOOR_E18 = "288000000000000000000"; // 288e18 (90% of spot)
const NOW = 1_000_000;
const DEADLINE = 1_000_600;

export const STOCK_PREMIUM_ARGS: Record<string, JsonRecord> = {
  hiss_stock_token_registry: {},
  hiss_stock_premium_scan: {},
  hiss_stock_premium_explain: { symbol: "AAPL" },
  hiss_lp_ladder_preview: {
    symbol: "AAPL",
    boundaryPriceUsdE18: BUY_FLOOR_E18,
    totalCapital: "400000000",
    rungs: 4,
  },
  hiss_lp_position_read: { tokenId: "12345" },
  hiss_lp_verify_receipt: { receipt: { stage: "preparation", liveTransactionSent: false } },
  hiss_lp_prepare_mint: {
    symbol: "AAPL",
    authority: { address: ADDR },
    recipient: ADDR,
    boundaryPriceUsdE18: BUY_FLOOR_E18,
    totalCapital: "400000000",
    rungs: 4,
    intentNonce: "nonce-mint-1",
    deadlineUnix: DEADLINE,
    nowUnix: NOW,
  },
  hiss_lp_prepare_increase: {
    symbol: "AAPL",
    authority: { address: ADDR },
    recipient: ADDR,
    tokenId: "12345",
    poolAddress: AAPL_POOL,
    addAmount0: "1000000",
    minAmount0: "990000",
    minAmount1: "0",
    intentNonce: "nonce-inc-1",
    deadlineUnix: DEADLINE,
    nowUnix: NOW,
  },
  hiss_lp_prepare_withdraw: {
    symbol: "AAPL",
    authority: { address: ADDR },
    recipient: ADDR,
    tokenId: "12345",
    poolAddress: AAPL_POOL,
    liquidity: "1000000000",
    minAmount0: "0",
    minAmount1: "0",
    intentNonce: "nonce-wd-1",
    deadlineUnix: DEADLINE,
    nowUnix: NOW,
  },
  hiss_lp_prepare_collect: {
    symbol: "AAPL",
    authority: { address: ADDR },
    recipient: ADDR,
    tokenId: "12345",
    poolAddress: AAPL_POOL,
    amount0Max: "1000000",
    amount1Max: "0",
    intentNonce: "nonce-col-1",
    deadlineUnix: DEADLINE,
    nowUnix: NOW,
  },
  hiss_lp_prepare_close: {
    symbol: "AAPL",
    authority: { address: ADDR },
    recipient: ADDR,
    tokenId: "12345",
    poolAddress: AAPL_POOL,
    intentNonce: "nonce-close-1",
    deadlineUnix: DEADLINE,
    nowUnix: NOW,
  },
};

/** Malformed inputs per Stock-Premium tool — each must yield a TYPED error. */
export const STOCK_PREMIUM_NEGATIVE: Record<string, JsonRecord[]> = {
  hiss_stock_token_registry: [{ apiKey: "sk-live-x" }],
  hiss_stock_premium_scan: [{ probeUsdg: "12.5" }, { secret: "x" }],
  hiss_stock_premium_explain: [{}, { symbol: 123 }],
  hiss_lp_ladder_preview: [
    {}, // missing required
    { symbol: "AAPL", boundaryPriceUsdE18: "not-a-number", totalCapital: "400000000" },
  ],
  hiss_lp_position_read: [{}, { tokenId: "not-numeric" }],
  hiss_lp_verify_receipt: [{}, { receipt: "nope" }],
  hiss_lp_prepare_mint: [
    {}, // missing required
    {
      // wrong recipient (≠ authority)
      symbol: "AAPL",
      authority: { address: ADDR },
      recipient: "0x2222222222222222222222222222222222222222",
      boundaryPriceUsdE18: BUY_FLOOR_E18,
      totalCapital: "400000000",
      intentNonce: "n",
      deadlineUnix: DEADLINE,
      nowUnix: NOW,
    },
  ],
  hiss_lp_prepare_increase: [
    {},
    {
      // unknown pool
      symbol: "AAPL",
      authority: { address: ADDR },
      recipient: ADDR,
      tokenId: "12345",
      poolAddress: "0x3333333333333333333333333333333333333333",
      addAmount0: "1000000",
      minAmount0: "0",
      minAmount1: "0",
      intentNonce: "n",
      deadlineUnix: DEADLINE,
      nowUnix: NOW,
    },
  ],
  hiss_lp_prepare_withdraw: [
    {},
    {
      // expired deadline
      symbol: "AAPL",
      authority: { address: ADDR },
      recipient: ADDR,
      tokenId: "12345",
      poolAddress: AAPL_POOL,
      liquidity: "1000000000",
      minAmount0: "0",
      minAmount1: "0",
      intentNonce: "n",
      deadlineUnix: 999_000,
      nowUnix: NOW,
    },
  ],
  hiss_lp_prepare_collect: [
    {},
    {
      // replay
      symbol: "AAPL",
      authority: { address: ADDR },
      recipient: ADDR,
      tokenId: "12345",
      poolAddress: AAPL_POOL,
      amount0Max: "1000000",
      intentNonce: "seen-nonce",
      seenNonces: ["seen-nonce"],
      deadlineUnix: DEADLINE,
      nowUnix: NOW,
    },
  ],
  hiss_lp_prepare_close: [
    {},
    {
      // unsupported token
      symbol: "NOTATOKEN",
      authority: { address: ADDR },
      recipient: ADDR,
      tokenId: "12345",
      poolAddress: AAPL_POOL,
      intentNonce: "n",
      deadlineUnix: DEADLINE,
      nowUnix: NOW,
    },
  ],
};
