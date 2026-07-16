// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  splitEligibleHiss,
  REWARD_SPLIT_BPS_TOTAL,
  XHISS_STAKER_BPS,
  DEPOSITOR_VESTING_BPS,
  PROVIDER_REWARDS_BPS,
  TREASURY_BPS,
  HISS_TREASURY_SAFE,
  hissRewardSplitRecipients,
} from "../src/rewards/split.js";
import {
  HISS_REWARD_METHOD_V1,
  allocateDepositorRewards,
  allocateProviderRewards,
  epochPoolBreakdown,
  linearVested,
  PROVIDER_COMPONENT_BPS,
  PROVIDER_DOMINANCE_CAP_BPS,
  DEPOSITOR_VEST_SECONDS,
  PROVIDER_VEST_SECONDS,
} from "../src/rewards/method.js";
import {
  canTransitionEpochState,
  assertEpochStateTransition,
  claimGateOpen,
} from "../src/rewards/lifecycle.js";

describe("50/30/10/10 split", () => {
  it("legs sum to exactly 10,000 bps", () => {
    expect(XHISS_STAKER_BPS + DEPOSITOR_VESTING_BPS + PROVIDER_REWARDS_BPS + TREASURY_BPS).toBe(10_000);
    expect(REWARD_SPLIT_BPS_TOTAL).toBe(10_000);
  });

  it("splits an amount exactly, treasury absorbs the dust", () => {
    // 10001 base units: floor legs 5000/3000/1000, treasury = 1001 (absorbs +1).
    const s = splitEligibleHiss("10001");
    expect(s.xHissStakerAmount).toBe("5000");
    expect(s.depositorVestingAmount).toBe("3000");
    expect(s.providerRewardsAmount).toBe("1000");
    expect(s.treasuryAmount).toBe("1001");
    const sum =
      BigInt(s.xHissStakerAmount) +
      BigInt(s.depositorVestingAmount) +
      BigInt(s.providerRewardsAmount) +
      BigInt(s.treasuryAmount);
    expect(sum).toBe(10001n);
  });

  it("handles a round amount with zero dust", () => {
    const s = splitEligibleHiss("10000");
    expect(s.treasuryAmount).toBe("1000");
  });

  it("rejects a malformed amount", () => {
    expect(() => splitEligibleHiss("-5")).toThrow();
    expect(() => splitEligibleHiss("1.5")).toThrow();
  });

  it("pins treasury + WETH recipients to the Safe; distributors default null", () => {
    const r = hissRewardSplitRecipients();
    expect(r.treasury).toBe(HISS_TREASURY_SAFE);
    expect(r.wethRecipient).toBe(HISS_TREASURY_SAFE);
    expect(r.depositorVestingDistributor).toBeNull();
    expect(r.providerRewardsDistributor).toBeNull();
  });
});

describe("epoch pool breakdown", () => {
  it("splits eligible HISS into the four pools", () => {
    const b = epochPoolBreakdown("10000");
    expect(b.xHissStakerPool).toBe("5000");
    expect(b.depositorPool).toBe("3000");
    expect(b.providerPool).toBe("1000");
    expect(b.treasuryPool).toBe("1000");
  });
});

describe("depositor rewards — share-seconds", () => {
  it("allocates pro-rata by shares x seconds held", () => {
    // A: 100 shares for 100s = 10000 ss. B: 100 shares for 300s = 30000 ss.
    // Pool 4000 -> A gets 1000, B gets 3000.
    const r = allocateDepositorRewards({
      poolAmount: "4000",
      vestStart: 1_000_000,
      intervals: [
        {
          depositor: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          shares: "100",
          startTime: 0,
          endTime: 100,
        },
        {
          depositor: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
          shares: "100",
          startTime: 0,
          endTime: 300,
        },
      ],
    });
    const byAddr = Object.fromEntries(r.allocations.map((a) => [a.depositor, a.amount]));
    expect(byAddr["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]).toBe("1000");
    expect(byAddr["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]).toBe("3000");
    expect(r.dust).toBe("0");
    expect(r.allocations[0]!.vestEnd - r.allocations[0]!.vestStart).toBe(DEPOSITOR_VEST_SECONDS);
  });

  it("leaves floor-division remainder as dust", () => {
    const r = allocateDepositorRewards({
      poolAmount: "10",
      vestStart: 0,
      intervals: [
        { depositor: "0x1111111111111111111111111111111111111111", shares: "1", startTime: 0, endTime: 1 },
        { depositor: "0x2222222222222222222222222222222222222222", shares: "1", startTime: 0, endTime: 1 },
        { depositor: "0x3333333333333333333333333333333333333333", shares: "1", startTime: 0, endTime: 1 },
      ],
    });
    const distributed = r.allocations.reduce((s, a) => s + BigInt(a.amount), 0n);
    expect(distributed + BigInt(r.dust)).toBe(10n);
    expect(r.dust).toBe("1");
  });
});

describe("provider rewards — 40/30/20/10 with 25% cap", () => {
  it("uses the canonical component split and cap constants", () => {
    expect(PROVIDER_COMPONENT_BPS.equalBps).toBe(4000);
    expect(PROVIDER_COMPONENT_BPS.externalTvlBps).toBe(3000);
    expect(PROVIDER_COMPONENT_BPS.retentionBps).toBe(2000);
    expect(PROVIDER_COMPONENT_BPS.operationalBps).toBe(1000);
    expect(PROVIDER_DOMINANCE_CAP_BPS).toBe(2500);
  });

  it("no eligible groups => everything rolls over", () => {
    const r = allocateProviderRewards({ poolAmount: "1000", vestStart: 0, groups: [] });
    expect(r.rolloverToNextEpoch).toBe("1000");
    expect(r.eligibleGroupCount).toBe(0);
  });

  it("enforces the 25% dominance cap with rollover", () => {
    // One dominant group and four tiny ones. The dominant group's raw score
    // exceeds 25% of the pool; the cap pulls it down and the rest is
    // redistributed / rolled over. No single group exceeds 25% of the pool.
    const groups = [
      {
        registryKey: "big",
        eligible: true,
        externalTvlDays: "1000000",
        retentionScore: "1000000",
        operationalBps: 10000,
      },
      { registryKey: "s1", eligible: true, externalTvlDays: "1", retentionScore: "1", operationalBps: 1 },
      { registryKey: "s2", eligible: true, externalTvlDays: "1", retentionScore: "1", operationalBps: 1 },
      { registryKey: "s3", eligible: true, externalTvlDays: "1", retentionScore: "1", operationalBps: 1 },
      { registryKey: "s4", eligible: true, externalTvlDays: "1", retentionScore: "1", operationalBps: 1 },
    ];
    const pool = 1_000_000n;
    const r = allocateProviderRewards({ poolAmount: pool.toString(), vestStart: 0, groups });
    const cap = (pool * BigInt(PROVIDER_DOMINANCE_CAP_BPS)) / 10_000n;
    for (const a of r.allocations) {
      expect(BigInt(a.amount) <= cap).toBe(true);
    }
    const distributed = r.allocations.reduce((s, a) => s + BigInt(a.amount), 0n);
    expect(distributed + BigInt(r.rolloverToNextEpoch)).toBeLessThanOrEqual(pool);
    expect(r.allocations.find((a) => a.registryKey === "big")!.capApplied).toBe(true);
  });

  it("provider vest window is 90 days", () => {
    const r = allocateProviderRewards({
      poolAmount: "100",
      vestStart: 500,
      groups: [
        { registryKey: "g", eligible: true, externalTvlDays: "1", retentionScore: "1", operationalBps: 1 },
      ],
    });
    expect(r.allocations[0]!.vestEnd - r.allocations[0]!.vestStart).toBe(PROVIDER_VEST_SECONDS);
  });
});

describe("linear vesting", () => {
  it("is 0 before start, total at/after end, linear in between", () => {
    expect(linearVested(1000n, 100, 200, 50)).toBe(0n);
    expect(linearVested(1000n, 100, 200, 200)).toBe(1000n);
    expect(linearVested(1000n, 100, 200, 150)).toBe(500n);
  });
});

describe("methodology bundle + lifecycle", () => {
  it("exposes the canonical split and cap", () => {
    expect(HISS_REWARD_METHOD_V1.split.xHissStakerBps).toBe(5000);
    expect(HISS_REWARD_METHOD_V1.provider.dominanceCapBps).toBe(2500);
    expect(HISS_REWARD_METHOD_V1.depositor.vestSeconds).toBe(DEPOSITOR_VEST_SECONDS);
  });

  it("permits only legal epoch state transitions", () => {
    expect(canTransitionEpochState("provisional", "final")).toBe(true);
    expect(canTransitionEpochState("challenge", "funded")).toBe(true);
    expect(canTransitionEpochState("provisional", "claimed")).toBe(false);
    expect(() => assertEpochStateTransition("final", "claimed")).toThrow();
  });

  it("claim gate opens only when funded, past challenge, and open", () => {
    expect(claimGateOpen({ funded: true, challengeWindowClosed: true, open: true })).toBe(true);
    expect(claimGateOpen({ funded: true, challengeWindowClosed: false, open: true })).toBe(false);
  });
});
