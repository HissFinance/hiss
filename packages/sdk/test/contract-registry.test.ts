import { describe, it, expect } from "vitest";
import { keccak256, type Hex } from "viem";
import { HissClient, mapRegistryEntry } from "../src/client";
import type { ReadResult } from "../src/types";

const ADDR = "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6" as const;

describe("mapRegistryEntry (pure)", () => {
  it("marks a live non-empty runtime code as deployed with a keccak hash", () => {
    const code = "0x600160005260206000f3" as Hex;
    const live: ReadResult<Hex | undefined> = { state: "live", value: code };
    const e = mapRegistryEntry("flagshipVault", ADDR, live);
    expect(e).toEqual({
      name: "flagshipVault",
      address: ADDR,
      status: "deployed",
      runtimeCodeHash: keccak256(code),
    });
  });

  it("marks empty code (0x) as no_bytecode with a null hash", () => {
    const e = mapRegistryEntry("x", ADDR, { state: "live", value: "0x" });
    expect(e.status).toBe("no_bytecode");
    expect(e.runtimeCodeHash).toBeNull();
  });

  it("marks a degraded read as unknown with a null hash (never fabricates)", () => {
    const e = mapRegistryEntry("x", ADDR, { state: "degraded", value: null, error: "boom" });
    expect(e.status).toBe("unknown");
    expect(e.runtimeCodeHash).toBeNull();
  });
});

describe("getContractRegistryDetailed (object shape, fail-soft)", () => {
  it("returns { chainId, observedAt, entries[] } — never a bare array — even offline", async () => {
    const client = new HissClient({ rpcUrl: "http://127.0.0.1:1/unreachable", chainId: 4663 });
    const report = await client.getContractRegistryDetailed("2026-07-24T00:00:00.000Z");

    expect(Array.isArray(report)).toBe(false);
    expect(report.chainId).toBe(4663);
    expect(report.observedAt).toBe("2026-07-24T00:00:00.000Z");
    expect(Array.isArray(report.entries)).toBe(true);
    expect(report.entries.length).toBeGreaterThan(0);
    for (const e of report.entries) {
      expect(Object.keys(e).sort()).toEqual(["address", "name", "runtimeCodeHash", "status"]);
      // Offline → every read degrades to UNKNOWN, never a fabricated hash.
      expect(e.status).toBe("unknown");
      expect(e.runtimeCodeHash).toBeNull();
    }
    // The whole report serializes cleanly (no bigints, no undefined).
    expect(() => JSON.stringify(report)).not.toThrow();
  });
});
