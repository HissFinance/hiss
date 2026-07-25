// SPDX-License-Identifier: Apache-2.0
/**
 * Stock-Premium LP — public barrel.
 *
 * The management-fee SSOT (policy constants + `computeManagementFee`) and the
 * canonical `HissLpManagerV1` deployment record. Read/prepare-only: nothing
 * here signs, submits, or moves funds.
 */

export * from "./fee/index.js";
export * from "./deployment.js";
