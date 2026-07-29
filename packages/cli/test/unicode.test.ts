/**
 * §24.3 — Unicode matrix. Proves the ASCII fallback path for every
 * RENDERER-CONTROLLED glyph (state markers, verdicts, box-drawing, bullets,
 * arrows) engages when Unicode is unavailable — the Windows / dumb-terminal /
 * screen-reader safety net. Authored copy punctuation (em-dash, ≠) is a
 * separate concern, characterized in `accessibility.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { resolveUnicode } from "../src/lib/capabilities.js";
import type { CapabilityInput } from "../src/lib/capabilities.js";
import { makeSymbols, GLYPHS } from "../src/lib/symbols.js";
import { renderBlocks } from "../src/lib/render.js";
import { testContext } from "../src/lib/context.js";
import { vaultInspectCommand } from "../src/commands/vault.js";
import { agenticStatusCommand } from "../src/commands/agentic.js";
import { coilCompileCommand } from "../src/commands/coil.js";
import { mockClient, fixture } from "./_helpers.js";
import type { ViewBlock } from "../src/lib/view.js";

const input = (over: Partial<CapabilityInput> = {}): CapabilityInput => ({
  env: {},
  stdoutIsTTY: true,
  stderrIsTTY: true,
  columns: 80,
  ...over,
});

/** Every preferred Unicode glyph the renderer can emit. */
const UNICODE_GLYPHS = Object.values(GLYPHS).map((g) => g.unicode);

describe("§24.3 unicode resolution precedence", () => {
  it("--unicode never → ASCII", () => {
    expect(resolveUnicode(input({ unicodeFlag: "never" }), "human")).toBe(false);
  });
  it("--unicode always → Unicode (HUMAN only)", () => {
    expect(resolveUnicode(input({ unicodeFlag: "always" }), "human")).toBe(true);
    expect(resolveUnicode(input({ unicodeFlag: "always" }), "plain")).toBe(false);
  });
  it("PLAIN mode is always ASCII", () => {
    expect(resolveUnicode(input({ unicodeFlag: "always", env: { LANG: "en_US.UTF-8" } }), "plain")).toBe(
      false,
    );
  });
  it("auto: UTF-8 locale + TTY → Unicode", () => {
    expect(resolveUnicode(input({ env: { LANG: "en_US.UTF-8" } }), "human")).toBe(true);
  });
  it("auto: TERM=dumb → ASCII even with a UTF-8 locale", () => {
    expect(resolveUnicode(input({ env: { TERM: "dumb", LANG: "en_US.UTF-8" } }), "human")).toBe(false);
  });
  it("auto: non-TTY → ASCII", () => {
    expect(resolveUnicode(input({ stdoutIsTTY: false, env: { LANG: "en_US.UTF-8" } }), "human")).toBe(false);
  });
});

describe("§24.3 symbol resolver — ASCII fallbacks", () => {
  it("maps every semantic glyph to a pure-ASCII fallback when Unicode is off", () => {
    const ascii = makeSymbols(false);
    const unicode = makeSymbols(true);
    for (const name of Object.keys(GLYPHS) as (keyof typeof GLYPHS)[]) {
      const a = ascii(name);
      // Fallback is pure ASCII.
      for (const ch of a) expect(ch.codePointAt(0)!).toBeLessThan(0x80);
      // And Unicode mode still yields the preferred glyph.
      expect(unicode(name)).toBe(GLYPHS[name].unicode);
    }
    // Spot-check the documented substitutions (task §24.3).
    expect(ascii("live")).toBe("*");
    expect(ascii("degraded")).toBe("~");
    expect(ascii("prepared")).toBe("o");
    expect(ascii("blocked")).toBe("#");
    expect(ascii("ok")).toBe("+");
    expect(ascii("err")).toBe("x");
    expect(ascii("arrow")).toBe("->");
    expect(ascii("hLine")).toBe("-");
  });
});

describe("§24.3 rendered views — no renderer glyph leaks when Unicode is off", () => {
  it("state/verdict/box glyphs are absent across representative views", async () => {
    const views: ViewBlock[][] = [];
    views.push((await vaultInspectCommand(mockClient(), "flagship")).view!);
    views.push(agenticStatusCommand().view!);
    views.push((await coilCompileCommand(fixture("coil.valid.json"), "2026-01-01T00:00:00.000Z")).view!);

    const ctx = testContext({ width: 100, color: false, unicode: false, mode: "human" });
    const out = views.map((v) => renderBlocks(ctx, v).join("\n")).join("\n");

    for (const g of UNICODE_GLYPHS) {
      // "?" is its own ASCII fallback (unknown/info); skip the ambiguous ones.
      if (g === "?") continue;
      expect(out, `renderer emitted Unicode glyph ${JSON.stringify(g)} with unicode:false`).not.toContain(g);
    }
  });

  it("the same views in Unicode mode DO use box-drawing / state glyphs", async () => {
    const view = agenticStatusCommand().view!;
    const ctx = testContext({ width: 100, color: false, unicode: true, mode: "human" });
    const out = renderBlocks(ctx, view).join("\n");
    // A status/fuse marker or bullet proves Unicode is actually exercised.
    expect(/[●○■✓✗▲•]/.test(out)).toBe(true);
  });
});
