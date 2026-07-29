/**
 * Value formatting helpers (OUTPUT_CONTRACT §1, §2, §11).
 *
 * - Address / hash abbreviation for HUMAN mode (full value always available
 *   via --verbose / --json).
 * - Canonical JSON serialization: bigint and chain-scale integers become
 *   STRINGS, keys are deterministically ordered, and `JSON.stringify` is never
 *   called directly on a payload that might contain a bigint (it throws).
 */

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX_HASH = /^0x[0-9a-fA-F]{48,}$/;

/** True if `s` looks like a 0x-prefixed EVM address. */
export function isAddress(s: string): boolean {
  return HEX_ADDRESS.test(s);
}

/** True if `s` looks like a long 0x-prefixed hash (tx / intent / evidence). */
export function isHash(s: string): boolean {
  return HEX_HASH.test(s);
}

/**
 * Abbreviate a 0x value as `0x1234…abcd` (4 head hex + 4 tail hex). Used in
 * HUMAN tables/labels only. NEVER inside a signed-payload transaction review,
 * where the full value is mandatory (§13). Non-hex input is returned as-is.
 */
export function abbreviate(value: string, ellipsis = "…"): string {
  if (!/^0x[0-9a-fA-F]{12,}$/.test(value)) return value;
  return `${value.slice(0, 6)}${ellipsis}${value.slice(-4)}`;
}

/** ISO timestamp for a Date, second precision, always UTC (deterministic). */
export function isoTimestamp(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Group the integer part of a decimal string with thousands separators, keeping
 * any fractional part and sign intact. Operates on strings so precision is
 * never lost. Non-numeric input is returned unchanged.
 */
export function groupDigits(value: string): string {
  const m = /^(-?)(\d+)(\.\d+)?$/.exec(value);
  if (!m) return value;
  const [, sign = "", int = "", frac = ""] = m;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${frac}`;
}

// ---- PLAIN-mode ASCII folding ------------------------------------------------

/**
 * Map of common Unicode punctuation/symbols → ASCII, used by {@link asciiFold}
 * to keep PLAIN mode strictly ASCII (OUTPUT_CONTRACT §1). Covers what authored
 * copy and the components emit (—, ≠, →, ·, …, quotes, math relations).
 */
const FOLD_MAP: Record<string, string> = {
  "—": "-", // — em dash
  "–": "-", // – en dash
  "‒": "-", // ‒ figure dash
  "‑": "-", // ‑ non-breaking hyphen
  "−": "-", // − minus sign
  "≠": "!=", // ≠
  "→": "->", // →
  "←": "<-", // ←
  "↑": "^", // ↑
  "↓": "v", // ↓
  "·": "-", // · middle dot
  "•": "-", // • bullet
  "●": "*", // ● black circle
  "◐": "~", // ◐ half circle
  "○": "o", // ○ white circle
  "■": "#", // ■ black square
  "…": "...", // … ellipsis
  "‘": "'", // ‘
  "’": "'", // ’
  "“": '"', // “
  "”": '"', // ”
  "≤": "<=", // ≤
  "≥": ">=", // ≥
  "≈": "~", // ≈
  "×": "x", // ×
  "÷": "/", // ÷
  "±": "+/-", // ±
  "™": "(TM)", // ™
  "®": "(R)", // ®
  "©": "(C)", // ©
  "€": "EUR", // €
  "£": "GBP", // £
  " ": " ", // non-breaking space
  " ": " ", // thin space
  " ": " ", // narrow no-break space
  "✓": "+", // ✓ check
  "✗": "x", // ✗ ballot x
  "▲": "!", // ▲ triangle
  ℹ: "i", // ℹ info
  "‖": "||", // ‖ double vertical bar
  "∥": "||", // ∥
};

const FOLD_RE = new RegExp(`[${Object.keys(FOLD_MAP).join("")}]`, "g");

/**
 * Degrade a string to strict ASCII for PLAIN mode: map known Unicode
 * punctuation/symbols to ASCII equivalents, then replace any residual
 * non-ASCII code point with `?` so PLAIN output never carries a stray UTF-8
 * byte. HUMAN mode never calls this (it keeps Unicode with glyph fallbacks);
 * JSON is unaffected.
 */
export function asciiFold(input: string): string {
  const mapped = input.replace(FOLD_RE, (ch) => FOLD_MAP[ch] ?? ch);
  // Strip any remaining non-ASCII (keep tab/newline; drop control chars).
  // eslint-disable-next-line no-control-regex
  return mapped.replace(/[^\t\n\x20-\x7E]/g, "?");
}

// ---- canonical JSON ----------------------------------------------------------

/**
 * Deep-convert a value into a JSON-safe form: bigint → decimal string, keys
 * sorted recursively (stable diffs / golden snapshots), and any value with a
 * `toJSON` honored. Dates become ISO strings. Undefined object members are
 * dropped. Never throws on bigint.
 */
export function toCanonicalJson(value: unknown): unknown {
  return normalize(value);
}

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value === null || value === undefined) return value ?? null;
  if (typeof value !== "object") {
    // number/string/boolean; guard non-finite numbers to null (invalid JSON).
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    return value;
  }
  if (value instanceof Date) return isoTimestamp(value);
  if (Array.isArray(value)) return value.map(normalize);
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src).sort()) {
    const v = normalize(src[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/**
 * Serialize a payload to canonical JSON text (bigint-as-string, sorted keys).
 * `indent` defaults to 2 spaces for human-legible `--json`; pass 0 for compact.
 */
export function serializeJson(value: unknown, indent = 2): string {
  return JSON.stringify(normalize(value), null, indent);
}
