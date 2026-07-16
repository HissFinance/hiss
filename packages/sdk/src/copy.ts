/**
 * Verbatim acknowledgement and caution strings surfaced on action plans.
 *
 * These follow HISS copy rules: no guaranteed yield/APY, no passive-income or
 * holder-reward framing, and every action makes clear the caller's own wallet
 * or Safe signs — HISS prepares and verifies, it never signs, submits, or
 * takes custody.
 */

/** The caller signs; HISS never does. Surfaced on every action plan. */
export const SIGNING_NOTICE =
  "This is an unsigned plan for review. Your own wallet or Safe signs and submits it — HISS never signs, never submits, and never takes custody.";

/** Depositor risk framing (not a performance claim). */
export const DEPOSITOR_ACKS: readonly string[] = [
  "Depositors share profits and losses. Deposits are not FDIC insured.",
  "No guaranteed yield, APY, or returns. Not a performance claim.",
  "Target allocations are a strategy target, not a claim about current holdings — read holdings live on chain.",
  "Tokenized stocks are economic exposure, not direct share ownership, and may be region- or provider-restricted.",
];

/** Staking risk framing (verbatim required lines). */
export const STAKING_ACKS: readonly string[] = [
  "Not a performance claim.",
  "Historical fee distributions are not forecasts.",
  "No known unresolved Critical or High findings after internal launch review.",
];

/** Creator framing for vault creation. */
export const CREATOR_ACKS: readonly string[] = [
  "Creating a candidate never deploys a vault. Deployment is signed from the creator's own wallet via VaultFactory.",
  "No guaranteed yield, APY, or returns. Not a performance claim.",
];

/** Owner-gated action framing. */
export const OWNER_ACTION_ACKS: readonly string[] = [
  "This is an owner-gated action — it only succeeds when signed by the contract's owner (an EOA or the owning Safe).",
];
