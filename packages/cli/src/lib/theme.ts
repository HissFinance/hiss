/**
 * Semantic theme (OUTPUT_CONTRACT §7, task §7). ONE source of color — no raw
 * color calls anywhere else. Tokens are meaning-bound, not decorative.
 *
 * Color is applied via picocolors for the standard 16-color palette and via
 * tiered raw escapes for the HISS brand accent (a terminal-safe approximation
 * of the Robinhood/HISS acid-green), with truecolor → 256 → basic → no-color
 * fallbacks. When color is disabled every token is the identity function, so
 * meaning is still carried by words + symbols.
 *
 * IMPORTANT: color reflects STATE VALIDITY, never performance. The renderer
 * must never color a number green/red to imply gain/loss (that would read as a
 * performance claim). `positive`/`negative` exist for non-financial diffs only;
 * the P&L component deliberately avoids them (see components/pnl.ts).
 */

import pc from "picocolors";
import type { ColorLevel } from "./capabilities.js";

// Force-enabled palette: picocolors must NOT auto-detect (dep review) —
// the renderer alone decides whether color is applied, via the `on` gate.
const c = pc.createColors(true);

const ESC = "\u001B";
const RESET = `${ESC}[0m`;

/** A styling function: wraps text, or returns it unchanged when disabled. */
export type Style = (s: string) => string;

/** Every semantic token the renderer may reference. */
export interface Theme {
  readonly color: boolean;
  readonly colorLevel: ColorLevel;

  // brand + structure
  brand: Style;
  brandStrong: Style;
  heading: Style;
  subheading: Style;
  label: Style;
  value: Style;
  muted: Style;
  link: Style;
  address: Style;
  hash: Style;
  timestamp: Style;
  divider: Style;

  // verdict / severity
  success: Style;
  warning: Style;
  error: Style;
  info: Style;
  unknown: Style;
  disabled: Style;

  // lifecycle states
  live: Style;
  active: Style;
  ready: Style;
  prepared: Style;
  submitted: Style;
  confirmed: Style;
  reconciled: Style;
  degraded: Style;
  blocked: Style;
  paused: Style;
  stopped: Style;
  paper: Style;
  demo: Style;

  // deltas (NON-financial only)
  positive: Style;
  negative: Style;
  neutral: Style;

  // domain accents
  chain: Style;
  brokerage: Style;
  mcp: Style;
  coil: Style;
  fuse: Style;
  receipt: Style;
  vault: Style;
  liquidity: Style;
  staking: Style;
}

const identity: Style = (s) => s;

/** Wrap with an explicit SGR open code (raw escape, tier-specific brand). */
function sgr(openCode: string): Style {
  const open = `${ESC}[${openCode}m`;
  return (s) => open + s + RESET;
}

/** Acid-green brand accent, resolved to the best tier available. */
function brandStyle(level: ColorLevel): Style {
  if (level >= 3) return sgr("38;2;166;255;0"); // truecolor acid-green
  if (level === 2) return sgr("38;5;154"); // 256-color bright green-yellow
  return c.green; // basic
}

/** Build the theme for the resolved color capability. */
export function makeTheme(opts: { color: boolean; colorLevel: ColorLevel }): Theme {
  const on = opts.color;
  const level = opts.colorLevel;

  // Disabled → every token is identity (meaning carried by words + symbols).
  const s = (fn: Style): Style => (on ? fn : identity);
  const bold = (fn: Style): Style => (on ? (t) => c.bold(fn(t)) : identity);
  const brand = s(brandStyle(level));

  return {
    color: on,
    colorLevel: level,

    brand,
    brandStrong: on ? (t) => c.bold(brandStyle(level)(t)) : identity,
    heading: bold(c.cyan),
    subheading: s(c.cyan),
    label: s(c.dim),
    value: identity, // values are never colored by default
    muted: s(c.dim),
    link: s((t) => c.underline(c.blue(t))),
    address: s(c.gray),
    hash: s(c.gray),
    timestamp: s(c.dim),
    divider: s(c.dim),

    success: s(c.green),
    warning: s(c.yellow),
    error: s(c.red),
    info: s(c.blue),
    unknown: s(c.dim),
    disabled: s(c.dim),

    live: s(c.green),
    active: s(c.green),
    ready: s(c.cyan),
    prepared: s(c.cyan),
    submitted: s(c.cyan),
    confirmed: s(c.green),
    reconciled: s(c.green),
    degraded: s(c.yellow),
    blocked: s(c.red),
    paused: s(c.yellow),
    stopped: s(c.red),
    paper: s(c.magenta),
    demo: s(c.magenta),

    positive: s(c.green),
    negative: s(c.red),
    neutral: identity,

    chain: s(c.blue),
    brokerage: s(c.magenta),
    mcp: s(c.cyan),
    coil: s(c.cyan),
    fuse: s(c.yellow),
    receipt: s(c.green),
    vault: brand,
    liquidity: s(c.blue),
    staking: s(c.magenta),
  };
}
