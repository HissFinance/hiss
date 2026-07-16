#!/usr/bin/env node
/**
 * `hiss-mcp` — local stdio MCP server for HISS Finance. Read-and-prepare
 * only: no keys, no signing, no submission, no owner/admin actions.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../server.js";
import { createHissClient } from "../lib/client.js";

async function main(): Promise<void> {
  const client = createHissClient({
    rpcUrl: process.env.HISS_RPC_URL,
    chainId: process.env.HISS_CHAIN_ID ? Number(process.env.HISS_CHAIN_ID) : undefined,
  });
  const server = createServer({ client });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only — stdout is the MCP transport.
  process.stderr.write("hiss-finance MCP server ready on stdio.\n");
}

main().catch((err) => {
  process.stderr.write(`hiss-mcp: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
