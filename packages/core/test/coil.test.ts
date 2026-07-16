// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  validateCoil,
  coilManifestHash,
  COIL_SCHEMA_VERSION,
  TOTAL_WEIGHT_BPS,
  type CoilManifest,
} from "../src/coil/manifest.js";
import { defaultFuses } from "../src/coil/fuses.js";

function baseCoil(overrides: Partial<CoilManifest> = {}): CoilManifest {
  return {
    schemaVersion: COIL_SCHEMA_VERSION,
    coilId: "coil-test",
    slug: "test-coil",
    name: "Test Coil",
    version: 1,
    whisper: "semis look coiled",
    chainId: 4663,
    allocations: [
      { ticker: "NVDA", tokenAddress: "0x1111111111111111111111111111111111111111", weightBps: 6000 },
      { ticker: "AMD", tokenAddress: "0x2222222222222222222222222222222222222222", weightBps: 4000 },
    ],
    brokerSymbols: [
      { symbol: "NVDA", registryTicker: "NVDA" },
      { symbol: "AMD", registryTicker: "AMD" },
    ],
    rebalance: { method: "drift", driftThresholdBps: 500, minTradeUsd: 10, maxSlippageBps: 50 },
    fuses: defaultFuses(),
    triggers: [{ kind: "manualReview" }],
    executionMode: "paper_only",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Coil allocation invariant", () => {
  it("accepts weights summing to exactly 10,000 bps", () => {
    expect(TOTAL_WEIGHT_BPS).toBe(10_000);
    const result = validateCoil(baseCoil());
    expect(result.valid).toBe(true);
  });

  it("rejects weights that do not sum to 10,000 bps", () => {
    const result = validateCoil(
      baseCoil({
        allocations: [
          { ticker: "NVDA", tokenAddress: "0x1111111111111111111111111111111111111111", weightBps: 6000 },
          { ticker: "AMD", tokenAddress: "0x2222222222222222222222222222222222222222", weightBps: 3000 },
        ],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "WEIGHTS_SUM")).toBe(true);
  });

  it("rejects a duplicate token address", () => {
    const result = validateCoil(
      baseCoil({
        allocations: [
          { ticker: "NVDA", tokenAddress: "0x1111111111111111111111111111111111111111", weightBps: 5000 },
          { ticker: "NV2", tokenAddress: "0x1111111111111111111111111111111111111111", weightBps: 5000 },
        ],
      }),
    );
    expect(result.issues.some((i) => i.code === "DUPLICATE_ALLOCATION")).toBe(true);
  });

  it("rejects an address-shaped brokerage symbol (symbol-space confusion)", () => {
    const result = validateCoil(
      baseCoil({
        brokerSymbols: [{ symbol: "0x1111111111111111111111111111111111111111", registryTicker: "NVDA" }],
      }),
    );
    expect(result.issues.some((i) => i.code === "SYMBOL_SPACE_CONFUSION")).toBe(true);
  });

  it("produces a deterministic manifest hash", () => {
    expect(coilManifestHash(baseCoil())).toBe(coilManifestHash(baseCoil()));
  });
});
