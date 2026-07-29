/**
 * Exit-code taxonomy (OUTPUT_CONTRACT §6/§16).
 *
 * The stable process-exit set for the `hiss` CLI. Before this module the CLI
 * emitted only `0` (any rendered result, INCLUDING business INVALID/FAILED)
 * and `1` (any thrown error). That collapsed every fail-closed business outcome
 * into a success code — a caller could not tell VALID from INVALID by exit
 * status. This taxonomy fixes that:
 *
 *   0 success        — affirmative result (VALID / VERIFIED / prepared / read OK)
 *   1 general        — uncaught fault, guard trip, unknown internal error
 *   2 usage          — usage error, malformed input, credential-shaped field
 *   3 config         — missing/invalid rpc-url or chain-id, missing input FILE
 *   4 network        — RPC/SDK/hosted-endpoint failure, timeout, degraded read
 *   5 policy         — fail-closed REFUSAL to prepare/compile (rule/fuse block)
 *   6 verification   — a verification that RAN and returned not-valid
 *   7 partial        — outcome could not be fully determined (unknown/partial)
 *
 * MIGRATION / BEHAVIOR CHANGE (regression-guarded by Agent 4): business
 * fail-closed *results* — `vault validate` INVALID, `coil validate` INVALID,
 * `coil compile` refusal, `receipt verify` FAILED, `vault prepare-create`
 * refusal, `skill print` not-found — used to exit `0`. They now carry the
 * non-zero code below via `CommandResult.exitCode` (the rendered human/JSON
 * text is UNCHANGED; only the process exit code moves). Errors that used to be
 * `1` (missing file, bad JSON, credential reject, SDK/RPC failure, usage) are
 * likewise reclassified. Nothing is collapsed to `1`.
 */

import { CredentialRejectedError } from "./credentials.js";
import { ExecutionClaimError } from "./guard.js";

/** The stable exit-code set. */
export const EXIT = {
  SUCCESS: 0,
  GENERAL: 1,
  USAGE: 2,
  CONFIG: 3,
  NETWORK: 4,
  POLICY: 5,
  VERIFICATION: 6,
  PARTIAL: 7,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export type ExitKind =
  "success" | "general" | "usage" | "config" | "network" | "policy" | "verification" | "partial";

const KIND_BY_CODE: Record<ExitCode, ExitKind> = {
  0: "success",
  1: "general",
  2: "usage",
  3: "config",
  4: "network",
  5: "policy",
  6: "verification",
  7: "partial",
};

export function kindForCode(code: number): ExitKind {
  return KIND_BY_CODE[code as ExitCode] ?? "general";
}

/**
 * A typed CLI error carrying its own exit code + taxonomy kind. Handlers throw
 * this when they want an explicit code; `runCli` reads it. Business fail-closed
 * *results* (that render normally without throwing) should instead set
 * `CommandResult.exitCode` so the human/JSON output is preserved.
 */
export class HissCliError extends Error {
  readonly code: ExitCode;
  readonly kind: ExitKind;
  constructor(message: string, code: ExitCode, kind?: ExitKind) {
    super(message);
    this.name = "HissCliError";
    this.code = code;
    this.kind = kind ?? kindForCode(code);
  }
}

/** Shape a fatal error is reduced to before rendering (§4 error envelope). */
export interface ClassifiedError {
  code: ExitCode;
  kind: ExitKind;
  message: string;
}

const NETWORKISH =
  /\b(network|timeout|timed out|fetch failed|econnrefused|econnreset|enotfound|eai_again|socket|rpc|does not implement|degraded|getaddrinfo|und_err)\b/i;

/**
 * Classify a THROWN error into an exit code + kind + message (OUTPUT_CONTRACT
 * §6). Precedence:
 *   - {@link HissCliError} carries its own code (highest).
 *   - Credential-shaped field → 2 (usage/bad-input).
 *   - Missing/unreadable input file (ENOENT/EISDIR/EACCES) → 3 (config).
 *   - Malformed JSON (SyntaxError) → 2 (usage/bad-input).
 *   - Execution-claim guard trip → 1 (internal fault, never a silent downgrade).
 *   - Network / SDK-not-implemented / degraded → 4.
 *   - Anything else → 1 (general).
 */
export function classifyThrown(err: unknown): ClassifiedError {
  if (err instanceof HissCliError) {
    return { code: err.code, kind: err.kind, message: err.message };
  }
  if (err instanceof CredentialRejectedError) {
    return { code: EXIT.USAGE, kind: "usage", message: err.message };
  }
  if (err instanceof ExecutionClaimError) {
    // A guard trip is an INTERNAL fault (we tried to print a falsehood), never
    // a silent downgrade of the requested output.
    return { code: EXIT.GENERAL, kind: "general", message: err.message };
  }
  const e = err as { code?: string; message?: string; name?: string };
  const message = e?.message ?? String(err);
  if (e?.code === "ENOENT" || e?.code === "EISDIR" || e?.code === "EACCES") {
    return { code: EXIT.CONFIG, kind: "config", message };
  }
  if (err instanceof SyntaxError) {
    return { code: EXIT.USAGE, kind: "usage", message };
  }
  if (NETWORKISH.test(message)) {
    return { code: EXIT.NETWORK, kind: "network", message };
  }
  return { code: EXIT.GENERAL, kind: "general", message };
}

/**
 * Commander error `.code` values that are NOT failures — help/version
 * short-circuits. These map to exit 0 with no error render.
 */
export function isCommanderSuccessShortCircuit(code: string | undefined): boolean {
  return code === "commander.helpDisplayed" || code === "commander.version" || code === "commander.help";
}

/**
 * Classify a commander error. Every commander USAGE error (unknown command,
 * missing/excess argument, unknown/invalid option) maps to exit 2 — overriding
 * commander's own default of 1 — so bad invocation is distinguishable from a
 * runtime fault.
 */
export function classifyCommanderError(err: { code?: string; message?: string }): ClassifiedError {
  return {
    code: EXIT.USAGE,
    kind: "usage",
    message: (err.message ?? "usage error").replace(/^error:\s*/i, ""),
  };
}
