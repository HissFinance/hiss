import type { HissClient, JsonRecord, UnsignedTx } from "../../src/lib/types.js";

function unsigned(description: string): UnsignedTx {
  return {
    chainId: 4663,
    to: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
    data: "0xabcdef",
    value: "0",
    description,
    signed: false,
  };
}

/** A deterministic mock RPC-backed client. Read values are deliberately plain. */
export function mockClient(): HissClient {
  const status: JsonRecord = {
    network: "robinhood-chain-mainnet",
    chain: "4663",
    token: { symbol: "HISS", address: "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3" },
    vaultCount: 1,
  };
  return {
    getProtocolStatus: () => Promise.resolve(status),
    getContractRegistry: () => Promise.resolve({ hissToken: status.token }),
    listVaults: () =>
      Promise.resolve([{ slug: "flagship", address: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6" }]),
    getVault: (ref) =>
      Promise.resolve({
        slug: ref,
        address: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
        baseAsset: "USDG",
      }),
    getVaultHoldings: () => Promise.resolve({ readAtIso: "2026-07-16T00:00:00Z", positions: [] }),
    getVaultPerformance: () => Promise.resolve({ window: "30d", points: [] }),
    getStakingStatus: () =>
      Promise.resolve({ vaultAddress: "0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be", stakingAsset: "HISS" }),
    getRewardStatus: () => Promise.resolve({ split: { xHissStakerBps: 5000 } }),
    getDepositorReward: () => Promise.resolve({ status: "not_yet_scored" }),
    getProviderReward: () => Promise.resolve({ status: "not_yet_scored" }),
    getReceipt: (id) => Promise.resolve({ id, kind: "state_read" }),
    getSupportedAssets: () => Promise.resolve([{ symbol: "USDG" }, { symbol: "AAPL" }]),
    getFeeSchedule: () => Promise.resolve({ swapFeeBps: 70 }),
    prepareVaultCreation: () => Promise.resolve(unsigned("Create a USDG Creator Vault.")),
    prepareVaultDeposit: (v, a) => Promise.resolve(unsigned(`Deposit ${a} USDG into ${v}.`)),
    prepareVaultWithdrawal: (v, s) => Promise.resolve(unsigned(`Withdraw ${s} shares from ${v}.`)),
    prepareHissStake: (a) => Promise.resolve(unsigned(`Stake ${a} HISS.`)),
    prepareXhissCooldown: (a) => Promise.resolve(unsigned(`Start cooldown for ${a} xHISS.`)),
    prepareXhissRedeem: () => Promise.resolve(unsigned("Redeem xHISS.")),
  };
}

/** A valid VaultManifest for prepare/validate tests. */
export const VALID_VAULT_MANIFEST: JsonRecord = {
  schema: "vault-manifest-1.0.0",
  chainId: 4663,
  name: "Example USDG Vault",
  baseAsset: "USDG",
  allowedAssets: ["USDG", "AAPL"],
  fees: { managementBps: 100, performanceBps: 1000 },
  creator: { address: "0x1111111111111111111111111111111111111111", skinInGameUsdg: 5000 },
  rebalance: { fuses: { maxAssetWeightBps: 4000, maxSlippageBps: 50, maxDailyTurnoverBps: 2000 } },
};

/** A valid CoilManifest for coil tests. */
export const VALID_COIL_MANIFEST: JsonRecord = {
  schema: "coil-manifest-1.0.0",
  name: "Momentum Sleeve",
  universe: ["AAPL", "MSFT", "NVDA"],
  rules: [{ when: "trend>0", weight: 0.33 }],
  fuses: { maxPositionBps: 2000, maxGrossExposureBps: 10000, allowShorting: false },
};
