// SPDX-License-Identifier: Apache-2.0
/**
 * Stock-Premium LP — `HissLpManagerV1` canonical public deployment record.
 *
 * `HissLpManagerV1` is DEPLOYED, LAUNCHED PAUSED, and source-VERIFIED on
 * Blockscout on Robinhood Chain mainnet (4663). Owner and treasury are both the
 * HISS Treasury Safe (2-of-3); `feeBps` is 500 with an immutable `MAX_FEE_BPS`
 * of 500 (the management fee applies to realized LP fees only — see
 * `./fee/policy.js`). Launched paused means inert: no positions enrollable and
 * nothing charged.
 *
 * The address itself lives in the canonical contract registry
 * (`../registry/contracts.js`, key `lpManagerV1`) and in
 * `contracts/deployments/robinhood-chain-mainnet.json`; this module composes
 * the typed record from those SSOTs — it never re-types a literal.
 *
 * Truth rules:
 *   - Deployed ≠ active ≠ accepting funds. "DEPLOYED_PAUSED" is the committed
 *     artifact status; the LIVE `paused()` / `feeBps()` / `treasury()` /
 *     `owner()` state is always a fresh chain read, and a failed read renders
 *     "unknown" — never "live", never "active", never "not deployed".
 *   - Nothing here signs, submits, or moves funds. Pure data.
 */

import { ROBINHOOD_CHAIN_MAINNET_ID, explorerAddressUrl } from "../chain/config.js";
import { getContractAddress } from "../registry/contracts.js";
import { HISS_TREASURY_SAFE } from "../rewards/split.js";
import {
  HISS_LP_FEE_TREASURY,
  HISS_LP_MANAGEMENT_FEE_BPS,
  HISS_LP_MANAGEMENT_FEE_MAX_BPS,
  HISS_LP_MANAGEMENT_FEE_VERSION,
} from "./fee/policy.js";

/** Contract name as compiled + verified on Blockscout. */
export const HISS_LP_MANAGER_V1_CONTRACT_NAME = "HissLpManagerV1" as const;

/** The deployed manager address, resolved from the canonical registry. */
export const HISS_LP_MANAGER_V1_ADDRESS = getContractAddress("lpManagerV1");

/** Chain the manager is deployed on — Robinhood Chain mainnet (4663). */
export const HISS_LP_MANAGER_V1_CHAIN_ID = ROBINHOOD_CHAIN_MAINNET_ID;

/**
 * Artifact-proven deployment status. "DEPLOYED_PAUSED" is a statement about the
 * committed deployment record, NOT a live claim: the current pause state must
 * always come from a fresh `paused()` read (unknown on failure, never "live").
 */
export const HISS_LP_MANAGER_V1_STATUS = "DEPLOYED_PAUSED" as const;

/** Canonical Blockscout page for the verified contract (built, never re-typed). */
export const HISS_LP_MANAGER_V1_EXPLORER_URL = explorerAddressUrl(
  HISS_LP_MANAGER_V1_CHAIN_ID,
  HISS_LP_MANAGER_V1_ADDRESS,
) as string;

/**
 * The full typed deployment record. Fee facts + expected owner/treasury are
 * references to their SSOTs — a drift there is a drift here, by construction.
 */
export const HISS_LP_MANAGER_V1_DEPLOYMENT = {
  contract: HISS_LP_MANAGER_V1_CONTRACT_NAME,
  address: HISS_LP_MANAGER_V1_ADDRESS,
  chainId: HISS_LP_MANAGER_V1_CHAIN_ID,
  status: HISS_LP_MANAGER_V1_STATUS,
  explorerUrl: HISS_LP_MANAGER_V1_EXPLORER_URL,
  explorerVerified: true,
  /** Owner + treasury at deployment: the HISS Treasury Safe (2-of-3). */
  expectedOwner: HISS_TREASURY_SAFE,
  expectedTreasury: HISS_LP_FEE_TREASURY,
  /** Immutable fee facts, from the fee SSOT (`stock-premium/fee`). */
  feePolicyVersion: HISS_LP_MANAGEMENT_FEE_VERSION,
  expectedFeeBps: HISS_LP_MANAGEMENT_FEE_BPS,
  immutableMaxFeeBps: HISS_LP_MANAGEMENT_FEE_MAX_BPS,
  /** Launch posture recorded in the artifact — paused, nothing enrollable. */
  launchedPaused: true,
} as const;

export type HissLpManagerV1Deployment = typeof HISS_LP_MANAGER_V1_DEPLOYMENT;
