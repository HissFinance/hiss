/**
 * Defense-in-depth redaction (OUTPUT_CONTRACT §8, task §22).
 *
 * ONE redaction pass, applied to every human/plain string BEFORE it is
 * rendered. Inputs are already guarded by `assertNoCredentials`; this is a
 * second layer so a secret that somehow reaches an output string never leaves
 * the process.
 *
 * DESIGN (post-review):
 *  - Keys on secret-shaped VALUES and unambiguous credential-NAMES, never on a
 *    generic display label. In particular the bare word "token" is NOT a
 *    trigger, so the key-value label `Token:` leaves the PUBLIC token symbol
 *    (`HISS`) intact. Only compound secret names (`access-token`,
 *    `x-robinhood-token`, a vendor `*_API_KEY` env var, …) redact.
 *  - COLOR-INDEPENDENT: matching is performed on the ANSI-stripped text, so a
 *    styled string and its plain twin always redact identically. When a secret
 *    is present the redacted plain text is returned (color is intentionally
 *    dropped for that line — safety over aesthetics); otherwise the original
 *    (possibly styled) string is returned untouched.
 *  - Public on-chain identifiers — addresses (40 hex), tx hashes (64 hex),
 *    receipt IDs, pool/Safe addresses, token symbols — are ALWAYS preserved
 *    verbatim: no rule keys on bare hex or on a display label.
 *  - RPC-URL userinfo (`scheme://user:pass@host`) is redacted, because
 *    `--verbose` may print the RPC URL to stderr.
 */

import { stripAnsi } from "./width.js";

const PLACEHOLDER = "[redacted]";

// Unambiguous secret NAME cores (case-insensitive). Notably absent: the bare
// word "token" — only compound token names redact. A leading `[A-Za-z0-9_-]*`
// absorbs env-var prefixes (e.g. a vendor prefix in a `*_API_KEY` name).
const SECRET_NAME =
  "[A-Za-z0-9_-]*(?:api[_-]?key|secret|passw(?:ord|d)|mnemonic|seed(?:[_-]?phrase)?|private[_-]?key|(?:access|auth|refresh|session|id|csrf|api|bearer|robinhood)[_-]?token|x-[a-z0-9-]*-token)[A-Za-z0-9_-]*";

interface Rule {
  readonly re: RegExp;
  readonly replace: (m: string, ...groups: string[]) => string;
}

const RULES: Rule[] = [
  // PEM private-key / certificate blocks.
  {
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replace: () => PLACEHOLDER,
  },
  // URL userinfo: scheme://user:pass@host → scheme://[redacted]@host. Keeps the
  // host so a diagnostic is still useful; the embedded credential is masked.
  {
    re: /([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/\s@]+@/g,
    replace: (_m, scheme: string) => `${scheme}${PLACEHOLDER}@`,
  },
  // Authorization / Bearer headers.
  {
    re: /\b(Authorization\s*[:=]\s*)(?:Bearer\s+)?\S+/gi,
    replace: (_m, p1: string) => `${p1}${PLACEHOLDER}`,
  },
  {
    re: /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/g,
    replace: () => `Bearer ${PLACEHOLDER}`,
  },
  // Cookie / Set-Cookie header values.
  {
    re: /\b(Set-Cookie|Cookie)\s*[:=]\s*[^\s;]+/gi,
    replace: (_m, p1: string) => `${p1}: ${PLACEHOLDER}`,
  },
  // Common opaque API-key token shapes (Stripe-style / generic sk-/pk-/rk-/ak-).
  {
    re: /\b(?:sk|pk|rk|ak)_(?:live|test|prod)?_?[A-Za-z0-9]{12,}/g,
    replace: () => PLACEHOLDER,
  },
  // Credential-NAMED assignments: <secret-name>[:=]<value>. Absorbs env-var
  // prefixes (a prefixed `*_API_KEY=…`) and compound token names
  // (x-robinhood-token: …); never triggers on a bare `Token:` display label.
  {
    re: new RegExp(`(${SECRET_NAME})(\\s*[:=]\\s*)("?)([^\\s"']+)\\3`, "gi"),
    replace: (_m, name: string, sep: string) => `${name}${sep}${PLACEHOLDER}`,
  },
  // Absolute home paths (private local paths) — hide the user segment.
  {
    re: /\/(?:Users|home)\/[^/\s:]+(?=\/|\b)/g,
    replace: () => PLACEHOLDER,
  },
];

function applyRules(input: string): string {
  let out = input;
  for (const rule of RULES) out = out.replace(rule.re, rule.replace as never);
  return out;
}

/**
 * Redact secret-shaped substrings. Matching is color-independent: it runs on
 * the ANSI-stripped text, so styled and plain strings redact identically.
 */
export function redact(input: string): string {
  const plain = stripAnsi(input);
  const redacted = applyRules(plain);
  // No secret in the visible text → return the original untouched (preserving
  // any ANSI styling). A secret was found → return the redacted plain text.
  return redacted === plain ? input : redacted;
}

/** The identity redactor — for tests that need a pass-through. */
export const noRedact = (s: string): string => s;
