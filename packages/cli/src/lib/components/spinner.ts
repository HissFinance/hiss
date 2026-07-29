/**
 * SPINNER (task §14): a live indeterminate indicator for genuinely long reads.
 *
 * HARD RULES:
 *  - stderr ONLY, and ONLY when mode is HUMAN, both streams are TTYs, and
 *    reduced-motion is not requested. Otherwise it is inert (no animation, no
 *    output to stdout ever) — so JSON/PLAIN/non-TTY/CI stay pristine.
 *  - Auto-removed on completion; `stop()` clears the line so nothing orphans,
 *    even on an exception path (call it in a finally).
 *  - Never a fake percentage — it is indeterminate by design.
 */

import type { OutputContext } from "../context.js";

export interface Spinner {
  update(text: string): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  /** Stop and clear the line. Safe to call multiple times. */
  stop(): void;
}

const UNICODE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const ASCII_FRAMES = ["-", "\\", "|", "/"];

/** A spinner that does nothing (non-interactive / machine / reduced-motion). */
function inertSpinner(): Spinner {
  return { update() {}, succeed() {}, fail() {}, stop() {} };
}

export function createSpinner(ctx: OutputContext, initial: string): Spinner {
  const active = ctx.mode === "human" && ctx.interactive && !ctx.reducedMotion;
  if (!active) return inertSpinner();

  const frames = ctx.unicode ? UNICODE_FRAMES : ASCII_FRAMES;
  // Carriage-return + ANSI erase-whole-line (CSI 2K).
  const CLEAR = "\r\u001B[2K";
  let text = initial;
  let i = 0;
  let stopped = false;

  const clearLine = () => ctx.stderr(CLEAR);
  const draw = () => {
    const frame = ctx.theme.brand(frames[i % frames.length] ?? "");
    ctx.stderr(`${CLEAR}${frame} ${ctx.redact(text)}`);
    i += 1;
  };

  const timer = setInterval(draw, 90);
  if (typeof timer.unref === "function") timer.unref();
  draw();

  const finish = (glyph: string, final?: string) => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    clearLine();
    if (final) ctx.stderr(`${glyph} ${ctx.redact(final)}\n`);
  };

  return {
    update(next: string) {
      text = next;
    },
    succeed(final?: string) {
      finish(ctx.symbols("ok"), final ?? text);
    },
    fail(final?: string) {
      finish(ctx.symbols("err"), final ?? text);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      clearLine();
    },
  };
}
