import { describe, it, expect } from "vitest";
import {
  createVaultManifest,
  manifestHash,
  verifyManifestHash,
  VAULT_MANIFEST_SCHEMA_VERSION,
} from "../src/manifest";
import { buildAllocation } from "../src/allocation";
import { buildFuseSet } from "../src/fuses";
import { USDG_ASSET } from "../src/assets";
import { buildReceipt, verifyReceipt, verifyReceiptHash } from "../src/receipts";

function sampleCandidate() {
  return createVaultManifest({
    name: "Example Vault",
    symbol: "xEX",
    asset: USDG_ASSET,
    allocations: buildAllocation([
      { symbol: "AAA", address: "0x1111111111111111111111111111111111111111", weight: 1 },
      { symbol: "BBB", address: "0x2222222222222222222222222222222222222222", weight: 1 },
    ]),
    fees: { performanceFeeBps: 1000 },
    minSkinBps: 100,
    lockupSeconds: 0,
    strategy: { summary: "Equal weight two assets.", rebalanceMethod: "drift", noticePeriodSeconds: 86400 },
    jurisdiction: { usPersonsRestricted: false },
    fuses: buildFuseSet({ maxAssetWeightBps: 6000, maxSlippageBps: 100 }),
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("manifest hashing", () => {
  it("stamps the schema version", () => {
    expect(sampleCandidate().schemaVersion).toBe(VAULT_MANIFEST_SCHEMA_VERSION);
  });

  it("is deterministic across re-serialization", () => {
    expect(manifestHash(sampleCandidate())).toBe(manifestHash(sampleCandidate()));
  });

  it("is prefixed and stable in shape", () => {
    const h = manifestHash(sampleCandidate());
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("excludes timestamps from the hash", () => {
    const a = sampleCandidate();
    const b = {
      ...sampleCandidate(),
      createdAt: "2030-12-31T23:59:59.999Z",
      updatedAt: "2031-01-01T00:00:00.000Z",
    };
    expect(manifestHash(a)).toBe(manifestHash(b));
  });

  it("changes when identity content changes", () => {
    const a = sampleCandidate();
    const b = { ...sampleCandidate(), name: "Different Vault" };
    expect(manifestHash(a)).not.toBe(manifestHash(b));
  });

  it("verifyManifestHash confirms a matching hash", () => {
    const c = sampleCandidate();
    expect(verifyManifestHash(c, manifestHash(c))).toBe(true);
    expect(verifyManifestHash(c, "sha256:" + "0".repeat(64))).toBe(false);
  });

  it("rejects allocations that do not sum to 10,000", () => {
    expect(() =>
      createVaultManifest({
        name: "Bad",
        symbol: "xBAD",
        asset: USDG_ASSET,
        allocations: [
          { symbol: "AAA", address: "0x1111111111111111111111111111111111111111", weightBps: 5000 },
        ],
        fees: { performanceFeeBps: 0 },
        minSkinBps: 0,
        lockupSeconds: 0,
        strategy: { summary: "x", rebalanceMethod: "manual", noticePeriodSeconds: 0 },
        jurisdiction: { usPersonsRestricted: false },
      }),
    ).toThrow();
  });
});

describe("receipt verification", () => {
  it("round-trips a receipt over a manifest hash", () => {
    const c = sampleCandidate();
    const receipt = buildReceipt(
      "manifest_hash",
      { manifestHash: manifestHash(c) },
      "2026-01-01T00:00:00.000Z",
    );
    expect(verifyReceipt(receipt)).toBe(true);
    expect(verifyReceiptHash(receipt, receipt.contentHash)).toBe(true);
  });

  it("detects a tampered payload", () => {
    const receipt = buildReceipt("manifest_hash", { manifestHash: "sha256:aaa" }, "2026-01-01T00:00:00.000Z");
    (receipt.payload as { manifestHash: string }).manifestHash = "sha256:bbb";
    expect(verifyReceipt(receipt)).toBe(false);
  });
});
