/**
 * STATUS BADGE (task §13): symbol + label + color. Color is never the sole
 * signal — the glyph and the word carry the state on their own.
 */

import type { OutputContext } from "../context.js";
import type { StateToken } from "../view.js";
import { stateVisual } from "./shared.js";

export function renderStatus(
  ctx: OutputContext,
  props: { state: StateToken; label: string; note?: string },
): string[] {
  const v = stateVisual(ctx.theme, props.state);
  const glyph = ctx.symbols(v.glyph);
  const head = v.style(`${glyph} ${props.label}`);
  const line = props.note ? `${head} ${ctx.theme.muted(`${ctx.symbols("bullet")} ${props.note}`)}` : head;
  return [line];
}
