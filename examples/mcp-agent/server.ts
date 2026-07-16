/**
 * mcp-agent — a minimal, READ-ONLY MCP server exposing HISS protocol reads.
 *
 * This server only reads public chain/protocol state via @hiss-finance/sdk. It
 * does NOT place brokerage orders, sign transactions, or take custody of
 * anything. It is compilation/read software — not a trading rail.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createHissClient } from "@hiss-finance/sdk";

const client = createHissClient({ rpcUrl: process.env.HISS_RPC_URL });

const server = new Server({ name: "hiss-read-only", version: "0.0.0" }, { capabilities: { tools: {} } });

const TOOLS = [
  {
    name: "hiss_get_status",
    description: "Read the HISS protocol chain config and contract directory (read-only).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "hiss_get_vault",
    description: "Read a HISS vault summary by address (read-only). Deposit state is a live read.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string", description: "0x vault address on chain 4663" } },
      required: ["address"],
      additionalProperties: false,
    },
  },
] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    if (name === "hiss_get_status") {
      const status = await client.getStatus();
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    }
    if (name === "hiss_get_vault") {
      const address = String((args as { address?: unknown })?.address ?? "");
      if (!address.startsWith("0x")) {
        return { isError: true, content: [{ type: "text", text: "address must be a 0x string" }] };
      }
      const vault = await client.getVault(address);
      return { content: [{ type: "text", text: JSON.stringify(vault, null, 2) }] };
    }
    return { isError: true, content: [{ type: "text", text: `unknown tool: ${name}` }] };
  } catch (err) {
    // Fail closed: report the read as unknown, never fabricate a result.
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `read failed (state unknown): ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so stdout stays a clean MCP channel.
  console.error("hiss-read-only MCP server ready (read-only; no order execution).");
}

main().catch((err) => {
  console.error("server failed to start:", err);
  process.exit(1);
});
