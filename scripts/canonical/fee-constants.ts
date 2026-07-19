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
  /** Vault-providers leg (integer percent). */
  vaultProvidersPct: number;
  /** Vault-contributors leg — the former depositor cohort (integer percent). */
  vaultContributorsPct: number;
  /** Treasury Safe leg — absorbs floor-division dust (integer percent). */
  treasuryPct: number;
  /** Economic-burn leg to the canonical dead address (integer percent). */
  burnPct: number;
}

export interface FeeConstants {
  /** Uniswap V4 pool swap fee, in basis points (0.7% = 70 bps). */
  swapFeeBps: number;
  /** Launch fee routing: creator vs. Doppler (integer percent). */
  creatorSharePct: number;
  dopplerSharePct: number;
  /** Verified HISS-token trading-fee split (fail-closed 50/15/15/10/10). */
  hissFeeSplit: FeeSplit;
  /** Claimed WETH routes 100% to the Treasury Safe — never split. */
  claimedWethTreasuryPct: number;
  /**
   * Economic burn sink — the canonical dead address. HISS routed here leaves
   * circulation but HISS.totalSupply is NOT reduced.
   */
  burnAddress: string;
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
    vaultProvidersPct: 15,
    vaultContributorsPct: 15,
    treasuryPct: 10,
    burnPct: 10,
  },
  claimedWethTreasuryPct: 100,
  burnAddress: "0x000000000000000000000000000000000000dEaD",
  providerRewardsPolicyV1: {
    providersPct: 30,
    treasuryPct: 70,
    wethPct: 0,
  },
  creatorPremintPct: 15,
  premintVestYears: 2,
  premintCliffDays: 30,
};

/** The canonical split rendered as the "a/b/c/d/e" token used in prose. */
export function splitToken(s: FeeSplit = FEE_CONSTANTS.hissFeeSplit): string {
  return `${s.stakersPct}/${s.vaultProvidersPct}/${s.vaultContributorsPct}/${s.treasuryPct}/${s.burnPct}`;
}

/** Sanity invariant: the five legs sum to exactly 100. */
export function splitSumsTo100(s: FeeSplit = FEE_CONSTANTS.hissFeeSplit): boolean {
  return s.stakersPct + s.vaultProvidersPct + s.vaultContributorsPct + s.treasuryPct + s.burnPct === 100;
}
