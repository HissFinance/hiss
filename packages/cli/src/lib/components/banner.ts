/**
 * BANNER (task §13): the HISS wordmark + tagline. Rendered only in HUMAN mode
 * and only when a command explicitly opts in — never by default, so scripts
 * and pipes stay clean. ASCII-safe; brand color when available.
 */

import type { OutputContext } from "../context.js";

export function renderBanner(ctx: OutputContext, props: { title: string; subtitle?: string }): string[] {
  if (ctx.mode !== "human") {
    // In PLAIN, degrade to a stable plain line (JSON never reaches here).
    return props.subtitle ? [`${props.title} — ${props.subtitle}`] : [props.title];
  }
  const lines = [ctx.theme.brandStrong(props.title)];
  if (props.subtitle) lines.push(ctx.theme.muted(props.subtitle));
  return lines;
}
