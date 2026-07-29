/**
 * §24.3 (accessibility, copy layer) — PLAIN-mode is strictly ASCII.
 *
 * OUTPUT_CONTRACT §1 says PLAIN is "ASCII only". Agent 2 (37bc1d0) added an
 * asciiFold() applied by the sink to every PLAIN stdout line, stderr warning,
 * and fatal error line, so authored copy punctuation (em-dash, ≠, →, ·, …) and
 * any residual non-ASCII are folded away. This suite now HARD-asserts that no
 * PLAIN output byte is > 0x7F — both the renderer glyphs (box-drawing / state)
 * and the authored copy.
 */

import { describe, it, expect } from "vitest";
import { renderCapture, capture, mockClient, healthyMcpFetch, fixture, nonAscii } from "./_helpers.js";
import { renderResult, renderErrorResult, type CommandResult } from "../src/lib/output.js";

import { statusCommand, contractsCommand } from "../src/commands/status.js";
import { vaultListCommand, vaultInspectCommand, vaultValidateCommand } from "../src/commands/vault.js";
import { stakeStatusCommand } from "../src/commands/stake.js";
import { rewardsStatusCommand } from "../src/commands/rewards.js";
import { coilCompileCommand } from "../src/commands/coil.js";
import { mcpStatusCommand } from "../src/commands/mcp.js";
import { lpStatusCommand } from "../src/commands/lp.js";
import { agenticStatusCommand } from "../src/commands/agentic.js";

/** Renderer-controlled glyphs that MUST NEVER appear in PLAIN output. */
const FORBIDDEN_GLYPHS = [
  "●",
  "◐",
  "○",
  "■",
  "Ⅱ",
  "✓",
  "✗",
  "▲",
  "ℹ",
  "•",
  "─",
  "│",
  "┌",
  "┐",
  "└",
  "┘",
  "├",
  "┤",
];

async function allPlainOutput(): Promise<string> {
  const makers: (() => Promise<CommandResult> | CommandResult)[] = [
    () => statusCommand(mockClient()),
    () => contractsCommand(mockClient()),
    () => vaultListCommand(mockClient()),
    () => vaultInspectCommand(mockClient(), "flagship"),
    () => vaultValidateCommand(fixture("vault.invalid.json")),
    () => stakeStatusCommand(mockClient()),
    () => rewardsStatusCommand(mockClient()),
    () => coilCompileCommand(fixture("coil.valid.json"), "2026-01-01T00:00:00.000Z"),
    () => mcpStatusCommand(healthyMcpFetch(), "https://mcp.example.test"),
    () => lpStatusCommand(),
    () => agenticStatusCommand(),
  ];
  let out = "";
  for (const make of makers) {
    const result = await make();
    out += renderCapture(result, { mode: "plain" }).stdout;
  }
  return out;
}

describe("§24.3 PLAIN-mode is strictly ASCII", () => {
  it("NEVER emits a renderer box-drawing / state glyph in PLAIN", async () => {
    const out = await allPlainOutput();
    for (const g of FORBIDDEN_GLYPHS) {
      expect(out, `PLAIN leaked renderer glyph ${JSON.stringify(g)}`).not.toContain(g);
    }
  });

  it("emits ZERO non-ASCII bytes across every command's PLAIN output", async () => {
    const out = await allPlainOutput();
    const found = nonAscii(out);
    expect(
      found,
      `PLAIN carried non-ASCII: ${found.map((c) => "U+" + c.codePointAt(0)!.toString(16)).join(", ")}`,
    ).toEqual([]);
  });

  it("PLAIN warnings and errors on stderr are also ASCII-folded", () => {
    // Directly exercise the sink's stderr paths with Unicode-bearing copy.
    const capW = capture({ mode: "plain" });
    renderResult(
      { summary: "ok", data: {}, warnings: ["planned ≠ funded → not claimable · note"], exitCode: 0 },
      capW.ctx,
    );
    expect(nonAscii(capW.err())).toEqual([]);

    const capE = capture({ mode: "plain" });
    renderErrorResult({ code: 1, message: "boom — sub‑detail ≠ ok", kind: "general" }, capE.ctx);
    expect(nonAscii(capE.err())).toEqual([]);
  });
});
