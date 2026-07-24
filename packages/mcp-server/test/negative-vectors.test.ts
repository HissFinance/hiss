/**
 * Negative-vector suite: every one of the 22 tools must reject malformed,
 * missing, or out-of-bounds input with a TYPED error result (isError=true +
 * a structured error.code) — never a raw exception, never an unhandled throw,
 * never an MCP protocol violation.
 *
 * Plus explicit guard proofs (credential guard, execution-claim guard) and the
 * fail-closed prepare guard (no empty-target / selector-less calldata).
 */

import { describe, it, expect } from "vitest";
import { callHissTool } from "../src/server.js";
import { HISS_TOOLS } from "../src/tools.js";
import { createHissClient } from "../src/lib/client.js";
import { assertRealizableUnsignedTx } from "../src/lib/txguard.js";
import { assertNoCredentials, CredentialRejectedError } from "../src/lib/credentials.js";
import { mockClient } from "./helpers/mockClient.js";
import { STOCK_PREMIUM_ARGS, STOCK_PREMIUM_NEGATIVE } from "./helpers/stockPremiumArgs.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { JsonRecord } from "../src/lib/types.js";

const deps = { client: mockClient(), nowIso: () => "2026-07-24T00:00:00.000Z" };

/** A result is a well-formed TYPED error: isError + structured error.code string. */
function isTypedError(result: CallToolResult, code?: string): boolean {
  if (result.isError !== true) return false;
  const sc = result.structuredContent as JsonRecord | undefined;
  const err = sc?.error as JsonRecord | undefined;
  if (!err || typeof err.code !== "string") return false;
  // structuredContent must always be a plain object (never an array) — MCP schema.
  if (Array.isArray(result.structuredContent)) return false;
  return code ? err.code === code : true;
}

const ADDR = "0x1111111111111111111111111111111111111111";

/**
 * One or more malformed inputs per tool. Every entry must produce a typed error
 * (INVALID_INPUT unless otherwise noted).
 */
const NEGATIVE: Record<string, JsonRecord[]> = {
  // No-required-arg reads: the negative vector is a credential-shaped field.
  hiss_get_protocol_status: [{ apiKey: "sk-live-xxxx" }],
  hiss_get_contract_registry: [{ password: "hunter2" }],
  hiss_get_vaults: [{ private_key: "0x" + "a".repeat(64) }],
  hiss_get_staking_status: [{ secret: "x" }],
  hiss_get_reward_status: [
    {
      mnemonic:
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    },
  ],
  hiss_get_supported_assets: [{ bearer: "token" }],
  hiss_get_fee_schedule: [{ accessToken: "abc" }],
  // Reads with required args.
  hiss_get_vault: [{}, { ref: 123 }, { ref: "" }],
  hiss_get_vault_holdings: [{}, { vault: "not-an-address" }, { vault: "0x123" }],
  hiss_get_vault_performance: [{}, { vault: "0xZZZ" }],
  hiss_get_receipt: [{}, { id: 5 }],
  hiss_verify_receipt: [{}, { receipt: "not-an-object" }, { receipt: [1, 2] }],
  // Prepares / validators.
  hiss_create_vault_candidate: [{}, { name: "x" }, { name: "x", allowedAssets: [] }],
  hiss_validate_vault_candidate: [{}, { manifest: "nope" }],
  hiss_prepare_vault_creation: [
    {},
    { manifest: { schema: "vault-manifest-1.0.0", chainId: 8453, baseAsset: "USDC" } },
  ],
  hiss_prepare_vault_deposit: [
    {},
    { vault: ADDR, amount: "100" }, // missing receiver
    { vault: "bad", amount: "100", receiver: ADDR },
    { vault: ADDR, amount: "", receiver: ADDR },
  ],
  hiss_prepare_vault_withdrawal: [
    {},
    { vault: ADDR, shares: "1" },
    { vault: "bad", shares: "1", receiver: ADDR },
  ],
  hiss_prepare_hiss_stake: [{}, { amount: "" }, { amount: 500 }],
  hiss_prepare_xhiss_cooldown: [{}, { xhissAmount: 50 }],
  hiss_prepare_xhiss_redeem: [{}, { xShares: "25" }, { xShares: "25", receiver: "bad" }],
  hiss_validate_coil: [{}, { manifest: 42 }],
  hiss_compile_coil: [
    {},
    { manifest: { schema: "coil-manifest-1.0.0" } },
    { manifest: {}, nowIso: "not-a-date" },
  ],
  ...STOCK_PREMIUM_NEGATIVE,
};

describe("negative-vector coverage: every registered tool rejects bad input with typed errors", () => {
  it("has a negative vector for every registered tool (count is dynamic)", () => {
    const covered = new Set(Object.keys(NEGATIVE));
    for (const t of HISS_TOOLS) expect(covered.has(t.name)).toBe(true);
    // Dynamic: every registered tool is covered — no hard-coded total.
    expect(Object.keys(NEGATIVE).length).toBe(HISS_TOOLS.length);
  });

  for (const [name, vectors] of Object.entries(NEGATIVE)) {
    vectors.forEach((args, i) => {
      it(`${name} [vector ${i}] -> typed error, never a raw throw`, async () => {
        let result: CallToolResult;
        // callHissTool must NEVER throw — it always resolves to a result.
        result = await callHissTool(name, args, deps);
        expect(isTypedError(result)).toBe(true);
        // Never an MCP protocol violation: structuredContent is a plain object.
        expect(Array.isArray(result.structuredContent)).toBe(false);
      });
    });
  }
});

describe("credential guard", () => {
  it("rejects credential-shaped fields by key and by value", () => {
    for (const bad of [
      { privateKey: "x" },
      { api_key: "x" },
      { seed: "x" },
      { nested: { password: "x" } },
      { value: "0x" + "a".repeat(64) },
      {
        phrase:
          "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      },
    ]) {
      expect(() => assertNoCredentials(bad)).toThrow(CredentialRejectedError);
    }
  });

  it("passes clean input", () => {
    expect(() => assertNoCredentials({ vault: ADDR, amount: "100" })).not.toThrow();
  });

  it("every tool refuses a credential-shaped field at the server boundary", async () => {
    for (const t of HISS_TOOLS) {
      const result = await callHissTool(t.name, { privateKey: "0x" + "a".repeat(64) }, deps);
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain("CREDENTIAL_REJECTED");
    }
  });
});

describe("execution-claim guard + unsigned invariant across all prepares", () => {
  const prepareTools = HISS_TOOLS.filter((t) => t.kind === "prepare").map((t) => t.name);
  const VALID: Record<string, JsonRecord> = {
    hiss_create_vault_candidate: {
      name: "D",
      allowedAssets: ["USDG"],
      creator: { address: ADDR, skinInGameUsdg: 1 },
    },
    hiss_validate_vault_candidate: {
      manifest: {
        schema: "vault-manifest-1.0.0",
        chainId: 4663,
        name: "V",
        baseAsset: "USDG",
        allowedAssets: ["USDG"],
        fees: { managementBps: 0, performanceBps: 0 },
        creator: { address: ADDR, skinInGameUsdg: 1 },
        rebalance: { fuses: { maxAssetWeightBps: 4000, maxSlippageBps: 50, maxDailyTurnoverBps: 2000 } },
      },
    },
    hiss_prepare_vault_creation: {
      manifest: {
        schema: "vault-manifest-1.0.0",
        chainId: 4663,
        name: "V",
        baseAsset: "USDG",
        allowedAssets: ["USDG"],
        fees: { managementBps: 0, performanceBps: 0 },
        creator: { address: ADDR, skinInGameUsdg: 1 },
        rebalance: { fuses: { maxAssetWeightBps: 4000, maxSlippageBps: 50, maxDailyTurnoverBps: 2000 } },
      },
    },
    hiss_prepare_vault_deposit: { vault: ADDR, amount: "100", receiver: ADDR },
    hiss_prepare_vault_withdrawal: { vault: ADDR, shares: "10", receiver: ADDR },
    hiss_prepare_hiss_stake: { amount: "500" },
    hiss_prepare_xhiss_cooldown: { xhissAmount: "50" },
    hiss_prepare_xhiss_redeem: { xShares: "25", receiver: ADDR },
    hiss_validate_coil: {
      manifest: {
        schema: "coil-manifest-1.0.0",
        name: "C",
        universe: ["AAPL"],
        rules: [{ when: "x", weight: 1 }],
        fuses: { maxPositionBps: 2000, maxGrossExposureBps: 10000, allowShorting: false },
      },
    },
    hiss_compile_coil: {
      manifest: {
        schema: "coil-manifest-1.0.0",
        name: "C",
        universe: ["AAPL"],
        rules: [{ when: "x", weight: 1 }],
        fuses: { maxPositionBps: 2000, maxGrossExposureBps: 10000, allowShorting: false },
      },
    },
    ...STOCK_PREMIUM_ARGS,
  };

  it("no prepare tool's summary reads like a completed on-chain action", async () => {
    for (const name of prepareTools) {
      const result = await callHissTool(name, VALID[name] ?? {}, deps);
      // Not an OUTPUT_GUARD error — the summary never claims execution.
      expect(JSON.stringify(result.content)).not.toContain("OUTPUT_GUARD");
    }
  });

  it("every tx-producing prepare returns signed:false and admits nothing was sent", async () => {
    const txTools = [
      "hiss_prepare_vault_creation",
      "hiss_prepare_vault_deposit",
      "hiss_prepare_vault_withdrawal",
      "hiss_prepare_hiss_stake",
      "hiss_prepare_xhiss_cooldown",
      "hiss_prepare_xhiss_redeem",
    ];
    for (const name of txTools) {
      const result = await callHissTool(name, VALID[name] ?? {}, deps);
      const sc = result.structuredContent as JsonRecord;
      expect(sc.signed).toBe(false);
      expect(String(sc.note)).toContain("UNSIGNED");
      expect((result.content as Array<{ text: string }>)[0]?.text ?? "").toContain("Nothing was sent");
    }
  });
});

describe("fail-closed prepare guard (no empty-target / selector-less calldata)", () => {
  it("rejects empty / zero target", () => {
    expect(() => assertRealizableUnsignedTx("", "0xdeadbeef")).toThrow();
    expect(() =>
      assertRealizableUnsignedTx("0x0000000000000000000000000000000000000000", "0xdeadbeef"),
    ).toThrow();
    expect(() => assertRealizableUnsignedTx("not-an-address", "0xdeadbeef")).toThrow();
  });

  it("rejects empty / selector-less calldata", () => {
    expect(() => assertRealizableUnsignedTx(ADDR, "0x")).toThrow();
    expect(() => assertRealizableUnsignedTx(ADDR, "")).toThrow();
    expect(() => assertRealizableUnsignedTx(ADDR, "0x1234")).toThrow(); // < 4-byte selector
  });

  it("accepts a real target + 4-byte-selector calldata", () => {
    expect(() => assertRealizableUnsignedTx(ADDR, "0x6e553f65")).not.toThrow();
  });

  it("a facade whose prepare would yield empty calldata fails closed (never success-shaped)", async () => {
    // Real facade: an out-of-range amount makes the SDK refuse to encode calldata,
    // so no success-shaped unsigned tx is ever produced. This runs no network I/O.
    const real = createHissClient();
    const result = await callHissTool("hiss_prepare_hiss_stake", { amount: "0" }, { client: real });
    expect(result.isError).toBe(true);
    expect(isTypedError(result)).toBe(true);
    const sc = result.structuredContent as JsonRecord;
    expect(sc.signed).toBeUndefined(); // never a signed:false success shell
  });
});
