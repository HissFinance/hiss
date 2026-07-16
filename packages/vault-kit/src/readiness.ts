/**
 * Deployment-readiness validation for a vault candidate.
 *
 * Fail-closed: readiness is only reported when every affirmative requirement
 * is met. A missing or malformed field is an error, never a silent pass. This
 * checks the LOCAL candidate — it does not read chain state or claim anything
 * is deployed.
 */

import { TOTAL_BPS, isValidBps, sumBps } from "./bps";
import { validateFuses } from "./fuses";
import type { VaultCandidate } from "./manifest";
import { VAULT_MANIFEST_SCHEMA_VERSION } from "./manifest";
import { ROBINHOOD_CHAIN_MAINNET, ROBINHOOD_CHAIN_TESTNET } from "./assets";

/** Upper bound on a creator-set performance fee (illustrative policy ceiling). */
export const MAX_PERFORMANCE_FEE_BPS = 3_000;
/** Upper bound on a referral fee. */
export const MAX_REFERRAL_FEE_BPS = 1_000;
/** Upper bound on required creator skin. */
export const MAX_MIN_SKIN_BPS = 5_000;

/** Severity of a readiness finding. */
export type IssueSeverity = "error" | "warning";

/** A single readiness finding. */
export interface ReadinessIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
}

/** Result of {@link validateDeploymentReadiness}. */
export interface ReadinessResult {
  /** True only when there are zero errors. */
  ready: boolean;
  issues: ReadinessIssue[];
  errors: ReadinessIssue[];
  warnings: ReadinessIssue[];
}

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const HASH32_RE = /^0x[0-9a-f]{64}$/;

function isAddress(value: unknown): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value.toLowerCase());
}

/**
 * Validate that a candidate is internally consistent and within policy
 * bounds, so it is safe to compile into a deployment plan.
 */
export function validateDeploymentReadiness(candidate: VaultCandidate): ReadinessResult {
  const issues: ReadinessIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  if (candidate.schemaVersion !== VAULT_MANIFEST_SCHEMA_VERSION) {
    err(
      "schema.version",
      `Unexpected schema version "${candidate.schemaVersion}" (want ${VAULT_MANIFEST_SCHEMA_VERSION}).`,
    );
  }

  if (candidate.chainId !== ROBINHOOD_CHAIN_MAINNET && candidate.chainId !== ROBINHOOD_CHAIN_TESTNET) {
    err("chain.id", `Unsupported chainId ${candidate.chainId} (want 4663 or 46630).`);
  }

  if (!candidate.name || candidate.name.trim().length === 0) err("meta.name", "Vault name is required.");
  if (!candidate.symbol || candidate.symbol.trim().length === 0) {
    err("meta.symbol", "Vault symbol is required.");
  }

  // Base asset.
  if (!isAddress(candidate.asset?.address)) {
    err("asset.address", "Base asset address must be a 20-byte hex address.");
  }
  if (!Number.isInteger(candidate.asset?.decimals) || candidate.asset.decimals < 0) {
    err("asset.decimals", "Base asset decimals must be a non-negative integer.");
  }

  // Allocations.
  if (!Array.isArray(candidate.allocations) || candidate.allocations.length === 0) {
    err("allocation.empty", "At least one allocation is required.");
  } else {
    const weights = candidate.allocations.map((a) => a.weightBps);
    if (!weights.every(isValidBps)) {
      err("allocation.bps", "Every allocation weight must be an integer in [0, 10000] bps.");
    }
    const total = sumBps(weights);
    if (total !== TOTAL_BPS) {
      err("allocation.sum", `Allocations must sum to ${TOTAL_BPS} bps, got ${total}.`);
    }
    const seen = new Set<string>();
    for (const a of candidate.allocations) {
      if (!isAddress(a.address)) {
        err("allocation.address", `Allocation "${a.symbol}" has an invalid address.`);
        continue;
      }
      if (seen.has(a.address)) err("allocation.duplicate", `Duplicate allocation for ${a.address}.`);
      seen.add(a.address);
      if (a.weightBps === 0) warn("allocation.zero", `Allocation "${a.symbol}" is 0 bps.`);
    }
  }

  // Fees.
  const perf = candidate.fees?.performanceFeeBps;
  if (!isValidBps(perf) || perf > MAX_PERFORMANCE_FEE_BPS) {
    err("fees.performance", `Performance fee must be 0–${MAX_PERFORMANCE_FEE_BPS} bps, got ${perf}.`);
  }
  if (candidate.fees?.referralBps !== undefined) {
    const ref = candidate.fees.referralBps;
    if (!isValidBps(ref) || ref > MAX_REFERRAL_FEE_BPS) {
      err("fees.referral", `Referral fee must be 0–${MAX_REFERRAL_FEE_BPS} bps, got ${ref}.`);
    }
    if (ref > 0 && !isAddress(candidate.fees.referral)) {
      err("fees.referralAddress", "A non-zero referral fee needs a valid referral address.");
    }
  }

  // Skin in the game.
  if (!isValidBps(candidate.minSkinBps) || candidate.minSkinBps > MAX_MIN_SKIN_BPS) {
    err("skin.bps", `minSkinBps must be 0–${MAX_MIN_SKIN_BPS} bps, got ${candidate.minSkinBps}.`);
  } else if (candidate.minSkinBps === 0) {
    warn("skin.zero", "minSkinBps is 0 — the creator has no required stake.");
  }

  // Lockup / strategy.
  if (!Number.isInteger(candidate.lockupSeconds) || candidate.lockupSeconds < 0) {
    err("lockup.seconds", "lockupSeconds must be a non-negative integer.");
  }
  if (!candidate.strategy?.summary || candidate.strategy.summary.trim().length === 0) {
    err("strategy.summary", "A strategy summary is required.");
  }
  if (
    !Number.isInteger(candidate.strategy?.noticePeriodSeconds) ||
    candidate.strategy.noticePeriodSeconds < 0
  ) {
    err("strategy.notice", "strategy.noticePeriodSeconds must be a non-negative integer.");
  }

  // Jurisdiction acks.
  if (
    candidate.jurisdiction?.requiredRiskAckHash !== undefined &&
    !HASH32_RE.test(candidate.jurisdiction.requiredRiskAckHash.toLowerCase())
  ) {
    err("jurisdiction.riskAck", "requiredRiskAckHash must be a 32-byte hex hash.");
  }
  if (
    candidate.jurisdiction?.requiredJurisdictionAckHash !== undefined &&
    !HASH32_RE.test(candidate.jurisdiction.requiredJurisdictionAckHash.toLowerCase())
  ) {
    err("jurisdiction.jurisdictionAck", "requiredJurisdictionAckHash must be a 32-byte hex hash.");
  }
  if (candidate.jurisdiction?.usPersonsRestricted && !candidate.jurisdiction.requiredJurisdictionAckHash) {
    warn("jurisdiction.missingAck", "usPersonsRestricted is set but no jurisdiction ack hash is provided.");
  }

  // Fuses.
  for (const msg of validateFuses(candidate.fuses ?? [])) {
    err("fuse.invalid", msg);
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return { ready: errors.length === 0, issues, errors, warnings };
}
