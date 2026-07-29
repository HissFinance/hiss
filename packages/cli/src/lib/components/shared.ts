/**
 * Internal helpers shared by the rich components. Not a public component —
 * value/cell formatting, token→style lookup, and box-drawing rules used by the
 * component set.
 */

import type { OutputContext } from "../context.js";
import type { Theme, Style } from "../theme.js";
import type { StateToken } from "../view.js";
import type { GlyphName } from "../symbols.js";
import { abbreviate, groupDigits, isAddress, isHash } from "../format.js";

export type ValueToken = StateToken | "address" | "hash" | "muted" | "value";

/** Resolve a semantic token name to its theme style. */
export function tokenStyle(theme: Theme, token: ValueToken | undefined): Style {
  if (!token) return theme.value;
  const map: Record<string, Style> = {
    address: theme.address,
    hash: theme.hash,
    muted: theme.muted,
    value: theme.value,
    live: theme.live,
    active: theme.active,
    ready: theme.ready,
    prepared: theme.prepared,
    submitted: theme.submitted,
    confirmed: theme.confirmed,
    reconciled: theme.reconciled,
    degraded: theme.degraded,
    blocked: theme.blocked,
    paused: theme.paused,
    stopped: theme.stopped,
    paper: theme.paper,
    demo: theme.demo,
    success: theme.success,
    warning: theme.warning,
    error: theme.error,
    info: theme.info,
    unknown: theme.unknown,
  };
  return map[token] ?? theme.value;
}

/**
 * Format a value for display: explicit UNKNOWN for null/undefined, address/hash
 * abbreviation in HUMAN mode (unless `full`), thousands-grouping for plain
 * integers, then the token style. Returns the styled string.
 */
export function formatValue(
  ctx: OutputContext,
  value: string | number | null | undefined,
  opts: { token?: ValueToken; full?: boolean } = {},
): string {
  if (value === null || value === undefined || value === "") {
    return ctx.theme.unknown("UNKNOWN");
  }
  let text = typeof value === "number" ? String(value) : value;

  // 0x abbreviation only in HUMAN and only when not explicitly full.
  const isHex = isAddress(text) || isHash(text);
  if (isHex && !opts.full && ctx.mode === "human") {
    text = abbreviate(text, ctx.symbols("ellipsis"));
  }

  let token = opts.token;
  if (!token && isHex) token = isAddress(value as string) ? "address" : "hash";
  return tokenStyle(ctx.theme, token)(text);
}

/** Group a numeric string for right-aligned financial cells. */
export function formatNumeric(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "UNKNOWN";
  return groupDigits(typeof value === "number" ? String(value) : value);
}

/** Horizontal rule of `width` columns using the theme divider + symbol. */
export function rule(ctx: OutputContext, width: number): string {
  const line = ctx.symbols("hLine").repeat(Math.max(1, width));
  return ctx.theme.divider(line);
}

/** Map a state token to its glyph + style so color is never the sole signal. */
export function stateVisual(
  theme: Theme,
  state: StateToken,
): { glyph: GlyphName; style: Style; word: string } {
  const table: Record<StateToken, { glyph: GlyphName; style: Style; word: string }> = {
    live: { glyph: "live", style: theme.live, word: "LIVE" },
    active: { glyph: "live", style: theme.active, word: "ACTIVE" },
    ready: { glyph: "prepared", style: theme.ready, word: "READY" },
    prepared: { glyph: "prepared", style: theme.prepared, word: "PREPARED" },
    submitted: { glyph: "prepared", style: theme.submitted, word: "SUBMITTED" },
    confirmed: { glyph: "ok", style: theme.confirmed, word: "CONFIRMED" },
    reconciled: { glyph: "ok", style: theme.reconciled, word: "RECONCILED" },
    degraded: { glyph: "degraded", style: theme.degraded, word: "DEGRADED" },
    blocked: { glyph: "blocked", style: theme.blocked, word: "BLOCKED" },
    paused: { glyph: "paused", style: theme.paused, word: "PAUSED" },
    stopped: { glyph: "blocked", style: theme.stopped, word: "STOPPED" },
    paper: { glyph: "prepared", style: theme.paper, word: "PAPER" },
    demo: { glyph: "prepared", style: theme.demo, word: "DEMO" },
    success: { glyph: "ok", style: theme.success, word: "OK" },
    warning: { glyph: "warn", style: theme.warning, word: "WARNING" },
    error: { glyph: "err", style: theme.error, word: "ERROR" },
    info: { glyph: "info", style: theme.info, word: "INFO" },
    unknown: { glyph: "unknown", style: theme.unknown, word: "UNKNOWN" },
  };
  return table[state];
}
