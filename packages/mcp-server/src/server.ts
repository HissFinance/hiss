/**
 * MCP server wiring over the official low-level Server: `tools/list` and
 * `tools/call`, with the execution-claim output guard applied to every result
 * before it leaves the process. Credential-shaped input is rejected up front.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { HISS_TOOLS, getTool, assertToolInputClean, ToolInputError, type ToolContext } from "./tools.js";
import { assertNoExecutionClaim, ExecutionClaimError } from "./lib/guard.js";
import { CredentialRejectedError } from "./lib/credentials.js";
import type { HissClient, JsonRecord } from "./lib/types.js";

export const SERVER_NAME = "hiss-finance";
export const SERVER_VERSION = "0.1.0";

export const SERVER_INSTRUCTIONS = `HISS Finance MCP tools READ public protocol state and PREPARE unsigned
transactions. They never hold keys, never sign, never submit, and never
perform owner-only, Safe, admin, reward-root, or reward-funding actions.
There is no code path to any of those. An on-chain action is complete only
after your own wallet's receipt confirms. Nothing here is investment advice.`;

export interface ServerDeps {
  /**
   * The read/prepare client. Required. The `bin/server.ts` entrypoint builds
   * one from `@hiss-finance/sdk`; tests inject a mock. Keeping it injected
   * means this module never statically depends on the SDK transport.
   */
  client?: HissClient;
  /** Fixed clock for deterministic output (tests). */
  nowIso?: () => string;
}

function makeContext(deps: ServerDeps): ToolContext {
  if (!deps.client) {
    throw new Error("HISS MCP server requires a client (deps.client). Build one with createHissClient().");
  }
  return {
    client: deps.client,
    nowIso: (deps.nowIso ?? (() => new Date().toISOString()))(),
  };
}

function errorResult(code: string, message: string, issues?: unknown): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: `[${code}] ${message}` }],
    structuredContent: { error: { code, message, issues: issues ?? null } },
  };
}

/**
 * Run a tool and return a guarded MCP result. Exported for tests. The tool's
 * human summary (its claim) is passed through the execution-claim guard;
 * completion verbs are only allowed when the outcome verifies a real receipt.
 */
export async function callHissTool(
  name: string,
  args: JsonRecord,
  deps: ServerDeps = {},
): Promise<CallToolResult> {
  const tool = getTool(name);
  if (!tool) return errorResult("UNKNOWN_TOOL", `No HISS tool named "${name}".`);
  try {
    assertToolInputClean(args ?? {});
    const ctx = makeContext(deps);
    const outcome = await tool.handler(args ?? {}, ctx);
    // Hard guard: the tool's summary may never read like a completed action.
    assertNoExecutionClaim(outcome.summary, { receiptVerified: outcome.receiptVerified });
    const text = `${outcome.summary}\n\n${JSON.stringify(outcome.structured, null, 2)}`;
    return { content: [{ type: "text", text }], structuredContent: outcome.structured };
  } catch (err) {
    if (err instanceof ExecutionClaimError) return errorResult("OUTPUT_GUARD", err.message);
    if (err instanceof CredentialRejectedError)
      return errorResult("CREDENTIAL_REJECTED", err.message, err.fields);
    if (err instanceof ToolInputError) return errorResult("INVALID_INPUT", err.message, err.issues);
    return errorResult("TOOL_ERROR", err instanceof Error ? err.message : String(err));
  }
}

/** Construct the MCP Server with tools registered. */
export function createServer(deps: ServerDeps = {}): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: HISS_TOOLS.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
      annotations: {
        readOnlyHint: t.kind === "read",
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: t.kind === "read",
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return callHissTool(name, (args ?? {}) as JsonRecord, deps);
  });

  return server;
}
