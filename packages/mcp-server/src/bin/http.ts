#!/usr/bin/env node
/**
 * `hiss-mcp-http` — production Streamable HTTP MCP server for HISS Finance.
 *
 * A SECOND transport over the EXACT SAME `createServer()` factory used by the
 * stdio entrypoint (`bin/server.ts`). There is no duplicated tool or handler
 * logic: identical tools, identical guards, identical read/prepare client.
 * Read-and-prepare only — no keys, no signing, no submission, no owner/admin
 * actions, and no code path to any of those.
 *
 * Stateless request/response mode (`sessionIdGenerator: undefined`): a fresh
 * Server + transport are created per request and torn down when the response
 * closes, so there is no cross-request state and no session to hijack.
 *
 * Production hardening (transport only — tool behavior is untouched):
 *   - GET /healthz  liveness
 *   - GET /readyz   readiness (RPC reachable + chain id matches) 200/503
 *   - GET /version  deployment version, toolset hash, SDK/Node versions
 *   - POST /mcp     the MCP JSON-RPC endpoint
 *   Host allowlist (421), body-size cap (413), request deadline (504),
 *   per-client rate limit (429), redacted structured logs, graceful shutdown.
 *
 * Env (values by NAME only — never commit a value):
 *   PORT / HISS_MCP_HTTP_PORT       listen port (default 8730)
 *   HISS_MCP_HTTP_HOST              bind host (default 127.0.0.1; use 0.0.0.0 in a container)
 *   HISS_MCP_ALLOWED_HOSTS         csv Host allowlist (default mcp.hiss.finance,localhost,127.0.0.1,[::1])
 *   HISS_MCP_MAX_BODY_BYTES        max POST body bytes (default 262144)
 *   HISS_MCP_REQUEST_TIMEOUT_MS    per-request deadline (default 15000)
 *   HISS_MCP_RATE_LIMIT_MAX        requests per window per client (default 120)
 *   HISS_MCP_RATE_LIMIT_WINDOW_MS  rate-limit window (default 60000)
 *   HISS_MCP_DEPLOY_VERSION        release marker for /version (default package version)
 *   HISS_RPC_URL, HISS_CHAIN_ID    read config (same as the stdio bin)
 */

import {
  createServer as createNodeHttpServer,
  type IncomingMessage,
  type Server as NodeHttpServer,
  type ServerResponse,
} from "node:http";
import { createHash } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../server.js";
import { createHissClient } from "../lib/client.js";
import { checkRpcReadiness, type ReadinessResult } from "../lib/readiness.js";
import { buildVersionInfo } from "../lib/version-info.js";
import { SERVER_NAME } from "../server.js";
import type { HissClient } from "../lib/types.js";

const MCP_PATH = "/mcp";

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

export interface HttpConfig {
  host: string;
  port: number;
  allowedHosts: string[];
  maxBodyBytes: number;
  requestTimeoutMs: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  rpcUrl?: string;
  chainId?: number;
}

const DEFAULT_ALLOWED_HOSTS = ["mcp.hiss.finance", "localhost", "127.0.0.1", "[::1]"];

function intFromEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Resolve the HTTP config from the environment. No value is ever logged. */
export function resolveHttpConfig(env: NodeJS.ProcessEnv = process.env): HttpConfig {
  const allowed = (env.HISS_MCP_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
  return {
    host: env.HISS_MCP_HTTP_HOST ?? "127.0.0.1",
    port: intFromEnv(env.HISS_MCP_HTTP_PORT ?? env.PORT, 8730),
    allowedHosts: allowed.length > 0 ? allowed : [...DEFAULT_ALLOWED_HOSTS],
    maxBodyBytes: intFromEnv(env.HISS_MCP_MAX_BODY_BYTES, 262144),
    requestTimeoutMs: intFromEnv(env.HISS_MCP_REQUEST_TIMEOUT_MS, 15000),
    rateLimitMax: intFromEnv(env.HISS_MCP_RATE_LIMIT_MAX, 120),
    rateLimitWindowMs: intFromEnv(env.HISS_MCP_RATE_LIMIT_WINDOW_MS, 60000),
    rpcUrl: env.HISS_RPC_URL,
    chainId: env.HISS_CHAIN_ID ? Number(env.HISS_CHAIN_ID) : undefined,
  };
}

// ---------------------------------------------------------------------------
// redacted structured logging — emits only a fixed set of safe fields. It
// never receives (so can never leak) the RPC URL, credentials, headers, tool
// arguments, or any wallet/user data.
// ---------------------------------------------------------------------------

export interface LogEntry {
  event: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  /** Salted, truncated client fingerprint — never a raw IP. */
  client?: string;
  reason?: string;
}

function defaultLogger(entry: LogEntry): void {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
}

// ---------------------------------------------------------------------------
// host + client helpers
// ---------------------------------------------------------------------------

/** Extract the lowercased hostname (no port) from a Host header value. */
export function hostnameOf(hostHeader: string | undefined): string | undefined {
  if (!hostHeader) return undefined;
  const h = hostHeader.trim();
  if (h.length === 0) return undefined;
  if (h.startsWith("[")) {
    // IPv6 literal: [::1]:8730 -> [::1]
    const end = h.indexOf("]");
    return end > 0 ? h.slice(0, end + 1).toLowerCase() : h.toLowerCase();
  }
  const colon = h.indexOf(":");
  return (colon >= 0 ? h.slice(0, colon) : h).toLowerCase();
}

export function isHostAllowed(hostHeader: string | undefined, allowed: string[]): boolean {
  const name = hostnameOf(hostHeader);
  if (!name) return false;
  return allowed.includes(name);
}

/** First-hop client identifier: XFF head, else socket address. */
function clientKey(req: IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  const head = Array.isArray(xff) ? xff[0] : xff;
  if (head && head.length > 0) return head.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

// Per-process salt so logged fingerprints are stable within a run but do not
// reveal the raw IP and cannot be correlated across restarts.
const CLIENT_SALT = createHash("sha256").update(String(process.pid)).update(String(Date.now())).digest();

function clientFingerprint(key: string): string {
  return createHash("sha256").update(CLIENT_SALT).update(key).digest("hex").slice(0, 12);
}

// ---------------------------------------------------------------------------
// rate limiter — fixed window per client, in-process. Best-effort per
// instance (no session affinity required for MCP correctness).
// ---------------------------------------------------------------------------

interface RateBucket {
  count: number;
  resetAt: number;
}

function makeRateLimiter(max: number, windowMs: number, now: () => number) {
  const buckets = new Map<string, RateBucket>();
  return function take(key: string): { allowed: boolean; retryAfterSec: number } {
    const t = now();
    let b = buckets.get(key);
    if (!b || t >= b.resetAt) {
      b = { count: 0, resetAt: t + windowMs };
      buckets.set(key, b);
    }
    // opportunistic prune to keep the map bounded
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) if (t >= v.resetAt) buckets.delete(k);
    }
    b.count += 1;
    if (b.count > max) return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - t) / 1000) };
    return { allowed: true, retryAfterSec: 0 };
  };
}

// ---------------------------------------------------------------------------
// body reading with a hard byte cap
// ---------------------------------------------------------------------------

class BodyTooLargeError extends Error {}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > maxBytes) throw new BodyTooLargeError();
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? JSON.parse(raw) : undefined;
}

// ---------------------------------------------------------------------------
// deadline helper
// ---------------------------------------------------------------------------

const TIMEOUT = Symbol("timeout");

async function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), ms);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// server factory
// ---------------------------------------------------------------------------

export interface HttpServerOverrides {
  /** Injected read/prepare client (tests). Defaults to one built from env. */
  client?: HissClient;
  /** Config overrides merged over the env-resolved config (tests). */
  config?: Partial<HttpConfig>;
  /** Readiness probe override (tests). Defaults to a live RPC eth_chainId read. */
  readiness?: () => Promise<ReadinessResult>;
  /** Monotonic clock for the rate limiter (tests). */
  now?: () => number;
  /**
   * Wall-clock source for per-request tool output (tests). Threaded into every
   * per-request `createServer({ nowIso })` so time-stamped reads (e.g. the
   * contract registry's `observedAt`) are deterministic. Defaults to real time.
   */
  nowIso?: () => string;
  /** Structured log sink (tests). */
  logger?: (entry: LogEntry) => void;
}

export interface HttpServerHandle {
  httpServer: NodeHttpServer;
  config: HttpConfig;
}

/**
 * Build (but do not start) the hardened HTTP server. Importing this module has
 * no side effects; `startFromEnv()` (below) is the only thing that listens.
 */
export function createHttpServer(overrides: HttpServerOverrides = {}): HttpServerHandle {
  const config: HttpConfig = { ...resolveHttpConfig(), ...overrides.config };
  const now = overrides.now ?? (() => Date.now());
  const log = overrides.logger ?? defaultLogger;

  // One shared read/prepare client — it holds no keys and no per-request state.
  const client = overrides.client ?? createHissClient({ rpcUrl: config.rpcUrl, chainId: config.chainId });

  const readiness =
    overrides.readiness ??
    (() =>
      checkRpcReadiness({
        rpcUrl: config.rpcUrl,
        chainId: config.chainId,
        timeoutMs: Math.min(config.requestTimeoutMs, 5000),
      }));

  const rateLimit = makeRateLimiter(config.rateLimitMax, config.rateLimitWindowMs, now);

  function sendJson(
    res: ServerResponse,
    status: number,
    body: unknown,
    headers?: Record<string, string>,
  ): void {
    if (res.headersSent || res.writableEnded) return;
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  }

  const httpServer = createNodeHttpServer((req: IncomingMessage, res: ServerResponse) => {
    const started = now();
    const key = clientKey(req);
    const fp = clientFingerprint(key);
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;

    const finish = (status: number, reason?: string): void => {
      log({ event: "request", method, path, status, durationMs: now() - started, client: fp, reason });
    };

    // 1) Host allowlist — reject a mismatched/absent Host before any work.
    if (!isHostAllowed(req.headers.host, config.allowedHosts)) {
      sendJson(res, 421, { error: { code: "HOST_NOT_ALLOWED", message: "Host header is not allowed." } });
      finish(421, "host_not_allowed");
      return;
    }

    // 2) Liveness — never touches the MCP layer, never rate-limited.
    if (method === "GET" && path === "/healthz") {
      sendJson(res, 200, { ok: true, server: SERVER_NAME, transport: "streamable-http" });
      finish(200);
      return;
    }

    // 3) Readiness — RPC reachable + chain id matches. Not rate-limited (probe).
    if (method === "GET" && path === "/readyz") {
      void (async () => {
        const outcome = await withDeadline(readiness(), config.requestTimeoutMs);
        if (outcome === TIMEOUT) {
          sendJson(res, 504, { ready: false, reason: "readiness_timeout" });
          finish(504, "readiness_timeout");
          return;
        }
        const status = outcome.ready ? 200 : 503;
        sendJson(res, status, outcome);
        finish(status, outcome.ready ? undefined : outcome.reason);
      })();
      return;
    }

    // Everything below is rate-limited per client.
    const gate = rateLimit(key);
    if (!gate.allowed) {
      sendJson(
        res,
        429,
        { error: { code: "RATE_LIMITED", message: "Too many requests." } },
        {
          "retry-after": String(gate.retryAfterSec),
        },
      );
      finish(429, "rate_limited");
      return;
    }

    // 4) Version — server + chain + toolset identity, no tool invocation. The
    // public-safe base shape shared by every transport (see buildVersionInfo).
    if (method === "GET" && path === "/version") {
      sendJson(res, 200, buildVersionInfo({ chainId: config.chainId, transport: "streamable-http" }));
      finish(200);
      return;
    }

    // 5) MCP endpoint.
    if (path !== MCP_PATH) {
      sendJson(res, 404, {
        jsonrpc: "2.0",
        error: { code: -32601, message: `No route for ${path}.` },
        id: null,
      });
      finish(404, "no_route");
      return;
    }

    void (async () => {
      // Stateless: fresh Server + transport per request, torn down on close.
      const server = createServer({ client, nowIso: overrides.nowIso });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      try {
        const body = method === "POST" ? await readJsonBody(req, config.maxBodyBytes) : undefined;
        await server.connect(transport);
        const outcome = await withDeadline(transport.handleRequest(req, res, body), config.requestTimeoutMs);
        if (outcome === TIMEOUT) {
          sendJson(res, 504, {
            jsonrpc: "2.0",
            error: { code: -32000, message: "Request timed out." },
            id: null,
          });
          finish(504, "mcp_timeout");
          return;
        }
        finish(res.statusCode || 200);
      } catch (err) {
        if (err instanceof BodyTooLargeError) {
          sendJson(res, 413, {
            jsonrpc: "2.0",
            error: { code: -32600, message: "Request body too large." },
            id: null,
          });
          finish(413, "body_too_large");
          return;
        }
        sendJson(res, 400, {
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: `Bad MCP request: ${err instanceof Error ? err.message : "unknown"}`,
          },
          id: null,
        });
        finish(400, "bad_request");
      }
    })();
  });

  // Node-level guards against slowloris / stuck sockets.
  httpServer.requestTimeout = Math.max(config.requestTimeoutMs * 2, 30000);
  httpServer.headersTimeout = Math.max(config.requestTimeoutMs, 10000);

  return { httpServer, config };
}

// ---------------------------------------------------------------------------
// entrypoint
// ---------------------------------------------------------------------------

function startFromEnv(): void {
  const { httpServer, config } = createHttpServer();
  httpServer.listen(config.port, config.host, () => {
    process.stderr.write(
      `hiss-finance MCP server ready on http://${config.host}:${config.port}${MCP_PATH} (streamable HTTP).\n`,
    );
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stderr.write(`hiss-mcp-http: ${signal} received, draining…\n`);
    httpServer.close(() => process.exit(0));
    // Hard stop if connections do not drain in time.
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Only listen when run as the entrypoint — importing (tests) has no side effect.
const invokedPath = process.argv[1] ? process.argv[1].replace(/\\/g, "/") : "";
if (invokedPath.endsWith("/bin/http.js") || invokedPath.endsWith("/bin/http.ts")) {
  startFromEnv();
}
