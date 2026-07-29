/**
 * Terminal capability detection for the HISS CLI renderer.
 *
 * Pure and deterministic: every input (flags, env, TTY state, columns) is
 * passed in, so tests resolve capabilities with zero process globals. The
 * ONLY place that reads `process.*` is `context.ts` (which calls
 * {@link resolveCapabilities} with the real environment). See
 * `docs/cli/OUTPUT_CONTRACT.md` §3 for the normative precedence rules.
 */

export type RenderMode = "human" | "json" | "plain";
export type Verbosity = "quiet" | "normal" | "verbose";

/** Color capability tier: 0 none · 1 basic-16 · 2 ansi-256 · 3 truecolor. */
export type ColorLevel = 0 | 1 | 2 | 3;

export type WhenFlag = "auto" | "always" | "never";

/** Raw, pre-resolution inputs — everything the resolver needs, nothing global. */
export interface CapabilityInput {
  /** `--json` shorthand (highest mode precedence). */
  jsonFlag?: boolean;
  /** `--output <mode>` explicit selection. */
  outputFlag?: RenderMode | undefined;
  /** `--plain` shorthand. */
  plainFlag?: boolean;
  /** `--color auto|always|never`. */
  colorFlag?: WhenFlag | undefined;
  /** `--unicode auto|always|never`. */
  unicodeFlag?: WhenFlag | undefined;
  /** `--quiet`. */
  quiet?: boolean;
  /** `--verbose`. */
  verbose?: boolean;
  /** Process environment (injected). */
  env: Record<string, string | undefined>;
  /** Whether stdout is a TTY. */
  stdoutIsTTY: boolean;
  /** Whether stderr is a TTY. */
  stderrIsTTY: boolean;
  /** Terminal columns, if known (usually `process.stdout.columns`). */
  columns?: number | undefined;
}

export interface ResolvedCapabilities {
  mode: RenderMode;
  color: boolean;
  colorLevel: ColorLevel;
  unicode: boolean;
  width: number;
  verbosity: Verbosity;
  /** stdout AND stderr are TTYs — the precondition for spinners/progress. */
  interactive: boolean;
  /** Reduced-motion requested (NO_MOTION / REDUCE_MOTION) — suppresses animation. */
  reducedMotion: boolean;
}

const DEFAULT_WIDTH = 80;
const MIN_WIDTH = 20;

/** Mode precedence (OUTPUT_CONTRACT §3): json > --output > plain > env > default human. */
export function resolveMode(input: CapabilityInput): RenderMode {
  if (input.jsonFlag) return "json";
  if (input.outputFlag) return input.outputFlag;
  if (input.plainFlag) return "plain";
  const envOut = input.env.HISS_OUTPUT;
  if (envOut === "json" || envOut === "plain" || envOut === "human") return envOut;
  // Non-TTY never silently becomes JSON; it stays HUMAN (color/unicode fall
  // away below, yielding a clean machine-plain posture without changing mode).
  return "human";
}

function envColorLevel(env: Record<string, string | undefined>): ColorLevel {
  const colorterm = (env.COLORTERM ?? "").toLowerCase();
  if (colorterm.includes("truecolor") || colorterm.includes("24bit")) return 3;
  const term = (env.TERM ?? "").toLowerCase();
  if (term.includes("256")) return 2;
  return 1;
}

/** Color resolution (OUTPUT_CONTRACT §3) — precedence, highest wins. */
export function resolveColor(
  input: CapabilityInput,
  mode: RenderMode,
): { color: boolean; level: ColorLevel } {
  // Hard invariant: JSON and PLAIN never carry ANSI, under any flag.
  if (mode !== "human") return { color: false, level: 0 };

  if (input.colorFlag === "never") return { color: false, level: 0 };

  const env = input.env;
  const forceColor = env.FORCE_COLOR;

  if (input.colorFlag === "always") {
    // HUMAN only (already guaranteed by the mode check above).
    const level = forceColor ? forceLevel(forceColor) : envColorLevel(env);
    return { color: level > 0, level: level || 1 };
  }

  if (env.NO_COLOR !== undefined) return { color: false, level: 0 };

  // auto
  if (forceColor !== undefined) {
    const level = forceLevel(forceColor);
    return { color: level > 0, level };
  }
  if ((env.TERM ?? "").toLowerCase() === "dumb") return { color: false, level: 0 };
  if (!input.stdoutIsTTY) return { color: false, level: 0 };
  if (env.CI !== undefined) return { color: false, level: 0 };
  const level = envColorLevel(env);
  return { color: true, level };
}

function forceLevel(v: string): ColorLevel {
  const s = v.toLowerCase();
  if (s === "0" || s === "false") return 0;
  if (s === "3") return 3;
  if (s === "2") return 2;
  return 1; // "1", "true", anything truthy
}

/** Unicode resolution (OUTPUT_CONTRACT §3). PLAIN is always ASCII. */
export function resolveUnicode(input: CapabilityInput, mode: RenderMode): boolean {
  if (mode === "plain") return false;
  if (input.unicodeFlag === "never") return false;
  if (input.unicodeFlag === "always") return mode === "human";
  // auto
  const env = input.env;
  if ((env.TERM ?? "").toLowerCase() === "dumb") return false;
  const locale = `${env.LC_ALL ?? ""} ${env.LC_CTYPE ?? ""} ${env.LANG ?? ""}`.toLowerCase();
  const utf8 = locale.includes("utf-8") || locale.includes("utf8");
  if (utf8 && input.stdoutIsTTY) return true;
  return false;
}

export function resolveWidth(input: CapabilityInput): number {
  const fromCols = input.columns && input.columns > 0 ? input.columns : undefined;
  const fromEnv = input.env.COLUMNS ? Number(input.env.COLUMNS) : undefined;
  const raw = fromCols ?? (fromEnv && fromEnv > 0 ? fromEnv : undefined) ?? DEFAULT_WIDTH;
  return Math.max(MIN_WIDTH, Math.floor(raw));
}

export function resolveVerbosity(input: CapabilityInput): Verbosity {
  // `--quiet` trims stdout to the summary; it wins the enum so the sink knows
  // to trim. `--verbose` adds stderr diagnostics (Agent 3) and is reported via
  // the enum only when quiet is absent.
  if (input.quiet) return "quiet";
  if (input.verbose) return "verbose";
  return "normal";
}

function isReducedMotion(env: Record<string, string | undefined>): boolean {
  const flag = (v: string | undefined) => v !== undefined && v !== "0" && v.toLowerCase() !== "false";
  return flag(env.NO_MOTION) || flag(env.REDUCE_MOTION) || flag(env.HISS_NO_SPINNER);
}

/** Resolve every terminal capability from a single pure input. */
export function resolveCapabilities(input: CapabilityInput): ResolvedCapabilities {
  const mode = resolveMode(input);
  const { color, level } = resolveColor(input, mode);
  const unicode = resolveUnicode(input, mode);
  return {
    mode,
    color,
    colorLevel: level,
    unicode,
    width: resolveWidth(input),
    verbosity: resolveVerbosity(input),
    interactive: input.stdoutIsTTY && input.stderrIsTTY,
    reducedMotion: isReducedMotion(input.env),
  };
}
