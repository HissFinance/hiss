/**
 * FUSE MATRIX (task §13): fuse / result / current / limit / reason /
 * evidence-age. Built on the width-aware table so it stacks cleanly at narrow
 * widths. The `result` cell is a status badge (symbol + word + color), so a
 * trip is legible without color.
 */

import type { OutputContext } from "../context.js";
import type { FuseRow, TableCell, StateToken } from "../view.js";
import { renderTable } from "./table.js";
import { stateVisual } from "./shared.js";

function resultCell(ctx: OutputContext, result: FuseRow["result"]): TableCell {
  const state: StateToken =
    result === "pass"
      ? "success"
      : result === "unknown"
        ? "unknown"
        : result === "tripped"
          ? "blocked"
          : "error";
  const v = stateVisual(ctx.theme, state);
  return { value: `${ctx.symbols(v.glyph)} ${result.toUpperCase()}`, token: state };
}

export function renderFuse(ctx: OutputContext, props: { rows: FuseRow[]; title?: string }): string[] {
  return renderTable(ctx, {
    title: props.title ?? "Fuse matrix",
    columns: [
      { header: "Fuse" },
      { header: "Result" },
      { header: "Current", numeric: true },
      { header: "Limit", numeric: true },
      { header: "Reason" },
      { header: "Evidence" },
    ],
    rows: props.rows.map((r) => [
      r.fuse,
      resultCell(ctx, r.result),
      r.current ?? null,
      r.limit ?? null,
      r.reason ?? null,
      r.evidenceAge ?? null,
    ]),
  });
}
