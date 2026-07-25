// SPDX-License-Identifier: Apache-2.0
/**
 * Stock-Premium LP management fee — public barrel (SSOT surface).
 *
 * The ONE import point for the fee policy + arithmetic. Every consumer MUST
 * import `computeManagementFee` and the policy constants from here (or the
 * stock-premium barrel) — never re-implement the fee math inline.
 */

export {
  HISS_LP_MANAGEMENT_FEE_VERSION,
  HISS_LP_MANAGEMENT_FEE_BPS,
  HISS_LP_MANAGEMENT_FEE_MAX_BPS,
  HISS_LP_MANAGEMENT_FEE_BPS_DENOMINATOR,
  HISS_LP_FEE_TREASURY,
} from "./policy.js";
export type { __FeePolicyInvariants } from "./policy.js";

export { computeManagementFee } from "./managementFee.js";
export type { ManagementFeeSplit } from "./managementFee.js";
