import { describe, it, expect } from "vitest";
import { buildVersionInfo } from "../src/lib/version-info.js";
import { HISS_TOOLS } from "../src/tools.js";
import { computeToolsetHash } from "../src/lib/toolset-hash.js";

describe("buildVersionInfo (public-safe base /version shape)", () => {
  it("carries chainId (default 4663, overridable) and a dynamic toolset identity", () => {
    const v = buildVersionInfo({ transport: "streamable-http" });
    expect(v.chainId).toBe(4663);
    expect(buildVersionInfo({ chainId: 46630, transport: "x" }).chainId).toBe(46630);

    expect(v.toolCount).toBe(HISS_TOOLS.length);
    expect(v.toolCount).toBe(39);
    expect(v.toolsetHash).toBe(computeToolsetHash().hash);
    expect(v.toolNames).toEqual(HISS_TOOLS.map((t) => t.name).sort());
    expect(v.server).toEqual({ name: "hiss-finance", version: "0.1.0" });
    expect(typeof v.deploymentVersion).toBe("string");
  });

  it("advertises NO source-provenance fields (host-agnostic public package)", () => {
    // The published package must never expose a deployed-commit SHA or an
    // upstream-distribution SHA — those belong to a hosting layer, not here.
    const v = buildVersionInfo({ transport: "streamable-http" }) as Record<string, unknown>;
    expect("sourceSha" in v).toBe(false);
    expect("publicSha" in v).toBe(false);
    // And the serialized payload is likewise provenance-free.
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/sourceSha|publicSha/);
  });
});
