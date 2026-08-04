/**
 * @hiss-finance/sdk
 *
 * TypeScript SDK for HISS Finance on Robinhood Chain. Two capabilities:
 *
 *  1. Public chain READS via viem (no HISS API key required) — protocol
 *     status, contract registry, vault state, staking status/positions, the
 *     reward model, and receipt verification. Every read is fail-soft: it is
 *     labeled `degraded` on failure, never a fabricated zero.
 *
 *  2. Typed, UNSIGNED ActionPlans (`prepare*`) for vault deposits/withdrawals,
 *     vault creation, $HISS approval/staking, and xHISS cooldown/redeem. Each
 *     plan carries decoded args, calldata, and a deterministic plan hash for
 *     the caller to review and sign with THEIR OWN wallet or Safe.
 *
 * This SDK never signs a transaction, never submits one, never accepts a
 * private key, and never calls a credentialed endpoint. HISS is compilation
 * and verification software: it prepares and verifies; wallets and Safes sign.
 *
 * Apache-2.0.
 */

// Constants + chain wiring
export * from "./constants";
export { robinhoodChainMainnet, robinhoodChainTestnet, chainForId } from "./chains";

// ABIs
export {
  ERC20_ABI,
  VAULT_ABI,
  VAULT_FACTORY_ABI,
  VAULT_ASSET_REGISTRY_ABI,
  VAULT_V2_ABI,
  VAULT_V2_QUEUE_ABI,
  VAULT_V2_SETTLER_ABI,
  VAULT_V2_LIVENESS_ABI,
  VAULT_V2_PRICE_MESH_ABI,
  XHISS_ABI,
} from "./abi";

// Types
export type {
  ActionPlan,
  ReadResult,
  ReadState,
  ProtocolStatus,
  ContractRegistryEntry,
  ContractRegistryReport,
  ContractRegistryReportEntry,
  ContractDeploymentStatus,
  VaultReads,
  VaultLifecycle,
  VaultV2AssetCapacity,
  VaultV2Status,
  StakingStatus,
  StakingPosition,
} from "./types";

// Plan construction
export { buildActionPlan, computePlanHash, planHashPayload } from "./plan";
export type { BuildActionPlanInput } from "./plan";

// Client (reads)
export { HissClient, mapRegistryEntry } from "./client";
export type { HissClientOptions, RewardModel } from "./client";

// Ergonomic factory + address alias used across the SDK examples.
import { HissClient as _HissClient, type HissClientOptions as _HissClientOptions } from "./client";
import { ADDRESSES } from "./constants";
export function createHissClient(options?: _HissClientOptions): _HissClient {
  return new _HissClient(options);
}
export const HISS_ADDRESSES = ADDRESSES;

// Prepare methods (unsigned action plans)
export {
  prepareVaultDeposit,
  prepareVaultWithdrawal,
  prepareVaultCreation,
  prepareVaultManagementAction,
  prepareHissApproval,
  prepareErc20Approval,
  prepareHissStake,
  prepareXhissCooldown,
  prepareXhissRedeem,
  createVaultManifest,
  validateVaultManifest,
  calculateAllocationBps,
} from "./prepare";
export type {
  PrepareVaultDepositInput,
  PrepareVaultWithdrawalInput,
  PrepareVaultCreationInput,
  PrepareVaultManagementInput,
  PrepareApprovalInput,
  PrepareHissStakeInput,
  PrepareXhissCooldownInput,
  PrepareXhissRedeemInput,
} from "./prepare";

// Verification (deterministic) + coils
export * from "./verify";

// Copy strings (verbatim acknowledgements/cautions)
export { SIGNING_NOTICE, DEPOSITOR_ACKS, STAKING_ACKS, CREATOR_ACKS, OWNER_ACTION_ACKS } from "./copy";
