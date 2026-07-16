// SPDX-License-Identifier: Apache-2.0
/**
 * HISS reward split — 50/30/10/10 of VERIFIED $HISS trading fees.
 *
 * Only verified $HISS-token trading fees are ever split. Creator vesting,
 * WETH, pre-existing balances, and unclassified deltas are excluded upstream
 * and rejected here. The four legs (basis points of the eligible HISS):
 *
 *   5000  xHISS stakers        -> the xHISS staking vault
 *   3000  depositor vesting    -> the depositor vesting distributor
 *   1000  provider rewards     -> the provider rewards distributor
 *   1000  treasury             -> the HISS Treasury Safe (2-of-3)
 *
 * Pure bigint floor division per leg; the TREASURY leg absorbs the dust so the
 * four legs always sum EXACTLY to the input. Claimed WETH is never part of
 * this split — policy is 100% of claimed WETH to the Treasury Safe.
 */

import { getContractAddress } from "../registry/contracts.js";

export const HISS_REWARD_SPLIT_VERSION = "hiss-reward-split-v1";

export const XHISS_STAKER_BPS = 5000 as const;
export const DEPOSITOR_VESTING_BPS = 3000 as const;
export const PROVIDER_REWARDS_BPS = 1000 as const;
export const TREASURY_BPS = 1000 as const;

const BPS_DENOMINATOR = 10_000n;

/** The Treasury Safe (2-of-3) address — treasury + WETH legs are pinned here. */
export const HISS_TREASURY_SAFE = getContractAddress("treasurySafe");

export type HissRewardSplit = {
  source: "verified_hiss_trading_fee";
  /** The only distributable figure, HISS base units (18 dec) as a string. */
  totalEligibleHiss: string;
  xHissStakerAmount: string;
  depositorVestingAmount: string;
  providerRewardsAmount: string;
  /** Includes the floor-division dust — the four legs sum EXACTLY. */
  treasuryAmount: string;
  xHissStakerBps: typeof XHISS_STAKER_BPS;
  depositorVestingBps: typeof DEPOSITOR_VESTING_BPS;
  providerRewardsBps: typeof PROVIDER_REWARDS_BPS;
  treasuryBps: typeof TREASURY_BPS;
  creatorVestingExcluded: true;
  wethExcluded: true;
};

/** Where each leg pays out. Distributors are null until deployed. */
export type HissRewardSplitRecipients = {
  xHissStakerVault: string | null;
  depositorVestingDistributor: string | null;
  providerRewardsDistributor: string | null;
  treasury: typeof HISS_TREASURY_SAFE;
  wethRecipient: typeof HISS_TREASURY_SAFE;
};

/** The four leg constants sum to exactly 10,000 bps. */
export const REWARD_SPLIT_BPS_TOTAL =
  XHISS_STAKER_BPS + DEPOSITOR_VESTING_BPS + PROVIDER_REWARDS_BPS + TREASURY_BPS;

function toBigInt(label: string, value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a base-unit decimal string, got: ${value}`);
  return BigInt(value);
}

/**
 * Split a RAW eligible-HISS base-unit amount 50/30/10/10 (floor per leg;
 * treasury absorbs the dust so the four sum EXACTLY). Fail-closed on a
 * negative or malformed amount.
 */
export function splitEligibleHiss(totalEligibleHiss: string): HissRewardSplit {
  const total = toBigInt("totalEligibleHiss", totalEligibleHiss);
  if (total < 0n) throw new Error("reward split rejected: total must be non-negative");

  const xHissStaker = (total * BigInt(XHISS_STAKER_BPS)) / BPS_DENOMINATOR;
  const depositorVesting = (total * BigInt(DEPOSITOR_VESTING_BPS)) / BPS_DENOMINATOR;
  const providerRewards = (total * BigInt(PROVIDER_REWARDS_BPS)) / BPS_DENOMINATOR;
  const treasury = total - xHissStaker - depositorVesting - providerRewards;

  const treasuryFloor = (total * BigInt(TREASURY_BPS)) / BPS_DENOMINATOR;
  if (treasury < treasuryFloor) {
    throw new Error("internal invariant violated: treasury leg fell below its floor share");
  }
  if (xHissStaker + depositorVesting + providerRewards + treasury !== total) {
    throw new Error("internal invariant violated: split legs must sum exactly to the eligible total");
  }

  return {
    source: "verified_hiss_trading_fee",
    totalEligibleHiss: total.toString(),
    xHissStakerAmount: xHissStaker.toString(),
    depositorVestingAmount: depositorVesting.toString(),
    providerRewardsAmount: providerRewards.toString(),
    treasuryAmount: treasury.toString(),
    xHissStakerBps: XHISS_STAKER_BPS,
    depositorVestingBps: DEPOSITOR_VESTING_BPS,
    providerRewardsBps: PROVIDER_REWARDS_BPS,
    treasuryBps: TREASURY_BPS,
    creatorVestingExcluded: true,
    wethExcluded: true,
  };
}

/** Build a recipients config; treasury/WETH legs are pinned to the Safe. */
export function hissRewardSplitRecipients(
  contracts: {
    xHissStakerVault?: string | null;
    depositorVestingDistributor?: string | null;
    providerRewardsDistributor?: string | null;
  } = {},
): HissRewardSplitRecipients {
  return {
    xHissStakerVault: contracts.xHissStakerVault ?? null,
    depositorVestingDistributor: contracts.depositorVestingDistributor ?? null,
    providerRewardsDistributor: contracts.providerRewardsDistributor ?? null,
    treasury: HISS_TREASURY_SAFE,
    wethRecipient: HISS_TREASURY_SAFE,
  };
}
