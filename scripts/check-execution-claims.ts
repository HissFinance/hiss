/**
 * check:execution-claims — enforces HISS's core honesty invariant in docs,
 * skill packs, and tool descriptions.
 *
 * HISS is compilation/verification software: it NEVER takes custody and never
 * asserts a brokerage/on-chain action succeeded without a receipt. So any
 * sentence that claims HISS itself deposited / staked / withdrew / claimed /
 * traded / deployed / executed a transaction MUST carry an adjacent
 * receipt-verification qualifier (an on-chain receipt, a confirmed tx hash,
 * a "verified"/"confirmed" chain read, or an explicit "unconfirmed" hedge).
 *
 * Bare execution claims fail. Docs that exist to EXPLAIN this guard are
 * allowlisted via a marker so they can quote the forbidden phrasing.
 *
 * Exit 1 on any unqualified claim.
 */
import { listFiles, readLines, rel, REPO_ROOT } from "./lib/walk.ts";

// NOTE: Bankr is deliberately NOT a subject here. Bankr is the real external
// executor — "Bankr executes ... trades on robinhood" is the canonical honest
// phrasing. This guard targets HISS (and its own surfaces) falsely asserting
// that IT executed a transaction without a receipt qualifier.
const SUBJECT = "(?:HISS|the vault|the agent|the bot|CoilOps)";
const VERB =
  "(?:deposit(?:s|ed)?|stak(?:e|es|ed)|withdr(?:aw|aws|ew|awn)|claim(?:s|ed)?|trad(?:e|es|ed)|deploy(?:s|ed)?|execut(?:e|es|ed)|swap(?:s|ped)?|redeem(?:s|ed)?|sen[dt]s?)";
const CLAIM_RE = new RegExp(
  `\\b${SUBJECT}\\s+(?:successfully\\s+|already\\s+|has\\s+|have\\s+|had\\s+)?${VERB}\\b`,
  "i",
);

/**
 * A qualifier anywhere in the claim's paragraph window neutralizes it: an
 * on-chain receipt, a confirmed tx hash, an explicit "unconfirmed" hedge, an
 * honest "HISS does/sends nothing / hard-typed false" boundary statement, or a
 * negation/hypothetical framing of the verb itself.
 */
const VERIFY_RE =
  /\b(receipt|reconcil\w*\s+receipt|on-?chain(?:ally)?\s+(?:confirm|verif)|onchain_confirmed|chain-?confirm|tx\s*hash|transaction\s+hash|confirmed\s+on\s+chain|verified\s+on\s+chain|only\s+.*\breceipt|unconfirmed|job_completed_unconfirmed|not\s+settled|never\s+(?:executes|places|sends|takes\s+custody)|does\s+not\s+(?:execute|place|take\s+custody)|hard-?typed\s+`?false|liveordersent|hissexecutes\w*|compile-?only|verification\s+software)\b/i;

/**
 * Negated / hypothetical framing ON THE CLAIM LINE means it is not an
 * affirmative execution claim at all (e.g. "would imply HISS executed",
 * "HISS sends nothing", "still not execution", "cannot place orders").
 */
const NEGATION_RE =
  /\b(not|never|no|nothing|none|cannot|can't|won't|would|wouldn't|doesn't|does\s+not|don't|isn't|imply|implies|implied|blocked|refus\w*|reject\w*|false)\b/i;

/** Marker a doc can carry to opt out (it explains the guard itself). */
const ALLOW_MARKER = /execution-claims?-guard:\s*allow/i;

const EXTS = new Set([".md", ".mdx", ".markdown", ".txt", ".json"]);

function main(): void {
  const files = listFiles(REPO_ROOT, { textOnly: true }).filter((f) => {
    const lower = f.toLowerCase();
    return [...EXTS].some((e) => lower.endsWith(e));
  });

  const violations: { file: string; line: number; text: string }[] = [];

  for (const file of files) {
    const r = rel(file);
    // The guard's own source and its explainer docs quote the phrasing.
    if (r === "scripts/check-execution-claims.ts") continue;

    const lines = readLines(file);
    const whole = lines.join("\n");
    if (ALLOW_MARKER.test(whole)) continue;

    for (let i = 0; i < lines.length; i++) {
      if (!CLAIM_RE.test(lines[i])) continue;
      // Negated / hypothetical framing on the claim line is not an assertion.
      if (NEGATION_RE.test(lines[i])) continue;
      // A verification qualifier may sit anywhere in the surrounding paragraph.
      const windowText = lines.slice(Math.max(0, i - 3), i + 4).join(" ");
      if (!VERIFY_RE.test(windowText)) {
        violations.push({ file: r, line: i + 1, text: lines[i].trim().slice(0, 160) });
      }
    }
  }

  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  unqualified execution claim\n    > ${v.text}`);
  }
  console.log(`EXECUTION_CLAIM_VIOLATIONS=${violations.length}`);
  if (violations.length > 0) {
    console.error(
      `\ncheck:execution-claims FAILED — ${violations.length} claim(s) lack an adjacent receipt/verification qualifier.`,
    );
    process.exit(1);
  }
  console.log("check:execution-claims OK — all execution claims are receipt-qualified.");
}

main();
