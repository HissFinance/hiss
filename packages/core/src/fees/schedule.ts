// SPDX-License-Identifier: Apache-2.0
/**
 * Vault fee schemas + constants — pure, deterministic, and fully disclosed.
 *
 * Launch schedule:
 *  - Saving a vault candidate: 0 USDG (always free).
 *  - Publishing a public vault: 50 USDG launch fee (paid on-chain at publish).
 *  - Creator performance fee: 10% of new net profit above the high-water mark
 *    (launch cap 10%; verified creators up to 20%).
 *  - HISS protocol share: 10% of the creator performance fee at launch
 *    (config-gated maximum 20%) — a share of the creator fee, never an extra
 *    depositor fee.
 *  - Routing fee: 0 while HISS live routing is disabled; 0.5 bps default and
 *    1 bps standard cap once live; 2 bps advanced maximum. Stored in
 *    tenth-of-a-bp so 0.5 bps is representable.
 *  - Creator skin-in-the-game: 5% minimum, required before public deposits.
 *  - Deposit fee 0; withdrawal fee 0 (gas, unwind, and slippage are disclosed
 *    separately — no hidden spread).
 *
 * Performance fees follow a high-water mark: no fee on losses, and no fee
 * until prior losses are fully recovered. The deployed contracts are the
 * source of truth at execution time; these calculators are for previews.
 */

export type VaultFeePhase = "launch" | "standard" | "max_configured";

export const LAUNCH_FEE_SCHEDULE = Object.freeze({
  candidateSaveFeeUsdg: 0,
  publicCreationFeeUsdg: 50,
  standardCreationFeeUsdg: 100,
  perfFeeDefaultBps: 1_000,
  perfFeeCapUnverifiedBps: 1_000,
  perfFeeCapVerifiedBps: 2_000,
  protocolShareLaunchBps: 1_000,
  protocolShareMaxBps: 2_000,
  routingFeeWhileDisabledTenthBps: 0,
  routingFeeDefaultTenthBps: 5,
  routingFeeStandardCapTenthBps: 10,
  routingFeeAdvancedMaxTenthBps: 20,
  creatorSkinMinBps: 500,
  depositFeeUsdg: 0,
  withdrawalFeeUsdg: 0,
});

export const BPS_DENOMINATOR = 10_000n;

/** A vault's fee configuration. All fees are public. */
export type VaultFeeConfig = {
  /** Creator performance fee, bps of profit above the high-water mark. */
  performanceFeeBps: number;
  /** HISS protocol share, bps OF THE CREATOR FEE (never of principal). */
  protocolShareBps: number;
  /** Routing fee in tenth-of-a-bp of rebalance notional; 0 while disabled. */
  routingFeeTenthBps: number;
  /** Public creator fee recipient (0x address). */
  creatorFeeRecipient: string;
};

export type FeeIssue = { code: string; message: string };

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/** Launch-default fee config for a new vault. */
export function defaultVaultFeeConfig(creatorFeeRecipient: string): VaultFeeConfig {
  return {
    performanceFeeBps: LAUNCH_FEE_SCHEDULE.perfFeeDefaultBps,
    protocolShareBps: LAUNCH_FEE_SCHEDULE.protocolShareLaunchBps,
    routingFeeTenthBps: LAUNCH_FEE_SCHEDULE.routingFeeWhileDisabledTenthBps,
    creatorFeeRecipient,
  };
}

/** Validate a fee config against the disclosed caps. Empty result = valid. */
export function validateVaultFeeConfig(
  config: VaultFeeConfig | undefined,
  options: { creatorVerified?: boolean } = {},
): FeeIssue[] {
  const issues: FeeIssue[] = [];
  if (!config || typeof config !== "object") {
    return [{ code: "FEE_CONFIG_SHAPE", message: "feeConfig must be an object." }];
  }

  const perfCap = options.creatorVerified
    ? LAUNCH_FEE_SCHEDULE.perfFeeCapVerifiedBps
    : LAUNCH_FEE_SCHEDULE.perfFeeCapUnverifiedBps;
  if (config.performanceFeeBps < 0 || config.performanceFeeBps > perfCap) {
    issues.push({ code: "PERF_FEE_CAP", message: `performanceFeeBps must be in [0, ${perfCap}].` });
  }
  if (config.protocolShareBps < 0 || config.protocolShareBps > LAUNCH_FEE_SCHEDULE.protocolShareMaxBps) {
    issues.push({
      code: "PROTOCOL_SHARE_CAP",
      message: `protocolShareBps must be in [0, ${LAUNCH_FEE_SCHEDULE.protocolShareMaxBps}].`,
    });
  }
  if (
    config.routingFeeTenthBps < 0 ||
    config.routingFeeTenthBps > LAUNCH_FEE_SCHEDULE.routingFeeAdvancedMaxTenthBps
  ) {
    issues.push({
      code: "ROUTING_FEE_CAP",
      message: `routingFeeTenthBps must be in [0, ${LAUNCH_FEE_SCHEDULE.routingFeeAdvancedMaxTenthBps}].`,
    });
  }
  if (typeof config.creatorFeeRecipient !== "string" || !ADDRESS_PATTERN.test(config.creatorFeeRecipient)) {
    issues.push({ code: "FEE_RECIPIENT", message: "creatorFeeRecipient must be a public 0x address." });
  }
  return issues;
}

/**
 * Performance fee on a profit figure above the high-water mark, with the HISS
 * protocol share carved out of the creator fee. Pure bigint math over base
 * units; no fee on non-positive profit. Returns creator/protocol split whose
 * sum equals the gross performance fee exactly (protocol absorbs floor dust).
 */
export function computePerformanceFee(input: {
  /** New net profit above the high-water mark, base units (non-negative). */
  profitAboveHighWaterMark: bigint;
  performanceFeeBps: number;
  protocolShareBps: number;
}): { grossFee: bigint; protocolShare: bigint; creatorShare: bigint } {
  if (input.profitAboveHighWaterMark <= 0n) {
    return { grossFee: 0n, protocolShare: 0n, creatorShare: 0n };
  }
  const grossFee = (input.profitAboveHighWaterMark * BigInt(input.performanceFeeBps)) / BPS_DENOMINATOR;
  const protocolShare = (grossFee * BigInt(input.protocolShareBps)) / BPS_DENOMINATOR;
  const creatorShare = grossFee - protocolShare;
  return { grossFee, protocolShare, creatorShare };
}
