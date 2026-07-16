# mcp-agent

A minimal, **read-only** [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes HISS protocol reads to an MCP-capable agent (e.g. Claude
Desktop) via `@hiss-finance/sdk`.

It exposes two tools:

- `hiss_get_status` — chain config + contract directory.
- `hiss_get_vault` — one vault summary by address.

This server is compilation/read software. It does **not** place brokerage
orders, sign transactions, or take custody of anything. Reads fail closed: an
unrecoverable read is reported as unknown, never fabricated.

## Run (stdio)

```bash
pnpm --filter @hiss-finance/example-mcp-agent start
```

It speaks MCP over stdio and prints a readiness line to stderr:

```
hiss-read-only MCP server ready (read-only; no order execution).
```

## Wire into an MCP client

Add it to your client's server config (paths are illustrative):

```json
{
  "mcpServers": {
    "hiss": {
      "command": "pnpm",
      "args": ["--filter", "@hiss-finance/example-mcp-agent", "start"]
    }
  }
}
```

Optionally set `HISS_RPC_URL` (see `.env.example`) to use your own RPC; it
defaults to the public Robinhood Chain endpoint. Do not commit secrets.
