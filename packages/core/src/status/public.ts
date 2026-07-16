// SPDX-License-Identifier: Apache-2.0
/**
 * Public status types + evidence-precedence rules.
 *
 * A status claim needs proof. A failed read is "unknown" — never "live" and
 * never "not_deployed". A negative claim ("not deployed") requires affirmative
 * evidence (e.g. a no-bytecode read). Degraded reads surface the last verified
 * state, labeled. These types encode that discipline.
 */

/**
 * live         — affirmatively verified present/active by a fresh read.
 * deployment_pending — intentionally not yet activated (a positive design state).
 * not_deployed — affirmatively verified absent (e.g. no bytecode at address).
 * degraded     — last verified state shown; the current read failed.
 * unknown      — the read failed and there is no prior verified state.
 */
export type StatusLevel = "live" | "deployment_pending" | "not_deployed" | "degraded" | "unknown";

export const STATUS_LEVELS: readonly StatusLevel[] = [
  "live",
  "deployment_pending",
  "not_deployed",
  "degraded",
  "unknown",
];

export type EvidenceKind =
  "fresh_chain_read" | "committed_artifact" | "no_bytecode_read" | "typed_constant" | "none";

/** A single status claim with the evidence backing it. */
export type PublicStatus = {
  subject: string;
  level: StatusLevel;
  evidence: EvidenceKind;
  /** ISO timestamp of the read/artifact this status derives from, if any. */
  observedAt?: string;
  /** For "degraded": the last verified level being surfaced. */
  lastVerifiedLevel?: StatusLevel;
  detail?: string;
};

/**
 * Resolve a status fail-closed: a positive claim requires positive evidence; a
 * "not_deployed" claim requires affirmative absence evidence; missing evidence
 * collapses to "unknown".
 */
export function resolveStatus(input: {
  subject: string;
  requestedLevel: StatusLevel;
  evidence: EvidenceKind;
  observedAt?: string;
  lastVerifiedLevel?: StatusLevel;
  detail?: string;
}): PublicStatus {
  const positive = input.requestedLevel === "live";
  const negative = input.requestedLevel === "not_deployed";

  let level = input.requestedLevel;
  if (positive && input.evidence !== "fresh_chain_read" && input.evidence !== "committed_artifact") {
    level = "unknown";
  }
  if (negative && input.evidence !== "no_bytecode_read") {
    level = "unknown";
  }

  return {
    subject: input.subject,
    level,
    evidence: input.evidence,
    observedAt: input.observedAt,
    lastVerifiedLevel: input.lastVerifiedLevel,
    detail: input.detail,
  };
}
