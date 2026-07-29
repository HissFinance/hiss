/**
 * §24.4 — Per-command golden matrix. Every command family is exercised across
 * its states (success / degraded / invalid / refusal / unknown) and rendered in
 * PLAIN and JSON (stable, snapshotted) plus HUMAN-no-color (rich components,
 * deterministic, ANSI-free). Snapshots lock the rendered contract so any future
 * drift is caught. Fully hermetic: mock client, injected mcp fetch, frozen
 * clock, fixed 80-col width.
 *
 * NOTE: snapshots reflect the CORRECTED behavior after the Agent 2/3 fixes
 * (37bc1d0, 8376b0f): PLAIN output is strictly ASCII (asciiFold), the public
 * "Token: HISS" symbol is no longer over-redacted, and prepare-* reviews show a
 * single `wei` unit.
 */

import { describe, it, expect } from "vitest";
import {
  renderCapture,
  mockClient,
  healthyMcpFetch,
  downMcpFetch,
  fixture,
  SKILLS_DIR,
  SAMPLE_TX,
} from "./_helpers.js";
import type { CommandResult } from "../src/lib/output.js";
import type { HissClient } from "../src/lib/types.js";

import { statusCommand, contractsCommand } from "../src/commands/status.js";
import {
  vaultListCommand,
  vaultInspectCommand,
  vaultHoldingsCommand,
  vaultPerformanceCommand,
  vaultValidateCommand,
  vaultCreateCommand,
  vaultPrepareCreateCommand,
  vaultPrepareDepositCommand,
  vaultPrepareWithdrawCommand,
} from "../src/commands/vault.js";
import {
  stakeStatusCommand,
  stakePrepareCommand,
  stakeCooldownCommand,
  stakeRedeemCommand,
} from "../src/commands/stake.js";
import {
  rewardsStatusCommand,
  rewardsContributorCommand,
  rewardsProviderCommand,
} from "../src/commands/rewards.js";
import { coilValidateCommand, coilCompileCommand } from "../src/commands/coil.js";
import { receiptVerifyCommand } from "../src/commands/receipt.js";
import { mcpStatusCommand, mcpToolsCommand, mcpDoctorCommand } from "../src/commands/mcp.js";
import { lpStatusCommand, lpFeesCommand, lpScanCommand, lpPrepareMintCommand } from "../src/commands/lp.js";
import {
  agenticStatusCommand,
  agenticSetupCommand,
  agenticCoilsCommand,
  agenticGrantsCommand,
  agenticReceiptsCommand,
} from "../src/commands/agentic.js";
import { skillListCommand, skillPrintCommand } from "../src/commands/skill.js";

/**
 * Golden snapshots must be hermetic: the absolute fixtures path is a
 * machine-specific build location (and a private-boundary leak if committed),
 * so replace it with a stable token before snapshotting. Real `hiss skill`
 * output legitimately shows the caller's own dir — only the TEST snapshot is
 * normalized.
 */
const scrubPaths = (s: string): string => s.split(SKILLS_DIR).join("<skills-dir>");

const FIXED_NOW = "2026-01-01T00:00:00.000Z";
const VALID_RECEIPT = JSON.stringify({
  kind: "state-read",
  subject: "vault",
  note: "integrity fixture",
  hash: "0xcaf148cbe2e70fb008e653ca7ca3ffc46365e3f1a515f13f9cf31de081427975",
});
const FAILED_RECEIPT = JSON.stringify({ kind: "state-read", hash: "0xdeadbeef" });

/** A client whose protocol read reports a degraded (unreachable) posture. */
function degradedClient(): HissClient {
  return mockClient({
    getProtocolStatus: () =>
      Promise.resolve({ network: "robinhood-chain-mainnet", chain: "4663", chainId: 4663, reachable: false }),
  });
}

type Make = () => Promise<CommandResult> | CommandResult;

const CASES: [string, Make][] = [
  ["status.success", () => statusCommand(mockClient())],
  ["status.degraded", () => statusCommand(degradedClient())],
  ["contracts", () => contractsCommand(mockClient())],

  ["vault.list", () => vaultListCommand(mockClient())],
  ["vault.inspect", () => vaultInspectCommand(mockClient(), "flagship")],
  ["vault.holdings", () => vaultHoldingsCommand(mockClient(), "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6")],
  [
    "vault.performance",
    () => vaultPerformanceCommand(mockClient(), "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6"),
  ],
  ["vault.validate.valid", () => vaultValidateCommand(fixture("vault.valid.json"))],
  ["vault.validate.invalid", () => vaultValidateCommand(fixture("vault.invalid.json"))],
  ["vault.create", () => vaultCreateCommand()],
  [
    "vault.prepare-create.refused",
    () => vaultPrepareCreateCommand(mockClient(), fixture("vault.invalid.json")),
  ],
  ["vault.prepare-create.ok", () => vaultPrepareCreateCommand(mockClient(), fixture("vault.valid.json"))],
  ["vault.prepare-deposit", () => vaultPrepareDepositCommand(mockClient(), SAMPLE_TX.to, "1000")],
  ["vault.prepare-withdraw", () => vaultPrepareWithdrawCommand(mockClient(), SAMPLE_TX.to, "50")],

  ["stake.status", () => stakeStatusCommand(mockClient())],
  ["stake.prepare", () => stakePrepareCommand(mockClient(), "1000")],
  ["stake.cooldown", () => stakeCooldownCommand(mockClient(), "500")],
  ["stake.redeem", () => stakeRedeemCommand(mockClient())],

  ["rewards.status", () => rewardsStatusCommand(mockClient())],
  [
    "rewards.contributor",
    () => rewardsContributorCommand(mockClient(), "0x1111111111111111111111111111111111111111"),
  ],
  ["rewards.provider", () => rewardsProviderCommand(mockClient(), "group-1")],

  ["coil.validate.valid", () => coilValidateCommand(fixture("coil.valid.json"))],
  ["coil.validate.invalid", () => coilValidateCommand(fixture("coil.invalid.json"))],
  ["coil.compile.ok", () => coilCompileCommand(fixture("coil.valid.json"), FIXED_NOW)],
  ["coil.compile.refused", () => coilCompileCommand(fixture("coil.invalid.json"), FIXED_NOW)],

  ["receipt.verify.verified", () => receiptVerifyCommand(VALID_RECEIPT)],
  ["receipt.verify.failed", () => receiptVerifyCommand(FAILED_RECEIPT)],

  ["mcp.status.healthy", () => mcpStatusCommand(healthyMcpFetch(), "https://mcp.example.test")],
  ["mcp.status.down", () => mcpStatusCommand(downMcpFetch, "https://mcp.example.test")],
  ["mcp.tools.healthy", () => mcpToolsCommand(healthyMcpFetch(), "https://mcp.example.test")],
  ["mcp.doctor.healthy", () => mcpDoctorCommand(healthyMcpFetch(), "https://mcp.example.test")],
  ["mcp.doctor.down", () => mcpDoctorCommand(downMcpFetch, "https://mcp.example.test")],

  ["lp.status", () => lpStatusCommand()],
  ["lp.fees", () => lpFeesCommand()],
  ["lp.scan.unknown", () => lpScanCommand()],
  ["lp.prepare-mint.unavailable", () => lpPrepareMintCommand()],

  ["agentic.status", () => agenticStatusCommand()],
  ["agentic.setup", () => agenticSetupCommand()],
  ["agentic.coils", () => agenticCoilsCommand()],
  ["agentic.grants", () => agenticGrantsCommand()],
  ["agentic.receipts", () => agenticReceiptsCommand()],

  ["skill.list", () => skillListCommand(SKILLS_DIR)],
  ["skill.print.found", () => skillPrintCommand("demo-pack", SKILLS_DIR)],
  ["skill.print.notfound", () => skillPrintCommand("does-not-exist", SKILLS_DIR)],
];

describe("§24.4 golden — JSON envelope (stable, canonical)", () => {
  for (const [name, make] of CASES) {
    it(name, async () => {
      const result = await make();
      const { stdout } = renderCapture(result, { mode: "json" }, { command: name, cliVersion: "0.2.0" });
      // Every JSON payload must parse and carry the stable envelope keys.
      const env = JSON.parse(stdout);
      expect(env).toHaveProperty("ok");
      expect(env).toHaveProperty("code");
      expect(env).toHaveProperty("summary");
      expect(env).toHaveProperty("data");
      expect(scrubPaths(stdout)).toMatchSnapshot();
    });
  }
});

describe("§24.4 golden — PLAIN (ASCII-ish, stable labels)", () => {
  for (const [name, make] of CASES) {
    it(name, async () => {
      const result = await make();
      const { stdout } = renderCapture(result, { mode: "plain" });
      expect(scrubPaths(stdout)).toMatchSnapshot();
    });
  }
});

describe("§24.4 golden — HUMAN (no color, Unicode components)", () => {
  for (const [name, make] of CASES) {
    it(name, async () => {
      const result = await make();
      const { stdout } = renderCapture(result, { mode: "human", color: false, unicode: true });
      expect(scrubPaths(stdout)).toMatchSnapshot();
    });
  }
});
