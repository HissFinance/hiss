/**
 * The OutputContext (OUTPUT_CONTRACT §8) — the single source of terminal
 * truth. Built ONCE (in `cli.ts` by Agent 3) from resolved flags + env +
 * capability detection, then passed to the renderer and any handler that needs
 * width/verbosity. No component reads `process.*` independently; everything is
 * injectable so tests are fully deterministic.
 */

import {
  resolveCapabilities,
  type CapabilityInput,
  type ColorLevel,
  type RenderMode,
  type Verbosity,
} from "./capabilities.js";
import { makeTheme, type Theme } from "./theme.js";
import { makeSymbols, type SymbolSet } from "./symbols.js";
import { redact as defaultRedact } from "./redact.js";

export type { RenderMode, Verbosity, ColorLevel } from "./capabilities.js";

export interface OutputContext {
  readonly mode: RenderMode;
  /** Resolved color on/off (§3). */
  readonly color: boolean;
  /** Additive: color capability tier (0 none · 1 basic · 2 256 · 3 truecolor). */
  readonly colorLevel: ColorLevel;
  /** Resolved Unicode/box-drawing capability (§3). */
  readonly unicode: boolean;
  /** Resolved terminal columns (fallback 80). */
  readonly width: number;
  readonly verbosity: Verbosity;
  /** stdout AND stderr are TTYs — precondition for spinners/progress. */
  readonly interactive: boolean;
  /** Additive: reduced-motion requested — suppress animation. */
  readonly reducedMotion: boolean;
  /** Primary-output writer (never the raw stream). */
  readonly stdout: (chunk: string) => void;
  /** Diagnostics/progress/error writer. */
  readonly stderr: (chunk: string) => void;
  /** Injectable clock for reproducible timestamps. */
  readonly clock: () => Date;
  /** Redaction policy hook, applied before rendering (defense-in-depth). */
  readonly redact: (s: string) => string;
  /** Additive: semantic theme bound to the resolved color capability. */
  readonly theme: Theme;
  /** Additive: symbol resolver bound to the resolved Unicode capability. */
  readonly symbols: SymbolSet;
}

export interface BuildContextInput extends CapabilityInput {
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
  clock?: () => Date;
  redact?: (s: string) => string;
}

/**
 * Build an OutputContext from resolved flags + environment. Streams/clock/
 * redact default to process-backed writers but are fully overridable for tests.
 */
export function buildContext(input: BuildContextInput): OutputContext {
  const caps = resolveCapabilities(input);
  return {
    mode: caps.mode,
    color: caps.color,
    colorLevel: caps.colorLevel,
    unicode: caps.unicode,
    width: caps.width,
    verbosity: caps.verbosity,
    interactive: caps.interactive,
    reducedMotion: caps.reducedMotion,
    stdout: input.stdout ?? ((chunk) => process.stdout.write(chunk)),
    stderr: input.stderr ?? ((chunk) => process.stderr.write(chunk)),
    clock: input.clock ?? (() => new Date()),
    redact: input.redact ?? defaultRedact,
    theme: makeTheme({ color: caps.color, colorLevel: caps.colorLevel }),
    symbols: makeSymbols(caps.unicode),
  };
}

/**
 * Build the real process-backed context. The ONE place that reads
 * `process.env` / `process.stdout.isTTY` / columns for capability resolution.
 */
export function buildProcessContext(flags: {
  jsonFlag?: boolean;
  outputFlag?: RenderMode;
  plainFlag?: boolean;
  colorFlag?: "auto" | "always" | "never";
  unicodeFlag?: "auto" | "always" | "never";
  quiet?: boolean;
  verbose?: boolean;
}): OutputContext {
  return buildContext({
    ...flags,
    env: process.env,
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    stderrIsTTY: Boolean(process.stderr.isTTY),
    columns: process.stdout.columns,
  });
}

/**
 * Convenience for tests: a fully deterministic context (fixed width, color off,
 * frozen clock, capturing writers). Override any field.
 */
export function testContext(overrides: Partial<OutputContext> = {}): OutputContext {
  const base = buildContext({
    env: {},
    stdoutIsTTY: false,
    stderrIsTTY: false,
    columns: 80,
    clock: () => new Date("2026-01-01T00:00:00.000Z"),
  });
  const color = overrides.color ?? base.color;
  const colorLevel = overrides.colorLevel ?? base.colorLevel;
  const unicode = overrides.unicode ?? base.unicode;
  return {
    ...base,
    ...overrides,
    theme: overrides.theme ?? makeTheme({ color, colorLevel }),
    symbols: overrides.symbols ?? makeSymbols(unicode),
  };
}
