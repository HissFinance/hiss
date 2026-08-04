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

import { createPublicClient, http, keccak256, type Hex } from "viem";
import { verifyReceipt as vaultKitVerifyReceipt, type VaultKitReceipt } from "@hiss-finance/vault-kit";
import {
  ERC20_ABI,
  VAULT_ABI,
  VAULT_ASSET_REGISTRY_ABI,
  VAULT_V2_ABI,
  VAULT_V2_LIVENESS_ABI,
  VAULT_V2_PRICE_MESH_ABI,
  VAULT_V2_QUEUE_ABI,
  VAULT_V2_SETTLER_ABI,
  XHISS_ABI,
} from "./abi";
import { chainForId } from "./chains";
import {
  ADDRESSES,
  DECIMALS,
  ROBINHOOD_CHAIN_MAINNET,
  ROBINHOOD_MAINNET_RPC_URL,
  VAULT_LIFECYCLE,
  VAULT_V2_REBALANCE_POLICY,
  XHISS_TIMING,
} from "./constants";
import type {
  ContractRegistryEntry,
  ContractRegistryReport,
  ContractRegistryReportEntry,
  ProtocolStatus,
  ReadResult,
  StakingPosition,
  StakingStatus,
  VaultReads,
  VaultV2AssetCapacity,
  VaultV2Status,
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
      vaults: {
        canonicalDepositVault: ADDRESSES.vaultV2,
        canonicalLabel: VAULT_LIFECYCLE.canonicalLabel,
        legacyV1Vault: ADDRESSES.flagshipVault,
        legacyLabel: VAULT_LIFECYCLE.legacyLabel,
        note: "Static lifecycle facts — queue/keeper/capacity/pause state is a live read (getVaultV2Status).",
      },
      ...(block.error ? { note: `RPC unreachable: ${block.error}` } : {}),
    };
  }

  /** The canonical public contract registry (static addresses). */
  getContractRegistry(): ContractRegistryEntry[] {
    return [
      { key: "usdg", address: ADDRESSES.usdg, description: "USDG settlement asset (6 decimals)" },
      { key: "hiss", address: ADDRESSES.hiss, description: "$HISS protocol token (18 decimals)" },
      {
        key: "vaultV2",
        address: ADDRESSES.vaultV2,
        description: "HISS Vault V2 — canonical new-deposit vault (queue-routed epoch settlement)",
      },
      {
        key: "vaultV2RequestQueue",
        address: ADDRESSES.vaultV2RequestQueue,
        description: "HissRequestQueue — V2 deposit/USDG-redemption escrow + epoch queue",
      },
      {
        key: "vaultV2BatchSettler",
        address: ADDRESSES.vaultV2BatchSettler,
        description: "HissBatchSettler — V2 settlement/keeper/rebalance authority flags",
      },
      {
        key: "flagshipVault",
        address: ADDRESSES.flagshipVault,
        description: "HISS Vault (flagship V1, proxy) — LEGACY; closed to new deposits",
      },
      {
        key: "vaultFactory",
        address: ADDRESSES.vaultFactory,
        description: "VaultFactory (creates USDG vaults)",
      },
      { key: "xhissVault", address: ADDRESSES.xhissVault, description: "xHISS staking vault" },
    ];
  }

  /**
   * The contract registry as a canonical OBJECT report: the chain id, an
   * observation timestamp, and each entry enriched with a live runtime-bytecode
   * observation (`keccak256(eth_getCode)` + a deployment status). This is the
   * object shape MCP `structuredContent` requires — never a bare array.
   *
   * Fail-soft per entry: a degraded `eth_getCode` read yields
   * `status: "unknown"` with a null hash (UNKNOWN, never a fabricated hash and
   * never a false "no_bytecode"). An address with empty code is `no_bytecode`.
   */
  async getContractRegistryDetailed(
    observedAt: string = new Date().toISOString(),
  ): Promise<ContractRegistryReport> {
    const base = this.getContractRegistry();
    const entries = await Promise.all(
      base.map(async (e) => {
        const code = await soft<Hex | undefined>(
          () => this.client.getCode({ address: e.address }) as Promise<Hex | undefined>,
        );
        return mapRegistryEntry(e.key, e.address, code);
      }),
    );
    return { chainId: this.chainId, observedAt, entries };
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

  /** True when `address` is the canonical V2 vault. */
  private isVaultV2(address: string): boolean {
    return address.toLowerCase() === ADDRESSES.vaultV2.toLowerCase();
  }

  /**
   * Read a single vault's public state (fail-soft per field). Defaults to the
   * CANONICAL V2 vault. The legacy V1 flagship is still directly addressable —
   * it is labeled `legacy_v1` and never the deposit default.
   */
  async getVault(vault: `0x${string}` = ADDRESSES.vaultV2): Promise<VaultReads> {
    if (this.isVaultV2(vault)) return this.getVaultV2();

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

    const isLegacyV1 = vault.toLowerCase() === ADDRESSES.flagshipVault.toLowerCase();
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
      depositRoute: "erc4626_deposit",
      ...(isLegacyV1
        ? {
            lifecycle: "legacy_v1" as const,
            note:
              `${VAULT_LIFECYCLE.legacyLabel}. New deposits route to the canonical V2 vault ` +
              `(${ADDRESSES.vaultV2}). Live state above is a chain read, never assumed.`,
          }
        : { lifecycle: "unknown" as const }),
    };
  }

  /** Read the canonical V2 vault's public state (fail-soft per field). */
  async getVaultV2(): Promise<VaultReads> {
    const vault = ADDRESSES.vaultV2;
    const [name, symbol, asset, totalAssets, totalSupply, pps, paused, queueActive] = await Promise.all([
      soft(() => this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "name" })),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "symbol" })),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "asset" })),
      soft(() =>
        this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "totalAssets" }),
      ),
      soft(() =>
        this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "totalSupply" }),
      ),
      soft(
        () =>
          this.client.readContract({
            address: vault,
            abi: VAULT_V2_ABI,
            functionName: "pricePerShare",
          }) as Promise<readonly [bigint, number]>,
      ),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "paused" })),
      soft(() =>
        this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "queueActive" }),
      ),
    ]);

    // V2 pricePerShare returns (pps, availability) — surface pps, degraded on failure.
    const pricePerShare: ReadResult<string> =
      pps.state === "live" && pps.value != null
        ? { state: "live", value: pps.value[0].toString() }
        : { state: "degraded", value: null, ...(pps.error ? { error: pps.error } : {}) };

    return {
      address: vault,
      chainId: this.chainId,
      name,
      symbol,
      asset,
      totalAssets: mapBig(totalAssets),
      totalSupply: mapBig(totalSupply),
      pricePerShare,
      // No V1-style direct-deposit gate exists on V2 — deposits are queue-routed.
      acceptingPublicDeposits: {
        state: "degraded",
        value: null,
        error:
          "Not a V2 read: V2 has no direct-deposit gate. Deposits settle through the request queue — see queueActive/paused and getVaultV2Status().",
      },
      lifecycle: "canonical_v2",
      depositRoute: "request_queue",
      queueActive,
      paused,
      note: `${VAULT_LIFECYCLE.canonicalLabel}. Queue, keeper, and capacity state are live reads — see getVaultV2Status().`,
    };
  }

  /**
   * Discover known vaults: the CANONICAL V2 vault first, then the legacy V1
   * flagship as a separately labeled entry (never the deposit default).
   */
  async getVaults(): Promise<VaultReads[]> {
    const [v2, v1] = await Promise.all([this.getVaultV2(), this.getVault(ADDRESSES.flagshipVault)]);
    return [v2, v1];
  }

  /**
   * Live lane/status snapshot for the canonical V2 vault: pause + queue +
   * keeper/settlement/rebalance authority flags, liveness evidence, and
   * side-aware safe-notional capacity. Every leg is fail-soft (UNKNOWN on a
   * failed read — never fabricated, never "live", never "not deployed").
   * Rebalancing inactive is BY POLICY (owner-declared), not a fault state;
   * a live `rebalanceActive == true` read wins over the declaration.
   */
  async getVaultV2Status(): Promise<VaultV2Status> {
    const vault = ADDRESSES.vaultV2;
    const queue = ADDRESSES.vaultV2RequestQueue;
    const settler = ADDRESSES.vaultV2BatchSettler;

    const [
      block,
      vPaused,
      vSupply,
      vAssets,
      vCash,
      vQueueActive,
      vPendingRedeems,
      qPaused,
      qPending,
      qPendingDeposit,
      qPendingRedemption,
      sSettlement,
      sKeeper,
      sRebalance,
      livenessReport,
      heldCount,
    ] = await Promise.all([
      soft(() => this.client.getBlock()),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "paused" })),
      soft(() =>
        this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "totalSupply" }),
      ),
      soft(() =>
        this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "totalAssets" }),
      ),
      soft(() => this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "usdgCash" })),
      soft(() =>
        this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "queueActive" }),
      ),
      soft(() =>
        this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "pendingRedeemCount" }),
      ),
      soft(() =>
        this.client.readContract({ address: queue, abi: VAULT_V2_QUEUE_ABI, functionName: "paused" }),
      ),
      soft(() =>
        this.client.readContract({ address: queue, abi: VAULT_V2_QUEUE_ABI, functionName: "pendingCount" }),
      ),
      soft(() =>
        this.client.readContract({
          address: queue,
          abi: VAULT_V2_QUEUE_ABI,
          functionName: "pendingDepositUsdg",
        }),
      ),
      soft(() =>
        this.client.readContract({
          address: queue,
          abi: VAULT_V2_QUEUE_ABI,
          functionName: "pendingRedemptionShares",
        }),
      ),
      soft(() =>
        this.client.readContract({
          address: settler,
          abi: VAULT_V2_SETTLER_ABI,
          functionName: "settlementActive",
        }),
      ),
      soft(() =>
        this.client.readContract({
          address: settler,
          abi: VAULT_V2_SETTLER_ABI,
          functionName: "keeperActive",
        }),
      ),
      soft(() =>
        this.client.readContract({
          address: settler,
          abi: VAULT_V2_SETTLER_ABI,
          functionName: "rebalanceActive",
        }),
      ),
      soft(
        () =>
          this.client.readContract({
            address: ADDRESSES.vaultV2Liveness,
            abi: VAULT_V2_LIVENESS_ABI,
            functionName: "liveness",
          }) as Promise<{
            state: number;
            executionAllowed: boolean;
            displayAllowed: boolean;
            observedChainId: bigint;
            ageSeconds: bigint;
            producedBlocks: bigint;
            reason: string;
          }>,
      ),
      soft(() =>
        this.client.readContract({ address: vault, abi: VAULT_V2_ABI, functionName: "heldAssetCount" }),
      ),
    ]);

    // --- per-held-asset side-aware capacity (fail-soft, unknown != zero) ----
    const perAsset: VaultV2AssetCapacity[] = [];
    if (heldCount.state === "live" && heldCount.value != null) {
      const n = Number(heldCount.value);
      for (let i = 0; i < n; i += 1) {
        const token = await soft<`0x${string}`>(
          () =>
            this.client.readContract({
              address: vault,
              abi: VAULT_V2_ABI,
              functionName: "heldAssets",
              args: [BigInt(i)],
            }) as Promise<`0x${string}`>,
        );
        if (token.state !== "live" || token.value == null) continue;
        const [symbol, buy, sell] = await Promise.all([
          soft<string>(
            () =>
              this.client.readContract({
                address: token.value as `0x${string}`,
                abi: ERC20_ABI,
                functionName: "symbol",
              }) as Promise<string>,
          ),
          soft(
            () =>
              this.client.readContract({
                address: ADDRESSES.vaultV2PriceMesh,
                abi: VAULT_V2_PRICE_MESH_ABI,
                functionName: "maxSafeBuyNotionalUsdg",
                args: [token.value as `0x${string}`],
              }) as Promise<readonly [boolean, bigint, number]>,
          ),
          soft(
            () =>
              this.client.readContract({
                address: ADDRESSES.vaultV2PriceMesh,
                abi: VAULT_V2_PRICE_MESH_ABI,
                functionName: "maxSafeSellNotionalUsdg",
                args: [token.value as `0x${string}`],
              }) as Promise<readonly [boolean, bigint, number]>,
          ),
        ]);
        perAsset.push({
          token: token.value,
          symbol: mapStr(symbol),
          buyKnown: buy.state === "live" && buy.value != null ? buy.value[0] : null,
          buyNotionalUsdg: buy.state === "live" && buy.value != null ? buy.value[1].toString() : null,
          buyZeroReason: buy.state === "live" && buy.value != null ? buy.value[2] : null,
          sellKnown: sell.state === "live" && sell.value != null ? sell.value[0] : null,
          sellNotionalUsdg: sell.state === "live" && sell.value != null ? sell.value[1].toString() : null,
          sellZeroReason: sell.state === "live" && sell.value != null ? sell.value[2] : null,
        });
      }
    }

    // Min over KNOWN sides only; any unknown side ⇒ unknown overall (fail closed).
    const minSide = (side: "buy" | "sell"): string | null => {
      if (perAsset.length === 0) return null;
      let min: bigint | null = null;
      for (const a of perAsset) {
        const known = side === "buy" ? a.buyKnown : a.sellKnown;
        const notional = side === "buy" ? a.buyNotionalUsdg : a.sellNotionalUsdg;
        if (known !== true || notional === null) return null;
        const v = BigInt(notional);
        if (min === null || v < min) min = v;
      }
      return min === null ? null : min.toString();
    };
    const depositCapacity = minSide("buy");
    const sellCapacity = minSide("sell");
    let redemptionCapacity: string | null = null;
    if (sellCapacity !== null && vCash.state === "live" && vCash.value != null) {
      const cash = vCash.value as bigint;
      const cap = BigInt(sellCapacity);
      redemptionCapacity = (cap < cash ? cap : cash).toString();
    }

    // --- liveness + keeper lane ---------------------------------------------
    const LIVENESS_STATES = ["UNKNOWN", "UNAVAILABLE", "STALE", "DEGRADED", "OK"] as const;
    const liveness =
      livenessReport.state === "live" && livenessReport.value != null
        ? {
            state: LIVENESS_STATES[livenessReport.value.state] ?? ("UNKNOWN" as const),
            executionAllowed: livenessReport.value.executionAllowed,
            ageSeconds: livenessReport.value.ageSeconds.toString(),
          }
        : { state: null, executionAllowed: null, ageSeconds: null };

    const keeperState: VaultV2Status["keeper"]["state"] =
      sKeeper.state !== "live" || sKeeper.value == null
        ? "UNKNOWN"
        : sKeeper.value === false
          ? "INACTIVE"
          : liveness.executionAllowed === true
            ? "HEALTHY"
            : "DEGRADED";
    const keeperReason =
      keeperState === "HEALTHY"
        ? "Settler keeper authority active and liveness evidence fresh."
        : keeperState === "DEGRADED"
          ? "Keeper authority active but liveness evidence is stale/unknown — priced execution sizes down/zero until a heartbeat lands."
          : keeperState === "INACTIVE"
            ? "Settler keeper authority is owner-disabled."
            : "Keeper state unread (UNKNOWN, never assumed).";

    // --- rebalance lane: live flag wins; inactive is BY POLICY, not a fault --
    const rebActive = sRebalance.state === "live" && sRebalance.value != null ? sRebalance.value : null;
    const rebByPolicy = rebActive === false;
    const rebReason =
      rebActive === true
        ? "Bounded chunked rebalancing armed with owner-set targets (live read)."
        : rebActive === false
          ? VAULT_V2_REBALANCE_POLICY.reason
          : "Rebalance flag unread (UNKNOWN).";

    return {
      vault,
      chainId: this.chainId,
      source: {
        rpcUrl: this.rpcUrl,
        blockNumber:
          block.state === "live" && block.value != null && block.value.number != null
            ? block.value.number.toString()
            : null,
        blockTimestampUnix:
          block.state === "live" && block.value != null ? Number(block.value.timestamp) : null,
      },
      vaultReads: {
        paused: vPaused,
        totalSupply: mapBig(vSupply),
        totalAssets: mapBig(vAssets),
        usdgCash: mapBig(vCash),
        queueActive: vQueueActive,
        pendingRedeemCount: mapBig(vPendingRedeems),
      },
      queue: {
        address: queue,
        paused: qPaused,
        pendingCount: mapBig(qPending),
        pendingDepositUsdg: mapBig(qPendingDeposit),
        pendingRedemptionShares: mapBig(qPendingRedemption),
      },
      keeper: {
        state: keeperState,
        keeperActive: sKeeper,
        settlementActive: sSettlement,
        reason: keeperReason,
      },
      rebalancing: { active: rebActive, byPolicy: rebByPolicy, reason: rebReason },
      liveness,
      capacity: {
        immediateDepositCapacityUsdg: depositCapacity,
        immediateUsdgRedemptionCapacityUsdg: redemptionCapacity ?? sellCapacity,
        perAsset,
      },
      note: "Live chain reads on the canonical V2 vault. A failed leg is UNKNOWN (null/degraded) — never fabricated. Rebalancing inactive is owner-declared policy, not a fault state. Not a performance claim.",
    };
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
   * return, forecast, or performance claim. Defaults to the canonical V2
   * vault, whose pricePerShare read carries a mark-availability flag.
   */
  async getVaultPerformance(
    vault: `0x${string}` = ADDRESSES.vaultV2,
  ): Promise<{ vault: `0x${string}`; pricePerShare: ReadResult<string>; lifecycle?: string; note: string }> {
    if (this.isVaultV2(vault)) {
      const pps = await soft(
        () =>
          this.client.readContract({
            address: vault,
            abi: VAULT_V2_ABI,
            functionName: "pricePerShare",
          }) as Promise<readonly [bigint, number]>,
      );
      return {
        vault,
        pricePerShare:
          pps.state === "live" && pps.value != null
            ? { state: "live", value: pps.value[0].toString() }
            : { state: "degraded", value: null, ...(pps.error ? { error: pps.error } : {}) },
        lifecycle: "canonical_v2",
        note: "Price-per-share is a live chain read on the canonical V2 vault, not a return or forecast. Not a performance claim.",
      };
    }
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
    const isLegacyV1 = vault.toLowerCase() === ADDRESSES.flagshipVault.toLowerCase();
    return {
      vault,
      pricePerShare: pps,
      ...(isLegacyV1 ? { lifecycle: "legacy_v1" } : {}),
      note: "Price-per-share is a live chain read, not a return or forecast. Not a performance claim.",
    };
  }

  /** Strategy detail lives in the off-chain manifest; on-chain only the hash is pinned. */
  getVaultStrategy(vault: `0x${string}` = ADDRESSES.vaultV2): { vault: `0x${string}`; note: string } {
    return {
      vault,
      note: "A vault's strategy detail is the off-chain manifest whose keccak256 is pinned on-chain as strategyHash. Fetch the manifest via the HISS vault API or supply a candidate.",
    };
  }

  /** Fee configuration is per-vault; fetch specifics from the HISS vault API. */
  getVaultFees(vault: `0x${string}` = ADDRESSES.vaultV2): { vault: `0x${string}`; note: string } {
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

/**
 * Pure mapping from a fail-soft `eth_getCode` read to an enriched registry
 * entry. Exported for deterministic unit testing (no network). Degraded read →
 * `unknown` + null hash; empty code (`0x`/absent) → `no_bytecode` + null hash;
 * non-empty runtime code → `deployed` + `keccak256(code)`.
 */
export function mapRegistryEntry(
  name: string,
  address: `0x${string}`,
  code: ReadResult<Hex | undefined>,
): ContractRegistryReportEntry {
  if (code.state !== "live") return { name, address, runtimeCodeHash: null, status: "unknown" };
  const hex = code.value;
  if (!hex || hex === "0x") return { name, address, runtimeCodeHash: null, status: "no_bytecode" };
  return { name, address, runtimeCodeHash: keccak256(hex), status: "deployed" };
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
