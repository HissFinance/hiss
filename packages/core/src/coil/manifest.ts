// SPDX-License-Identifier: Apache-2.0
/**
 * CoilManifest — a structured, versioned trading thesis: an allocation core
 * plus policy, risk fuses, and triggers. Coils COMPILE into artifacts
 * (runbooks, execution capsules, share cards, receipts); HISS itself never
 * executes and never takes custody.
 *
 * The allocation core carries two symbol spaces that are never confused: the
 * on-chain token addresses (identity) and an explicit brokerage-ticker mapping
 * for agentic brokerage accounts. The core invariant is that allocation
 * weights sum to EXACTLY 10,000 basis points.
 */

import { hashCanonical } from "../receipts/canonical.js";
import { isAddress } from "../address/address.js";
import { validateFuses, type FuseSet } from "./fuses.js";

export const COIL_SCHEMA_VERSION = "coil-1.0.0";

/** Total allocation weight, in basis points. Weights must sum to this exactly. */
export const TOTAL_WEIGHT_BPS = 10_000;

/**
 * Execution modes, safest-first. The default is always `paper_only`; the
 * agentic mode requires an explicit user acknowledgment at compile time — a
 * mode string alone can never unlock live execution.
 */
export type ExecutionMode = "paper_only" | "preview_only" | "human_confirm" | "agentic_mcp_enabled";

export const DEFAULT_EXECUTION_MODE: ExecutionMode = "paper_only";

/** One holding in the allocation core, identified by its on-chain address. */
export type CoilAllocation = {
  /** Display ticker (human-facing only, never identity). */
  ticker: string;
  /** Canonical token address (identity). */
  tokenAddress: `0x${string}`;
  /** Weight in basis points; all weights sum to exactly 10,000. */
  weightBps: number;
  rationale?: string;
};

/** Explicit brokerage-side mapping for one holding (never a 0x address). */
export type BrokerSymbolMapping = {
  symbol: string;
  registryTicker: string;
  note?: string;
};

export type CoilTrigger =
  | { kind: "driftThreshold"; thresholdBps: number }
  | { kind: "schedule"; cadence: "daily" | "weekly" | "monthly"; note?: string }
  | { kind: "marketEvent"; description: string }
  | { kind: "manualReview"; note?: string };

export type CoilRebalancePolicy = {
  method: "drift" | "calendar" | "hybrid" | "manual";
  driftThresholdBps: number;
  minTradeUsd: number;
  maxSlippageBps: number;
};

export type CoilManifest = {
  schemaVersion: typeof COIL_SCHEMA_VERSION;
  coilId: string;
  slug: string;
  name: string;
  /** Monotonic version; bump on any content change. */
  version: number;
  /** The raw market idea this Coil was coiled from. */
  whisper: string;
  chainId: number;
  allocations: CoilAllocation[];
  /** Explicit brokerage-symbol mapping (agentic account side). */
  brokerSymbols: BrokerSymbolMapping[];
  rebalance: CoilRebalancePolicy;
  fuses: FuseSet;
  triggers: CoilTrigger[];
  executionMode: ExecutionMode;
  createdAt: string;
  updatedAt: string;
  forkOf?: string;
};

export type CoilIssue = { severity: "error" | "warning"; code: string; message: string };

const TICKER_PATTERN = /^[A-Z][A-Z0-9.]{0,9}$/;

/**
 * Validate the 10,000-bps allocation invariant plus per-allocation and
 * symbol-space rules. Returns { valid, issues }; `valid` is false if any
 * error-severity issue is present.
 */
export function validateCoil(
  coil: CoilManifest,
  options?: { forCapsule?: boolean },
): {
  valid: boolean;
  issues: CoilIssue[];
} {
  const issues: CoilIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  if (coil.schemaVersion !== COIL_SCHEMA_VERSION) err("COIL_SCHEMA", "Unsupported Coil schema version.");
  if (!coil.whisper?.trim()) err("WHISPER_REQUIRED", "A Coil records its originating whisper.");
  if (!coil.allocations || coil.allocations.length === 0) {
    err("NO_ALLOCATIONS", "A Coil needs at least one allocation.");
  }

  // The core invariant: weights sum to exactly 10,000 bps.
  const total = (coil.allocations ?? []).reduce((sum, a) => sum + a.weightBps, 0);
  if (total !== TOTAL_WEIGHT_BPS) {
    err("WEIGHTS_SUM", `Allocation weights must sum to exactly ${TOTAL_WEIGHT_BPS} bps; got ${total}.`);
  }

  const seen = new Set<string>();
  for (const alloc of coil.allocations ?? []) {
    if (!Number.isInteger(alloc.weightBps) || alloc.weightBps <= 0) {
      err("WEIGHT_INVALID", `${alloc.ticker}: weightBps must be a positive integer.`);
    }
    if (!isAddress(alloc.tokenAddress)) {
      err("ALLOCATION_ADDRESS", `${alloc.ticker}: tokenAddress must be a 0x token address (identity).`);
    } else {
      const key = alloc.tokenAddress.toLowerCase();
      if (seen.has(key)) err("DUPLICATE_ALLOCATION", `Duplicate token address ${alloc.tokenAddress}.`);
      seen.add(key);
    }
  }

  // Symbol-space guard: brokerage tickers are plain tickers, never addresses.
  for (const broker of coil.brokerSymbols ?? []) {
    if (broker.symbol.startsWith("0x") || broker.registryTicker.startsWith("0x")) {
      err(
        "SYMBOL_SPACE_CONFUSION",
        `Broker symbol "${broker.symbol}" is address-shaped — brokerage symbols are plain tickers.`,
      );
      continue;
    }
    if (!TICKER_PATTERN.test(broker.symbol)) {
      err("BROKER_SYMBOL_INVALID", `Broker symbol "${broker.symbol}" is not a valid ticker.`);
    }
  }

  for (const issue of validateFuses(coil.fuses ?? [], options?.forCapsule ?? false)) {
    err(issue.code, issue.message);
  }

  if (options?.forCapsule && coil.executionMode === "paper_only") {
    warn("MODE_PAPER_ONLY", "This Coil is paper_only — choose a non-paper mode before compiling a capsule.");
  }

  return { valid: issues.every((i) => i.severity !== "error"), issues };
}

/** Deterministic content hash of a Coil manifest. */
export function coilManifestHash(coil: CoilManifest): string {
  return hashCanonical(coil);
}
