/**
 * ActionPlan construction and the deterministic plan hash.
 *
 * A plan hash is keccak256 over the EXECUTION-relevant fields of the plan
 * (chain, target, function, calldata, value) serialized in canonical form.
 * It deliberately excludes advisory fields (summary, warnings, expiry) so the
 * same call always hashes the same way, independent of when it was built.
 */

import { keccak256, toBytes, type Hex } from "viem";
import type { ActionPlan } from "./types";
import { isSupportedChainId } from "./constants";

/** Recursively sort object keys so serialization is stable. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
  }
  return value;
}

/** The execution-relevant projection a plan hash is computed over. */
export function planHashPayload(
  plan: Pick<ActionPlan, "chainId" | "target" | "function" | "calldata" | "value">,
): string {
  return canonicalJson({
    chainId: plan.chainId,
    target: plan.target.toLowerCase(),
    function: plan.function,
    calldata: plan.calldata.toLowerCase(),
    value: plan.value,
  });
}

/** keccak256 of the canonical execution payload. */
export function computePlanHash(
  plan: Pick<ActionPlan, "chainId" | "target" | "function" | "calldata" | "value">,
): Hex {
  return keccak256(toBytes(planHashPayload(plan)));
}

/** Fields a caller supplies; the plan hash is filled in for them. */
export interface BuildActionPlanInput {
  chainId: number;
  target: `0x${string}`;
  function: string;
  decodedArgs: Record<string, string>;
  calldata: Hex;
  value?: string;
  summary: string;
  warnings?: string[];
  requiredAcknowledgments?: string[];
  expiry?: string | null;
}

/**
 * Assemble a complete {@link ActionPlan}, computing its plan hash. Throws
 * (fail-closed) if the target chain is not a supported HISS chain — the SDK
 * will never hand back a plan aimed at the wrong chain.
 */
export function buildActionPlan(input: BuildActionPlanInput): ActionPlan {
  if (!isSupportedChainId(input.chainId)) {
    throw new Error(
      `buildActionPlan: unsupported chainId ${input.chainId} — HISS actions target Robinhood Chain (4663 / 46630) only`,
    );
  }

  const base = {
    chainId: input.chainId,
    target: input.target,
    function: input.function,
    calldata: input.calldata,
    value: input.value ?? "0",
  };

  return {
    ...base,
    decodedArgs: input.decodedArgs,
    summary: input.summary,
    warnings: input.warnings ?? [],
    requiredAcknowledgments: input.requiredAcknowledgments ?? [],
    planHash: computePlanHash(base),
    expiry: input.expiry ?? null,
  };
}
