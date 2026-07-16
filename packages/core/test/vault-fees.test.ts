// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { buildVaultManifest, validateVaultManifest } from "../src/vault/manifest.js";
import {
  defaultVaultFeeConfig,
  validateVaultFeeConfig,
  computePerformanceFee,
  LAUNCH_FEE_SCHEDULE,
} from "../src/fees/schedule.js";

const CREATOR = "0x1111111111111111111111111111111111111111";

describe("vault manifest", () => {
  it("builds a valid launch-default manifest", () => {
    const m = buildVaultManifest({
      name: "Blue Chip USDG",
      slug: "blue-chip-usdg",
      description: "A conservative USDG vault.",
      creatorWalletAddress: CREATOR,
      allowedAssetSymbols: ["USDG", "SPY"],
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    expect(validateVaultManifest(m)).toEqual([]);
    expect(m.baseAsset).toBe("USDG");
    expect(m.baseAssetAddress).toBe("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
  });

  it("rejects a non-Robinhood chain (Base is never a vault chain)", () => {
    const m = buildVaultManifest({
      name: "X",
      slug: "x",
      description: "d",
      creatorWalletAddress: CREATOR,
      allowedAssetSymbols: ["USDG"],
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    const issues = validateVaultManifest({ ...m, chainId: 8453 });
    expect(issues.some((i) => i.code === "VAULT_CHAIN_INVALID")).toBe(true);
  });

  it("rejects a non-USDG base asset", () => {
    const m = buildVaultManifest({
      name: "X",
      slug: "x",
      description: "d",
      creatorWalletAddress: CREATOR,
      allowedAssetSymbols: ["USDG"],
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    const issues = validateVaultManifest({ ...m, baseAsset: "USDC" as unknown as "USDG" });
    expect(issues.some((i) => i.code === "BASE_ASSET_INVALID")).toBe(true);
  });
});

describe("fee schedule + arithmetic", () => {
  it("launch defaults: 10% perf fee, 10% protocol share, 0 routing", () => {
    const cfg = defaultVaultFeeConfig(CREATOR);
    expect(cfg.performanceFeeBps).toBe(1000);
    expect(cfg.protocolShareBps).toBe(1000);
    expect(cfg.routingFeeTenthBps).toBe(0);
    expect(validateVaultFeeConfig(cfg)).toEqual([]);
  });

  it("rejects a perf fee above the unverified launch cap", () => {
    const cfg = { ...defaultVaultFeeConfig(CREATOR), performanceFeeBps: 1500 };
    expect(validateVaultFeeConfig(cfg).some((i) => i.code === "PERF_FEE_CAP")).toBe(true);
    // A verified creator may go to 20%.
    expect(validateVaultFeeConfig(cfg, { creatorVerified: true })).toEqual([]);
  });

  it("computes the performance fee and protocol carve-out exactly", () => {
    // 10% of 1000 = 100 gross; 10% protocol share of 100 = 10; creator gets 90.
    const r = computePerformanceFee({
      profitAboveHighWaterMark: 1000n,
      performanceFeeBps: 1000,
      protocolShareBps: 1000,
    });
    expect(r.grossFee).toBe(100n);
    expect(r.protocolShare).toBe(10n);
    expect(r.creatorShare).toBe(90n);
    expect(r.protocolShare + r.creatorShare).toBe(r.grossFee);
  });

  it("charges no fee on non-positive profit (high-water mark)", () => {
    const r = computePerformanceFee({
      profitAboveHighWaterMark: 0n,
      performanceFeeBps: 1000,
      protocolShareBps: 1000,
    });
    expect(r.grossFee).toBe(0n);
  });

  it("saving a candidate is always free", () => {
    expect(LAUNCH_FEE_SCHEDULE.candidateSaveFeeUsdg).toBe(0);
    expect(LAUNCH_FEE_SCHEDULE.publicCreationFeeUsdg).toBe(50);
  });
});
