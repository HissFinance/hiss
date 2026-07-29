/**
 * TEXT + DIVIDER (task §13 primitives): plain prose lines (optionally themed)
 * and a horizontal rule. Prose is width-wrapped.
 */

import type { OutputContext } from "../context.js";
import type { Style } from "../theme.js";
import { wrapText } from "../width.js";
import { rule } from "./shared.js";

export function renderText(
  ctx: OutputContext,
  props: { lines: string[]; token?: "muted" | "value" | "warning" | "error" | "info" },
): string[] {
  const styleMap: Record<string, Style> = {
    muted: ctx.theme.muted,
    value: ctx.theme.value,
    warning: ctx.theme.warning,
    error: ctx.theme.error,
    info: ctx.theme.info,
  };
  const style = props.token ? (styleMap[props.token] ?? ctx.theme.value) : ctx.theme.value;
  const out: string[] = [];
  for (const line of props.lines) {
    for (const wrapped of wrapText(line, ctx.width)) out.push(style(wrapped));
  }
  return out;
}

export function renderDivider(ctx: OutputContext): string[] {
  return [rule(ctx, ctx.width)];
}
