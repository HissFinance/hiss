/**
 * DATA TABLE (task §13, §10): width-aware columnar renderer.
 *
 * - Financial columns are right-aligned and NEVER wrapped or truncated.
 * - Missing cells render an explicit muted UNKNOWN.
 * - Addresses/hashes abbreviate in HUMAN (full in --json).
 * - When the table cannot fit the terminal width, it falls back to a STACKED
 *   key-value layout per row — no broken borders, no hidden numbers.
 * - `compact` tightens the gutter.
 */

import type { OutputContext } from "../context.js";
import type { TableColumn, TableCell } from "../view.js";
import { formatValue, formatNumeric, tokenStyle, rule } from "./shared.js";
import { visibleWidth, padEnd, padStart } from "../width.js";

interface Rendered {
  display: string; // styled
  width: number; // visible width
  right: boolean;
}

function renderCell(ctx: OutputContext, cell: TableCell, col: TableColumn): Rendered {
  const right = col.numeric === true || col.align === "right";
  let display: string;
  if (cell === null || cell === undefined) {
    display = ctx.theme.unknown("UNKNOWN");
  } else if (typeof cell === "object") {
    if (col.numeric) {
      const grouped = formatNumeric(cell.value);
      display =
        grouped === "UNKNOWN" ? ctx.theme.unknown("UNKNOWN") : tokenStyle(ctx.theme, cell.token)(grouped);
    } else {
      display = formatValue(ctx, cell.value, { token: cell.token, full: cell.full });
    }
  } else if (col.numeric) {
    const grouped = formatNumeric(cell);
    display = grouped === "UNKNOWN" ? ctx.theme.unknown("UNKNOWN") : ctx.theme.value(grouped);
  } else {
    display = formatValue(ctx, cell);
  }
  return { display, width: visibleWidth(display), right };
}

export function renderTable(
  ctx: OutputContext,
  props: { columns: TableColumn[]; rows: TableCell[][]; title?: string; compact?: boolean },
): string[] {
  const out: string[] = [];
  if (props.title) out.push(ctx.theme.heading(props.title));

  const cols = props.columns;
  const grid: Rendered[][] = props.rows.map((row) => cols.map((col, i) => renderCell(ctx, row[i], col)));

  // Natural column widths (header vs. widest cell).
  const colWidths = cols.map((col, i) => {
    const headerW = visibleWidth(col.header);
    const cellW = grid.reduce((max, row) => Math.max(max, row[i]?.width ?? 0), 0);
    return Math.max(headerW, cellW);
  });

  const gutter = props.compact ? 1 : 2;
  const total = colWidths.reduce((a, b) => a + b, 0) + gutter * Math.max(0, cols.length - 1);

  if (total <= ctx.width || cols.length <= 1) {
    // Aligned table.
    const sep = " ".repeat(gutter);
    const header = cols
      .map((col, i) => {
        const w = colWidths[i] ?? 0;
        const text = ctx.theme.heading(col.header);
        return col.numeric || col.align === "right" ? padStart(text, w) : padEnd(text, w);
      })
      .join(sep);
    out.push(header);
    out.push(rule(ctx, Math.min(ctx.width, total)));
    for (const row of grid) {
      out.push(
        cols
          .map((_, i) => {
            const cell = row[i] ?? { display: ctx.theme.unknown("UNKNOWN"), width: 7, right: false };
            const w = colWidths[i] ?? 0;
            return cell.right ? padStart(cell.display, w) : padEnd(cell.display, w);
          })
          .join(sep),
      );
    }
    return out;
  }

  // Stacked fallback: one key-value block per row.
  const labelWidth = Math.max(0, ...cols.map((col) => visibleWidth(col.header)));
  props.rows.forEach((_, rowIdx) => {
    if (rowIdx > 0) out.push("");
    cols.forEach((col, i) => {
      const label = ctx.theme.label(padEnd(`${col.header}:`, labelWidth + 1));
      out.push(`${label} ${grid[rowIdx]?.[i]?.display ?? ctx.theme.unknown("UNKNOWN")}`);
    });
  });
  return out;
}
