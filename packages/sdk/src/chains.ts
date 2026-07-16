/**
 * viem chain definitions for Robinhood Chain. The mainnet definition uses the
 * public, keyless RPC endpoint by default; callers may inject their own.
 */

import { defineChain } from "viem";
import {
  ROBINHOOD_CHAIN_MAINNET,
  ROBINHOOD_CHAIN_TESTNET,
  ROBINHOOD_MAINNET_EXPLORER,
  ROBINHOOD_MAINNET_RPC_URL,
} from "./constants";

/** Robinhood Chain mainnet (4663). */
export const robinhoodChainMainnet = defineChain({
  id: ROBINHOOD_CHAIN_MAINNET,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [ROBINHOOD_MAINNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: ROBINHOOD_MAINNET_EXPLORER },
  },
});

/** Robinhood Chain testnet (46630). RPC must be supplied by the caller. */
export const robinhoodChainTestnet = defineChain({
  id: ROBINHOOD_CHAIN_TESTNET,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [] },
  },
});

/** Pick a chain definition by id (defaults to mainnet). */
export function chainForId(chainId: number) {
  return chainId === ROBINHOOD_CHAIN_TESTNET ? robinhoodChainTestnet : robinhoodChainMainnet;
}
