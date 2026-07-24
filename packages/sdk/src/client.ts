/**
 * HissClient — public, read-only chain access plus a home for the SDK's
 * prepare/verify surface.
 *
 * Reads use a viem PublicClient built from an injected RPC url. No HISS API
 * key is required for public reads. Every read is FAIL-SOFT: on any RPC error
 * the result is labeled `degraded` with `value: null` — never a fabricated
 * zero, never silently "live", never "not deployed". Callers must treat a
 * degraded read as UNKNOWN.
 *
 * This client reads and prepares. It never signs, never submits, never holds a
 * key, and never calls a credentialed endpoint.
 */

import { createPublicClient, http } from "viem";
import { verifyReceipt as vaultKitVerifyReceipt, type VaultKitReceipt } from "@hiss-finance/vault-kit";
import { ERC20_ABI, VAULT_ABI, VAULT_ASSET_REGISTRY_ABI, XHISS_ABI } from "./abi";
import { chainForId } from "./chains";
import {
  ADDRESSES,
  DECIMALS,
  ROBINHOOD_CHAIN_MAINNET,
  ROBINHOOD_MAINNET_RPC_URL,
  XHISS_TIMING,
} from "./constants";
import type {
  ContractRegistryEntry,
  ProtocolStatus,
  ReadResult,
  StakingPosition,
  StakingStatus,
  VaultReads,
} from "./types";

export interface HissClientOptions {
  /** JSON-RPC endpoint. Defaults to the public Robinhood Chain mainnet RPC. */
  rpcUrl?: string;
  /** Chain id (defaults to 4663). */
  chainId?: number;
}

/** Wrap a chain read so failure degrades instead of throwing. */
async function soft<T>(fn: () => Promise<T>): Promise<ReadResult<T>> {
  try {
    const value = await fn();
    return { state: "live", value };
  } catch (e) {
    return { state: "degraded", value: null, error: (e as Error).message };
  }
}

const str = (v: bigint) => v.toString();

/** Descriptive reward-split model (constants, not a chain read). */
export interface RewardModel {
  version: string;
  /** 50/15/15/10/10 split of verified $HISS trading fees. */
  legs: {
    xhissStakersBps: number;
    vaultProvidersBps: number;
    vaultContributorsBps: number;
    treasuryBps: number;
    /** Economic burn to the canonical dead address; does not reduce totalSupply. */
    burnBps: number;
  };
  /** Canonical economic-burn sink (dead address). */
  burnAddress: string;
  wethPolicy: string;
  note: string;
}

export class HissClient {
  readonly chainId: number;
  readonly rpcUrl: string;
  private readonly client: ReturnType<typeof createPublicClient>;

  constructor(options: HissClientOptions = {}) {
    this.chainId = options.chainId ?? ROBINHOOD_CHAIN_MAINNET;
    this.rpcUrl = options.rpcUrl ?? ROBINHOOD_MAINNET_RPC_URL;
    this.client = createPublicClient({
      chain: chainForId(this.chainId),
      transport: http(this.rpcUrl),
    });
  }

  // -------------------------------------------------------------------------
  // Protocol + registry
  // -------------------------------------------------------------------------

  /** Reachability + latest block. Fail-soft: `reachable: false` on RPC error. */
  async getProtocolStatus(): Promise<ProtocolStatus> {
    const block = await soft(() => this.client.getBlockNumber());
    return {
      chainId: this.chainId,
      rpcUrl: this.rpcUrl,
      reachable: block.state === "live",
      blockNumber: block.value != null ? block.value.toString() : null,
      ...(block.error ? { note: `RPC unreachable: ${block.error}` } : {}),
    };
  }

  /** The canonical public contract registry (static addresses). */
  getContractRegistry(): ContractRegistryEntry[] {
    return [
      { key: "usdg", address: ADDRESSES.usdg, description: "USDG settlement asset (6 decimals)" },
      { key: "hiss", address: ADDRESSES.hiss, description: "$HISS protocol token (18 decimals)" },
      { key: "flagshipVault", address: ADDRESSES.flagshipVault, description: "Flagship HISS Vault (proxy)" },
      {
        key: "vaultFactory",
        address: ADDRESSES.vaultFactory,
        description: "VaultFactory (creates USDG vaults)",
      },
      { key: "xhissVault", address: ADDRESSES.xhissVault, description: "xHISS staking vault" },
    ];
  }

  // -------------------------------------------------------------------------
  // Supported assets (on-chain VaultAssetRegistry allow-list)
  // -------------------------------------------------------------------------

  /** Enumerate the registry's allow-listed asset addresses (fail-soft). */
  private async registryAssetAddresses(): Promise<ReadResult<`0x${string}`[]>> {
    return soft(async () => {
      const count = (await this.client.readContract({
        address: ADDRESSES.vaultAssetRegistry,
        abi: VAULT_ASSET_REGISTRY_ABI,
        functionName: "assetCount",
      })) as bigint;
      const addrs: `0x${string}`[] = [];
      for (let i = 0n; i < count; i += 1n) {
        addrs.push(
          (await this.client.readContract({
            address: ADDRESSES.vaultAssetRegistry,
            abi: VAULT_ASSET_REGISTRY_ABI,
            functionName: "assetList",
            args: [i],
          })) as `0x${string}`,
        );
      }
      return addrs;
    });
  }

  /**
   * The canonical supported-asset set: the USDG base settlement asset and the
   * $HISS protocol token (from constants) plus the live VaultAssetRegistry
   * stock-token allow-list read from chain 4663. Fail-soft: if the registry
   * read degrades, the registry portion is labeled UNKNOWN and only the
   * canonical base assets are returned — never a fabricated list.
   */
  async getSupportedAssets(): Promise<{
    chainId: number;
    registry: `0x${string}`;
    source: "onchain_registry" | "degraded";
    base: Array<{ symbol: string; address: `0x${string}`; decimals: number; category: string; note: string }>;
    assets: Array<{
      symbol: ReadResult<string>;
      address: `0x${string}`;
      decimals: ReadResult<string>;
      category: string;
      enabled: ReadResult<boolean>;
      maxAllocationBps: ReadResult<string>;
    }>;
    count: number;
    note: string;
    registryError?: string;
  }> {
    const base = [
      {
        symbol: "USDG",
        address: ADDRESSES.usdg,
        decimals: DECIMALS.usdg,
        category: "stablecoin",
        note: "Vault base settlement asset.",
      },
      {
        symbol: "HISS",
        address: ADDRESSES.hiss,
        decimals: DECIMALS.hiss,
        category: "governance",
        note: "Protocol / staking token — not a vault-holdable asset.",
      },
    ];
    const addrs = await this.registryAssetAddresses();
    if (addrs.state !== "live" || addrs.value == null) {
      return {
        chainId: this.chainId,
        registry: ADDRESSES.vaultAssetRegistry,
        source: "degraded",
        base,
        assets: [],
        count: 0,
        note: "VaultAssetRegistry read is degraded (UNKNOWN) — showing only the canonical base assets. Retry against chain 4663; a degraded read is never treated as an empty allow-list.",
        ...(addrs.error ? { registryError: addrs.error } : {}),
      };
    }
    const assets = await Promise.all(
      addrs.value.map(async (address) => {
        const [symbol, decimals, policy] = await Promise.all([
          soft<string>(
            () =>
              this.client.readContract({
                address,
                abi: ERC20_ABI,
                functionName: "symbol",
              }) as Promise<string>,
          ),
          soft<number>(
            () =>
              this.client.readContract({
                address,
                abi: ERC20_ABI,
                functionName: "decimals",
              }) as Promise<number>,
          ),
          soft<{ enabled: boolean; maxAllocationBps: number }>(
            () =>
              this.client.readContract({
                address: ADDRESSES.vaultAssetRegistry,
                abi: VAULT_ASSET_REGISTRY_ABI,
                functionName: "getAssetPolicy",
                args: [address],
              }) as Promise<{ enabled: boolean; maxAllocationBps: number }>,
          ),
        ]);
        return {
          address,
          symbol: mapStr(symbol),
          decimals: mapNum(decimals),
          category: "stock-token",
          enabled:
            policy.state === "live" && policy.value != null
              ? ({ state: "live", value: policy.value.enabled } as ReadResult<boolean>)
              : ({ state: "degraded", value: null } as ReadResult<boolean>),
          maxAllocationBps:
            policy.state === "live" && policy.value != null
              ? ({ state: "live", value: String(policy.value.maxAllocationBps) } as ReadResult<string>)
              : ({ state: "degraded", value: null } as ReadResult<string>),
        };
      }),
    );
    return {
      chainId: this.chainId,
      registry: ADDRESSES.vaultAssetRegistry,
      source: "onchain_registry",
      base,
      assets,
      count: assets.length,
      note: "USDG (base) + HISS (protocol) + the live VaultAssetRegistry stock-token allow-list on chain 4663. Enabled/allocation policy is a live per-asset read.",
    };
  }

  // -------------------------------------------------------------------------
  // Vaults
  // -------------------------------------------------------------------------

  /** Read a single vault's public state (fail-soft per field). */
  async getVault(vault: `0x${string}` = ADDRESSES.flagshipVault): Promise<VaultReads> {
    const [name, symbol, asset, totalAssets, totalSupply, pricePerShare, accepting] = await Promise.all([
      soft(() => this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: "name" })),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: "symbol" })),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: "asset" })),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: "totalAssets" })),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: "totalSupply" })),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: "pricePerShare" })),
      soft(() =>
        this.client.readContract({ address: vault, abi: VAULT_ABI, functionName: "acceptingPublicDeposits" }),
      ),
    ]);

    return {
      address: vault,
      chainId: this.chainId,
      name,
      symbol,
      asset,
      totalAssets: mapBig(totalAssets),
      totalSupply: mapBig(totalSupply),
      pricePerShare: mapBig(pricePerShare),
      acceptingPublicDeposits: accepting,
    };
  }

  /** Discover known vaults. Today this is the flagship; extend with a snapshot. */
  async getVaults(): Promise<VaultReads[]> {
    return [await this.getVault(ADDRESSES.flagshipVault)];
  }

  /**
   * Read a vault's live ERC-20 holdings (balanceOf(vault) per asset). Holdings
   * are always a live chain read — a manifest's target weights are never a
   * claim about current holdings.
   *
   * When no asset list is supplied the set is resolved on-chain: the vault's
   * own base `asset()` plus every token in the VaultAssetRegistry allow-list.
   * Each holding is enriched with its live symbol/decimals. Fail-soft: if the
   * registry read degrades the result is labeled `degraded` (UNKNOWN) and only
   * the vault's base asset is read — never a fabricated or silently-empty set.
   */
  async getVaultHoldings(
    vault: `0x${string}`,
    assetAddresses: readonly `0x${string}`[] = [],
  ): Promise<{
    vault: `0x${string}`;
    source: "supplied" | "onchain_registry" | "degraded_base_only";
    holdings: {
      asset: `0x${string}`;
      symbol: ReadResult<string>;
      decimals: ReadResult<string>;
      balance: ReadResult<string>;
    }[];
    note?: string;
    registryError?: string;
  }> {
    let source: "supplied" | "onchain_registry" | "degraded_base_only" = "supplied";
    let note: string | undefined;
    let registryError: string | undefined;
    let assets: `0x${string}`[] = [...assetAddresses];

    if (assets.length === 0) {
      const baseAsset = await soft<`0x${string}`>(
        () =>
          this.client.readContract({
            address: vault,
            abi: VAULT_ABI,
            functionName: "asset",
          }) as Promise<`0x${string}`>,
      );
      const registry = await this.registryAssetAddresses();
      const set = new Map<string, `0x${string}`>();
      if (baseAsset.state === "live" && baseAsset.value)
        set.set(baseAsset.value.toLowerCase(), baseAsset.value);
      if (registry.state === "live" && registry.value) {
        for (const a of registry.value) set.set(a.toLowerCase(), a);
        source = "onchain_registry";
        note =
          "Holdings over the vault's base asset plus the live VaultAssetRegistry allow-list on chain 4663.";
      } else {
        source = "degraded_base_only";
        registryError = registry.error;
        note =
          "VaultAssetRegistry read is degraded (UNKNOWN); holdings cover only the vault's base asset. A degraded read is never treated as an empty allow-list.";
      }
      assets = [...set.values()];
    }

    const holdings = await Promise.all(
      assets.map(async (asset) => {
        const [symbol, decimals, balance] = await Promise.all([
          soft<string>(
            () =>
              this.client.readContract({
                address: asset,
                abi: ERC20_ABI,
                functionName: "symbol",
              }) as Promise<string>,
          ),
          soft<number>(
            () =>
              this.client.readContract({
                address: asset,
                abi: ERC20_ABI,
                functionName: "decimals",
              }) as Promise<number>,
          ),
          soft<bigint>(
            () =>
              this.client.readContract({
                address: asset,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [vault],
              }) as Promise<bigint>,
          ),
        ]);
        return { asset, symbol: mapStr(symbol), decimals: mapNum(decimals), balance: mapBig(balance) };
      }),
    );
    return {
      vault,
      source,
      holdings,
      ...(note ? { note } : {}),
      ...(registryError ? { registryError } : {}),
    };
  }

  /**
   * Read a vault's price-per-share. This is a point-in-time chain read, not a
   * return, forecast, or performance claim.
   */
  async getVaultPerformance(
    vault: `0x${string}` = ADDRESSES.flagshipVault,
  ): Promise<{ vault: `0x${string}`; pricePerShare: ReadResult<string>; note: string }> {
    const pps = mapBig(
      await soft<bigint>(
        () =>
          this.client.readContract({
            address: vault,
            abi: VAULT_ABI,
            functionName: "pricePerShare",
          }) as Promise<bigint>,
      ),
    );
    return {
      vault,
      pricePerShare: pps,
      note: "Price-per-share is a live chain read, not a return or forecast. Not a performance claim.",
    };
  }

  /** Strategy detail lives in the off-chain manifest; on-chain only the hash is pinned. */
  getVaultStrategy(vault: `0x${string}` = ADDRESSES.flagshipVault): { vault: `0x${string}`; note: string } {
    return {
      vault,
      note: "A vault's strategy detail is the off-chain manifest whose keccak256 is pinned on-chain as strategyHash. Fetch the manifest via the HISS vault API or supply a candidate.",
    };
  }

  /** Fee configuration is per-vault; fetch specifics from the HISS vault API. */
  getVaultFees(vault: `0x${string}` = ADDRESSES.flagshipVault): { vault: `0x${string}`; note: string } {
    return {
      vault,
      note: "Fee config (performance fee, referral) is set at creation. Read the vault's fee route on the HISS vault API for specifics. No guaranteed yield or APY.",
    };
  }

  // -------------------------------------------------------------------------
  // Staking (xHISS)
  // -------------------------------------------------------------------------

  /** xHISS staking status (fail-soft). Deployment/pause state is a live read. */
  async getStakingStatus(): Promise<StakingStatus> {
    const vault = ADDRESSES.xhissVault;
    const totalShares = await soft<bigint>(
      () =>
        this.client.readContract({
          address: vault,
          abi: XHISS_ABI,
          functionName: "totalSupply",
        }) as Promise<bigint>,
    );
    const totalStaked =
      totalShares.state === "live" && totalShares.value != null
        ? await soft<bigint>(
            () =>
              this.client.readContract({
                address: vault,
                abi: XHISS_ABI,
                functionName: "convertToAssets",
                args: [totalShares.value as bigint],
              }) as Promise<bigint>,
          )
        : ({ state: "degraded", value: null } as ReadResult<bigint>);

    const hissToken = await soft<`0x${string}`>(
      () =>
        this.client.readContract({
          address: vault,
          abi: XHISS_ABI,
          functionName: "hiss",
        }) as Promise<`0x${string}`>,
    );
    const paused = await soft<boolean>(
      () =>
        this.client.readContract({
          address: vault,
          abi: XHISS_ABI,
          functionName: "paused",
        }) as Promise<boolean>,
    );

    return {
      vault,
      chainId: this.chainId,
      hissToken,
      totalStaked: mapBig(totalStaked),
      totalShares: mapBig(totalShares),
      paused,
    };
  }

  /** A single account's xHISS position (balance, redeemable, cooldown). */
  async getStakingPosition(account: `0x${string}`): Promise<StakingPosition> {
    const vault = ADDRESSES.xhissVault;
    const shares = await soft<bigint>(
      () =>
        this.client.readContract({
          address: vault,
          abi: XHISS_ABI,
          functionName: "balanceOf",
          args: [account],
        }) as Promise<bigint>,
    );
    const redeemable =
      shares.state === "live" && shares.value != null
        ? await soft<bigint>(
            () =>
              this.client.readContract({
                address: vault,
                abi: XHISS_ABI,
                functionName: "convertToAssets",
                args: [shares.value as bigint],
              }) as Promise<bigint>,
          )
        : ({ state: "degraded", value: null } as ReadResult<bigint>);

    const cooldown = await soft<readonly [bigint, bigint, bigint]>(
      () =>
        this.client.readContract({
          address: vault,
          abi: XHISS_ABI,
          functionName: "cooldownOf",
          args: [account],
        }) as Promise<readonly [bigint, bigint, bigint]>,
    );

    const c0 = cooldown.value?.[0];
    const c1 = cooldown.value?.[1];
    const c2 = cooldown.value?.[2];

    return {
      vault,
      account,
      shares: mapBig(shares),
      redeemableHiss: mapBig(redeemable),
      cooldownShares:
        cooldown.state === "live" ? { state: "live", value: str(c0!) } : { state: "degraded", value: null },
      cooldownReadyAt:
        cooldown.state === "live" ? { state: "live", value: str(c1!) } : { state: "degraded", value: null },
      cooldownWindowEndsAt:
        cooldown.state === "live" ? { state: "live", value: str(c2!) } : { state: "degraded", value: null },
    };
  }

  // -------------------------------------------------------------------------
  // Rewards
  // -------------------------------------------------------------------------

  /**
   * The reward-split model (HISS_REWARD_METHOD_V2, 50/15/15/10/10 of verified
   * $HISS trading fees). Constants only. Whether any leg is funded or claimable
   * is a separate, gated, chain-verified fact — planned is not funded is not
   * claimable. The burn leg is an economic burn to the canonical dead address
   * and does NOT reduce HISS.totalSupply.
   */
  getRewardMethod(): RewardModel {
    return {
      version: "hiss-reward-split-v2",
      legs: {
        xhissStakersBps: 5000,
        vaultProvidersBps: 1500,
        vaultContributorsBps: 1500,
        treasuryBps: 1000,
        burnBps: 1000,
      },
      burnAddress: "0x000000000000000000000000000000000000dEaD",
      wethPolicy:
        "100% of claimed WETH routes to the Treasury Safe — never split, never to stakers or providers.",
      note: "These are split constants, not a promise of yield. 'Vault contributors' is the current name for the former depositor cohort. The burn leg is an economic burn to the dead address and does not reduce totalSupply. Some recipient distributors may be undeployed (null) — nothing moves against a null recipient. planned != funded != claimable.",
    };
  }

  /**
   * Reward status. Funding/claimability is owner-gated and chain-verified;
   * this SDK does not fabricate amounts. Returns the model plus an explicit
   * unknown-until-verified note.
   */
  getRewardStatus(): { model: RewardModel; funded: null; note: string } {
    return {
      model: this.getRewardMethod(),
      funded: null,
      note: "Funding and claimable amounts are unknown here — verify against live chain state and committed reward artifacts. A missing read is unknown, never zero and never 'live'.",
    };
  }

  // -------------------------------------------------------------------------
  // Receipts
  // -------------------------------------------------------------------------

  /** Receipts are produced by HISS tooling/APIs; verify them locally here. */
  getReceipts(): { receipts: []; note: string } {
    return {
      receipts: [],
      note: "Deterministic receipts are emitted by HISS APIs and the vault-kit builders. Fetch them from the vault's receipts route, then verify with verifyReceipt().",
    };
  }

  /** Verify a local receipt's content hash (delegates to @hiss-finance/vault-kit). */
  verifyReceipt(receipt: VaultKitReceipt): boolean {
    return vaultKitVerifyReceipt(receipt);
  }

  /** Convenience: the immutable xHISS timing constants. */
  get xhissTiming() {
    return XHISS_TIMING;
  }

  /** Convenience: canonical token decimals. */
  get decimals() {
    return DECIMALS;
  }
}

function mapBig(r: ReadResult<bigint>): ReadResult<string> {
  if (r.state === "live" && r.value != null) return { state: "live", value: r.value.toString() };
  return { state: "degraded", value: null, ...(r.error ? { error: r.error } : {}) };
}

function mapStr(r: ReadResult<string>): ReadResult<string> {
  if (r.state === "live" && r.value != null) return { state: "live", value: r.value };
  return { state: "degraded", value: null, ...(r.error ? { error: r.error } : {}) };
}

function mapNum(r: ReadResult<number>): ReadResult<string> {
  if (r.state === "live" && r.value != null) return { state: "live", value: String(r.value) };
  return { state: "degraded", value: null, ...(r.error ? { error: r.error } : {}) };
}
