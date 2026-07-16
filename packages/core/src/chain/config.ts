// SPDX-License-Identifier: Apache-2.0
/**
 * Robinhood Chain network configuration.
 *
 * HISS Finance operates on Robinhood Chain (mainnet 4663 / testnet 46630).
 * RPC endpoints are the public documented defaults; callers may override them
 * with their own provider. Never point a live flow at a chain config whose id
 * is not one of the supported ids below.
 */

export type HissNetwork = "robinhood-mainnet" | "robinhood-testnet";

export type HissChainConfig = {
  id: number;
  name: string;
  network: HissNetwork;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: { default: { http: readonly string[] } };
  blockExplorers: { default: { name: string; url: string } };
};

export const ROBINHOOD_CHAIN_MAINNET = {
  id: 4663,
  name: "Robinhood Chain",
  network: "robinhood-mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
} as const satisfies HissChainConfig;

export const ROBINHOOD_CHAIN_TESTNET = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  network: "robinhood-testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://explorer.testnet.chain.robinhood.com" } },
} as const satisfies HissChainConfig;

export const ROBINHOOD_CHAIN_MAINNET_ID = 4663 as const;
export const ROBINHOOD_CHAIN_TESTNET_ID = 46630 as const;

export type RobinhoodChainId = typeof ROBINHOOD_CHAIN_MAINNET_ID | typeof ROBINHOOD_CHAIN_TESTNET_ID;

export const SUPPORTED_CHAINS: readonly HissChainConfig[] = [
  ROBINHOOD_CHAIN_MAINNET,
  ROBINHOOD_CHAIN_TESTNET,
];

export const SUPPORTED_CHAIN_IDS: readonly RobinhoodChainId[] = [
  ROBINHOOD_CHAIN_MAINNET_ID,
  ROBINHOOD_CHAIN_TESTNET_ID,
];

/** True when `chainId` is a supported Robinhood Chain id. */
export function isSupportedChainId(chainId: number): chainId is RobinhoodChainId {
  return chainId === ROBINHOOD_CHAIN_MAINNET_ID || chainId === ROBINHOOD_CHAIN_TESTNET_ID;
}

export function getChainById(chainId: number): HissChainConfig | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId);
}

/**
 * Assert that `chainId` is the expected Robinhood Chain id. Fail-closed:
 * pooled-vault and reward flows must reject any other chain (Base is never a
 * HISS chain).
 */
export function assertChainId(
  chainId: number,
  expected: RobinhoodChainId = ROBINHOOD_CHAIN_MAINNET_ID,
): void {
  if (chainId !== expected) {
    throw new Error(
      `wrong chain: expected Robinhood Chain ${expected}, got ${chainId}. HISS only operates on chain ${SUPPORTED_CHAIN_IDS.join(" / ")}.`,
    );
  }
}

export function explorerAddressUrl(chainId: number, address: string): string | undefined {
  const chain = getChainById(chainId);
  return chain ? `${chain.blockExplorers.default.url}/address/${address}` : undefined;
}

export function explorerTxUrl(chainId: number, txHash: string): string | undefined {
  const chain = getChainById(chainId);
  return chain ? `${chain.blockExplorers.default.url}/tx/${txHash}` : undefined;
}
