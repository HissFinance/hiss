/**
 * check:secrets — scans tracked text files for secret-SHAPED tokens.
 *
 * This is the value-level companion to check:private-boundary (which catches
 * secret ENV *names*). Here we catch anything that looks like a live
 * credential: provider tokens, cloud keys, raw private keys, JWTs, and
 * non-placeholder secret assignments.
 *
 * Detection patterns require enough trailing entropy that the pattern SOURCE
 * in this file cannot match itself, so the scanner can scan the whole repo
 * including itself.
 *
 * Exit 1 on any hit, printing file:line and the matched token id.
 */
import { listFiles, readLines, rel, REPO_ROOT } from "./lib/walk.ts";

interface SecretRule {
  id: string;
  test: RegExp;
}

/** High-signal provider/token shapes — flagged in ANY file. */
const RULES: SecretRule[] = [
  { id: "github-pat", test: /\bghp_[A-Za-z0-9]{36}\b/ },
  { id: "github-fine-grained-pat", test: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { id: "openai-or-stripe-key", test: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { id: "aws-access-key-id", test: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "google-api-key", test: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "slack-token", test: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: "jwt", test: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b/ },
];

/**
 * A raw 32-byte hex value (0x + 64 hex) is shape-identical to a private key AND
 * to every keccak/tx/bytecode/block hash and storage slot in a web3 repo, so we
 * only flag it when the surrounding context actually smells like a signing key.
 */
const RAW_KEY_RE = /\b0x[0-9a-fA-F]{64}\b/;
const PRIVKEY_CONTEXT_RE =
  /(priv(?:ate)?[_-]?key|secret[_-]?key|signing[_-]?key|signer|mnemonic|seed[_-]?phrase|\bpk\b|wallet[_-]?key|deployer[_-]?key)/i;

/**
 * Secret-shaped assignment: KEY = "value" where KEY smells sensitive and the
 * value is not an obvious placeholder or env-var reference.
 */
const ASSIGN_RE =
  /\b([A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|TOKEN|MNEMONIC))\b\s*[:=]\s*['"]?([^\s'"$#{}<>]{8,})['"]?/i;

const PLACEHOLDER_RE =
  /^(your|my|the|some|example|placeholder|changeme|change_me|xxx+|todo|redacted|dummy|test|fake|sample|env|process)\b|\.\.\.|^\*+$|^x+$/i;

/** Guard scripts define the pattern SOURCES; do not scan them for values. */
const SELF = new Set<string>(["scripts/check-secrets.ts"]);

/**
 * Real dotenv files must never be tracked. Documented templates
 * (.env.example / .sample / .template) ARE allowed — they hold placeholders.
 */
const DOTENV_RE = /(^|\/)\.env(\.[A-Za-z0-9_.-]+)?$/;
const DOTENV_TEMPLATE_RE = /\.(example|sample|template|dist)$/;

/** Env/config-style files where a `KEY=value` genuinely smells like a secret. */
const ENV_STYLE_RE = /(^|\/)\.env(\.[A-Za-z0-9_.-]+)?$|\.(ini|properties|cfg|conf|toml|env)$/;

function isEnvStyle(relPath: string): boolean {
  return ENV_STYLE_RE.test(relPath);
}

function main(): void {
  const files = listFiles(REPO_ROOT, { textOnly: true });
  const hits: { file: string; line: number; id: string; text: string }[] = [];

  for (const file of files) {
    const r = rel(file);

    if (DOTENV_RE.test(r) && !DOTENV_TEMPLATE_RE.test(r)) {
      hits.push({ file: r, line: 0, id: "tracked-dotenv-file", text: r });
    }

    if (SELF.has(r)) continue;

    const envStyle = isEnvStyle(r);
    const lines = readLines(file);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const rule of RULES) {
        if (rule.test.test(line)) {
          hits.push({ file: r, line: i + 1, id: rule.id, text: redact(line) });
        }
      }

      // 32-byte hex only counts as a key in a key-ish context or an env file.
      if (RAW_KEY_RE.test(line) && (envStyle || PRIVKEY_CONTEXT_RE.test(line))) {
        hits.push({ file: r, line: i + 1, id: "raw-private-key-hex", text: redact(line) });
      }

      // Generic KEY=value secret smell is only reliable in env/config files;
      // in source it fires on public addresses and ordinary identifiers.
      if (envStyle) {
        const m = ASSIGN_RE.exec(line);
        if (m && !PLACEHOLDER_RE.test(m[2])) {
          hits.push({ file: r, line: i + 1, id: "secret-assignment", text: redact(line) });
        }
      }
    }
  }

  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  [${h.id}]\n    > ${h.text}`);
  }
  console.log(`SECRET_SCAN_ACTIVE_HITS=${hits.length}`);
  if (hits.length > 0) {
    console.error(`\ncheck:secrets FAILED — ${hits.length} secret-shaped token(s) found.`);
    process.exit(1);
  }
  console.log("check:secrets OK — no secret-shaped tokens found.");
}

/** Never echo a full potential secret into CI logs. */
function redact(line: string): string {
  const t = line.trim();
  return t.length <= 24 ? t : `${t.slice(0, 12)}…${t.slice(-6)}`;
}

main();
