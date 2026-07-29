/**
 * §24.7 — Performance sanity. These are NOT hard gates (machine-dependent);
 * they record ballpark timings and fail only on an EGREGIOUS regression, so a
 * pathological O(n^2) width/serialize bug can't slip in unnoticed. Numbers are
 * emitted to stderr for the record.
 */

import { describe, it, expect } from "vitest";
import { renderCapture, mockClient } from "./_helpers.js";
import { serializeJson } from "../src/lib/format.js";
import { statusCommand } from "../src/commands/status.js";
import { renderBlocks } from "../src/lib/render.js";
import { testContext } from "../src/lib/context.js";
import type { CommandResult } from "../src/lib/output.js";
import type { ViewBlock } from "../src/lib/view.js";

function timed(label: string, fn: () => void): number {
  const t0 = performance.now();
  fn();
  const dt = performance.now() - t0;
  process.stderr.write(`[perf] ${label}: ${dt.toFixed(1)}ms\n`);
  return dt;
}

describe("§24.7 performance (record + egregious-only gate)", () => {
  it("renders `status` 1000× (HUMAN + JSON) without material regression", async () => {
    const result = await statusCommand(mockClient());
    const dtHuman = timed("status x1000 human", () => {
      for (let i = 0; i < 1000; i++)
        renderCapture(result, { mode: "human", color: true, colorLevel: 3, unicode: true });
    });
    const dtJson = timed("status x1000 json", () => {
      for (let i = 0; i < 1000; i++) renderCapture(result, { mode: "json" });
    });
    expect(dtHuman).toBeLessThan(3000);
    expect(dtJson).toBeLessThan(3000);
  });

  it("renders a 2000-row table without super-linear blowup", () => {
    const rows = Array.from({ length: 2000 }, (_, i) => [
      `vault-${i}`,
      { value: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6", token: "address" as const, full: true },
      { value: (i * 1000).toString(), token: undefined },
    ]);
    const view: ViewBlock[] = [
      {
        kind: "table",
        title: "Large table",
        columns: [{ header: "Vault" }, { header: "Address" }, { header: "Amount", numeric: true }],
        rows,
      },
    ];
    const ctx = testContext({ width: 120, color: true, unicode: true, mode: "human" });
    let lines: string[] = [];
    const dt = timed("table 2000 rows", () => {
      lines = renderBlocks(ctx, view);
    });
    expect(lines.length).toBeGreaterThan(2000);
    expect(dt).toBeLessThan(1500);
  });

  it("serializes a large canonical JSON payload quickly", () => {
    const big: CommandResult["data"] = {
      vaults: Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        address: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
        wei: (BigInt(i) * 10n ** 18n).toString(),
      })),
    };
    let text = "";
    const dt = timed("serializeJson 5000 items", () => {
      text = serializeJson(big);
    });
    expect(() => JSON.parse(text)).not.toThrow();
    expect(dt).toBeLessThan(1500);
  });
});
