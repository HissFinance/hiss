/**
 * SECTION (task §13): a titled group of child blocks, indented one level. The
 * child renderer is injected to avoid a circular import with `render.ts`.
 */

import type { OutputContext } from "../context.js";
import type { ViewBlock } from "../view.js";

export function renderSection(
  ctx: OutputContext,
  props: { title: string; blocks: ViewBlock[] },
  renderChild: (block: ViewBlock) => string[],
): string[] {
  const out: string[] = [ctx.theme.heading(props.title)];
  const indent = "  ";
  for (const block of props.blocks) {
    for (const line of renderChild(block)) out.push(indent + line);
  }
  return out;
}
