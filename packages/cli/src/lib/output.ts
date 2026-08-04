/**
 * Output sink for the HISS CLI — the SINGLE place a {@link CommandResult}
 * becomes bytes. Routes every result through the context-aware renderer across
 * three modes (OUTPUT_CONTRACT §1):
 *
 *  - HUMAN  — semantic color, Unicode, width-aware components (rich `view`
 *             blocks when a handler opts in, else `summary` + indented detail).
 *  - JSON   — a stable envelope (§2), canonical bigint-as-string serialization,
 *             stdout is valid JSON and NOTHING else; no ANSI under any flag.
 *  - PLAIN  — ASCII, no ANSI, stable labels (`summary` + detail) for logs,
 *             screen readers, and dumb terminals.
 *
 * Every human/plain string (summary + detail + view-derived lines + warnings)
 * passes through the execution-claim guard and the redaction hook before it is
 * written. Diagnostics/warnings go to stderr; stdout carries only the result.
 *
 * BACKWARD COMPATIBILITY: the legacy `render(result, mode, printer)` signature
 * is preserved as a thin shim so existing wiring keeps compiling and working
 * while Agent 3 migrates `cli.ts` to {@link renderResult} + an OutputContext.
 */

import { assertNoExecutionClaim } from "./guard.js";
import { buildContext, type OutputContext } from "./context.js";
import type { ViewBlock } from "./view.js";
import { renderBlocks } from "./render.js";
import { serializeJson, asciiFold } from "./format.js";
import { stripAnsi } from "./width.js";
import { redactDeep } from "./redact.js";

/** Legacy 3-value mode (mode ⊕ verbosity are separated in the new context). */
export type OutputMode = "human" | "json" | "quiet";

export interface CommandResult {
  /** One-line, guard-checked human summary. */
  summary: string;
  /** Structured payload (serialized under `data` in --json). */
  data: unknown;
  /** Optional extra human lines (each guard-checked) — the PLAIN/fallback body. */
  detail?: string[];
  /** True when this result verifies a real on-chain receipt (relaxes guard). */
  receiptVerified?: boolean;
  /**
   * Optional rich, declarative view (HUMAN mode). When present, the renderer
   * uses these components instead of `detail`. Data-only — no color/width logic
   * (that stays in the renderer), so handlers remain pure.
   */
  view?: ViewBlock[];
  /** Non-fatal warnings — routed to stderr, never into stdout JSON. */
  warnings?: string[];
  /** Optional exit-code signal for fail-closed results (Agent 3 exit taxonomy). */
  exitCode?: number;
}

/** Envelope metadata supplied by the caller (Agent 3) when it has it. */
export interface RenderMeta {
  /** Canonical command path, e.g. "vault validate". */
  command?: string;
  cliVersion?: string;
  /** Explicit success flag; defaults to `code === 0`. */
  ok?: boolean;
  /** Process exit code (§6); defaults to `result.exitCode ?? 0`. */
  code?: number;
  /** Warnings to surface (overrides `result.warnings`). */
  warnings?: string[];
}

export interface Printer {
  out: (line: string) => void;
  err: (line: string) => void;
}

export const consolePrinter: Printer = {
  out: (line) => process.stdout.write(line + "\n"),
  err: (line) => process.stderr.write(line + "\n"),
};

const DEFAULT_CLI_VERSION = "0.2.2";

/** The stable JSON envelope (§2). Keys are canonicalized by the serializer. */
export interface JsonEnvelope {
  ok: boolean;
  code: number;
  command?: string;
  cliVersion: string;
  summary: string;
  data: unknown;
  warnings?: string[];
}

function resolveWarnings(result: CommandResult, meta?: RenderMeta): string[] {
  return meta?.warnings ?? result.warnings ?? [];
}

/** Build the JSON envelope for a result. */
export function buildEnvelope(result: CommandResult, meta?: RenderMeta): JsonEnvelope {
  const code = meta?.code ?? result.exitCode ?? 0;
  const ok = meta?.ok ?? code === 0;
  const warnings = resolveWarnings(result, meta);
  const env: JsonEnvelope = {
    ok,
    code,
    cliVersion: meta?.cliVersion ?? DEFAULT_CLI_VERSION,
    summary: result.summary,
    data: result.data,
  };
  if (meta?.command) env.command = meta.command;
  if (warnings.length) env.warnings = warnings;
  return env;
}

function guardPlain(text: string, receiptVerified: boolean): void {
  assertNoExecutionClaim(stripAnsi(text), { receiptVerified });
}

/**
 * Render a result through an OutputContext. The primary sink for Agent 3.
 */
export function renderResult(result: CommandResult, ctx: OutputContext, meta?: RenderMeta): void {
  const receiptVerified = result.receiptVerified === true;
  const warnings = resolveWarnings(result, meta);

  if (ctx.mode === "json") {
    // Guard the human-facing summary/warnings even in JSON (a trip is an
    // internal fault → the throw keeps stdout empty). The `data` payload is
    // machine-readable and the MOST likely to be piped to a log, so deep-redact
    // its string values with the same redactor used for human output — a
    // credential embedded in e.g. an RPC-URL (`--rpc-url scheme://user:pass@…`)
    // must never leak just because the caller asked for JSON.
    guardPlain(result.summary, receiptVerified);
    for (const w of warnings) guardPlain(w, receiptVerified);
    const env = buildEnvelope(result, meta);
    env.data = redactDeep(env.data, ctx.redact);
    ctx.stdout(serializeJson(env) + "\n");
    return;
  }

  const lines: string[] = [];
  // PLAIN mode is strict ASCII: fold any Unicode from copy/components (§1).
  const shape = (s: string) => (ctx.mode === "plain" ? asciiFold(s) : s);
  const push = (text: string, indent = "") => {
    guardPlain(text, receiptVerified);
    lines.push(shape(ctx.redact(indent ? indent + text : text)));
  };

  push(result.summary);

  if (ctx.verbosity !== "quiet") {
    // HUMAN with an opted-in rich view uses components; PLAIN and the fallback
    // path use the stable `detail` lines (indented, label-based).
    if (ctx.mode === "human" && result.view && result.view.length > 0) {
      for (const line of renderBlocks(ctx, result.view)) push(line);
    } else {
      for (const d of result.detail ?? []) push(d, "  ");
    }
  }

  if (lines.length > 0) ctx.stdout(lines.join("\n") + "\n");

  // Warnings are diagnostics → stderr, never stdout (§4).
  for (const w of warnings) {
    guardPlain(w, receiptVerified);
    ctx.stderr(shape(`${ctx.symbols("warn")} ${ctx.redact(w)}`) + "\n");
  }
}

// ---- error envelope (for the fatal path; Agent 3 wires cli.ts/bin) -----------

export interface CliError {
  /** Exit code (§6). */
  code: number;
  /** Human message (guard-checked, redacted). */
  message: string;
  /** Taxonomy kind, e.g. "usage" | "config" | "network" | "policy". */
  kind?: string;
}

/**
 * Render a fatal error. In JSON mode a `{ok:false,...}` envelope is written to
 * STDERR (stdout stays empty, so "stdout is valid JSON or empty" holds); in
 * HUMAN/PLAIN a `hiss: <message>` line goes to stderr. Never writes stdout.
 */
export function renderErrorResult(error: CliError, ctx: OutputContext, meta?: RenderMeta): void {
  const message = ctx.redact(error.message);
  if (ctx.mode === "json") {
    const env = {
      ok: false,
      code: error.code,
      ...(meta?.command ? { command: meta.command } : {}),
      cliVersion: meta?.cliVersion ?? DEFAULT_CLI_VERSION,
      error: { code: error.code, message, kind: error.kind ?? "error" },
    };
    ctx.stderr(serializeJson(env) + "\n");
    return;
  }
  const line = `hiss: ${message}`;
  ctx.stderr((ctx.mode === "plain" ? asciiFold(line) : line) + "\n");
}

// ---- legacy shim -------------------------------------------------------------

function legacyContext(mode: OutputMode, printer: Printer): OutputContext {
  const toLines = (write: (line: string) => void) => (chunk: string) => {
    const body = chunk.endsWith("\n") ? chunk.slice(0, -1) : chunk;
    for (const line of body.split("\n")) write(line);
  };
  return buildContext({
    jsonFlag: mode === "json",
    quiet: mode === "quiet",
    env: process.env,
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    stderrIsTTY: Boolean(process.stderr.isTTY),
    columns: process.stdout.columns,
    stdout: toLines(printer.out),
    stderr: toLines(printer.err),
  });
}

/**
 * Legacy entry point. Preserved so current wiring compiles/works unchanged;
 * routes through {@link renderResult}. JSON now emits the stable envelope (§2).
 * New code should call {@link renderResult} with an explicit OutputContext.
 */
export function render(result: CommandResult, mode: OutputMode, printer: Printer = consolePrinter): void {
  renderResult(result, legacyContext(mode, printer));
}
