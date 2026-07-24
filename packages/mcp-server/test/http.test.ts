import { describe, it, expect, afterEach } from "vitest";
import { startTestServer, mcpCall, rawGet, type RunningHttp } from "./helpers/httpHarness.js";
import { computeToolsetHash } from "../src/lib/toolset-hash.js";
import { HISS_TOOLS } from "../src/tools.js";

const TOOL_COUNT = HISS_TOOLS.length;

let running: RunningHttp | undefined;
afterEach(async () => {
  await running?.close();
  running = undefined;
});

describe("GET /healthz", () => {
  it("is a 200 liveness probe", async () => {
    running = await startTestServer();
    const res = await fetch(`${running.origin}/healthz`);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

describe("GET /readyz", () => {
  it("returns 200 when the RPC probe is ready", async () => {
    running = await startTestServer({
      readiness: async () => ({ ready: true, chainId: 4663 }),
    });
    const res = await fetch(`${running.origin}/readyz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(body.chainId).toBe(4663);
  });

  it("returns 503 when the RPC probe is not ready", async () => {
    running = await startTestServer({
      readiness: async () => ({ ready: false, reason: "rpc_unreachable" }),
    });
    const res = await fetch(`${running.origin}/readyz`);
    expect(res.status).toBe(503);
    expect((await res.json()).ready).toBe(false);
  });

  it("never leaks the RPC URL in the readiness body", async () => {
    running = await startTestServer({
      config: { rpcUrl: "https://secret-rpc.example/xyz-key", chainId: 4663 },
      readiness: async () => ({ ready: false, reason: "rpc_unreachable" }),
    });
    const res = await fetch(`${running.origin}/readyz`);
    expect(await res.text()).not.toContain("secret-rpc");
  });
});

describe("GET /version", () => {
  it("reports the toolset hash, tool count, and runtime versions", async () => {
    running = await startTestServer();
    const res = await fetch(`${running.origin}/version`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.toolsetHash).toBe(computeToolsetHash().hash);
    expect(body.toolCount).toBe(TOOL_COUNT);
    expect(body.server.name).toBe("hiss-finance");
    expect(body.nodeVersion).toBe(process.version);
    expect(typeof body.mcpSdkVersion).toBe("string");
    expect(body.mcpSdkVersion.length).toBeGreaterThan(0);
    expect(typeof body.deploymentVersion).toBe("string");
  });
});

describe("Host validation", () => {
  it("rejects a non-allowlisted Host with 421", async () => {
    running = await startTestServer({ config: { allowedHosts: ["mcp.hiss.finance"] } });
    const res = await rawGet(running.port, "/version", { Host: "evil.example.com" });
    expect(res.status).toBe(421);
    expect(JSON.parse(res.body).error.code).toBe("HOST_NOT_ALLOWED");
  });

  it("accepts an explicitly allowlisted Host", async () => {
    running = await startTestServer({ config: { allowedHosts: ["mcp.hiss.finance"] } });
    const res = await rawGet(running.port, "/version", { Host: "mcp.hiss.finance" });
    expect(res.status).toBe(200);
  });

  it("rejects a request with no Host header", async () => {
    running = await startTestServer({ config: { allowedHosts: ["mcp.hiss.finance"] } });
    // Node injects a Host by default; send an empty one to simulate absence.
    const res = await rawGet(running.port, "/version", { Host: "" });
    expect(res.status).toBe(421);
  });
});

describe("Body size limit", () => {
  it("rejects an oversized POST body with 413", async () => {
    running = await startTestServer({ config: { maxBodyBytes: 200 } });
    const bloat = { jsonrpc: "2.0", id: 1, method: "tools/list", padding: "x".repeat(5000) };
    const res = await fetch(`${running.origin}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify(bloat),
    });
    expect(res.status).toBe(413);
  });

  it("accepts a normal-sized POST body", async () => {
    running = await startTestServer({ config: { maxBodyBytes: 262144 } });
    const { status, body } = await mcpCall(running.origin, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(status).toBe(200);
    expect((body.result as { tools: unknown[] }).tools).toHaveLength(TOOL_COUNT);
  });
});

describe("Request deadline", () => {
  it("returns 504 when processing exceeds the timeout", async () => {
    running = await startTestServer({
      config: { requestTimeoutMs: 10 },
      readiness: () => new Promise((resolve) => setTimeout(() => resolve({ ready: true }), 200)),
    });
    const res = await fetch(`${running.origin}/readyz`);
    expect(res.status).toBe(504);
    expect((await res.json()).reason).toBe("readiness_timeout");
  });
});

describe("Rate limiting", () => {
  it("returns 429 once the per-client limit is exceeded", async () => {
    running = await startTestServer({ config: { rateLimitMax: 2, rateLimitWindowMs: 60000 } });
    const a = await fetch(`${running.origin}/version`);
    const b = await fetch(`${running.origin}/version`);
    const c = await fetch(`${running.origin}/version`);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(c.status).toBe(429);
    expect(c.headers.get("retry-after")).toBeTruthy();
  });

  it("does not rate-limit liveness/readiness probes", async () => {
    running = await startTestServer({
      config: { rateLimitMax: 1, rateLimitWindowMs: 60000 },
      readiness: async () => ({ ready: true }),
    });
    for (let i = 0; i < 5; i++) {
      expect((await fetch(`${running.origin}/healthz`)).status).toBe(200);
      expect((await fetch(`${running.origin}/readyz`)).status).toBe(200);
    }
  });
});

describe("Unknown route", () => {
  it("returns a JSON-RPC 404 for an unrouted path", async () => {
    running = await startTestServer();
    const res = await fetch(`${running.origin}/nope`);
    expect(res.status).toBe(404);
  });
});
