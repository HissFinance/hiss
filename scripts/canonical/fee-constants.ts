/**
 * Canonical HISS fee-model constants — the single source of truth the
 * `check:fee-docs` guard validates published fee documentation against.
 *
 * These are PUBLIC, mechanical protocol parameters (basis points and integer
 * percentage legs). They contain no addresses, secrets, or private data.
 *
 * If the protocol parameters ever change, update this table AND the generated
 * docs in the same commit — the guard fails on any drift between them.
 */

export interface FeeSplit {
  /** xHISS stakers leg (integer percent). */
  stakersPct: number;
  /** Depositor-vesting leg (integer percent). */
  depositorVestingPct: number;
  /** Provider-rewards leg (integer percent). */
  providerRewardsPct: number;
  /** Treasury Safe leg — absorbs floor-division dust (integer percent). */
  treasuryPct: number;
}

export interface FeeConstants {
  /** Uniswap V4 pool swap fee, in basis points (0.7% = 70 bps). */
  swapFeeBps: number;
  /** Launch fee routing: creator vs. Doppler (integer percent). */
  creatorSharePct: number;
  dopplerSharePct: number;
  /** Verified HISS-token trading-fee split (fail-closed 50/30/10/10). */
  hissFeeSplit: FeeSplit;
  /** Claimed WETH routes 100% to the Treasury Safe — never split. */
  claimedWethTreasuryPct: number;
  /** Legacy provider-rewards-policy-v1: providers/treasury/weth. */
  providerRewardsPolicyV1: {
    providersPct: number;
    treasuryPct: number;
    wethPct: number;
  };
  /** Creator premint: excluded from all reward flows. */
  creatorPremintPct: number;
  premintVestYears: number;
  premintCliffDays: number;
}

export const FEE_CONSTANTS: FeeConstants = {
  swapFeeBps: 70,
  creatorSharePct: 95,
  dopplerSharePct: 5,
  hissFeeSplit: {
    stakersPct: 50,
    depositorVestingPct: 30,
    providerRewardsPct: 10,
    treasuryPct: 10,
  },
  claimedWethTreasuryPct: 100,
  providerRewardsPolicyV1: {
    providersPct: 30,
    treasuryPct: 70,
    wethPct: 0,
  },
  creatorPremintPct: 15,
  premintVestYears: 2,
  premintCliffDays: 30,
};

/** The canonical split rendered as the "a/b/c/d" token used in prose. */
export function splitToken(s: FeeSplit = FEE_CONSTANTS.hissFeeSplit): string {
  return `${s.stakersPct}/${s.depositorVestingPct}/${s.providerRewardsPct}/${s.treasuryPct}`;
}

/** Sanity invariant: the four legs sum to exactly 100. */
export function splitSumsTo100(s: FeeSplit = FEE_CONSTANTS.hissFeeSplit): boolean {
  return s.stakersPct + s.depositorVestingPct + s.providerRewardsPct + s.treasuryPct === 100;
}
