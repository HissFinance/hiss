import { describe, it, expect } from "vitest";
import { decodeFunctionData, getAddress } from "viem";
import {
  prepareVaultDeposit,
  prepareVaultWithdrawal,
  prepareVaultCreation,
  prepareHissApproval,
  prepareHissStake,
  prepareXhissCooldown,
  prepareXhissRedeem,
  createVaultManifest,
  calculateAllocationBps,
} from "../src/prepare";
import { computePlanHash } from "../src/plan";
import { VAULT_ABI, VAULT_FACTORY_ABI, XHISS_ABI, ERC20_ABI } from "../src/abi";
import { ADDRESSES, ROBINHOOD_CHAIN_MAINNET, ROBINHOOD_CHAIN_TESTNET } from "../src/constants";
import type { ActionPlan } from "../src/types";
import { buildAllocation } from "@hiss-finance/vault-kit";

const RECEIVER = "0x1111111111111111111111111111111111111111";

function candidate() {
  return createVaultManifest({
    name: "Example Vault",
    symbol: "xEX",
    asset: { symbol: "USDG", address: ADDRESSES.usdg, decimals: 6 },
    allocations: buildAllocation([
      { symbol: "AAA", address: "0x2222222222222222222222222222222222222222", weight: 1 },
      { symbol: "BBB", address: "0x3333333333333333333333333333333333333333", weight: 1 },
    ]),
    fees: { performanceFeeBps: 1000 },
    minSkinBps: 100,
    lockupSeconds: 0,
    strategy: { summary: "Equal weight.", rebalanceMethod: "drift", noticePeriodSeconds: 86400 },
    jurisdiction: { usPersonsRestricted: false },
    fuses: [],
  });
}

/** Every plan is unsigned data: calldata present, value "0", no signature. */
function assertUnsigned(plan: ActionPlan) {
  expect(plan.calldata.startsWith("0x")).toBe(true);
  expect(plan.value).toBe("0");
  expect(plan).not.toHaveProperty("signature");
  expect(plan).not.toHaveProperty("signedTx");
  expect(plan).not.toHaveProperty("privateKey");
  expect(plan.planHash).toMatch(/^0x[0-9a-f]{64}$/);
}

describe("prepareVaultDeposit", () => {
  it("encodes depositWithAcks with correct target and decoded args", () => {
    const riskAckHash = ("0x" + "aa".repeat(32)) as `0x${string}`;
    const jurisdictionAckHash = ("0x" + "bb".repeat(32)) as `0x${string}`;
    const plan = prepareVaultDeposit({
      vault: ADDRESSES.flagshipVault,
      amountUnits: 250_000000n,
      receiver: RECEIVER,
      acks: { riskAckHash, jurisdictionAckHash },
    });

    expect(plan.chainId).toBe(ROBINHOOD_CHAIN_MAINNET);
    expect(plan.target).toBe(getAddress(ADDRESSES.flagshipVault));
    expect(plan.function).toBe("depositWithAcks(uint256,address,bytes32,bytes32)");
    expect(plan.decodedArgs.assets).toBe("250000000");
    expect(plan.decodedArgs.receiver).toBe(getAddress(RECEIVER));

    const decoded = decodeFunctionData({ abi: VAULT_ABI, data: plan.calldata });
    expect(decoded.functionName).toBe("depositWithAcks");
    expect(decoded.args?.[0]).toBe(250_000000n);
    expect(decoded.args?.[1]).toBe(getAddress(RECEIVER));
    assertUnsigned(plan);
  });

  it("encodes plain deposit when no acks are supplied", () => {
    const plan = prepareVaultDeposit({ vault: ADDRESSES.flagshipVault, amountUnits: 1n, receiver: RECEIVER });
    expect(plan.function).toBe("deposit(uint256,address)");
    const decoded = decodeFunctionData({ abi: VAULT_ABI, data: plan.calldata });
    expect(decoded.functionName).toBe("deposit");
  });

  it("rejects a non-positive amount", () => {
    expect(() =>
      prepareVaultDeposit({ vault: ADDRESSES.flagshipVault, amountUnits: 0n, receiver: RECEIVER }),
    ).toThrow();
  });

  it("rejects a wrong chain", () => {
    expect(() =>
      prepareVaultDeposit({
        vault: ADDRESSES.flagshipVault,
        amountUnits: 1n,
        receiver: RECEIVER,
        chainId: 1,
      }),
    ).toThrow(/unsupported chainId/i);
  });
});

describe("prepareVaultWithdrawal", () => {
  it("encodes redeem(shares,receiver,owner)", () => {
    const plan = prepareVaultWithdrawal({
      vault: ADDRESSES.flagshipVault,
      sharesUnits: 5n,
      receiver: RECEIVER,
    });
    expect(plan.function).toBe("redeem(uint256,address,address)");
    const decoded = decodeFunctionData({ abi: VAULT_ABI, data: plan.calldata });
    expect(decoded.functionName).toBe("redeem");
    expect(decoded.args?.[2]).toBe(getAddress(RECEIVER)); // owner defaults to receiver
    assertUnsigned(plan);
  });
});

describe("prepareVaultCreation", () => {
  it("encodes createVault against the factory with a computed strategy hash", () => {
    const plan = prepareVaultCreation({ candidate: candidate(), feeRecipient: RECEIVER });
    expect(plan.target).toBe(getAddress(ADDRESSES.vaultFactory));
    expect(plan.function.startsWith("createVault(")).toBe(true);
    const decoded = decodeFunctionData({ abi: VAULT_FACTORY_ABI, data: plan.calldata });
    expect(decoded.functionName).toBe("createVault");
    const params = decoded.args?.[0] as { name: string; performanceFeeBps: number };
    expect(params.name).toBe("Example Vault");
    expect(params.performanceFeeBps).toBe(1000);
    assertUnsigned(plan);
  });

  it("rejects a candidate that is not deployment-ready", () => {
    const bad = candidate();
    bad.fees.performanceFeeBps = 9999; // over the ceiling
    expect(() => prepareVaultCreation({ candidate: bad, feeRecipient: RECEIVER })).toThrow(
      /not deployment-ready/i,
    );
  });
});

describe("prepareHissApproval / prepareHissStake", () => {
  it("approve targets $HISS by default", () => {
    const plan = prepareHissApproval({ spender: ADDRESSES.xhissVault, amountUnits: 10n });
    expect(plan.target).toBe(getAddress(ADDRESSES.hiss));
    const decoded = decodeFunctionData({ abi: ERC20_ABI, data: plan.calldata });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args?.[0]).toBe(getAddress(ADDRESSES.xhissVault));
    assertUnsigned(plan);
  });

  it("stake targets the xHISS vault", () => {
    const plan = prepareHissStake({ amountUnits: 1000n });
    expect(plan.target).toBe(getAddress(ADDRESSES.xhissVault));
    expect(plan.function).toBe("stake(uint256)");
    const decoded = decodeFunctionData({ abi: XHISS_ABI, data: plan.calldata });
    expect(decoded.functionName).toBe("stake");
    expect(decoded.args?.[0]).toBe(1000n);
    // required staking acknowledgements are attached verbatim
    expect(plan.requiredAcknowledgments).toContain("Not a performance claim.");
    assertUnsigned(plan);
  });
});

describe("prepareXhissCooldown / prepareXhissRedeem", () => {
  it("start cooldown encodes startCooldown(xShares)", () => {
    const plan = prepareXhissCooldown({ action: "start", xShares: 42n });
    const decoded = decodeFunctionData({ abi: XHISS_ABI, data: plan.calldata });
    expect(decoded.functionName).toBe("startCooldown");
    expect(decoded.args?.[0]).toBe(42n);
  });

  it("cancel cooldown encodes cancelCooldown()", () => {
    const plan = prepareXhissCooldown({ action: "cancel" });
    const decoded = decodeFunctionData({ abi: XHISS_ABI, data: plan.calldata });
    expect(decoded.functionName).toBe("cancelCooldown");
  });

  it("start requires xShares", () => {
    expect(() => prepareXhissCooldown({ action: "start" })).toThrow();
  });

  it("redeem encodes redeem(xShares,receiver)", () => {
    const plan = prepareXhissRedeem({ xShares: 7n, receiver: RECEIVER });
    expect(plan.function).toBe("redeem(uint256,address)");
    const decoded = decodeFunctionData({ abi: XHISS_ABI, data: plan.calldata });
    expect(decoded.functionName).toBe("redeem");
    expect(decoded.args?.[1]).toBe(getAddress(RECEIVER));
    assertUnsigned(plan);
  });
});

describe("plan hash", () => {
  it("is deterministic for identical inputs", () => {
    const a = prepareHissStake({ amountUnits: 1000n });
    const b = prepareHissStake({ amountUnits: 1000n });
    expect(a.planHash).toBe(b.planHash);
  });

  it("differs when calldata differs", () => {
    const a = prepareHissStake({ amountUnits: 1000n });
    const b = prepareHissStake({ amountUnits: 1001n });
    expect(a.planHash).not.toBe(b.planHash);
  });

  it("matches an independent recomputation over execution fields", () => {
    const plan = prepareHissStake({ amountUnits: 1000n });
    expect(plan.planHash).toBe(
      computePlanHash({
        chainId: plan.chainId,
        target: plan.target,
        function: plan.function,
        calldata: plan.calldata,
        value: plan.value,
      }),
    );
  });

  it("is stable across supported chains but distinct per chain", () => {
    const main = prepareXhissRedeem({ xShares: 1n, receiver: RECEIVER, chainId: ROBINHOOD_CHAIN_MAINNET });
    const test = prepareXhissRedeem({ xShares: 1n, receiver: RECEIVER, chainId: ROBINHOOD_CHAIN_TESTNET });
    expect(main.planHash).not.toBe(test.planHash);
  });
});

describe("calculateAllocationBps", () => {
  it("normalizes plain weights to 10,000 bps", () => {
    expect(calculateAllocationBps([1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(10000);
    expect(calculateAllocationBps([2, 1, 1])).toEqual([5000, 2500, 2500]);
  });
});
