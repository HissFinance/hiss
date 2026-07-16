import { describe, expect, it } from "vitest";
import {
  buildCooldownPlan,
  buildRedeemPlan,
  buildStakePlan,
  buildVaultCreatePlan,
  buildVaultDepositPlan,
} from "./index";
import { ROBINHOOD_CHAIN_ID, XHISS_TIMING } from "../constants";

const ACCOUNT = "0x00000000000000000000000000000000000000a1";
const VAULT = "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6";

describe("buildVaultDepositPlan", () => {
  it("builds an unsigned, unexecuted deposit plan for valid input", () => {
    const r = buildVaultDepositPlan({ vaultAddress: VAULT, amountBaseUnits: "1000", account: ACCOUNT });
    expect(r.valid).toBe(true);
    expect(r.plan?.kind).toBe("vault-deposit");
    expect(r.plan?.requiresSignature).toBe(true);
    expect(r.plan?.executed).toBe(false);
    expect(r.plan?.steps[0]?.chainId).toBe(ROBINHOOD_CHAIN_ID);
  });

  it("rejects a zero amount", () => {
    const r = buildVaultDepositPlan({ vaultAddress: VAULT, amountBaseUnits: "0", account: ACCOUNT });
    expect(r.valid).toBe(false);
    expect(r.plan).toBeNull();
    expect(r.errors.join(" ")).toMatch(/positive/);
  });
});

describe("buildVaultCreatePlan", () => {
  it("requires weights to sum to 10000 bps", () => {
    const bad = buildVaultCreatePlan({
      name: "Test",
      slug: "test",
      account: ACCOUNT,
      weights: [
        { symbol: "A", weightBps: 4000 },
        { symbol: "B", weightBps: 5000 },
      ],
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/10000/);

    const ok = buildVaultCreatePlan({
      name: "Test",
      slug: "test-vault",
      account: ACCOUNT,
      weights: [
        { symbol: "A", weightBps: 6000 },
        { symbol: "B", weightBps: 4000 },
      ],
    });
    expect(ok.valid).toBe(true);
  });

  it("rejects a non-kebab slug", () => {
    const r = buildVaultCreatePlan({
      name: "Test",
      slug: "Not Kebab",
      account: ACCOUNT,
      weights: [{ symbol: "A", weightBps: 10000 }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/kebab/);
  });
});

describe("buildStakePlan", () => {
  it("produces a plan with the non-performance disclaimer in notes", () => {
    const r = buildStakePlan({ amountBaseUnits: "5", account: ACCOUNT });
    expect(r.valid).toBe(true);
    expect(r.plan?.notes.join(" ")).toMatch(/not a performance claim/i);
  });
});

describe("buildCooldownPlan", () => {
  it("projects timing 72h + 2d out from now", () => {
    const now = 1_000_000;
    const r = buildCooldownPlan({ shareBaseUnits: "1", account: ACCOUNT, nowSeconds: now });
    expect(r.valid).toBe(true);
    expect(r.projected?.cooldownEndsAt).toBe(now + XHISS_TIMING.cooldownSeconds);
    expect(r.projected?.redeemWindowEndsAt).toBe(
      now + XHISS_TIMING.cooldownSeconds + XHISS_TIMING.redeemWindowSeconds,
    );
  });
});

describe("buildRedeemPlan", () => {
  it("rejects redeem before the window opens", () => {
    const r = buildRedeemPlan({
      shareBaseUnits: "1",
      account: ACCOUNT,
      receiver: ACCOUNT,
      redeemWindowOpensAt: 2_000,
      nowSeconds: 1_000,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/not opened/);
  });

  it("rejects redeem after the window closes", () => {
    const r = buildRedeemPlan({
      shareBaseUnits: "1",
      account: ACCOUNT,
      receiver: ACCOUNT,
      redeemWindowClosesAt: 1_000,
      nowSeconds: 2_000,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/closed/);
  });

  it("accepts redeem inside the window", () => {
    const r = buildRedeemPlan({
      shareBaseUnits: "1",
      account: ACCOUNT,
      receiver: ACCOUNT,
      redeemWindowOpensAt: 1_000,
      redeemWindowClosesAt: 3_000,
      nowSeconds: 2_000,
    });
    expect(r.valid).toBe(true);
    expect(r.plan?.kind).toBe("redeem");
  });
});
