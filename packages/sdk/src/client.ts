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
import { ERC20_ABI, VAULT_ABI, XHISS_ABI } from "./abi";
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
   * Read a vault's ERC-20 holdings for a supplied set of asset addresses
   * (balanceOf(vault) per asset). Holdings must be read live — a manifest's
   * target weights are never a claim about current holdings. Without an asset
   * list there is nothing to read on-chain, so the result is degraded.
   */
  async getVaultHoldings(
    vault: `0x${string}`,
    assetAddresses: readonly `0x${string}`[] = [],
  ): Promise<{
    vault: `0x${string}`;
    holdings: { asset: `0x${string}`; balance: ReadResult<string> }[];
    note?: string;
  }> {
    if (assetAddresses.length === 0) {
      return {
        vault,
        holdings: [],
        note: "Supply the vault's asset addresses (e.g. from the asset registry) to read live holdings.",
      };
    }
    const holdings = await Promise.all(
      assetAddresses.map(async (asset) => ({
        asset,
        balance: mapBig(
          await soft<bigint>(
            () =>
              this.client.readContract({
                address: asset,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [vault],
              }) as Promise<bigint>,
          ),
        ),
      })),
    );
    return { vault, holdings };
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
