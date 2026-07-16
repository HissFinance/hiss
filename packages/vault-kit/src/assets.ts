/**
 * Supported-asset registry for vault candidates.
 *
 * A vault may only allocate to assets the protocol's on-chain
 * VaultAssetRegistry recognizes. This module is local-first: it ships the two
 * canonical base assets as a seed and lets callers layer a snapshot of the
 * registry (or an injected reader) on top. It never opens a network
 * connection itself — pass in a reader if you want live discovery.
 */

/** Canonical chain ids for Robinhood Chain. */
export const ROBINHOOD_CHAIN_MAINNET = 4663;
export const ROBINHOOD_CHAIN_TESTNET = 46630;

/** A single asset the registry recognizes as vault-allocatable. */
export interface SupportedAsset {
  symbol: string;
  address: string;
  decimals: number;
  /** True for the vault's settlement/base asset (USDG on the flagship). */
  base?: boolean;
  /** Free-form category, e.g. "stablecoin", "stock-token", "governance". */
  category?: string;
}

/** USDG — the canonical settlement asset for HISS USDG Creator Vaults. */
export const USDG_ASSET: SupportedAsset = {
  symbol: "USDG",
  address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
  decimals: 6,
  base: true,
  category: "stablecoin",
};

/** $HISS — the protocol token (used by staking, not a vault base asset). */
export const HISS_ASSET: SupportedAsset = {
  symbol: "HISS",
  address: "0x47162135cc8fb253f939bd70e3d2b83075eaeba3",
  decimals: 18,
  category: "governance",
};

/** Seed set every registry starts from. */
export const SEED_ASSETS: readonly SupportedAsset[] = [USDG_ASSET, HISS_ASSET];

function normAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * A local, immutable-by-convention view over the set of supported assets.
 * Construct it from a registry snapshot; query it while building a candidate.
 */
export class AssetRegistry {
  private readonly byAddress = new Map<string, SupportedAsset>();

  constructor(assets: readonly SupportedAsset[] = SEED_ASSETS) {
    for (const a of assets) this.add(a);
  }

  /** Add or replace an asset (keyed by lowercased address). */
  add(asset: SupportedAsset): this {
    this.byAddress.set(normAddress(asset.address), {
      ...asset,
      address: normAddress(asset.address),
    });
    return this;
  }

  /** Merge a snapshot of assets (e.g. read from VaultAssetRegistry). */
  addMany(assets: readonly SupportedAsset[]): this {
    for (const a of assets) this.add(a);
    return this;
  }

  /** All known assets, sorted by symbol then address for stable output. */
  list(): SupportedAsset[] {
    return [...this.byAddress.values()].sort((a, b) =>
      a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : a.address < b.address ? -1 : 1,
    );
  }

  /** Look up by address (case-insensitive). */
  getByAddress(address: string): SupportedAsset | undefined {
    return this.byAddress.get(normAddress(address));
  }

  /** Look up by exact symbol (case-sensitive to avoid ticker collisions). */
  getBySymbol(symbol: string): SupportedAsset | undefined {
    return this.list().find((a) => a.symbol === symbol);
  }

  /** True when the address is a recognized, allocatable asset. */
  isSupported(address: string): boolean {
    return this.byAddress.has(normAddress(address));
  }

  /** Assets in a given category (e.g. "stock-token"). */
  discover(category: string): SupportedAsset[] {
    return this.list().filter((a) => a.category === category);
  }
}

/**
 * Build a registry from a raw snapshot (as you might decode from the on-chain
 * VaultAssetRegistry) merged onto the seed base assets.
 */
export function assetRegistryFromSnapshot(snapshot: readonly SupportedAsset[]): AssetRegistry {
  return new AssetRegistry(SEED_ASSETS).addMany(snapshot);
}
