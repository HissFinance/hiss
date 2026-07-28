/**
 * Lighter (Robinhood instance) — verified protocol constants.
 *
 * SOURCE OF TRUTH: the CURRENT official Lighter docs at
 * https://apidocs.rh.lighter.xyz (fetched + recorded 2026-07-28) and live
 * reads of https://api.rh.lighter.xyz/api/v1/orderBooks. Every enum value
 * here is quoted from those sources — nothing is assumed. See
 * docs/lighter/CAPABILITY_MANIFEST.md for the full research register and
 * per-value citations.
 *
 * HISS uses these constants for READ (public market data) and PREPARE (typed
 * unsigned order intent) only. HISS never signs, never submits, never holds a
 * Lighter API private key or auth token. Signing requires the official
 * Python/Go SDK (there is NO TypeScript/JS signer — confirmed by the SDK doc),
 * so signing lives entirely in the user-controlled local runtime.
 */

/** Robinhood-instance Lighter REST base (verified: Get Started + SDK docs). */
export const LIGHTER_REST_BASE_URL = "https://api.rh.lighter.xyz";

/** Robinhood-instance Lighter WebSocket stream (verified: WebSocket doc). */
export const LIGHTER_WS_URL = "wss://api.rh.lighter.xyz/stream";

/** Read-only WS variant for restricted regions (verified: WebSocket doc). */
export const LIGHTER_WS_URL_READONLY = "wss://api.rh.lighter.xyz/stream?readonly=true";

/** Official API docs index for agents (verified: Get Started doc). */
export const LIGHTER_LLMS_TXT_URL = "https://apidocs.rh.lighter.xyz/llms.txt";

/**
 * Order types (verified: Signing Transactions doc, "Order Types").
 * Numeric values are the on-wire uint8 `type` field.
 */
export const LIGHTER_ORDER_TYPE = {
  LIMIT: 0,
  MARKET: 1,
  STOP_LOSS: 2,
  STOP_LOSS_LIMIT: 3,
  TAKE_PROFIT: 4,
  TAKE_PROFIT_LIMIT: 5,
  TWAP: 6,
  // 7 (TWAPSubOrder) and 8 (LiquidationOrder) are internal — never client-created.
} as const;
export type LighterOrderTypeName = keyof typeof LIGHTER_ORDER_TYPE;

/** Order types a partner/client may create (excludes internal 7/8). */
export const LIGHTER_CLIENT_ORDER_TYPES: readonly LighterOrderTypeName[] = [
  "LIMIT",
  "MARKET",
  "STOP_LOSS",
  "STOP_LOSS_LIMIT",
  "TAKE_PROFIT",
  "TAKE_PROFIT_LIMIT",
  "TWAP",
] as const;

/** Time-in-force (verified: Signing Transactions doc, "Time in Force Options"). */
export const LIGHTER_TIME_IN_FORCE = {
  IMMEDIATE_OR_CANCEL: 0,
  GOOD_TILL_TIME: 1,
  POST_ONLY: 2,
} as const;
export type LighterTimeInForceName = keyof typeof LIGHTER_TIME_IN_FORCE;

/**
 * Order status (verified: Data Structures, Constants & Errors doc,
 * "Order Status (0-16)"). Only the anchors relevant to reconciliation are
 * enumerated with confidence; the CanceledOrder family occupies 4-16 with the
 * documented reason variants.
 */
export const LIGHTER_ORDER_STATUS = {
  IN_PROGRESS: 0, // in register
  PENDING: 1, // pending trigger
  ACTIVE_LIMIT: 2,
  FILLED: 3,
  // 4-16: canceled family — PostOnly, ReduceOnly, PositionNotAllowed,
  // MarginNotAllowed, TooMuchSlippage, NotEnoughLiquidity, SelfTrade, Expired,
  // OCO, Child, Liquidation, InvalidBalance (order per docs).
} as const;

/**
 * L2 transaction types (verified: Data Structures doc, "Transaction Types").
 * HISS only ever *describes* create/cancel/modify in a PREPARE intent — it
 * never signs or submits any of these.
 */
export const LIGHTER_TX_TYPE = {
  L2_TRANSFER: 12,
  L2_WITHDRAW: 13,
  L2_CREATE_ORDER: 14,
  L2_CANCEL_ORDER: 15,
  L2_MODIFY_ORDER: 17,
  L2_UPDATE_LEVERAGE: 20,
} as const;

/** Transaction status mapping (verified: Data Structures doc). */
export const LIGHTER_TX_STATUS = {
  FAILED: 0,
  PENDING: 1,
  EXECUTED: 2,
  PENDING_FINAL_STATE: 3,
} as const;

/** Market product types as reported by orderBooks.market_type (verified live). */
export const LIGHTER_MARKET_TYPE = {
  PERP: "perp",
  SPOT: "spot",
} as const;
export type LighterMarketType = (typeof LIGHTER_MARKET_TYPE)[keyof typeof LIGHTER_MARKET_TYPE];

/**
 * Order expiry bounds (verified: Signing Transactions doc — "a milliseconds
 * timestamp between 5 minutes and 30 days"). A prepared GTT order must carry
 * an expiry inside these bounds.
 */
export const LIGHTER_ORDER_EXPIRY_MIN_MS = 5 * 60 * 1000; // 5 minutes
export const LIGHTER_ORDER_EXPIRY_MAX_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Auth-token expiry ceilings (verified: API Keys doc). Documentation only —
 *  HISS never creates or holds a Lighter auth token. */
export const LIGHTER_AUTH_TOKEN_MAX_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8h standard token

/** client_order_index is a uint48 (verified: Signing Transactions doc). */
export const LIGHTER_CLIENT_ORDER_INDEX_MAX = 2 ** 48 - 1;

/** API key index range (verified: API Keys doc — 0..254, {0,1,2,3} reserved). */
export const LIGHTER_API_KEY_INDEX_MIN = 4;
export const LIGHTER_API_KEY_INDEX_MAX = 254;

/**
 * Error-code family ranges (verified: Data Structures doc, "Error Taxonomy").
 * Used to classify a Lighter error response into a stable family for
 * reconciliation without hard-coding every one of the ~200 codes.
 */
export const LIGHTER_ERROR_FAMILIES = [
  { name: "account", min: 21100, max: 21141 },
  { name: "public_pool", min: 21200, max: 21237 },
  { name: "collateral", min: 21300, max: 21305 },
  { name: "block_tx", min: 21400, max: 21516 },
  { name: "order_book", min: 21600, max: 21626 },
  { name: "order", min: 21700, max: 21745 },
  { name: "asset", min: 21801, max: 21809 },
  { name: "deleverage", min: 21901, max: 21906 },
  { name: "candlestick", min: 22400, max: 22403 },
  { name: "rate_limit", min: 23000, max: 23004 },
  { name: "general", min: 29404, max: 29501 },
  { name: "websocket", min: 30000, max: 30012 },
  { name: "referral", min: 41001, max: 41012 },
  { name: "api_token", min: 61001, max: 61009 },
  { name: "tier_change", min: 62001, max: 62006 },
] as const;

/** Classify a numeric Lighter error code into its documented family. */
export function classifyLighterError(code: number): string {
  for (const f of LIGHTER_ERROR_FAMILIES) {
    if (code >= f.min && code <= f.max) return f.name;
  }
  return "unknown";
}

/** The USDG quote asset id observed on every Robinhood stock-token spot pair. */
export const LIGHTER_USDG_QUOTE_ASSET_ID = 3;
