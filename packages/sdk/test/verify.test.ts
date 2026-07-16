import { describe, it, expect } from "vitest";
import { validateCoil, compileCoil, verifyManifestHash, manifestHash } from "../src/verify";
import { createVaultManifest } from "../src/prepare";
import { buildAllocation } from "@hiss-finance/vault-kit";
import { ADDRESSES } from "../src/constants";

const validCoil = {
  name: "Two-asset paper coil",
  mode: "paper_only" as const,
  assets: [
    { symbol: "AAA", weightBps: 6000 },
    { symbol: "BBB", weightBps: 4000 },
  ],
};

describe("validateCoil", () => {
  it("accepts a well-formed coil", () => {
    expect(validateCoil(validCoil).valid).toBe(true);
  });

  it("rejects weights that do not sum to 10,000", () => {
    const res = validateCoil({ ...validCoil, assets: [{ symbol: "AAA", weightBps: 5000 }] });
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.code === "coil.weightsSum")).toBe(true);
  });

  it("rejects a non-compile-only mode", () => {
    const res = validateCoil({ ...validCoil, mode: "live" as never });
    expect(res.valid).toBe(false);
  });
});

describe("compileCoil", () => {
  it("is deterministic and never executable", () => {
    const a = compileCoil(validCoil);
    const b = compileCoil(validCoil);
    expect(a.coilHash).toBe(b.coilHash);
    expect(a.executable).toBe(false);
    expect(a.coilHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("throws on an invalid coil", () => {
    expect(() => compileCoil({ ...validCoil, assets: [] })).toThrow();
  });
});

describe("manifest hash re-export", () => {
  it("reuses the vault-kit hasher end-to-end", () => {
    const c = createVaultManifest({
      name: "V",
      symbol: "xV",
      asset: { symbol: "USDG", address: ADDRESSES.usdg, decimals: 6 },
      allocations: buildAllocation([
        { symbol: "AAA", address: "0x2222222222222222222222222222222222222222", weight: 1 },
      ]),
      fees: { performanceFeeBps: 0 },
      minSkinBps: 0,
      lockupSeconds: 0,
      strategy: { summary: "x", rebalanceMethod: "manual", noticePeriodSeconds: 0 },
      jurisdiction: { usPersonsRestricted: false },
    });
    expect(verifyManifestHash(c, manifestHash(c))).toBe(true);
  });
});
