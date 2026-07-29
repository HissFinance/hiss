/**
 * §24.5 — stdout / stderr separation.
 *   - JSON stdout is valid JSON and NOTHING else; diagnostics go to stderr.
 *   - HUMAN warnings route to stderr; stdout carries only the result body.
 *   - A spinner NEVER writes stdout, is inert in JSON/PLAIN/non-TTY/reduced-
 *     motion, and leaves no orphan after stop()/an exception.
 */

import { describe, it, expect } from "vitest";
import { renderResult, type CommandResult } from "../src/lib/output.js";
import { createSpinner } from "../src/lib/components/spinner.js";
import { statusCommand } from "../src/commands/status.js";
import { mockClient, capture } from "./_helpers.js";

const withWarning: CommandResult = {
  summary: "Reward status read.",
  data: { funded: false },
  detail: ["planned then funded then claimable"],
  warnings: ["planned is not funded is not claimable"],
  exitCode: 0,
};

describe("§24.5 stdout carries only the primary output", () => {
  it("JSON: stdout is parseable JSON, stderr is empty", async () => {
    const result = await statusCommand(mockClient());
    const cap = capture({ mode: "json" });
    renderResult(result, cap.ctx, { command: "status", cliVersion: "0.2.0" });
    expect(() => JSON.parse(cap.out())).not.toThrow();
    expect(cap.err()).toBe("");
  });

  it("JSON: a warning lands inside the envelope, never as a stderr side-channel", () => {
    const cap = capture({ mode: "json" });
    renderResult(withWarning, cap.ctx, { command: "rewards status" });
    const env = JSON.parse(cap.out());
    expect(env.warnings).toEqual(["planned is not funded is not claimable"]);
    expect(cap.err()).toBe("");
  });

  it("HUMAN: warnings go to stderr; stdout has only the result body", () => {
    const cap = capture({ mode: "human", color: false });
    renderResult(withWarning, cap.ctx);
    expect(cap.out()).toContain("Reward status read.");
    expect(cap.out()).not.toContain("planned is not funded");
    expect(cap.err()).toContain("planned is not funded is not claimable");
  });
});

describe("§24.5 spinner discipline", () => {
  it("is INERT in JSON mode (no stdout, no stderr)", () => {
    const cap = capture({ mode: "json", interactive: true });
    const sp = createSpinner(cap.ctx, "loading");
    sp.stop();
    expect(cap.out()).toBe("");
    expect(cap.err()).toBe("");
  });

  it("is INERT when non-interactive (piped)", () => {
    const cap = capture({ mode: "human", interactive: false });
    const sp = createSpinner(cap.ctx, "loading");
    sp.stop();
    expect(cap.out()).toBe("");
    expect(cap.err()).toBe("");
  });

  it("is INERT under reduced motion", () => {
    const cap = capture({ mode: "human", interactive: true, reducedMotion: true });
    const sp = createSpinner(cap.ctx, "loading");
    sp.stop();
    expect(cap.err()).toBe("");
  });

  it("when ACTIVE it draws to stderr ONLY, never stdout", () => {
    const cap = capture({ mode: "human", interactive: true, unicode: true, color: true });
    const sp = createSpinner(cap.ctx, "reading chain");
    // Drew at least the initial frame to stderr.
    expect(cap.err().length).toBeGreaterThan(0);
    expect(cap.out()).toBe("");
    sp.stop();
    expect(cap.out()).toBe(""); // still nothing on stdout after stop
  });

  it("leaves no orphan: stop() clears and is idempotent, even after an exception", () => {
    const cap = capture({ mode: "human", interactive: true });
    const sp = createSpinner(cap.ctx, "working");
    try {
      throw new Error("boom");
    } catch {
      sp.stop();
    }
    const afterStop = cap.err();
    sp.stop(); // idempotent — no further writes, no throw
    expect(cap.err()).toBe(afterStop);
    expect(cap.out()).toBe("");
    // The last thing written is a line-clear sequence (no dangling frame text).
    expect(afterStop.endsWith("\r[2K")).toBe(true);
  });
});
