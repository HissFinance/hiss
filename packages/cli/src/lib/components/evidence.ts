/**
 * EVIDENCE (task §13, §15): the provenance behind a read — source, block,
 * observed-at, hash, age. Rendered as a muted evidence panel so a claim can
 * always be traced to what backed it. Degraded/last-verified reads use this to
 * show freshness.
 */

import type { OutputContext } from "../context.js";
import type { EvidenceRef } from "../view.js";
import { renderPanel } from "./panel.js";
import { formatValue } from "./shared.js";

function refLines(ctx: OutputContext, ref: EvidenceRef): string[] {
  const parts: string[] = [];
  if (ref.source) parts.push(`source: ${ref.source}`);
  if (ref.block !== undefined && ref.block !== null) parts.push(`block: ${ref.block}`);
  if (ref.observedAt) parts.push(`observed: ${ref.observedAt}`);
  if (ref.age) parts.push(`age: ${ref.age}`);
  const head = parts.length ? ctx.theme.muted(parts.join(`  ${ctx.symbols("bullet")} `)) : "";
  const lines = head ? [head] : [];
  if (ref.hash) lines.push(ctx.theme.muted("hash: ") + formatValue(ctx, ref.hash, { token: "hash" }));
  if (ref.note) lines.push(ctx.theme.muted(ref.note));
  return lines;
}

export function renderEvidence(ctx: OutputContext, props: { refs: EvidenceRef[]; title?: string }): string[] {
  const lines: string[] = [];
  props.refs.forEach((ref, i) => {
    if (i > 0) lines.push("");
    lines.push(...refLines(ctx, ref));
  });
  return renderPanel(ctx, { variant: "evidence", title: props.title ?? "Evidence", lines });
}
