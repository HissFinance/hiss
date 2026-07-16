import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { vaultValidateCommand } from "../src/commands/vault.js";
import { validateVaultManifest } from "../src/lib/validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => join(here, "fixtures", name);

describe("vault validate command", () => {
  it("accepts a well-formed Robinhood-Chain USDG manifest", async () => {
    const result = await vaultValidateCommand(fixture("vault.valid.json"));
    const data = result.data as { ok: boolean; issues: unknown[] };
    expect(data.ok).toBe(true);
    expect(data.issues).toHaveLength(0);
    expect(result.summary).toContain("VALID");
  });

  it("rejects a Base-chain / non-USDG manifest fail-closed", async () => {
    const result = await vaultValidateCommand(fixture("vault.invalid.json"));
    const data = result.data as { ok: boolean; issues: Array<{ code: string }> };
    expect(data.ok).toBe(false);
    const codes = data.issues.map((i) => i.code);
    expect(codes).toContain("CHAIN_NOT_ROBINHOOD");
    expect(codes).toContain("BASE_ASSET_INVALID");
    expect(codes).toContain("CREATOR_SKIN_REQUIRED");
  });
});

describe("validateVaultManifest unit", () => {
  it("enforces fee bounds", () => {
    const verdict = validateVaultManifest({
      schema: "vault-manifest-1.0.0",
      chainId: 4663,
      name: "x",
      baseAsset: "USDG",
      allowedAssets: ["USDG"],
      fees: { managementBps: 100, performanceBps: 99999 },
      creator: { address: "0x" + "1".repeat(40), skinInGameUsdg: 1 },
      rebalance: { fuses: { maxAssetWeightBps: 1, maxSlippageBps: 1, maxDailyTurnoverBps: 1 } },
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.issues.map((i) => i.code)).toContain("FEE_OUT_OF_BOUNDS");
  });
});
