/**
 * PANEL (task §13): a bordered callout for warnings, fuse failures, reviews,
 * receipts, and evidence. Left-bar + top/bottom rules; width-aware (content
 * wraps to the inner width so borders never break). Variant sets the accent —
 * color is reinforced by the title word, so meaning survives no-color.
 */

import type { OutputContext } from "../context.js";
import type { PanelVariant } from "../view.js";
import type { Style } from "../theme.js";
import { wrapText, visibleWidth, padEnd } from "../width.js";

function accentFor(ctx: OutputContext, variant: PanelVariant): Style {
  switch (variant) {
    case "warning":
      return ctx.theme.warning;
    case "error":
      return ctx.theme.error;
    case "success":
      return ctx.theme.success;
    case "evidence":
      return ctx.theme.muted;
    case "review":
      return ctx.theme.heading;
    case "info":
    default:
      return ctx.theme.info;
  }
}

export function renderPanel(
  ctx: OutputContext,
  props: { variant: PanelVariant; title?: string; lines: string[] },
): string[] {
  const accent = accentFor(ctx, props.variant);
  const box = Math.min(ctx.width, 100);
  const h = ctx.symbols("hLine");
  const v = ctx.symbols("vLine");
  const innerWidth = Math.max(4, box - 2);

  const out: string[] = [];

  // Top rule (with optional title).
  const tl = ctx.symbols("topLeft");
  if (props.title) {
    const titleText = ` ${props.title} `;
    const fillLen = Math.max(0, box - 1 - visibleWidth(titleText) - 1);
    out.push(accent(`${tl}${h}${titleText}${h.repeat(fillLen)}`));
  } else {
    out.push(accent(`${tl}${h.repeat(Math.max(0, box - 1))}`));
  }

  // Body lines.
  for (const raw of props.lines) {
    const wrapped = wrapText(raw, innerWidth);
    for (const line of wrapped.length ? wrapped : [""]) {
      out.push(`${accent(v)} ${padEnd(line, innerWidth)}`);
    }
  }

  // Bottom rule.
  const bl = ctx.symbols("bottomLeft");
  out.push(accent(`${bl}${h.repeat(Math.max(0, box - 1))}`));
  return out;
}
