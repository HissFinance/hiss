/**
 * `hiss mcp status|tools|doctor` — inspect the HOSTED HISS MCP server
 * (`https://mcp.hiss.finance`). These commands READ the server's public,
 * unauthenticated introspection endpoints (`/version`, `/healthz`, `/readyz`)
 * — never a private config, never a credential. Every read is FAIL-SOFT: a
 * network error surfaces as UNKNOWN with exit code 4 (network), never a
 * fabricated "live" or "down".
 *
 * The hosted server exposes the same tool surface as the local stdio MCP; the
 * authoritative tool schemas are served over the MCP JSON-RPC protocol at
 * `POST /mcp`, which needs an MCP client — so `mcp tools` reports the
 * server-attested `toolCount` + `toolsetHash` and points at that endpoint
 * rather than fabricating a list.
 */

import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { KVRow, ViewBlock } from "../lib/view.js";

export const DEFAULT_MCP_BASE_URL = "https://mcp.hiss.finance";

/** Minimal fetch surface (injectable for deterministic tests). */
export type FetchLike = (
  url: string,
  init?: { method?: string; signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text?: () => Promise<string> }>;

interface McpVersion {
  chainId?: number;
  toolCount?: number;
  toolsetHash?: string;
  transport?: string;
  /** `server` may be a string or `{ name, version }` object across builds. */
  server?: string | { name?: string; version?: string };
  version?: string;
  deploymentVersion?: string;
  sourceSha?: string;
  publicSha?: string;
  toolNames?: string[];
}

/** Coerce a possibly-object/undefined field to a scalar KV value (never an object). */
function scalar(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return v;
  return null;
}

function serverName(v: McpVersion): string | number | null {
  if (typeof v.server === "string") return v.server;
  return scalar(v.server?.name);
}

function serverVersion(v: McpVersion): string | number | null {
  if (typeof v.server === "object" && v.server)
    return scalar(v.server.version) ?? scalar(v.version) ?? scalar(v.deploymentVersion);
  return scalar(v.version) ?? scalar(v.deploymentVersion);
}

interface Probe<T> {
  ok: boolean;
  status: number | null;
  value: T | null;
  error?: string;
}

async function probe<T = unknown>(fetchImpl: FetchLike, url: string): Promise<Probe<T>> {
  try {
    const res = await fetchImpl(url, { method: "GET" });
    let value: unknown = null;
    try {
      value = await res.json();
    } catch {
      value = null;
    }
    return { ok: res.ok, status: res.status, value: value as T };
  } catch (e) {
    return { ok: false, status: null, value: null, error: (e as Error).message };
  }
}

function stateToken(p: Probe<unknown>): "live" | "degraded" | "unknown" {
  if (p.status == null) return "unknown";
  return p.ok ? "live" : "degraded";
}

function baseFrom(baseUrl?: string): string {
  let url = baseUrl ?? process.env.HISS_MCP_URL ?? DEFAULT_MCP_BASE_URL;
  // Strip trailing slashes linearly — avoids the /\/+$/ polynomial-ReDoS on
  // an uncontrolled URL (many trailing '/').
  while (url.endsWith("/")) url = url.slice(0, -1);
  return url;
}

/** `hiss mcp status` — endpoint, transport, chain, health/readiness, tool facts. */
export async function mcpStatusCommand(fetchImpl: FetchLike, baseUrl?: string): Promise<CommandResult> {
  const base = baseFrom(baseUrl);
  const version = await probe<McpVersion>(fetchImpl, `${base}/version`);
  const health = await probe(fetchImpl, `${base}/healthz`);
  const ready = await probe(fetchImpl, `${base}/readyz`);

  const v = version.value ?? {};
  const reachable = version.status != null || health.status != null || ready.status != null;
  const exitCode = reachable ? EXIT.SUCCESS : EXIT.NETWORK;

  const rows: KVRow[] = [
    { label: "Endpoint", value: base, token: "value" },
    { label: "MCP path", value: `${base}/mcp`, token: "muted" },
    { label: "Transport", value: scalar(v.transport), token: "value" },
    { label: "Chain", value: scalar(v.chainId), token: "value" },
    { label: "Server", value: serverName(v), token: "muted" },
    { label: "Version", value: serverVersion(v), token: "value" },
    { label: "Tool count", value: scalar(v.toolCount), token: "value" },
    { label: "Toolset hash", value: scalar(v.toolsetHash), token: "hash", full: true },
    { label: "Source SHA", value: scalar(v.sourceSha), token: "hash" },
    { label: "Public SHA", value: scalar(v.publicSha), token: "hash" },
  ];

  const view: ViewBlock[] = [
    { kind: "keyValue", title: "HISS MCP (hosted)", rows },
    {
      kind: "status",
      state: stateToken(health),
      label: `Health ${stateToken(health).toUpperCase()}`,
      note: health.status != null ? `GET /healthz -> ${health.status}` : "GET /healthz unreachable",
    },
    {
      kind: "status",
      state: stateToken(ready),
      label: `Readiness ${stateToken(ready).toUpperCase()}`,
      note: ready.status != null ? `GET /readyz -> ${ready.status}` : "GET /readyz unreachable (UNKNOWN)",
    },
  ];
  if (!reachable) {
    view.push({
      kind: "panel",
      variant: "warning",
      title: "Endpoint unreachable",
      lines: [
        "Could not reach the hosted MCP introspection endpoints — reporting UNKNOWN, not a claim.",
        version.error ? `Detail: ${version.error}` : "No response from /version, /healthz, or /readyz.",
      ],
    });
  }

  return {
    summary: reachable
      ? `HISS MCP status read from ${base}.`
      : `HISS MCP status is UNKNOWN — ${base} did not respond.`,
    data: {
      base,
      reachable,
      version: version.value,
      health: { status: health.status, ok: health.ok },
      readiness: { status: ready.status, ok: ready.ok },
    },
    detail: reachable
      ? [
          `Endpoint: ${base}`,
          `Transport: ${v.transport ?? "unknown"}`,
          `Chain: ${v.chainId ?? "unknown"}`,
          `Tool count: ${v.toolCount ?? "unknown"}`,
          `Toolset hash: ${v.toolsetHash ?? "unknown"}`,
        ]
      : ["Endpoint did not respond — status is UNKNOWN (not down, not live)."],
    view,
    exitCode,
  };
}

/** `hiss mcp tools` — server-attested tool count + toolset hash. */
export async function mcpToolsCommand(fetchImpl: FetchLike, baseUrl?: string): Promise<CommandResult> {
  const base = baseFrom(baseUrl);
  const version = await probe<McpVersion>(fetchImpl, `${base}/version`);
  const v = version.value ?? {};
  const reachable = version.status != null && version.ok;
  const exitCode = reachable ? EXIT.SUCCESS : EXIT.NETWORK;
  const names = Array.isArray(v.toolNames)
    ? v.toolNames.filter((n): n is string => typeof n === "string")
    : [];

  const view: ViewBlock[] = [
    {
      kind: "keyValue",
      title: "HISS MCP toolset",
      rows: [
        { label: "Endpoint", value: base, token: "value" },
        { label: "Tool count", value: scalar(v.toolCount), token: "value" },
        { label: "Toolset hash", value: scalar(v.toolsetHash), token: "hash", full: true },
        { label: "Chain", value: scalar(v.chainId), token: "value" },
      ],
    },
  ];
  if (names.length > 0) {
    view.push({
      kind: "table",
      title: `Tools (${names.length})`,
      columns: [{ header: "Tool" }],
      rows: names.map((n) => [n]),
    });
  } else {
    view.push({
      kind: "panel",
      variant: "info",
      lines: [
        "The server did not enumerate tool names in /version.",
        `List them over the MCP protocol: POST ${base}/mcp (tools/list).`,
      ],
    });
  }

  return {
    summary: reachable
      ? `HISS MCP serves ${scalar(v.toolCount) ?? names.length ?? "an unknown number of"} tool(s) (toolset ${scalar(v.toolsetHash) ?? "unknown"}).`
      : `HISS MCP toolset is UNKNOWN — ${base}/version did not respond.`,
    data: {
      base,
      toolCount: scalar(v.toolCount),
      toolsetHash: scalar(v.toolsetHash),
      toolNames: names,
      source: `${base}/mcp`,
    },
    detail: reachable
      ? [
          `Tool count: ${scalar(v.toolCount) ?? "unknown"}`,
          `Toolset hash: ${scalar(v.toolsetHash) ?? "unknown"}`,
          ...(names.length > 0 ? names : [`List via: POST ${base}/mcp`]),
        ]
      : ["/version did not respond — toolset is UNKNOWN."],
    view,
    exitCode,
  };
}

/** `hiss mcp doctor` — run every public probe and report a per-check verdict. */
export async function mcpDoctorCommand(fetchImpl: FetchLike, baseUrl?: string): Promise<CommandResult> {
  const base = baseFrom(baseUrl);
  const version = await probe<McpVersion>(fetchImpl, `${base}/version`);
  const health = await probe(fetchImpl, `${base}/healthz`);
  const ready = await probe(fetchImpl, `${base}/readyz`);
  const v = version.value ?? {};

  const checks = [
    { name: "GET /version (introspection)", p: version },
    { name: "GET /healthz (liveness)", p: health },
    { name: "GET /readyz (RPC + chain match)", p: ready },
  ];
  const anyReached = checks.some((c) => c.p.status != null);
  const allPass = checks.every((c) => c.p.ok);
  const exitCode = !anyReached ? EXIT.NETWORK : allPass ? EXIT.SUCCESS : EXIT.PARTIAL;

  const view: ViewBlock[] = [
    {
      kind: "fuse",
      title: `HISS MCP doctor — ${base}`,
      rows: checks.map((c) => ({
        fuse: c.name,
        result: c.p.status == null ? ("unknown" as const) : c.p.ok ? ("pass" as const) : ("fail" as const),
        current: c.p.status == null ? "no response" : `HTTP ${c.p.status}`,
      })),
    },
    {
      kind: "keyValue",
      rows: [
        { label: "Chain", value: scalar(v.chainId), token: "value" },
        { label: "Tool count", value: scalar(v.toolCount), token: "value" },
        { label: "Toolset hash", value: scalar(v.toolsetHash), token: "hash", full: true },
      ],
    },
  ];

  const summary = !anyReached
    ? `HISS MCP doctor: ${base} is unreachable — every check is UNKNOWN.`
    : allPass
      ? `HISS MCP doctor: all ${checks.length} checks pass at ${base}.`
      : `HISS MCP doctor: ${checks.filter((c) => c.p.ok).length}/${checks.length} checks pass at ${base}.`;

  return {
    summary,
    data: {
      base,
      checks: checks.map((c) => ({ name: c.name, status: c.p.status, ok: c.p.ok })),
      version: version.value,
    },
    detail: checks.map((c) => `${c.p.status == null ? "UNKNOWN" : c.p.ok ? "PASS" : "FAIL"} — ${c.name}`),
    view,
    exitCode,
  };
}
