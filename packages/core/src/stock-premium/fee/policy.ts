// SPDX-License-Identifier: Apache-2.0
/**
 * HISS Stock-Premium LP management fee — FROZEN policy constants (SSOT).
 *
 * `HISS_LP_MANAGEMENT_FEE_V1` is a standalone protocol SERVICE-REVENUE stream:
 * a fee of 500 bps on a user's *realized LP fees only* (never principal, never
 * P&L), routed 100% to the HISS Treasury Safe. It is NOT the HISS Reward
 * Method, is never part of the 50/15/15/10/10 trading-fee split, never touches
 * xHISS / providers / contributors / burn, and never feeds a Reward-Method
 * distributor.
 *
 * This module is the ONE place the bps, the immutable max, and the recipient
 * are defined. Every consumer reads from here; the deployed Solidity
 * `HissLpManagerV1` enforces the identical arithmetic on-chain (see
 * `../deployment.js`). The Treasury address is IMPORTED from the reward-split
 * module so the canonical Safe address is never re-typed in a second place.
 *
 * Pure data. Nothing here signs, deploys, or moves funds.
 */

import { HISS_TREASURY_SAFE } from "../../rewards/split.js";

/** Frozen policy version tag — bumps only with an owner-approved policy change. */
export const HISS_LP_MANAGEMENT_FEE_VERSION = "HISS_LP_MANAGEMENT_FEE_V1" as const;

/** The policy fee, in basis points of realized LP fees (500 = 5%). */
export const HISS_LP_MANAGEMENT_FEE_BPS = 500 as const;

/**
 * Immutable ceiling, mirrored by the contract's `MAX_FEE_BPS`. Any requested
 * `feeBps` above this is rejected fail-closed (never silently clamped). Equal
 * to the default by design — the fee cannot be configured higher.
 */
export const HISS_LP_MANAGEMENT_FEE_MAX_BPS = 500 as const;

/** The bps denominator (10000 = 100%). Load-bearing for multiply-before-divide. */
export const HISS_LP_MANAGEMENT_FEE_BPS_DENOMINATOR = 10000 as const;

/**
 * Recipient of every `protocolFeeN` — the HISS Treasury Safe (2-of-3, chain
 * 4663). Imported from the reward-split module: this is a REFERENCE, never a
 * second literal. Fee revenue lands here 100%, never at a Reward-Method
 * distributor.
 */
export const HISS_LP_FEE_TREASURY = HISS_TREASURY_SAFE;

// Compile-time guard: the default never exceeds the immutable ceiling. If the
// constants drift apart, this file fails to typecheck.
type _AssertTrue<T extends true> = T;
type _DefaultWithinCeiling = _AssertTrue<
  typeof HISS_LP_MANAGEMENT_FEE_BPS extends typeof HISS_LP_MANAGEMENT_FEE_MAX_BPS ? true : false
>;
// Reference the alias so unused-type lint never strips the guard.
export type __FeePolicyInvariants = [_DefaultWithinCeiling];
