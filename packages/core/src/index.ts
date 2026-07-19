// SPDX-License-Identifier: Apache-2.0
/**
 * @hiss-finance/core — the shared public truth layer for HISS Finance.
 *
 * Chain config, the canonical contract + asset registries, address and
 * symbol-space helpers, manifest/receipt/plan schemas, the fee model, and the
 * public HISS_REWARD_METHOD_V2 formulas. No database clients, no environment
 * loaders, no secrets, no admin actions.
 */

export const HISS_CORE_VERSION = "0.1.0";

// Crypto primitives
export { keccak256, keccak256Hex, keccak256Bytes } from "./crypto/keccak256.js";
export { sha256Hex } from "./crypto/sha256.js";

// Addresses
export {
  type Address,
  isAddress,
  isChecksumAddress,
  toChecksumAddress,
  normalizeAddress,
  addressesEqual,
  ZERO_ADDRESS,
} from "./address/address.js";

// Chain
export {
  type HissNetwork,
  type HissChainConfig,
  type RobinhoodChainId,
  ROBINHOOD_CHAIN_MAINNET,
  ROBINHOOD_CHAIN_TESTNET,
  ROBINHOOD_CHAIN_MAINNET_ID,
  ROBINHOOD_CHAIN_TESTNET_ID,
  SUPPORTED_CHAINS,
  SUPPORTED_CHAIN_IDS,
  isSupportedChainId,
  getChainById,
  assertChainId,
  explorerAddressUrl,
  explorerTxUrl,
} from "./chain/config.js";

// Symbol spaces
export {
  type BrokerSymbol,
  type TokenRef,
  isBrokerSymbol,
  parseBrokerSymbol,
  parseTokenAddress,
} from "./symbols/space.js";

// Registries
export * from "./registry/contracts.js";
export * from "./registry/assets.js";

// Coil
export * from "./coil/fuses.js";
export * from "./coil/manifest.js";

// Vault
export * from "./vault/manifest.js";

// Fees
export * from "./fees/schedule.js";

// Actions + receipts
export * from "./actions/plan.js";
export { canonicalJson, hashCanonical, keccakCanonical, stableStringify } from "./receipts/canonical.js";
export * from "./receipts/execution.js";

// Rewards
export * from "./rewards/split.js";
export * from "./rewards/math.js";
export * from "./rewards/method.js";
export * from "./rewards/lifecycle.js";

// Staking
export * from "./staking/xhiss.js";

// Status + errors
export * from "./status/public.js";
export * from "./errors/codes.js";

// Compatibility aliases (friendlier names used by the SDK examples)
export * from "./compat.js";
