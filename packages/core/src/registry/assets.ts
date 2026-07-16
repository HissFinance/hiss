// SPDX-License-Identifier: Apache-2.0
/**
 * Public asset registry — the base asset (USDG) plus the $HISS token.
 *
 * The full tradable tokenized-asset universe (stock tokens, tokenized ETFs) is
 * a separate, jurisdiction-gated surface; this public registry pins only the
 * two tokens whose economics the open-source core reasons about: USDG (the
 * 6-decimal vault base asset) and $HISS (the 18-decimal protocol token).
 */

import { ROBINHOOD_CHAIN_MAINNET_ID, type RobinhoodChainId } from "../chain/config.js";
import type { Address } from "../address/address.js";

export type AssetClass = "stablecoin" | "governance_token";

export type AssetEntry = {
  symbol: string;
  address: Address;
  chainId: RobinhoodChainId;
  decimals: number;
  assetClass: AssetClass;
  role: "base_asset" | "protocol_token";
  issuer: string;
};

/** USDG — the only vault base asset. 6 decimals (never assume 18). */
export const USDG_ASSET: AssetEntry = Object.freeze({
  symbol: "USDG",
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  chainId: ROBINHOOD_CHAIN_MAINNET_ID,
  decimals: 6,
  assetClass: "stablecoin",
  role: "base_asset",
  issuer: "Paxos (Global Dollar Network)",
});

/** $HISS — the 18-decimal protocol token and xHISS staking asset. */
export const HISS_ASSET: AssetEntry = Object.freeze({
  symbol: "HISS",
  address: "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3",
  chainId: ROBINHOOD_CHAIN_MAINNET_ID,
  decimals: 18,
  assetClass: "governance_token",
  role: "protocol_token",
  issuer: "HISS Finance",
});

export const ASSET_REGISTRY: readonly AssetEntry[] = Object.freeze([USDG_ASSET, HISS_ASSET]);

export const USDG_DECIMALS = 6 as const;
export const HISS_DECIMALS = 18 as const;

export function getAssetBySymbol(symbol: string): AssetEntry | undefined {
  return ASSET_REGISTRY.find((a) => a.symbol === symbol.toUpperCase());
}

export function getAssetByAddress(address: string): AssetEntry | undefined {
  const needle = address.toLowerCase();
  return ASSET_REGISTRY.find((a) => a.address.toLowerCase() === needle);
}
