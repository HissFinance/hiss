// SPDX-License-Identifier: Apache-2.0
/**
 * HISS Stock-Premium LP management fee — the SOLE arithmetic authority (SSOT).
 *
 * `computeManagementFee` is the ONE definition of the fee split. Every consumer
 * imports it; the deployed Solidity `HissLpManagerV1` implements the identical
 * arithmetic and is proven equal over the committed parity vectors
 * (`packages/core/test/fixtures/management-fee-vectors.json`, generated FROM
 * this module).
 *
 * Exact, pure bigint. Per token — callers invoke once per fee token; there is
 * no cross-token netting and no forced swap. By construction the ONLY base is a
 * REALIZED-LP-FEE amount: there is no principal / inventory / P&L parameter, so
 * it is structurally impossible to charge the fee on anything but realized
 * fees.
 *
 * Properties held (mirrored in Solidity + asserted in tests):
 *  - P1 conservation:  protocolFeeN + userFeeN === realizedLpFeeN, always.
 *  - P2 floor / user-favored: the protocol side is floored; ALL division dust
 *    accrues to the USER (the fee is a deduction *from* the user's fees).
 *  - P3 bounded / fail-closed: feeBps outside [0, MAX] throws — never clamped.
 *  - P4 principal isolation: no principal/P&L parameter exists.
 *  - P5 per-token: standalone per token, no netting.
 *  - P6 zero-safe: realizedLpFeeN === 0n → both legs 0n, no revert.
 *
 * Nothing here signs, deploys, or moves funds.
 */

import {
  HISS_LP_MANAGEMENT_FEE_BPS,
  HISS_LP_MANAGEMENT_FEE_BPS_DENOMINATOR,
  HISS_LP_MANAGEMENT_FEE_MAX_BPS,
} from "./policy.js";

/** The exact split of one token's realized LP fees. protocol + user === input. */
export interface ManagementFeeSplit {
  /** Floored protocol take, in the SAME token's base units. → Treasury Safe. */
  readonly protocolFeeN: bigint;
  /** Exact remainder the user keeps (>= 95% of realized; absorbs all dust). */
  readonly userFeeN: bigint;
}

/**
 * Split a single token's realized LP fees into the HISS protocol fee and the
 * user's kept amount.
 *
 * @param realizedLpFeeN REALIZED LP fees for one token (base units, >= 0).
 *        NEVER principal, NEVER P&L — the caller must pass only the proven
 *        realized-fee component.
 * @param feeBps The policy bps. Defaults to the frozen 500. Must be an integer
 *        in [0, HISS_LP_MANAGEMENT_FEE_MAX_BPS]; out of range throws
 *        (fail-closed).
 * @returns `{ protocolFeeN, userFeeN }` — exact bigint, summing to the input.
 */
export function computeManagementFee(
  realizedLpFeeN: bigint,
  feeBps: number = HISS_LP_MANAGEMENT_FEE_BPS,
): ManagementFeeSplit {
  if (typeof realizedLpFeeN !== "bigint") {
    throw new TypeError("computeManagementFee: realizedLpFeeN must be a bigint");
  }
  if (realizedLpFeeN < 0n) {
    throw new RangeError(`computeManagementFee: realizedLpFeeN must be >= 0 (got ${realizedLpFeeN})`);
  }
  if (!Number.isInteger(feeBps)) {
    throw new RangeError(`computeManagementFee: feeBps must be an integer (got ${feeBps})`);
  }
  // Fail-closed: never silently clamp an out-of-policy fee.
  if (feeBps < 0 || feeBps > HISS_LP_MANAGEMENT_FEE_MAX_BPS) {
    throw new RangeError(
      `computeManagementFee: feeBps ${feeBps} out of policy range [0, ${HISS_LP_MANAGEMENT_FEE_MAX_BPS}]`,
    );
  }

  const bps = BigInt(feeBps);
  const denom = BigInt(HISS_LP_MANAGEMENT_FEE_BPS_DENOMINATOR);

  // Multiply-BEFORE-divide (load-bearing): identical floor to the Solidity
  // `(realizedLpFee * feeBps) / 10000`. Dust from the floor accrues to the user.
  const protocolFeeN = (realizedLpFeeN * bps) / denom;
  const userFeeN = realizedLpFeeN - protocolFeeN;

  return { protocolFeeN, userFeeN };
}
