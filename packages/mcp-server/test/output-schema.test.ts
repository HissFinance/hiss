import { describe, it, expect } from "vitest";
import { callHissTool } from "../src/server.js";
import { HISS_TOOLS } from "../src/tools.js";
import { mockClient } from "./helpers/mockClient.js";
import type { JsonRecord } from "../src/lib/types.js";

// Deterministic mock client (the real facade's contract-registry shape is
// covered by the SDK's `getContractRegistryDetailed` test and by
// `scripts/check-mcp-output-schema.ts`, which drives the real facade). This
// suite pins the TOOL-layer output contract: object-not-array, no undefined,
// clean serialization, the registry object shape, and the prepare invariants.
const deps = { client: mockClient(), nowIso: () => "2026-07-24T00:00:00.000Z" };

const ADDR = "0x1111111111111111111111111111111111111111";
const VAULT = "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6";

const ARGS: Record<string, JsonRecord> = {
  hiss_get_vault: { ref: "flagship" },
  hiss_get_vault_holdings: { vault: VAULT },
  hiss_get_vault_performance: { vault: VAULT },
  hiss_get_receipt: { id: "r-1" },
  hiss_verify_receipt: { receipt: { kind: "state_read", hash: "0x00" } },
  hiss_create_vault_candidate: {
    name: "Draft",
    allowedAssets: ["USDG"],
    creator: { address: ADDR, skinInGameUsdg: 1 },
  },
  hiss_prepare_vault_deposit: { vault: VAULT, amount: "100", receiver: ADDR },
  hiss_prepare_vault_withdrawal: { vault: VAULT, shares: "10", receiver: ADDR },
  hiss_prepare_hiss_stake: { amount: "500" },
  hiss_prepare_xhiss_cooldown: { xhissAmount: "50" },
  hiss_prepare_xhiss_redeem: { xShares: "25", receiver: ADDR },
  hiss_validate_coil: {
    manifest: {
      schema: "coil-manifest-1.0.0",
      name: "c",
      universe: ["AAPL"],
      rules: [{ when: "x", weight: 1 }],
      fuses: { maxPositionBps: 100, maxGrossExposureBps: 1000, allowShorting: false },
    },
  },
  hiss_compile_coil: {
    manifest: {
      schema: "coil-manifest-1.0.0",
      name: "c",
      universe: ["AAPL"],
      rules: [{ when: "x", weight: 1 }],
      fuses: { maxPositionBps: 100, maxGrossExposureBps: 1000, allowShorting: false },
    },
    nowIso: "2026-07-24T00:00:00.000Z",
  },
};

function hasUndefined(v: unknown): boolean {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.some(hasUndefined);
  if (v && typeof v === "object") return Object.values(v).some(hasUndefined);
  return false;
}

describe("structuredContent is always a well-formed JSON object", () => {
  for (const tool of HISS_TOOLS) {
    it(`${tool.name}: object, never a root array, no undefined/bigint`, async () => {
      const res = await callHissTool(tool.name, ARGS[tool.name] ?? {}, deps);
      const sc = res.structuredContent as unknown;
      expect(sc, "structuredContent present").toBeTypeOf("object");
      expect(sc).not.toBeNull();
      expect(Array.isArray(sc), "no root array").toBe(false);
      expect(() => JSON.stringify(sc), "serializes cleanly").not.toThrow();
      expect(hasUndefined(sc), "no undefined fields").toBe(false);
    });
  }
});

describe("hiss_get_contract_registry fixed object shape", () => {
  it("is { chainId:4663, observedAt, entries:[{name,address,runtimeCodeHash,status}] }", async () => {
    const res = await callHissTool("hiss_get_contract_registry", {}, deps);
    const sc = res.structuredContent as JsonRecord;
    expect(Array.isArray(sc)).toBe(false);
    expect(sc.chainId).toBe(4663);
    expect(sc.observedAt).toBe("2026-07-24T00:00:00.000Z");
    expect(Array.isArray(sc.entries)).toBe(true);
    for (const e of sc.entries as JsonRecord[]) {
      expect(Object.keys(e).sort()).toEqual(["address", "name", "runtimeCodeHash", "status"]);
      expect(["deployed", "no_bytecode", "unknown"]).toContain(e.status);
    }
  });
});

describe("every prepare result preserves signed:false + liveTransactionSent:false", () => {
  const prepares = [
    "hiss_prepare_vault_deposit",
    "hiss_prepare_vault_withdrawal",
    "hiss_prepare_hiss_stake",
    "hiss_prepare_xhiss_cooldown",
    "hiss_prepare_xhiss_redeem",
  ];
  for (const name of prepares) {
    it(name, async () => {
      const res = await callHissTool(name, ARGS[name]!, deps);
      const sc = res.structuredContent as JsonRecord;
      expect(sc.signed).toBe(false);
      expect(sc.liveTransactionSent).toBe(false);
    });
  }
});
