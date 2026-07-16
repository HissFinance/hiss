/**
 * Output rendering for three modes: human (default), --json, --quiet.
 * Every command produces a {@link CommandResult}; the renderer decides how to
 * present it. All human text is passed through the execution-claim guard.
 */

import { assertNoExecutionClaim } from "./guard.js";

export type OutputMode = "human" | "json" | "quiet";

export interface CommandResult {
  /** One-line, guard-checked human summary. */
  summary: string;
  /** Structured payload (printed verbatim in --json). */
  data: unknown;
  /** Optional extra human lines (each guard-checked). */
  detail?: string[];
  /** True when this result verifies a real on-chain receipt (relaxes guard). */
  receiptVerified?: boolean;
}

export interface Printer {
  out: (line: string) => void;
  err: (line: string) => void;
}

export const consolePrinter: Printer = {
  out: (line) => process.stdout.write(line + "\n"),
  err: (line) => process.stderr.write(line + "\n"),
};

/** Render a result according to `mode`, guarding all human-facing strings. */
export function render(result: CommandResult, mode: OutputMode, printer: Printer = consolePrinter): void {
  const opts = { receiptVerified: result.receiptVerified === true };

  if (mode === "json") {
    printer.out(JSON.stringify(result.data, null, 2));
    return;
  }

  assertNoExecutionClaim(result.summary, opts);
  for (const line of result.detail ?? []) assertNoExecutionClaim(line, opts);

  if (mode === "quiet") {
    printer.out(result.summary);
    return;
  }

  printer.out(result.summary);
  for (const line of result.detail ?? []) printer.out("  " + line);
}
