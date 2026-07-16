// SPDX-License-Identifier: Apache-2.0
/**
 * ActionPlan — a compiled, reviewable set of would-be steps produced from a
 * Coil or vault rebalance intent.
 *
 * An ActionPlan is ALWAYS a plan: it describes what a user's own agent or the
 * user's own wallet would do. It has no "sent" or "executed" state — those
 * belong to an {@link ExecutionReceipt} the caller records after observing an
 * on-chain result. Every order step is a preview bounded by the source Coil's
 * fuses.
 */

import { hashCanonical } from "../receipts/canonical.js";

export const ACTION_PLAN_VERSION = "action-plan-1.0.0";

export type ActionStepKind = "order_preview" | "rebalance_leg" | "deposit_intent" | "withdraw_intent";

export type OrderSide = "buy" | "sell";

/** One step of a plan. Every step is a preview; nothing here is sent. */
export type ActionStep = {
  kind: ActionStepKind;
  /** Instrument the step targets: a plain ticker OR a 0x token address. */
  instrument: string;
  side: OrderSide;
  /** Optional notional (USD or base-asset units, disclosed by `unit`). */
  amount?: string;
  unit?: "usd" | "usdg_base_units" | "token_base_units";
  /** The fuse checks this step was validated against. */
  fuseChecks: string[];
  /** Conditions that abort the step at execution time. */
  abortConditions: string[];
  reason: string;
};

export type ActionPlan = {
  planVersion: typeof ACTION_PLAN_VERSION;
  planId: string;
  /** Content hash of the source manifest (Coil or vault) this plan compiled from. */
  sourceManifestHash: string;
  chainId: number;
  /** Plans are advisory previews — never a live execution instruction on their own. */
  executionMode: "paper_only" | "preview_only" | "human_confirm" | "agentic_mcp_enabled";
  steps: ActionStep[];
  createdAt: string;
  /** Content hash of the plan payload (excluding this field). */
  planHash?: string;
};

export type ActionPlanIssue = { code: string; message: string };

/** Validate an ActionPlan. Empty result = valid. */
export function validateActionPlan(plan: ActionPlan): ActionPlanIssue[] {
  const issues: ActionPlanIssue[] = [];
  if (plan.planVersion !== ACTION_PLAN_VERSION) {
    issues.push({ code: "PLAN_VERSION", message: `planVersion must be "${ACTION_PLAN_VERSION}".` });
  }
  if (!plan.sourceManifestHash) {
    issues.push({
      code: "SOURCE_HASH",
      message: "sourceManifestHash is required (plans derive from a manifest).",
    });
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    issues.push({ code: "NO_STEPS", message: "An ActionPlan needs at least one step." });
  }
  for (const step of plan.steps ?? []) {
    if (!step.instrument) issues.push({ code: "STEP_INSTRUMENT", message: "Each step needs an instrument." });
    if (step.fuseChecks.length === 0) {
      issues.push({
        code: "STEP_UNGUARDED",
        message: `Step for "${step.instrument}" has no fuse checks — every step is fuse-bounded.`,
      });
    }
  }
  return issues;
}

/** The hashed payload: the plan minus its own hash field. */
export function actionPlanHashPayload(plan: ActionPlan): Omit<ActionPlan, "planHash"> {
  const { planHash: _omit, ...payload } = plan;
  return payload;
}

/** Compute the deterministic content hash of an ActionPlan. */
export function computeActionPlanHash(plan: ActionPlan): string {
  return hashCanonical(actionPlanHashPayload(plan));
}
