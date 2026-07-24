import { describe, it, expect } from "vitest";
import { computeToolsetHash } from "../src/lib/toolset-hash.js";
import { HISS_TOOLS } from "../src/tools.js";

describe("toolset hash", () => {
  it("covers all 22 registered tools", () => {
    const t = computeToolsetHash();
    expect(t.toolCount).toBe(22);
    expect(t.toolNames).toHaveLength(22);
  });

  it("is deterministic across calls", () => {
    expect(computeToolsetHash().hash).toBe(computeToolsetHash().hash);
  });

  it("is a sha256 hex digest", () => {
    expect(computeToolsetHash().hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("is independent of tool declaration order", () => {
    const reversed = [...HISS_TOOLS].reverse();
    expect(computeToolsetHash(reversed).hash).toBe(computeToolsetHash(HISS_TOOLS).hash);
  });

  it("changes when a tool's contract changes", () => {
    const base = computeToolsetHash().hash;
    const mutated = HISS_TOOLS.map((t, i) =>
      i === 0 ? { ...t, description: `${t.description} (changed)` } : t,
    );
    expect(computeToolsetHash(mutated).hash).not.toBe(base);
  });

  it("returns sorted tool names", () => {
    const names = computeToolsetHash().toolNames;
    expect([...names].sort()).toEqual(names);
  });
});
