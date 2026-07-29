/**
 * Symbol set with mandatory ASCII fallbacks (OUTPUT_CONTRACT §7, §13).
 *
 * Color is NEVER the sole signal: every state also carries a symbol and a
 * word. When the terminal does not support Unicode, the ASCII form is used so
 * the same meaning survives on a dumb terminal, in PLAIN mode, and in logs.
 */

export interface Glyph {
  /** Preferred Unicode glyph. */
  readonly unicode: string;
  /** Guaranteed-safe ASCII fallback. */
  readonly ascii: string;
}

function g(unicode: string, ascii: string): Glyph {
  return { unicode, ascii };
}

/** The full glyph table. Keys are semantic, not visual. */
export const GLYPHS = {
  // state markers
  live: g("●", "*"), //     LIVE / active / on-chain present
  degraded: g("◐", "~"), // DEGRADED / last-verified
  prepared: g("○", "o"), // PREPARED / ready / unsigned
  blocked: g("■", "#"), //  BLOCKED / stopped / refused
  paused: g("Ⅱ", "||"), //  PAUSED
  unknown: g("?", "?"), //  UNKNOWN

  // verdicts
  ok: g("✓", "+"), //       VALID / VERIFIED / success
  warn: g("▲", "!"), //     warning / caution
  err: g("✗", "x"), //      INVALID / FAILED / error
  info: g("ℹ", "i"), //     info

  // decorative-but-meaningful
  bullet: g("•", "-"),
  arrow: g("→", "->"),
  ellipsis: g("…", "..."),

  // box drawing (light)
  hLine: g("─", "-"),
  vLine: g("│", "|"),
  topLeft: g("┌", "+"),
  topRight: g("┐", "+"),
  bottomLeft: g("└", "+"),
  bottomRight: g("┘", "+"),
  teeRight: g("├", "+"),
  teeLeft: g("┤", "+"),
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** A resolver bound to the terminal's Unicode capability. */
export interface SymbolSet {
  (name: GlyphName): string;
  readonly unicode: boolean;
}

/** Build a symbol resolver for the given Unicode capability. */
export function makeSymbols(unicode: boolean): SymbolSet {
  const resolve = ((name: GlyphName): string => {
    const glyph = GLYPHS[name];
    return unicode ? glyph.unicode : glyph.ascii;
  }) as { (name: GlyphName): string; unicode: boolean };
  resolve.unicode = unicode;
  return resolve as SymbolSet;
}
