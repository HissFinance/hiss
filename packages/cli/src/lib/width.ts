/**
 * Visible-width primitives for width-aware rendering (OUTPUT_CONTRACT §10).
 *
 * All measurement is done on the VISIBLE glyphs — ANSI escape sequences are
 * stripped before counting, and East-Asian wide code points count as 2
 * columns. Dependency-free (see `docs/cli/DEPENDENCY_REVIEW.md`): the ANSI
 * regex and wide-range table are vendored rather than pulling `strip-ansi` /
 * `string-width`. Escalate to those libs only if real CJK/emoji column
 * content appears.
 */

// Vendored ANSI escape-sequence matcher (CSI + OSC forms, incl. OSC-8
// hyperlinks terminated by BEL or ST). Well-known pattern, written with
// unicode escapes so it survives copy/paste. See DEPENDENCY_REVIEW.md.
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN =
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))";
const ANSI_RE = new RegExp(ANSI_PATTERN, "g");

/** Remove every ANSI escape sequence from a string. */
export function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, "");
}

/** True for East-Asian wide / fullwidth code points (count as 2 columns). */
function isWide(cp: number): boolean {
  return (
    cp >= 0x1100 &&
    (cp <= 0x115f || // Hangul Jamo
      cp === 0x2329 ||
      cp === 0x232a ||
      (cp >= 0x2e80 && cp <= 0x303e) || // CJK Radicals … Kangxi
      (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana … CJK symbols
      (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Ext A
      (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
      (cp >= 0xa000 && cp <= 0xa4cf) || // Yi
      (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
      (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
      (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK Compatibility Forms
      (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth Forms
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1faff) || // emoji / symbols & pictographs
      (cp >= 0x20000 && cp <= 0x3fffd)) // CJK Ext B+
  );
}

/** Zero-width code points (combining marks, joiners) — count as 0 columns. */
function isZeroWidth(cp: number): boolean {
  return (
    cp === 0x200b || // zero-width space
    cp === 0x200d || // zero-width joiner
    cp === 0xfeff || // BOM
    (cp >= 0x0300 && cp <= 0x036f) || // combining diacritical marks
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x20d0 && cp <= 0x20ff)
  );
}

/** Column width contribution of a single code point. */
function cpWidth(cp: number): number {
  if (cp === 0 || isZeroWidth(cp)) return 0;
  return isWide(cp) ? 2 : 1;
}

/** Visible column width of a string (ANSI-stripped, wide-aware). */
export function visibleWidth(input: string): number {
  const clean = stripAnsi(input);
  let width = 0;
  for (const ch of clean) width += cpWidth(ch.codePointAt(0) ?? 0);
  return width;
}

/** Pad the visible content to `width` columns on the right (left-aligned). */
export function padEnd(input: string, width: number): string {
  const gap = width - visibleWidth(input);
  return gap > 0 ? input + " ".repeat(gap) : input;
}

/** Pad the visible content to `width` columns on the left (right-aligned). */
export function padStart(input: string, width: number): string {
  const gap = width - visibleWidth(input);
  return gap > 0 ? " ".repeat(gap) + input : input;
}

/** Take the first `width` visible columns verbatim (no ellipsis). */
function takeVisible(input: string, width: number): string {
  let out = "";
  let w = 0;
  for (const ch of input) {
    const cw = cpWidth(ch.codePointAt(0) ?? 0);
    if (w + cw > width) break;
    out += ch;
    w += cw;
  }
  return out;
}

/** Drop the first `width` visible columns, returning the remainder. */
function dropVisible(input: string, width: number): string {
  let w = 0;
  const chars = Array.from(input);
  let i = 0;
  for (; i < chars.length; i++) {
    const cw = cpWidth(chars[i]!.codePointAt(0) ?? 0);
    if (w + cw > width) break;
    w += cw;
  }
  return chars.slice(i).join("");
}

/**
 * Truncate to at most `max` visible columns, appending an ellipsis marker when
 * truncation actually occurs. Used for prose / labels — NEVER for a financial
 * number (callers must not truncate numeric values; see §10).
 */
export function truncateEnd(input: string, max: number, ellipsis = "…"): string {
  if (visibleWidth(input) <= max) return input;
  const budget = Math.max(0, max - visibleWidth(ellipsis));
  return takeVisible(input, budget) + ellipsis;
}

/**
 * Middle-truncate, keeping both ends (for addresses/hashes shown in a narrow
 * column). Preserves head+tail so the value is still recognizable. Never used
 * inside a signed-payload review, where full values are mandatory (§13).
 */
export function truncateMiddle(input: string, max: number, ellipsis = "…"): string {
  const w = visibleWidth(input);
  if (w <= max) return input;
  const keep = Math.max(0, max - visibleWidth(ellipsis));
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  const chars = Array.from(input);
  return (
    chars.slice(0, head).join("") + ellipsis + (tail > 0 ? chars.slice(chars.length - tail).join("") : "")
  );
}

/**
 * Wrap prose to `width` columns on word boundaries. A single word longer than
 * `width` is hard-broken. Returns the wrapped lines (no trailing newline).
 */
export function wrapText(input: string, width: number): string[] {
  if (width <= 0) return [input];
  const out: string[] = [];
  for (const rawLine of input.split("\n")) {
    const words = rawLine.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    const pushBrokenWord = (word: string): string => {
      let rest = word;
      while (visibleWidth(rest) > width) {
        out.push(takeVisible(rest, width));
        rest = dropVisible(rest, width);
      }
      return rest;
    };
    for (const word of words) {
      if (line === "") {
        line = visibleWidth(word) <= width ? word : pushBrokenWord(word);
      } else if (visibleWidth(line) + 1 + visibleWidth(word) <= width) {
        line += " " + word;
      } else {
        out.push(line);
        line = visibleWidth(word) <= width ? word : pushBrokenWord(word);
      }
    }
    if (line !== "") out.push(line);
  }
  return out;
}
