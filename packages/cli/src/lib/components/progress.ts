/**
 * PROGRESS (static, task §14): a determinate bar rendered from REAL progress
 * data (a ratio in [0,1]). Never a fake percentage. This is a snapshot view
 * block — the live, animated variant is the spinner (see spinner.ts) and is
 * stderr-only. ASCII-safe fill so it survives no-Unicode terminals.
 */

import type { OutputContext } from "../context.js";

export function renderProgress(ctx: OutputContext, props: { label: string; ratio: number }): string[] {
  const ratio = Math.max(0, Math.min(1, props.ratio));
  const barWidth = Math.max(6, Math.min(24, ctx.width - 20));
  const filled = Math.round(ratio * barWidth);
  const fillCh = ctx.unicode ? "█" : "#";
  const emptyCh = ctx.unicode ? "░" : "-";
  const bar = fillCh.repeat(filled) + emptyCh.repeat(barWidth - filled);
  const pct = `${Math.round(ratio * 100)}%`;
  return [`${ctx.theme.label(props.label)} ${ctx.theme.brand(bar)} ${ctx.theme.value(pct)}`];
}
