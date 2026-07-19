// SPDX-License-Identifier: Apache-2.0
/**
 * HISS reward split — HISS_REWARD_METHOD_V2, 50/15/15/10/10 of VERIFIED $HISS
 * trading fees.
 *
 * Only verified $HISS-token trading fees are ever split. Creator vesting,
 * WETH, pre-existing balances, and unclassified deltas are excluded upstream
 * and rejected here. The five legs (basis points of the eligible HISS):
 *
 *   5000  xHISS stakers        -> the xHISS staking vault
 *   1500  vault providers      -> the vault-provider rewards distributor
 *   1500  vault contributors   -> the vault-contributor vesting distributor
 *   1000  treasury             -> the HISS Treasury Safe (2-of-3)
 *   1000  economic burn        -> the canonical dead address (0x…dEaD)
 *
 * "Vault contributors" is the current name for the former depositor cohort;
 * the allocation methodology (share-seconds) is unchanged. The BURN leg is an
 * ECONOMIC burn: HISS is transferred to the canonical dead address, which
 * removes it from circulation but does NOT reduce HISS.totalSupply.
 *
 * Pure bigint floor division per leg; the TREASURY leg absorbs the dust so the
 * five legs always sum EXACTLY to the input. Claimed WETH is never part of
 * this split — policy is 100% of claimed WETH to the Treasury Safe.
 *
 * V1 (50/30/10/10, four legs, no burn) is historical.
 */

import { getContractAddress } from "../registry/contracts.js";

export const HISS_REWARD_SPLIT_VERSION = "hiss-reward-split-v2";

export const XHISS_STAKER_BPS = 5000 as const;
export const VAULT_PROVIDER_BPS = 1500 as const;
export const VAULT_CONTRIBUTOR_BPS = 1500 as const;
export const TREASURY_BPS = 1000 as const;
export const BURN_BPS = 1000 as const;

const BPS_DENOMINATOR = 10_000n;

/**
 * Canonical economic-burn sink — the well-known "dead" address. HISS routed
 * here is removed from circulation (nobody holds the key), but the transfer is
 * an ordinary ERC-20 transfer: HISS.totalSupply is NOT reduced.
 */
export const HISS_BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;

/** The Treasury Safe (2-of-3) address — treasury + WETH legs are pinned here. */
export const HISS_TREASURY_SAFE = getContractAddress("treasurySafe");

export type HissRewardSplit = {
  source: "verified_hiss_trading_fee";
  /** The only distributable figure, HISS base units (18 dec) as a string. */
  totalEligibleHiss: string;
  xHissStakerAmount: string;
  vaultProviderAmount: string;
  vaultContributorAmount: string;
  /** Includes the floor-division dust — the five legs sum EXACTLY. */
  treasuryAmount: string;
  /** Economic burn to the dead address; does NOT reduce totalSupply. */
  burnAmount: string;
  xHissStakerBps: typeof XHISS_STAKER_BPS;
  vaultProviderBps: typeof VAULT_PROVIDER_BPS;
  vaultContributorBps: typeof VAULT_CONTRIBUTOR_BPS;
  treasuryBps: typeof TREASURY_BPS;
  burnBps: typeof BURN_BPS;
  creatorVestingExcluded: true;
  wethExcluded: true;
};

/** Where each leg pays out. Distributors are null until deployed. */
export type HissRewardSplitRecipients = {
  xHissStakerVault: string | null;
  vaultProviderDistributor: string | null;
  vaultContributorDistributor: string | null;
  treasury: typeof HISS_TREASURY_SAFE;
  /** Economic-burn sink — always the canonical dead address. */
  burn: typeof HISS_BURN_ADDRESS;
  wethRecipient: typeof HISS_TREASURY_SAFE;
};

/** The five leg constants sum to exactly 10,000 bps. */
export const REWARD_SPLIT_BPS_TOTAL =
  XHISS_STAKER_BPS + VAULT_PROVIDER_BPS + VAULT_CONTRIBUTOR_BPS + TREASURY_BPS + BURN_BPS;

function toBigInt(label: string, value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a base-unit decimal string, got: ${value}`);
  return BigInt(value);
}

/**
 * Split a RAW eligible-HISS base-unit amount 50/15/15/10/10 (floor per leg;
 * treasury absorbs the dust so the five sum EXACTLY). Fail-closed on a
 * negative or malformed amount.
 */
export function splitEligibleHiss(totalEligibleHiss: string): HissRewardSplit {
  const total = toBigInt("totalEligibleHiss", totalEligibleHiss);
  if (total < 0n) throw new Error("reward split rejected: total must be non-negative");

  const xHissStaker = (total * BigInt(XHISS_STAKER_BPS)) / BPS_DENOMINATOR;
  const vaultProvider = (total * BigInt(VAULT_PROVIDER_BPS)) / BPS_DENOMINATOR;
  const vaultContributor = (total * BigInt(VAULT_CONTRIBUTOR_BPS)) / BPS_DENOMINATOR;
  const burn = (total * BigInt(BURN_BPS)) / BPS_DENOMINATOR;
  const treasury = total - xHissStaker - vaultProvider - vaultContributor - burn;

  const treasuryFloor = (total * BigInt(TREASURY_BPS)) / BPS_DENOMINATOR;
  if (treasury < treasuryFloor) {
    throw new Error("internal invariant violated: treasury leg fell below its floor share");
  }
  if (xHissStaker + vaultProvider + vaultContributor + treasury + burn !== total) {
    throw new Error("internal invariant violated: split legs must sum exactly to the eligible total");
  }

  return {
    source: "verified_hiss_trading_fee",
    totalEligibleHiss: total.toString(),
    xHissStakerAmount: xHissStaker.toString(),
    vaultProviderAmount: vaultProvider.toString(),
    vaultContributorAmount: vaultContributor.toString(),
    treasuryAmount: treasury.toString(),
    burnAmount: burn.toString(),
    xHissStakerBps: XHISS_STAKER_BPS,
    vaultProviderBps: VAULT_PROVIDER_BPS,
    vaultContributorBps: VAULT_CONTRIBUTOR_BPS,
    treasuryBps: TREASURY_BPS,
    burnBps: BURN_BPS,
    creatorVestingExcluded: true,
    wethExcluded: true,
  };
}

/**
 * Build a recipients config; treasury/WETH legs are pinned to the Safe and the
 * burn leg to the canonical dead address.
 */
export function hissRewardSplitRecipients(
  contracts: {
    xHissStakerVault?: string | null;
    vaultProviderDistributor?: string | null;
    vaultContributorDistributor?: string | null;
  } = {},
): HissRewardSplitRecipients {
  return {
    xHissStakerVault: contracts.xHissStakerVault ?? null,
    vaultProviderDistributor: contracts.vaultProviderDistributor ?? null,
    vaultContributorDistributor: contracts.vaultContributorDistributor ?? null,
    treasury: HISS_TREASURY_SAFE,
    burn: HISS_BURN_ADDRESS,
    wethRecipient: HISS_TREASURY_SAFE,
  };
}
