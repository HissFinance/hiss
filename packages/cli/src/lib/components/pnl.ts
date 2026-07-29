/**
 * P&L BREAKDOWN (task §13): realized fees / uncollected fees / inventory P&L /
 * gas / execution costs / HISS management fee / net strategy P&L.
 *
 * Two hard rules:
 *  1. Gross fees must NEVER visually dominate net P&L — component lines are
 *     muted, the NET line is emphasized (heading weight) and separated by a
 *     rule, so the eye lands on net.
 *  2. Signs are always shown and never hidden; amounts are NOT colored by sign
 *     (green gain / red loss would read as a performance claim — banned §7).
 */

import type { OutputContext } from "../context.js";
import type { PnlLine } from "../view.js";
import { groupDigits } from "../format.js";
import { visibleWidth, padEnd, padStart } from "../width.js";
import { rule } from "./shared.js";

function amountText(line: PnlLine): string {
  const grouped = groupDigits(line.amount);
  // Preserve an explicit leading sign for non-negative amounts too? Keep the
  // author's sign as-is; never strip a minus. Append unit if provided.
  return line.unit ? `${grouped} ${line.unit}` : grouped;
}

export function renderPnl(ctx: OutputContext, props: { lines: PnlLine[]; title?: string }): string[] {
  const out: string[] = [];
  if (props.title) out.push(ctx.theme.heading(props.title));

  const labelWidth = Math.max(0, ...props.lines.map((l) => visibleWidth(l.label)));
  const amountWidth = Math.max(0, ...props.lines.map((l) => visibleWidth(amountText(l))));

  for (const line of props.lines) {
    const amount = amountText(line);
    if (line.net) {
      out.push(rule(ctx, Math.min(ctx.width, labelWidth + 2 + amountWidth)));
      const label = ctx.theme.heading(padEnd(line.label, labelWidth));
      const value = ctx.theme.brandStrong(padStart(amount, amountWidth));
      out.push(`${label}  ${value}`);
    } else {
      const label = ctx.theme.muted(padEnd(line.label, labelWidth));
      const value = ctx.theme.value(padStart(amount, amountWidth));
      out.push(`${label}  ${value}`);
    }
  }
  return out;
}
