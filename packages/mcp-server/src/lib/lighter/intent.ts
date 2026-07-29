/**
 * Lighter typed order INTENT — PREPARE ONLY (Layer B).
 *
 * HISS produces a fully-typed, UNSIGNED order intent: the exact integer-scaled
 * fields Lighter's SignerClient will need, wrapped in a HISS risk envelope
 * (max notional, max inventory, fuse checksum, strategy/intent/evidence hashes).
 *
 * HARD BOUNDARY (never violated by this module):
 *   - `signed` is ALWAYS false. There is no signing code path here.
 *   - No API private key, auth token, nonce, or account credential is accepted,
 *     stored, or emitted. `apiKeyIndex`/`accountIndex` are optional integer
 *     *references* only (identifiers, never secrets) and default to null.
 *   - The nonce is deliberately NOT set here — nonce management belongs to the
 *     user's local signer at submission time (per Signing Transactions doc).
 *
 * Signing + submission happen ONLY in the user-controlled local runtime using
 * the official Python/Go SDK (there is no TS/JS signer). See
 * docs/lighter/LOCAL_SIGNING_DESIGN.md.
 */

// Faithful port note: the private @hiss/core module hashes the intent with its
// receipts/canonical sha256 helper. The public mirror uses its own dependency-
// free canonical hash (lib/hash.ts, `0x`-prefixed sha256 over sorted-key JSON) —
// same determinism + idempotency guarantee, the mirror's own hash namespace.
import { canonicalHash as hashCanonical } from "../hash.js";
import {
  LIGHTER_CLIENT_ORDER_INDEX_MAX,
  LIGHTER_CLIENT_ORDER_TYPES,
  LIGHTER_ORDER_EXPIRY_MAX_MS,
  LIGHTER_ORDER_EXPIRY_MIN_MS,
  LIGHTER_ORDER_TYPE,
  LIGHTER_TIME_IN_FORCE,
  type LighterOrderTypeName,
  type LighterTimeInForceName,
} from "./constants.js";
import { baseAmountToInteger, priceToInteger, validateOrderAmounts } from "./precision.js";
import type { LighterMarket } from "./types.js";

export type LighterSide = "buy" | "sell";

/** Caller-supplied, human-readable order request. */
export interface LighterOrderRequest {
  market: LighterMarket;
  side: LighterSide;
  /** Human base amount (e.g. 1.5 shares). */
  size: string | number;
  /**
   * Human limit price. For MARKET / IOC taker orders this is the WORST price
   * accepted (per docs), and is REQUIRED — Lighter takers carry a price.
   */
  price: string | number;
  orderType: LighterOrderTypeName;
  timeInForce: LighterTimeInForceName;
  /** Unique uint48 client order index (caller-owned idempotency key). */
  clientOrderIndex: number;
  /** GTT expiry as an absolute ms timestamp; required for GOOD_TILL_TIME. */
  expiryMs?: number;
  reduceOnly?: boolean;
  /** Partner attribution (verified: Partner Attribution doc). Optional. */
  integratorAccountIndex?: number | null;
  integratorTakerFee?: number;
  integratorMakerFee?: number;
  /** HISS risk envelope (all optional; recorded into the intent + hash). */
  maxNotional?: number | null;
  maxInventory?: number | null;
  fuseChecksum?: string | null;
  strategyHash?: string | null;
  evidenceHash?: string | null;
  /** Non-secret references only — never a private key or auth token. */
  accountIndex?: number | null;
  apiKeyIndex?: number | null;
  /** Deterministic clock for hashing/tests. */
  nowMs?: number;
}

/** The typed, unsigned intent HISS emits. */
export interface LighterOrderIntent {
  readonly kind: "lighter.order.intent";
  readonly signed: false;
  version: 1;
  symbol: string;
  marketIndex: number;
  clientOrderIndex: number;
  side: LighterSide;
  isAsk: boolean;
  /** Integer-scaled base amount Lighter expects. */
  baseAmount: number;
  /** Integer-scaled price Lighter expects. */
  price: number;
  orderType: LighterOrderTypeName;
  orderTypeCode: number;
  timeInForce: LighterTimeInForceName;
  timeInForceCode: number;
  reduceOnly: boolean;
  expiryMs: number | null;
  /** Non-secret references (identifiers only). */
  accountIndex: number | null;
  apiKeyIndex: number | null;
  integrator: {
    accountIndex: number | null;
    takerFee: number | null;
    makerFee: number | null;
  };
  risk: {
    maxNotional: number | null;
    maxInventory: number | null;
    fuseChecksum: string | null;
    strategyHash: string | null;
    evidenceHash: string | null;
  };
  /** Human-readable echo for auditability. */
  human: { size: number; price: number; notional: number };
  preparedAtIso: string;
  /** Deterministic hash over all intent fields (idempotency + audit lineage). */
  intentHash: string;
}

export interface PrepareOutcome {
  ok: boolean;
  intent: LighterOrderIntent | null;
  errors: string[];
}

/**
 * Prepare a typed unsigned Lighter order intent. Fail-closed: any validation
 * failure returns `{ok:false, intent:null, errors}` — never a partial intent.
 */
export function prepareOrderIntent(req: LighterOrderRequest): PrepareOutcome {
  const errors: string[] = [];
  const m = req.market;

  if (!m || !m.active) errors.push(`market ${m?.symbol ?? "?"} is not active`);
  if (!LIGHTER_CLIENT_ORDER_TYPES.includes(req.orderType)) {
    errors.push(`unsupported order type: ${req.orderType}`);
  }
  if (!(req.timeInForce in LIGHTER_TIME_IN_FORCE)) {
    errors.push(`unsupported time-in-force: ${req.timeInForce}`);
  }
  if (
    !Number.isInteger(req.clientOrderIndex) ||
    req.clientOrderIndex < 0 ||
    req.clientOrderIndex > LIGHTER_CLIENT_ORDER_INDEX_MAX
  ) {
    errors.push(`clientOrderIndex must be a uint48 (0..${LIGHTER_CLIENT_ORDER_INDEX_MAX})`);
  }
  if (req.side !== "buy" && req.side !== "sell") {
    errors.push(`side must be "buy" or "sell" (got ${req.side})`);
  }

  // Amounts + precision (only meaningful once we have an active market).
  if (m) {
    const av = validateOrderAmounts(m, req.size, req.price);
    if (!av.ok) errors.push(...av.reasons);
  }

  // Expiry: GTT must be within [5min, 30d] from now.
  const now = req.nowMs ?? Date.now();
  let expiryMs: number | null = null;
  if (req.timeInForce === "GOOD_TILL_TIME") {
    if (typeof req.expiryMs !== "number") {
      errors.push("GOOD_TILL_TIME requires an absolute expiryMs timestamp");
    } else {
      const delta = req.expiryMs - now;
      if (delta < LIGHTER_ORDER_EXPIRY_MIN_MS || delta > LIGHTER_ORDER_EXPIRY_MAX_MS) {
        errors.push(
          `expiry must be between 5 minutes and 30 days from now (delta=${Math.round(delta / 1000)}s)`,
        );
      }
      expiryMs = req.expiryMs;
    }
  } else if (typeof req.expiryMs === "number") {
    expiryMs = req.expiryMs; // allowed but not required for non-GTT
  }

  // Integrator fee caps sanity (attribution, not secrets).
  if (
    req.integratorAccountIndex != null &&
    (req.integratorTakerFee == null || req.integratorMakerFee == null)
  ) {
    errors.push("integrator attribution requires both takerFee and makerFee");
  }

  if (errors.length > 0 || !m) {
    return { ok: false, intent: null, errors };
  }

  // Build scaled integers (these throw only on precision, already validated).
  let baseAmount: number;
  let price: number;
  try {
    baseAmount = baseAmountToInteger(m, req.size);
    price = priceToInteger(m, req.price);
  } catch (e) {
    return { ok: false, intent: null, errors: [e instanceof Error ? e.message : String(e)] };
  }

  const preparedAtIso = new Date(now).toISOString();
  const sizeNum = Number(req.size);
  const priceNum = Number(req.price);

  const core = {
    kind: "lighter.order.intent" as const,
    signed: false as const,
    version: 1 as const,
    symbol: m.symbol,
    marketIndex: m.marketId,
    clientOrderIndex: req.clientOrderIndex,
    side: req.side,
    isAsk: req.side === "sell",
    baseAmount,
    price,
    orderType: req.orderType,
    orderTypeCode: LIGHTER_ORDER_TYPE[req.orderType],
    timeInForce: req.timeInForce,
    timeInForceCode: LIGHTER_TIME_IN_FORCE[req.timeInForce],
    reduceOnly: Boolean(req.reduceOnly),
    expiryMs,
    accountIndex: req.accountIndex ?? null,
    apiKeyIndex: req.apiKeyIndex ?? null,
    integrator: {
      accountIndex: req.integratorAccountIndex ?? null,
      takerFee: req.integratorTakerFee ?? null,
      makerFee: req.integratorMakerFee ?? null,
    },
    risk: {
      maxNotional: req.maxNotional ?? null,
      maxInventory: req.maxInventory ?? null,
      fuseChecksum: req.fuseChecksum ?? null,
      strategyHash: req.strategyHash ?? null,
      evidenceHash: req.evidenceHash ?? null,
    },
    human: { size: sizeNum, price: priceNum, notional: sizeNum * priceNum },
    preparedAtIso,
  };

  const intent: LighterOrderIntent = {
    ...core,
    intentHash: hashCanonical(core),
  };

  return { ok: true, intent, errors: [] };
}

// ---------------------------------------------------------------------------
// Cancel + modify intents (prepare-only, unsigned).
// ---------------------------------------------------------------------------

export interface LighterCancelIntent {
  readonly kind: "lighter.cancel.intent";
  readonly signed: false;
  version: 1;
  symbol: string;
  marketIndex: number;
  orderIndex: string;
  preparedAtIso: string;
  intentHash: string;
}

export function prepareCancelIntent(args: { market: LighterMarket; orderIndex: string; nowMs?: number }): {
  ok: boolean;
  intent: LighterCancelIntent | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!args.market) errors.push("market required");
  if (!args.orderIndex || !/^\d+$/.test(String(args.orderIndex))) {
    errors.push("orderIndex must be a numeric string");
  }
  if (errors.length > 0) return { ok: false, intent: null, errors };
  const now = args.nowMs ?? Date.now();
  const core = {
    kind: "lighter.cancel.intent" as const,
    signed: false as const,
    version: 1 as const,
    symbol: args.market.symbol,
    marketIndex: args.market.marketId,
    orderIndex: String(args.orderIndex),
    preparedAtIso: new Date(now).toISOString(),
  };
  return { ok: true, intent: { ...core, intentHash: hashCanonical(core) }, errors: [] };
}

export interface LighterModifyIntent {
  readonly kind: "lighter.modify.intent";
  readonly signed: false;
  version: 1;
  symbol: string;
  marketIndex: number;
  orderIndex: string;
  newBaseAmount: number | null;
  newPrice: number | null;
  preparedAtIso: string;
  intentHash: string;
}

export function prepareModifyIntent(args: {
  market: LighterMarket;
  orderIndex: string;
  newSize?: string | number;
  newPrice?: string | number;
  nowMs?: number;
}): { ok: boolean; intent: LighterModifyIntent | null; errors: string[] } {
  const errors: string[] = [];
  if (!args.market) errors.push("market required");
  if (!args.orderIndex || !/^\d+$/.test(String(args.orderIndex))) {
    errors.push("orderIndex must be a numeric string");
  }
  if (args.newSize == null && args.newPrice == null) {
    errors.push("modify requires at least one of newSize / newPrice");
  }
  let newBaseAmount: number | null = null;
  let newPrice: number | null = null;
  if (args.market) {
    try {
      if (args.newSize != null) newBaseAmount = baseAmountToInteger(args.market, args.newSize);
      if (args.newPrice != null) newPrice = priceToInteger(args.market, args.newPrice);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (errors.length > 0) return { ok: false, intent: null, errors };
  const now = args.nowMs ?? Date.now();
  const core = {
    kind: "lighter.modify.intent" as const,
    signed: false as const,
    version: 1 as const,
    symbol: args.market.symbol,
    marketIndex: args.market.marketId,
    orderIndex: String(args.orderIndex),
    newBaseAmount,
    newPrice,
    preparedAtIso: new Date(now).toISOString(),
  };
  return { ok: true, intent: { ...core, intentHash: hashCanonical(core) }, errors: [] };
}
