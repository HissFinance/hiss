import { describe, it, expect } from "vitest";
import { statusCommand, contractsCommand } from "../src/commands/status.js";
import { assertNoExecutionClaim } from "../src/lib/guard.js";
import type { HissClient } from "../src/lib/types.js";

/** Minimal mock RPC-backed client — only the reads under test are wired. */
function mockClient(overrides: Partial<HissClient> = {}): HissClient {
  const notImplemented = () => Promise.reject(new Error("not used in this test"));
  const base = {
    getProtocolStatus: () =>
      Promise.resolve({
        network: "robinhood-chain-mainnet",
        chain: "4663",
        token: { symbol: "HISS", address: "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3" },
        vaultCount: 1,
        treasurySafe: "0xF100Fc28dd1721C698046Dbd60408c523b69e36c",
      }),
    getContractRegistry: () => Promise.resolve({ hissToken: "0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3" }),
    listVaults: notImplemented,
    getVault: notImplemented,
    getVaultHoldings: notImplemented,
    getVaultPerformance: notImplemented,
    getStakingStatus: notImplemented,
    getRewardStatus: notImplemented,
    getVaultContributorReward: notImplemented,
    getProviderReward: notImplemented,
    getReceipt: notImplemented,
    getSupportedAssets: notImplemented,
    getFeeSchedule: notImplemented,
    prepareVaultCreation: notImplemented,
    prepareVaultDeposit: notImplemented,
    prepareVaultWithdrawal: notImplemented,
    prepareHissStake: notImplemented,
    prepareXhissCooldown: notImplemented,
    prepareXhissRedeem: notImplemented,
  } as unknown as HissClient;
  return { ...base, ...overrides };
}

describe("status command (mock RPC)", () => {
  it("reads a protocol snapshot and never claims execution", async () => {
    const result = await statusCommand(mockClient());
    expect(result.summary).toContain("robinhood-chain-mainnet");
    expect(() => assertNoExecutionClaim(result.summary)).not.toThrow();
    for (const line of result.detail ?? []) {
      expect(() => assertNoExecutionClaim(line)).not.toThrow();
    }
    const data = result.data as { network: string };
    expect(data.network).toBe("robinhood-chain-mainnet");
  });

  it("lists the contract registry", async () => {
    const result = await contractsCommand(mockClient());
    expect(result.summary).toContain("entr");
    expect(result.detail?.[0]).toContain("hissToken");
  });
});
