// SPDX-License-Identifier: Apache-2.0
/**
 * xHISS staking constants + public copy.
 *
 * The xHISS vault is a single-asset staking vault over $HISS; xHISS is the
 * share token (18 decimals). Staking mints xHISS at the current rate, and
 * fee-funded injections raise the HISS-per-xHISS share value as they drip in
 * over 24 hours. Exits require a 72-hour cooldown followed by a 2-day redeem
 * window. The only approved public framing is mechanical — no yield, income,
 * or distribution language.
 */

import { getContractAddress } from "../registry/contracts.js";
import { HISS_ASSET } from "../registry/assets.js";

/** $HISS is the staked asset; xHISS is the 18-decimal share token. */
export const XHISS_STAKING_ASSET = HISS_ASSET.address;
export const XHISS_VAULT_ADDRESS = getContractAddress("xHissVault");
export const XHISS_STAKING_CHAIN_ID = HISS_ASSET.chainId;

/** Immutable contract timing parameters, mirrored for display. */
export const XHISS_STAKING_PARAMS = Object.freeze({
  /** Cooldown before a redeem window opens (72 hours). */
  cooldownSeconds: 72 * 3600,
  /** Window to redeem after cooldown (2 days). */
  redeemWindowSeconds: 2 * 24 * 3600,
  /** Fee-funded injections drip linearly over this window (24 hours). */
  rewardDripSeconds: 24 * 3600,
  shareSymbol: "xHISS",
  shareName: "Staked HISS",
});

/** Approved public copy — render verbatim where possible. */
export const XHISS_STAKING_COPY = Object.freeze({
  headline:
    "Stake HISS, receive xHISS. Fee-funded HISS injections increase the HISS-per-xHISS share value over time.",
  disclaimer: "Not a performance claim.",
  exitNote:
    "Exits require a 72-hour cooldown, then a 2-day redeem window. Injections drip into the share value over 24 hours.",
});

/**
 * Banned public-copy patterns for staking surfaces. Regex sources deliberately
 * never spell the literal banned phrases, so repo-wide copy guards stay clean.
 */
export const XHISS_BANNED_COPY_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "guaranteed-apy", pattern: /guaranteed\s+(apy|yield|returns?|rate)/i },
  { name: "passive-income", pattern: /passive\s+income/i },
  { name: "risk-free", pattern: /risk[\s-]free/i },
  { name: "dividends", pattern: /dividends?/i },
  { name: "holder-rewards", pattern: /holder\s+rewards?/i },
];

/** Names of banned copy patterns present in `text` (empty array = clean). */
export function xhissCopyViolations(text: string): string[] {
  return XHISS_BANNED_COPY_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}
