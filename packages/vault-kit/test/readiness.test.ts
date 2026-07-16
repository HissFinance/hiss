import { describe, it, expect } from "vitest";
import { createVaultManifest } from "../src/manifest";
import { buildAllocation } from "../src/allocation";
import { USDG_ASSET } from "../src/assets";
import { validateDeploymentReadiness } from "../src/readiness";

function baseCandidate(overrides: Partial<Parameters<typeof createVaultManifest>[0]> = {}) {
  return createVaultManifest({
    name: "Ready Vault",
    symbol: "xRDY",
    asset: USDG_ASSET,
    allocations: buildAllocation([
      { symbol: "AAA", address: "0x1111111111111111111111111111111111111111", weight: 1 },
      { symbol: "BBB", address: "0x2222222222222222222222222222222222222222", weight: 1 },
    ]),
    fees: { performanceFeeBps: 1000 },
    minSkinBps: 100,
    lockupSeconds: 0,
    strategy: { summary: "Equal weight.", rebalanceMethod: "drift", noticePeriodSeconds: 86400 },
    jurisdiction: { usPersonsRestricted: false },
    fuses: [],
    ...overrides,
  });
}

describe("validateDeploymentReadiness", () => {
  it("passes a well-formed candidate", () => {
    const r = validateDeploymentReadiness(baseCandidate());
    expect(r.ready).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("fails a performance fee over the ceiling", () => {
    const c = baseCandidate();
    c.fees.performanceFeeBps = 5000;
    const r = validateDeploymentReadiness(c);
    expect(r.ready).toBe(false);
    expect(r.errors.some((e) => e.code === "fees.performance")).toBe(true);
  });

  it("fails an unsupported chain id", () => {
    const c = baseCandidate();
    c.chainId = 1;
    const r = validateDeploymentReadiness(c);
    expect(r.ready).toBe(false);
    expect(r.errors.some((e) => e.code === "chain.id")).toBe(true);
  });

  it("fails a duplicate allocation address", () => {
    const c = baseCandidate();
    c.allocations = [
      { symbol: "AAA", address: "0x1111111111111111111111111111111111111111", weightBps: 5000 },
      { symbol: "AAA2", address: "0x1111111111111111111111111111111111111111", weightBps: 5000 },
    ];
    const r = validateDeploymentReadiness(c);
    expect(r.ready).toBe(false);
    expect(r.errors.some((e) => e.code === "allocation.duplicate")).toBe(true);
  });

  it("warns when usPersonsRestricted lacks a jurisdiction ack", () => {
    const c = baseCandidate({ jurisdiction: { usPersonsRestricted: true } });
    const r = validateDeploymentReadiness(c);
    expect(r.ready).toBe(true); // warning, not an error
    expect(r.warnings.some((w) => w.code === "jurisdiction.missingAck")).toBe(true);
  });

  it("fails a bad required risk ack hash", () => {
    const c = baseCandidate({
      jurisdiction: { usPersonsRestricted: false, requiredRiskAckHash: "0xnothex" },
    });
    const r = validateDeploymentReadiness(c);
    expect(r.ready).toBe(false);
    expect(r.errors.some((e) => e.code === "jurisdiction.riskAck")).toBe(true);
  });
});
