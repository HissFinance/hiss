import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createHttpServer, type HttpServerOverrides } from "../../src/bin/http.js";
import { mockClient } from "./mockClient.js";
import type { JsonRecord } from "../../src/lib/types.js";

export interface RunningHttp {
  origin: string;
  port: number;
  close: () => Promise<void>;
}

/** Start the hardened HTTP server on an ephemeral port with a mock client. */
export async function startTestServer(overrides: HttpServerOverrides = {}): Promise<RunningHttp> {
  const { httpServer } = createHttpServer({
    client: mockClient(),
    logger: () => {},
    ...overrides,
  });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const port = (httpServer.address() as AddressInfo).port;
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve()))),
  };
}

/** Parse a Streamable-HTTP SSE body, returning the JSON of the first `data:` line. */
export function parseSse(text: string): JsonRecord {
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("data:")) return JSON.parse(line.slice(5).trim()) as JsonRecord;
  }
  // Some responses are plain JSON.
  return JSON.parse(text) as JsonRecord;
}

/** POST a single JSON-RPC message to /mcp and return the parsed reply. */
export async function mcpCall(
  origin: string,
  message: JsonRecord,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; body: JsonRecord }> {
  const res = await fetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...extraHeaders,
    },
    body: JSON.stringify(message),
  });
  const text = await res.text();
  return { status: res.status, body: res.ok ? parseSse(text) : safeJson(text) };
}

function safeJson(text: string): JsonRecord {
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return { raw: text };
  }
}

/**
 * Raw GET that lets a test set an arbitrary Host header (fetch/undici silently
 * ignores a caller-set Host, so it cannot exercise Host validation).
 */
export function rawGet(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c as Buffer));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }),
      );
    });
    req.on("error", reject);
    req.end();
  });
}

let idCounter = 1;
export function toolsCall(name: string, args: JsonRecord): JsonRecord {
  return { jsonrpc: "2.0", id: idCounter++, method: "tools/call", params: { name, arguments: args } };
}
