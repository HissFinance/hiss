/**
 * Lighter precision handling.
 *
 * Lighter passes prices and base amounts as INTEGERS on the wire; the human
 * decimal value is `integer / 10^decimals`. The decimals are per-market and
 * MUST be read from orderBooks / orderBookDetails (`supported_price_decimals`,
 * `supported_size_decimals`) — never assumed (verified: Signing Transactions +
 * Get Started docs).
 *
 * A PREPARE intent must carry the exact integer values Lighter expects, so
 * these helpers convert human ⇄ integer deterministically and validate against
 * the market's minimums. We use integer math on scaled values to avoid float
 * drift; conversions round to the market tick and REJECT (throw) rather than
 * silently truncate a value that does not land on a valid tick.
 */

import type { LighterMarket } from "./types.js";

export class LighterPrecisionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "LighterPrecisionError";
  }
}

/** 10^n as an exact integer (n is small: decimals are single digits on Lighter). */
function pow10(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 18) {
    throw new LighterPrecisionError(`unsupported decimals: ${n}`, "BAD_DECIMALS");
  }
  return Math.round(10 ** n);
}

/**
 * Convert a human decimal string/number to the on-wire integer for a given
 * decimals count. Throws if the value has more precision than the market tick
 * (we never round away user-specified precision without their intent).
 */
export function toScaledInteger(value: string | number, decimals: number): number {
  const scale = pow10(decimals);
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num) || num < 0) {
    throw new LighterPrecisionError(`invalid amount: ${value}`, "BAD_AMOUNT");
  }
  const scaled = num * scale;
  const rounded = Math.round(scaled);
  // Reject values that do not land on a tick (beyond fp tolerance).
  if (Math.abs(scaled - rounded) > 1e-6) {
    throw new LighterPrecisionError(
      `value ${value} exceeds market precision of ${decimals} decimals`,
      "PRECISION_OVERFLOW",
    );
  }
  return rounded;
}

/** Convert an on-wire integer back to a human decimal number. */
export function fromScaledInteger(scaled: number, decimals: number): number {
  return scaled / pow10(decimals);
}

/** Convert a human price to the integer Lighter expects for this market. */
export function priceToInteger(market: LighterMarket, price: string | number): number {
  return toScaledInteger(price, market.priceDecimals);
}

/** Convert a human base amount (size) to the integer Lighter expects. */
export function baseAmountToInteger(market: LighterMarket, size: string | number): number {
  return toScaledInteger(size, market.sizeDecimals);
}

export interface AmountValidation {
  ok: boolean;
  reasons: string[];
}

/**
 * Validate a human (price, size) pair against a market's documented minimums.
 * Returns structured reasons — callers fail closed on `ok:false`.
 */
export function validateOrderAmounts(
  market: LighterMarket,
  size: string | number,
  price: string | number,
): AmountValidation {
  const reasons: string[] = [];
  const sizeNum = typeof size === "string" ? Number(size) : size;
  const priceNum = typeof price === "string" ? Number(price) : price;

  if (!Number.isFinite(sizeNum) || sizeNum <= 0) {
    reasons.push(`size must be a positive number (got ${size})`);
  }
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    reasons.push(`price must be a positive number (got ${price})`);
  }

  const minBase = Number(market.minBaseAmount);
  const minQuote = Number(market.minQuoteAmount);

  if (Number.isFinite(sizeNum) && sizeNum > 0 && Number.isFinite(minBase) && sizeNum < minBase) {
    reasons.push(`size ${sizeNum} below market minimum base amount ${market.minBaseAmount}`);
  }
  if (Number.isFinite(sizeNum) && Number.isFinite(priceNum) && sizeNum > 0 && priceNum > 0) {
    const notional = sizeNum * priceNum;
    if (Number.isFinite(minQuote) && notional < minQuote) {
      reasons.push(
        `notional ${notional.toFixed(6)} below market minimum quote amount ${market.minQuoteAmount}`,
      );
    }
  }

  // Precision check: values must land on the market tick.
  try {
    if (Number.isFinite(sizeNum) && sizeNum > 0) baseAmountToInteger(market, sizeNum);
  } catch (e) {
    reasons.push(e instanceof Error ? e.message : String(e));
  }
  try {
    if (Number.isFinite(priceNum) && priceNum > 0) priceToInteger(market, priceNum);
  } catch (e) {
    reasons.push(e instanceof Error ? e.message : String(e));
  }

  return { ok: reasons.length === 0, reasons };
}
