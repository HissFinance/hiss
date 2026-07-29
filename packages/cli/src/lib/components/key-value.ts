/**
 * KEY-VALUE GRID (task §13): aligned label/value pairs — the workhorse for
 * chain/block/observed/source/policy/owner/Treasury/fee readouts. Labels are
 * padded to a common column; long values wrap with a hanging indent; addresses
 * abbreviate in HUMAN (full value in --json/--verbose). Explicit UNKNOWN for
 * missing values.
 */

import type { OutputContext } from "../context.js";
import type { KVRow } from "../view.js";
import { formatValue } from "./shared.js";
import { visibleWidth, padEnd, wrapText } from "../width.js";

export function renderKeyValue(ctx: OutputContext, props: { rows: KVRow[]; title?: string }): string[] {
  const out: string[] = [];
  if (props.title) out.push(ctx.theme.heading(props.title));

  const rows = props.rows;
  const labelWidth = Math.min(
    Math.max(0, ...rows.map((r) => visibleWidth(r.label))),
    Math.max(8, Math.floor(ctx.width / 2)),
  );
  const gutter = 2;
  const valueWidth = Math.max(8, ctx.width - labelWidth - gutter - 1);

  for (const row of rows) {
    const label = ctx.theme.label(padEnd(`${row.label}:`, labelWidth + 1));
    const value = formatValue(ctx, row.value, { token: row.token, full: row.full });

    // Wrap only prose values (no ANSI, has spaces, over budget). Never wrap a
    // single opaque token (address/hash/number) — those stay on one line.
    const plain = typeof row.value === "string" ? row.value : String(row.value ?? "");
    if (visibleWidth(value) > valueWidth && /\s/.test(plain) && ctx.mode !== "plain") {
      const wrapped = wrapText(plain, valueWidth);
      out.push(`${label} ${wrapped[0] ?? ""}`);
      const indent = " ".repeat(labelWidth + 1 + gutter);
      for (const cont of wrapped.slice(1)) out.push(`${indent}${cont}`);
    } else {
      out.push(`${label} ${value}`);
    }
  }
  return out;
}
