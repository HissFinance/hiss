// SPDX-License-Identifier: Apache-2.0
/**
 * Two symbol spaces that must NEVER be confused.
 *
 * - Token address space: a Robinhood Chain token is identified by a 0x
 *   contract address in the canonical registry (a `TokenRef`).
 * - Brokerage symbol space: a broker-side instrument is a plain ticker
 *   ("NVDA") in an agentic brokerage account (a `BrokerSymbol`).
 *
 * A brokerage ticker is never a token address and a token address is never a
 * ticker. The guards here fail closed on any cross-space value (a "0x…"
 * ticker or a ticker where an address is required).
 */

import { isAddress, type Address } from "../address/address.js";

/** A plain brokerage ticker, e.g. "NVDA". Never a 0x address. */
export type BrokerSymbol = string & { readonly __brand: "BrokerSymbol" };

/** A canonical on-chain token reference (address + display ticker). */
export type TokenRef = {
  /** Canonical ERC-20 contract address (identity). */
  address: Address;
  /** Display ticker for humans — never used as identity. */
  ticker: string;
  chainId: number;
};

const TICKER_PATTERN = /^[A-Z][A-Z0-9.]{0,9}$/;

/** True for a valid plain brokerage ticker (and NOT an address). */
export function isBrokerSymbol(value: unknown): value is BrokerSymbol {
  return typeof value === "string" && !value.startsWith("0x") && TICKER_PATTERN.test(value);
}

/**
 * Parse a brokerage ticker, rejecting anything address-shaped. This is the
 * boundary that stops a 0x address from leaking into the brokerage space.
 */
export function parseBrokerSymbol(value: string): BrokerSymbol {
  if (value.startsWith("0x")) {
    throw new Error(`symbol-space error: "${value}" is address-shaped; brokerage symbols are plain tickers`);
  }
  const upper = value.toUpperCase();
  if (!TICKER_PATTERN.test(upper)) {
    throw new Error(`invalid brokerage ticker: "${value}"`);
  }
  return upper as BrokerSymbol;
}

/**
 * Parse a token address, rejecting anything ticker-shaped. This is the
 * boundary that stops a plain ticker from being used where an on-chain
 * address is required.
 */
export function parseTokenAddress(value: string): Address {
  if (!value.startsWith("0x")) {
    throw new Error(`symbol-space error: "${value}" is a ticker; a 0x token address is required here`);
  }
  if (!isAddress(value)) {
    throw new Error(`invalid token address: "${value}"`);
  }
  return value;
}
