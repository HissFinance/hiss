/**
 * Execution-claim output guard.
 *
 * HISS Finance tooling reads state and prepares UNSIGNED transactions. It
 * never signs, submits, or broadcasts anything, so no output may ever claim
 * that an on-chain action completed. This guard is the last line of defence:
 * any human-facing string is checked before it leaves the process, and a
 * completion claim throws instead of shipping a falsehood.
 *
 * Honest negations are tolerated ("no order was sent", "nothing was
 * deposited", "prepared an unsigned deposit"). A claim is only tripped when a
 * completion verb appears in an affirmative clause AND is not backed by a
 * verified receipt.
 */

/** Past-tense / completion verbs that assert an on-chain action happened. */
const CLAIM_VERBS = [
  "deposited",
  "staked",
  "unstaked",
  "withdrew",
  "withdrawn",
  "claimed",
  "traded",
  "deployed",
  "executed",
  "submitted",
  "broadcast",
  "broadcasted",
  "filled",
  "settled",
  "redeemed",
  "minted",
  "transferred",
  "swapped",
] as const;

/** Words that negate or defuse a nearby completion verb. */
const NEGATORS = [
  "no",
  "not",
  "never",
  "without",
  "cannot",
  "can't",
  "won't",
  "will",
  "would",
  "wouldn't",
  "hasn't",
  "haven't",
  "hadn't",
  "didn't",
  "doesn't",
  "don't",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "nothing",
  "neither",
  "unsigned",
  "prepared",
  "prepare",
  "prepares",
  "planned",
  "candidate",
  "would-be",
  "to",
  "ready",
  "pending",
];

const NEGATOR_SET = new Set(NEGATORS);
const CLAIM_RE = new RegExp(`\\b(${CLAIM_VERBS.join("|")})\\b`, "gi");

/** How many preceding tokens to scan for a negator. */
const NEGATION_WINDOW = 6;

export class ExecutionClaimError extends Error {
  constructor(public readonly phrase: string) {
    super(
      `Output guard tripped: text asserts a completed on-chain action ("${phrase}"). ` +
        "HISS never signs or submits transactions, so no output may claim one succeeded.",
    );
    this.name = "ExecutionClaimError";
  }
}

/** Split into lowercase word tokens, preserving positions is not required. */
function tokensBefore(text: string, index: number): string[] {
  const prefix = text.slice(0, index).toLowerCase();
  const words = prefix.match(/[a-z']+/g) ?? [];
  return words.slice(-NEGATION_WINDOW);
}

/**
 * Returns the offending phrase if `text` reads like an unqualified execution
 * claim, otherwise `null`. When `receiptVerified` is true, completion verbs
 * are permitted because a verified on-chain receipt backs them.
 */
export function findExecutionClaim(text: string, opts: { receiptVerified?: boolean } = {}): string | null {
  if (opts.receiptVerified) return null;
  CLAIM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLAIM_RE.exec(text)) !== null) {
    const preceding = tokensBefore(text, match.index);
    const defused = preceding.some((tok) => NEGATOR_SET.has(tok));
    if (!defused) {
      return match[0];
    }
  }
  return null;
}

/**
 * Throws {@link ExecutionClaimError} if `text` claims a completed on-chain
 * action without a verified receipt.
 */
export function assertNoExecutionClaim(text: string, opts: { receiptVerified?: boolean } = {}): void {
  const hit = findExecutionClaim(text, opts);
  if (hit) throw new ExecutionClaimError(hit);
}
