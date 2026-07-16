// SPDX-License-Identifier: Apache-2.0
/**
 * Public error codes + a typed HissError. Codes are stable, machine-readable
 * identifiers surfaced across APIs, manifests, and validators. Every code
 * fails closed: when in doubt, refuse.
 */

export const HISS_ERROR_CODES = Object.freeze({
  WRONG_CHAIN: "WRONG_CHAIN",
  INVALID_ADDRESS: "INVALID_ADDRESS",
  SYMBOL_SPACE_CONFUSION: "SYMBOL_SPACE_CONFUSION",
  WEIGHTS_SUM_INVALID: "WEIGHTS_SUM_INVALID",
  MANIFEST_INVALID: "MANIFEST_INVALID",
  VAULT_CHAIN_INVALID: "VAULT_CHAIN_INVALID",
  BASE_ASSET_INVALID: "BASE_ASSET_INVALID",
  FEE_CONFIG_INVALID: "FEE_CONFIG_INVALID",
  FUSE_COVERAGE_INSUFFICIENT: "FUSE_COVERAGE_INSUFFICIENT",
  REWARD_SPLIT_REJECTED: "REWARD_SPLIT_REJECTED",
  REWARD_STATE_TRANSITION_ILLEGAL: "REWARD_STATE_TRANSITION_ILLEGAL",
  RECEIPT_STATUS_INVALID: "RECEIPT_STATUS_INVALID",
  STATUS_UNKNOWN: "STATUS_UNKNOWN",
  UNKNOWN_CONTRACT_KEY: "UNKNOWN_CONTRACT_KEY",
} as const);

export type HissErrorCode = (typeof HISS_ERROR_CODES)[keyof typeof HISS_ERROR_CODES];

export const HISS_ERROR_CODE_VALUES: readonly HissErrorCode[] = Object.values(HISS_ERROR_CODES);

/** A typed error carrying a stable public code. */
export class HissError extends Error {
  readonly code: HissErrorCode;

  constructor(code: HissErrorCode, message: string) {
    super(message);
    this.name = "HissError";
    this.code = code;
  }
}

export function isHissError(value: unknown): value is HissError {
  return value instanceof HissError;
}
