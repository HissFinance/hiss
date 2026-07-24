# HISS MCP server — production deployment

Portable deployment for the HISS Finance remote MCP server at
`mcp.hiss.finance`. The server is **read-and-prepare only**: it reads public
protocol state and returns **unsigned** transactions. It never holds keys,
never signs, never submits, and has no owner/admin/Safe/reward-funding code
path. Nothing in this directory contains a secret.

## What ships

- **Transport:** Streamable HTTP MCP (`POST /mcp`), stateless request/response.
- **Bins:** `dist/bin/http.js` (HTTP, this deployment) and `dist/bin/server.js`
  (stdio, for local editors). Both are self-contained esbuild bundles over the
  **same** `createServer()` tool factory — identical 22 tools, identical guards.
- **Toolset:** 22 tools (12 read + 10 prepare). Verify a running instance with
  `GET /version` → `toolsetHash`.

## Pin the release

The image MUST be built from the merged public SHA **`cea4ecaa`** (the repaired
22-tool server + HTTP transport) or a later merged `main` that includes this
hardening. Do not build from an unmerged branch.

## Build

Build context is the **monorepo root** (pnpm must resolve the `@hiss-finance/*`
workspace packages):

```bash
docker build -f packages/mcp-server/Dockerfile -t hiss-mcp:<git-sha> .
```

The runtime stage carries only the bundled `dist/` on `node:20-slim` and runs
as the non-root `node` user.

## Endpoints

| Method | Path       | Purpose                                                                             | Codes                                   |
| ------ | ---------- | ----------------------------------------------------------------------------------- | --------------------------------------- |
| GET    | `/healthz` | Liveness (no MCP, no RPC).                                                          | 200                                     |
| GET    | `/readyz`  | Readiness — RPC reachable **and** chain id matches.                                 | 200 ready · 503 not-ready               |
| GET    | `/version` | Deployment version, `toolsetHash`, tool count/names, MCP SDK version, Node version. | 200                                     |
| POST   | `/mcp`     | MCP JSON-RPC (Streamable HTTP).                                                     | 200 · 413 body · 429 rate · 504 timeout |

Rejections applied before routing/work: **421** (Host not allowlisted),
**429** (rate limit), **413** (oversized body), **504** (request deadline).
`/healthz` and `/readyz` are exempt from rate limiting so orchestrator probes
are never throttled.

## Runtime environment (names only — never commit a value)

| Variable                        | Required    | Default                                      | Meaning                                                                                                 |
| ------------------------------- | ----------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `HISS_RPC_URL`                  | **yes**     | —                                            | Approved Robinhood Chain JSON-RPC endpoint. Used for `/readyz` and reads. Never logged, never returned. |
| `HISS_CHAIN_ID`                 | **yes**     | `4663` (code default)                        | Expected chain id. `/readyz` fails on mismatch. Set to `4663` (mainnet).                                |
| `HISS_MCP_HTTP_HOST`            | recommended | `127.0.0.1` (image sets `0.0.0.0`)           | Bind address. Containers use `0.0.0.0`.                                                                 |
| `PORT` / `HISS_MCP_HTTP_PORT`   | recommended | `8730`                                       | Listen port. `HISS_MCP_HTTP_PORT` wins if both set.                                                     |
| `HISS_MCP_ALLOWED_HOSTS`        | recommended | `mcp.hiss.finance,localhost,127.0.0.1,[::1]` | CSV Host allowlist. Must include the public hostname behind the TLS proxy plus the probe host.          |
| `HISS_MCP_MAX_BODY_BYTES`       | no          | `262144`                                     | Max POST body bytes → 413.                                                                              |
| `HISS_MCP_REQUEST_TIMEOUT_MS`   | no          | `15000`                                      | Per-request deadline → 504.                                                                             |
| `HISS_MCP_RATE_LIMIT_MAX`       | no          | `120`                                        | Requests per window per client → 429.                                                                   |
| `HISS_MCP_RATE_LIMIT_WINDOW_MS` | no          | `60000`                                      | Rate-limit window (ms).                                                                                 |
| `HISS_MCP_DEPLOY_VERSION`       | recommended | package version                              | Release marker surfaced by `/version` (set to the deployed git SHA).                                    |

> `HISS_RPC_URL` may embed a key. It is treated as a secret: never logged,
> never included in any response body, never printed by the structured logger
> (which emits only a fixed, safe field set). Supply it through your platform's
> secret store, not a committed file.

## Run (example)

```bash
docker run --rm -p 8730:8730 \
  -e HISS_RPC_URL \
  -e HISS_CHAIN_ID=4663 \
  -e HISS_MCP_HTTP_HOST=0.0.0.0 \
  -e PORT=8730 \
  -e HISS_MCP_ALLOWED_HOSTS=mcp.hiss.finance,localhost,127.0.0.1 \
  -e HISS_MCP_DEPLOY_VERSION=<git-sha> \
  hiss-mcp:<git-sha>
```

(`-e HISS_RPC_URL` with no `=value` forwards it from the host/secret store —
do not inline the URL.)

## Rollout & rollback

- **Health gating:** wire `GET /healthz` (liveness) and `GET /readyz`
  (readiness) into the platform. Do not route traffic until `/readyz` is 200.
- **Graceful shutdown:** the process handles `SIGTERM`/`SIGINT` by draining
  in-flight requests (10s hard cap), so rolling updates are clean.
- **Verification:** after cutover, `GET /version` must report the expected
  `toolsetHash` and `deploymentVersion`.

## Security invariants (do not weaken)

- Read-and-prepare only. No sign/submit/execute/arbitrary-call tool exists.
- No secret, RPC URL, wallet key, or user brokerage data in the image, logs, or
  any response.
- Host allowlist, body cap, request deadline, and rate limit are enabled by
  default; keep them on in production.
