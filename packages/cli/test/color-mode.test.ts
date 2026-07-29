/**
 * §24.1 — Color / mode matrix.
 *
 * Two layers of proof:
 *  1. The PURE capability resolver (`resolveCapabilities`) across every
 *     TTY/NO_COLOR/FORCE_COLOR/--color/--json/--plain/TERM=dumb/CI combination.
 *  2. Rendered-output invariants through the canonical sink:
 *       - JSON stdout NEVER carries ANSI, even under `--color always`.
 *       - PLAIN NEVER carries ANSI.
 *       - non-TTY auto → no ANSI.
 *       - `--color always` HUMAN → ANSI present.
 *       - stripAnsi(colored HUMAN) === uncolored HUMAN (same words/symbols,
 *         color removed) — the accessibility equivalence.
 */

import { describe, it, expect } from "vitest";
import { resolveCapabilities, resolveColor, resolveMode } from "../src/lib/capabilities.js";
import type { CapabilityInput } from "../src/lib/capabilities.js";
import { statusCommand } from "../src/commands/status.js";
import { agenticStatusCommand } from "../src/commands/agentic.js";
import { mockClient, renderCapture, stripAnsi, hasAnsi } from "./_helpers.js";

const baseInput = (over: Partial<CapabilityInput> = {}): CapabilityInput => ({
  env: {},
  stdoutIsTTY: true,
  stderrIsTTY: true,
  columns: 80,
  ...over,
});

describe("§24.1 capability resolution — mode precedence", () => {
  it("--json wins over everything", () => {
    expect(resolveMode(baseInput({ jsonFlag: true, plainFlag: true, outputFlag: "plain" }))).toBe("json");
  });
  it("--output beats --plain shorthand", () => {
    expect(resolveMode(baseInput({ outputFlag: "human", plainFlag: true }))).toBe("human");
  });
  it("--plain shorthand chosen when no higher flag", () => {
    expect(resolveMode(baseInput({ plainFlag: true }))).toBe("plain");
  });
  it("HISS_OUTPUT env below the flags", () => {
    expect(resolveMode(baseInput({ env: { HISS_OUTPUT: "json" } }))).toBe("json");
    expect(resolveMode(baseInput({ env: { HISS_OUTPUT: "plain" }, plainFlag: false }))).toBe("plain");
  });
  it("non-TTY never silently becomes JSON — stays human", () => {
    expect(resolveMode(baseInput({ stdoutIsTTY: false }))).toBe("human");
  });
  it("default is human", () => {
    expect(resolveMode(baseInput())).toBe("human");
  });
});

describe("§24.1 capability resolution — color precedence", () => {
  it("TTY human auto → color ON", () => {
    const caps = resolveCapabilities(baseInput());
    expect(caps.mode).toBe("human");
    expect(caps.color).toBe(true);
  });
  it("non-TTY auto → color OFF", () => {
    expect(resolveColor(baseInput({ stdoutIsTTY: false }), "human").color).toBe(false);
  });
  it("NO_COLOR (any value) → color OFF", () => {
    expect(resolveColor(baseInput({ env: { NO_COLOR: "" } }), "human").color).toBe(false);
    expect(resolveColor(baseInput({ env: { NO_COLOR: "1" } }), "human").color).toBe(false);
  });
  it("--color never is absolute (beats FORCE_COLOR)", () => {
    expect(resolveColor(baseInput({ colorFlag: "never", env: { FORCE_COLOR: "3" } }), "human").color).toBe(
      false,
    );
  });
  it("--color always enables HUMAN color", () => {
    expect(resolveColor(baseInput({ colorFlag: "always", stdoutIsTTY: false }), "human").color).toBe(true);
  });
  it("FORCE_COLOR=0 → OFF; FORCE_COLOR=1 → ON (auto)", () => {
    expect(resolveColor(baseInput({ env: { FORCE_COLOR: "0" } }), "human").color).toBe(false);
    expect(resolveColor(baseInput({ env: { FORCE_COLOR: "1" }, stdoutIsTTY: false }), "human").color).toBe(
      true,
    );
  });
  it("TERM=dumb → color OFF", () => {
    expect(resolveColor(baseInput({ env: { TERM: "dumb" } }), "human").color).toBe(false);
  });
  it("CI → color OFF by default, opt-in via FORCE_COLOR", () => {
    expect(resolveColor(baseInput({ env: { CI: "true" } }), "human").color).toBe(false);
    expect(resolveColor(baseInput({ env: { CI: "true", FORCE_COLOR: "1" } }), "human").color).toBe(true);
  });
  it("color levels: truecolor(3), 256(2), basic(1)", () => {
    expect(
      resolveColor(baseInput({ colorFlag: "always", env: { COLORTERM: "truecolor" } }), "human").level,
    ).toBe(3);
    expect(
      resolveColor(baseInput({ colorFlag: "always", env: { TERM: "xterm-256color" } }), "human").level,
    ).toBe(2);
    expect(resolveColor(baseInput({ colorFlag: "always", env: {} }), "human").level).toBe(1);
  });
});

describe("§24.1 HARD INVARIANT — JSON/PLAIN never carry ANSI", () => {
  it("JSON mode forces color off regardless of --color always / FORCE_COLOR", () => {
    const c1 = resolveColor(baseInput({ colorFlag: "always" }), "json");
    const c2 = resolveColor(baseInput({ env: { FORCE_COLOR: "3" } }), "json");
    expect(c1.color).toBe(false);
    expect(c2.color).toBe(false);
  });
  it("PLAIN mode forces color off", () => {
    expect(resolveColor(baseInput({ colorFlag: "always" }), "plain").color).toBe(false);
  });
});

describe("§24.1 rendered-output invariants (canonical sink)", () => {
  it("JSON stdout is ANSI-free even with --color always (parses as JSON)", async () => {
    const result = await statusCommand(mockClient());
    // Force a colored, unicode, interactive context but JSON mode.
    const { stdout } = renderCapture(
      result,
      {
        mode: "json",
        color: true,
        colorLevel: 3,
        unicode: true,
        interactive: true,
      },
      { command: "status", cliVersion: "0.2.0" },
    );
    expect(hasAnsi(stdout)).toBe(false);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe("status");
    expect(parsed.data.network).toBe("robinhood-chain-mainnet");
  });

  it("PLAIN stdout is ANSI-free", async () => {
    const result = await statusCommand(mockClient());
    const { stdout } = renderCapture(result, { mode: "plain" });
    expect(hasAnsi(stdout)).toBe(false);
  });

  it("non-TTY auto human → no ANSI", async () => {
    const result = await statusCommand(mockClient());
    // color:false is what resolveCapabilities yields for non-TTY auto.
    const { stdout } = renderCapture(result, { mode: "human", color: false, unicode: false });
    expect(hasAnsi(stdout)).toBe(false);
  });

  it("--color always HUMAN → ANSI present", async () => {
    const result = await statusCommand(mockClient());
    const { stdout } = renderCapture(result, { mode: "human", color: true, colorLevel: 1, unicode: true });
    expect(hasAnsi(stdout)).toBe(true);
  });

  it("EQUIVALENCE — stripAnsi(colored HUMAN) === uncolored HUMAN", () => {
    // agentic status has no field whose label collides with a redaction key,
    // so it is a clean witness of the color-removal equivalence.
    const result = agenticStatusCommand();
    const colored = renderCapture(result, {
      mode: "human",
      color: true,
      colorLevel: 3,
      unicode: true,
    }).stdout;
    const plainHuman = renderCapture(result, { mode: "human", color: false, unicode: true }).stdout;
    expect(hasAnsi(colored)).toBe(true);
    expect(hasAnsi(plainHuman)).toBe(false);
    // Same words + symbols; only the color escapes are removed.
    expect(stripAnsi(colored)).toBe(plainHuman);
  });

  /**
   * FIXED (Agent 2, 37bc1d0): `redact` no longer keys on the bare word `token`,
   * so the KV label `Token:` keeps the PUBLIC symbol `HISS`, and redaction now
   * runs on the ANSI-stripped view so it is color-independent. The §24.1
   * equivalence therefore holds for `status` too — including the token row.
   */
  it("EQUIVALENCE holds for `status` (no color-dependent over-redaction)", async () => {
    const result = await statusCommand(mockClient());
    const colored = renderCapture(result, {
      mode: "human",
      color: true,
      colorLevel: 3,
      unicode: true,
    }).stdout;
    const plainHuman = renderCapture(result, { mode: "human", color: false, unicode: true }).stdout;
    // The public token symbol survives in BOTH paths — never redacted.
    expect(stripAnsi(colored)).toContain("Token:");
    expect(stripAnsi(colored)).toContain("HISS 0x47162135");
    expect(plainHuman).toContain("HISS 0x47162135");
    expect(plainHuman).not.toContain("[redacted]");
    // Same words + symbols; only color escapes removed.
    expect(stripAnsi(colored)).toBe(plainHuman);
  });
});
