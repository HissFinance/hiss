/**
 * A deterministic in-memory {@link HissClient} for examples, tests, and local
 * development. It returns PUBLIC, well-known values (addresses, split shape)
 * with honest provenance. It never fabricates balances or performance history:
 * balances default to zero and performance defaults to an empty series unless
 * you explicitly provide overrides.
 *
 * Do NOT use the mock as a source of truth for live state — it does not read
 * the chain.
 */

import { HISS_ADDRESSES, ROBINHOOD_CHAIN_ID, ROBINHOOD_CHAIN_NAME } from "../constants";
import type {
  HissClient,
  HissContracts,
  HissStatus,
  RewardStatus,
  TokenBalance,
  VaultDetail,
  VaultHolding,
  VaultPerformance,
  VaultSummaryData,
  XhissPosition,
} from "../types";

export type MockHissClientOverrides = {
  observedAt?: string;
  vaults?: VaultSummaryData[];
  holdings?: Record<string, VaultHolding[]>;
  performance?: Record<string, VaultPerformance["points"]>;
  balances?: Record<string, string>;
  xhissShares?: Record<string, string>;
};

const DEFAULT_OBSERVED_AT = "2026-07-16T00:00:00.000Z";

export function createMockHissClient(overrides: MockHissClientOverrides = {}): HissClient {
  const observedAt = overrides.observedAt ?? DEFAULT_OBSERVED_AT;
  const provenance = {
    status: "live" as const,
    observedAt,
    note: "mock client (public constants; not a live chain read)",
  };

  const contracts = [
    {
      name: "$HISS token",
      address: HISS_ADDRESSES.hissToken,
      chainId: ROBINHOOD_CHAIN_ID,
      status: "deployed" as const,
      role: "protocol token",
    },
    {
      name: "xHISS vault",
      address: HISS_ADDRESSES.xhissVault,
      chainId: ROBINHOOD_CHAIN_ID,
      status: "deployed" as const,
      role: "staking vault",
    },
    {
      name: "Flagship vault",
      address: HISS_ADDRESSES.flagshipVault,
      chainId: ROBINHOOD_CHAIN_ID,
      status: "deployed" as const,
      role: "USDG creator vault",
    },
  ];

  const defaultVaults: VaultSummaryData[] = overrides.vaults ?? [
    {
      address: HISS_ADDRESSES.flagshipVault,
      chainId: ROBINHOOD_CHAIN_ID,
      name: "HISS Flagship Vault",
      assetSymbol: "USDG",
      assetDecimals: 18,
      depositState: "unknown",
      provenance: { ...provenance, note: "deposit state must be read live; mock reports unknown" },
    },
  ];

  const key = (a: string) => a.toLowerCase();

  return {
    async getStatus(): Promise<HissStatus> {
      return { chainId: ROBINHOOD_CHAIN_ID, network: ROBINHOOD_CHAIN_NAME, provenance, contracts };
    },
    async getContracts(): Promise<HissContracts> {
      return { chainId: ROBINHOOD_CHAIN_ID, contracts };
    },
    async getVaults(): Promise<VaultSummaryData[]> {
      return defaultVaults;
    },
    async getVault(address: string): Promise<VaultDetail> {
      const summary = defaultVaults.find((v) => key(v.address) === key(address)) ?? {
        address,
        chainId: ROBINHOOD_CHAIN_ID,
        name: "Unknown vault",
        depositState: "unknown" as const,
        provenance: { status: "unknown" as const, observedAt, note: "not in mock set" },
      };
      return { ...summary, holdings: overrides.holdings?.[key(address)] ?? [] };
    },
    async getVaultHoldings(address: string): Promise<VaultHolding[]> {
      return overrides.holdings?.[key(address)] ?? [];
    },
    async getVaultPerformance(address: string): Promise<VaultPerformance> {
      const points = overrides.performance?.[key(address)] ?? [];
      return {
        address,
        points,
        provenance:
          points.length > 0
            ? provenance
            : { status: "unknown", observedAt, note: "no performance history in mock" },
      };
    },
    async getHissBalance(account: string): Promise<TokenBalance> {
      return {
        account,
        token: HISS_ADDRESSES.hissToken,
        amountBaseUnits: overrides.balances?.[key(account)] ?? "0",
        decimals: 18,
        symbol: "HISS",
        provenance,
      };
    },
    async getXhissPosition(account: string): Promise<XhissPosition> {
      return {
        account,
        shareBaseUnits: overrides.xhissShares?.[key(account)] ?? "0",
        provenance,
      };
    },
    async getRewardStatus(): Promise<RewardStatus> {
      return {
        version: "hiss-reward-split-v1",
        legs: [
          { name: "xHISS stakers", recipient: HISS_ADDRESSES.xhissVault, bps: 5000, state: "planned" },
          { name: "Depositor vesting", recipient: null, bps: 3000, state: "none" },
          { name: "Provider rewards", recipient: null, bps: 1000, state: "none" },
          { name: "Treasury", recipient: null, bps: 1000, state: "planned" },
        ],
        provenance: { ...provenance, note: "split shape is public; funding state must be read live" },
      };
    },
  };
}
