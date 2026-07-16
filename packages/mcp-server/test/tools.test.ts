import { describe, it, expect } from "vitest";
import { callHissTool } from "../src/server.js";
import { HISS_TOOLS } from "../src/tools.js";
import { mockClient, VALID_VAULT_MANIFEST, VALID_COIL_MANIFEST } from "./helpers/mockClient.js";
import type { JsonRecord } from "../src/lib/types.js";

const deps = { client: mockClient(), nowIso: () => "2026-07-16T00:00:00.000Z" };

/** Valid arguments per tool so every tool can be exercised end-to-end. */
const ARGS: Record<string, JsonRecord> = {
  hiss_get_protocol_status: {},
  hiss_get_contract_registry: {},
  hiss_get_vaults: {},
  hiss_get_vault: { ref: "flagship" },
  hiss_get_vault_holdings: { vault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6" },
  hiss_get_vault_performance: { vault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6" },
  hiss_get_staking_status: {},
  hiss_get_reward_status: {},
  hiss_get_receipt: { id: "r-1" },
  hiss_verify_receipt: { receipt: { kind: "state_read", hash: "0x00" } },
  hiss_get_supported_assets: {},
  hiss_get_fee_schedule: {},
  hiss_create_vault_candidate: {
    name: "Draft",
    allowedAssets: ["USDG"],
    creator: { address: "0x" + "1".repeat(40), skinInGameUsdg: 1 },
  },
  hiss_validate_vault_candidate: { manifest: VALID_VAULT_MANIFEST },
  hiss_prepare_vault_creation: { manifest: VALID_VAULT_MANIFEST },
  hiss_prepare_vault_deposit: { vault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6", amount: "100" },
  hiss_prepare_vault_withdrawal: { vault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6", shares: "10" },
  hiss_prepare_hiss_stake: { amount: "500" },
  hiss_prepare_xhiss_cooldown: { xhissAmount: "50" },
  hiss_prepare_xhiss_redeem: {},
  hiss_validate_coil: { manifest: VALID_COIL_MANIFEST },
  hiss_compile_coil: { manifest: VALID_COIL_MANIFEST },
};

const FORBIDDEN_NAME_FRAGMENTS = [
  "sign",
  "submit",
  "execute",
  "broadcast",
  "fund",
  "publish_root",
  "publish_reward",
  "owner",
  "admin",
  "safe",
  "rescue",
  "set_injector",
  "transfer_ownership",
  "private",
  "seed",
];

describe("tool registry is read/prepare only", () => {
  it("every tool is classified read or prepare", () => {
    for (const t of HISS_TOOLS) expect(["read", "prepare"]).toContain(t.kind);
  });

  it("no tool name implies an owner-only, signing, or admin action", () => {
    for (const t of HISS_TOOLS) {
      for (const frag of FORBIDDEN_NAME_FRAGMENTS) {
        expect(t.name.toLowerCase()).not.toContain(frag);
      }
    }
  });

  it("exposes exactly 12 read + 10 prepare tools", () => {
    expect(HISS_TOOLS.filter((t) => t.kind === "read")).toHaveLength(12);
    expect(HISS_TOOLS.filter((t) => t.kind === "prepare")).toHaveLength(10);
  });
});

describe("every tool runs clean and never claims execution", () => {
  for (const tool of HISS_TOOLS) {
    it(`${tool.name} returns a guarded, non-error result`, async () => {
      const result = await callHissTool(tool.name, ARGS[tool.name] ?? {}, deps);
      expect(result.isError ?? false).toBe(false);
      expect(result.structuredContent).toBeDefined();
    });
  }
});

describe("prepare tools return strictly unsigned transactions", () => {
  const prepareTxTools = [
    "hiss_prepare_vault_creation",
    "hiss_prepare_vault_deposit",
    "hiss_prepare_vault_withdrawal",
    "hiss_prepare_hiss_stake",
    "hiss_prepare_xhiss_cooldown",
    "hiss_prepare_xhiss_redeem",
  ];
  for (const name of prepareTxTools) {
    it(`${name} is unsigned and admits nothing was sent`, async () => {
      const result = await callHissTool(name, ARGS[name] ?? {}, deps);
      const sc = result.structuredContent as JsonRecord;
      expect(sc.signed).toBe(false);
      expect(String(sc.note)).toContain("UNSIGNED");
      const text = (result.content as Array<{ text: string }>)[0]?.text ?? "";
      expect(text).toContain("Nothing was sent");
    });
  }
});

describe("input safety", () => {
  it("rejects credential-shaped input", async () => {
    const result = await callHissTool(
      "hiss_prepare_hiss_stake",
      { amount: "1", privateKey: "0x" + "a".repeat(64) } as JsonRecord,
      deps,
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("CREDENTIAL_REJECTED");
  });

  it("refuses to prepare an invalid vault manifest", async () => {
    const result = await callHissTool(
      "hiss_prepare_vault_creation",
      { manifest: { schema: "vault-manifest-1.0.0", chainId: 8453, baseAsset: "USDC" } },
      deps,
    );
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("INVALID_INPUT");
  });
});
