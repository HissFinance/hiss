/**
 * §24.2 — Width matrix. Every rich view is rendered at 40/60/80/100/120/160
 * columns (plus the 20-col floor). Invariants:
 *  - no throw, no negative-width math at any width;
 *  - aligned tables never draw a border/rule wider than the terminal;
 *  - a full transaction-review address is NEVER split across lines;
 *  - the stacked fallback engages at narrow widths (no squashed columns);
 *  - ANSI never corrupts width math (visible widths are color-independent).
 */

import { describe, it, expect } from "vitest";
import { renderBlocks } from "../src/lib/render.js";
import { visibleWidth } from "../src/lib/width.js";
import { testContext } from "../src/lib/context.js";
import { vaultListCommand, vaultPrepareDepositCommand } from "../src/commands/vault.js";
import { mockClient, SAMPLE_TX } from "./_helpers.js";
import type { ViewBlock } from "../src/lib/view.js";

const WIDTHS = [20, 40, 60, 80, 100, 120, 160];

function renderAt(
  view: ViewBlock[],
  width: number,
  opts: { color?: boolean; unicode?: boolean } = {},
): string[] {
  const ctx = testContext({
    width,
    color: opts.color ?? false,
    unicode: opts.unicode ?? true,
    mode: "human",
  });
  return renderBlocks(ctx, view);
}

describe("§24.2 width — vault list table", () => {
  it("never throws and never draws a rule/border wider than the terminal", async () => {
    const { view } = await vaultListCommand(mockClient());
    expect(view).toBeDefined();
    for (const w of WIDTHS) {
      const lines = renderAt(view!, w);
      // Box-drawing rule lines (only glyphs + spaces) must fit the width.
      for (const line of lines) {
        const isRuleLike = /^[─\-\s]+$/.test(line) && line.trim().length > 0;
        if (isRuleLike) expect(visibleWidth(line)).toBeLessThanOrEqual(w);
      }
    }
  });

  it("engages the STACKED fallback at narrow widths (labels reappear)", async () => {
    const { view } = await vaultListCommand(mockClient());
    // 120 cols: aligned (no per-row 'Address:' label, has a header rule).
    const wide = renderAt(view!, 120).join("\n");
    expect(wide).not.toMatch(/Address:/);
    // 40 cols: the 2-column table can't fit → stacked "Header: value" blocks.
    const narrow = renderAt(view!, 40).join("\n");
    expect(narrow).toMatch(/Address:/);
    expect(narrow).toMatch(/Vault:/);
    expect(narrow).toMatch(/State:/);
  });

  it("visible width is color-independent (ANSI never corrupts width math)", async () => {
    const { view } = await vaultListCommand(mockClient());
    const plain = renderAt(view!, 120, { color: false }).map(visibleWidth);
    const colored = renderAt(view!, 120, { color: true }).map(visibleWidth);
    expect(colored).toEqual(plain);
  });
});

describe("§24.2 width — transaction review never splits an address", () => {
  it("shows the full target address intact on a single line at every width", async () => {
    const { view } = await vaultPrepareDepositCommand(mockClient(), SAMPLE_TX.to, "1000");
    expect(view).toBeDefined();
    for (const w of WIDTHS) {
      const lines = renderAt(view!, w);
      // The full address must appear, and never span a line break.
      const onOneLine = lines.some((l) => l.includes(SAMPLE_TX.to));
      expect(onOneLine, `address split at width ${w}`).toBe(true);
      // The address must never be middle-truncated inside a review card.
      const joined = lines.join("\n");
      expect(joined).not.toContain(SAMPLE_TX.to.slice(0, 6) + "…");
    }
  });

  it("renders the UNSIGNED review with no financial sign hidden", async () => {
    const { view } = await vaultPrepareDepositCommand(mockClient(), SAMPLE_TX.to, "1000");
    const joined = renderAt(view!, 40).join("\n");
    expect(joined).toContain("UNSIGNED");
    expect(joined).toContain("0 wei");
  });

  /**
   * FIXED (Agent 3, 8376b0f): the command now passes the raw wei value and the
   * `transaction` component renders the single unit — no doubled "wei".
   */
  it("transaction-review value renders a single unit ('0 wei', not doubled)", async () => {
    const { view } = await vaultPrepareDepositCommand(mockClient(), SAMPLE_TX.to, "1000");
    const joined = renderAt(view!, 80).join("\n");
    expect(joined).toContain("Value:");
    expect(joined).toContain("0 wei");
    expect(joined).not.toContain("0 wei wei");
  });
});
