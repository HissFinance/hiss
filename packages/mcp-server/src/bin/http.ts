#!/usr/bin/env node
/**
 * `hiss-mcp-http` — Streamable HTTP MCP server for HISS Finance.
 *
 * This is a SECOND transport over the EXACT SAME `createServer()` factory used
 * by the stdio entrypoint (`bin/server.ts`). There is no duplicated tool or
 * handler logic: identical tools, identical guards, identical read/prepare
 * client. Read-and-prepare only — no keys, no signing, no submission, no
 * owner/admin actions.
 *
 * Stateless request/response mode (`sessionIdGenerator: undefined`): a fresh
 * Server + transport are created per request and torn down when the response
 * closes, so there is no cross-request state and no session to hijack.
 *
 * Env:
 *   HISS_MCP_HTTP_PORT  (default 8730)
 *   HISS_MCP_HTTP_HOST  (default 127.0.0.1 — localhost only by default)
 *   HISS_RPC_URL, HISS_CHAIN_ID  (read config, same as the stdio bin)
 */

import { createServer as createNodeHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../server.js";
import { createHissClient } from "../lib/client.js";

const MCP_PATH = "/mcp";
const PORT = process.env.HISS_MCP_HTTP_PORT ? Number(process.env.HISS_MCP_HTTP_PORT) : 8730;
const HOST = process.env.HISS_MCP_HTTP_HOST ?? "127.0.0.1";

// One shared read/prepare client — it holds no keys and no per-request state.
const client = createHissClient({
  rpcUrl: process.env.HISS_RPC_URL,
  chainId: process.env.HISS_CHAIN_ID ? Number(process.env.HISS_CHAIN_ID) : undefined,
});

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? JSON.parse(raw) : undefined;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(text);
}

const httpServer = createNodeHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${HOST}:${PORT}`}`);

  // Liveness probe — never touches the MCP layer.
  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, { ok: true, server: "hiss-finance", transport: "streamable-http" });
    return;
  }

  if (url.pathname !== MCP_PATH) {
    sendJson(res, 404, {
      jsonrpc: "2.0",
      error: { code: -32601, message: `No route for ${url.pathname}.` },
      id: null,
    });
    return;
  }

  // Stateless: fresh Server + transport per request, torn down on close.
  const server = createServer({ client });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    const body = req.method === "POST" ? await readJsonBody(req) : undefined;
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: {
          code: -32700,
          message: `Bad MCP request: ${err instanceof Error ? err.message : String(err)}`,
        },
        id: null,
      });
    }
  }
});

httpServer.listen(PORT, HOST, () => {
  process.stderr.write(
    `hiss-finance MCP server ready on http://${HOST}:${PORT}${MCP_PATH} (streamable HTTP).\n`,
  );
});

process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
