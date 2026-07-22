---
name: hiss-mcp
description: Use the HISS local MCP server — a stdio Model Context Protocol server that exposes HISS CoilOps, vault, staking, rewards, and stock-token tooling as callable tools for your own agent. Covers connecting the server, the tool families and their read/prepare-only contract, and the guards every tool output passes (execution-claim guard, credential rejection, planned ≠ funded ≠ claimable). Use when a user wants their agent to call HISS tools over MCP rather than raw HTTP. Compiles and verifies; never executes trades or custodies funds.
tags: [mcp, model-context-protocol, hiss-tools, agents, coilops]
version: 1
visibility: public
required_mcp_tools:
  - hiss_get_protocol_status
  - hiss_get_staking_status
  - hiss_get_reward_status
  - hiss_prepare_vault_deposit
  - hiss_validate_coil
  - hiss_verify_receipt
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS MCP Server

## Purpose

The HISS MCP server is a local **stdio** Model Context Protocol server that
exposes the HISS compilation/verification toolset to your own agent as
typed tools. It is a thin, deterministic surface over the same logic behind
the public `https://app.hiss.finance` HTTP routes (the canonical API base;
`https://www.hiss.finance` continues to serve the same routes for
compatibility): it PREPARES artifacts
(Coils, capsules, deposit intents, command packs, receipts) and READS
verified state. It never sends a transaction, never places an order, never
holds keys, and never takes custody.

Every tool output passes the execution-claim guard and carries
`liveOrderSent: false`. Any output that would imply HISS executed something
is blocked, not softened.

## Connecting

The server speaks MCP over stdio — launch it as a local process and point
your MCP-capable client at it (Claude Desktop, Claude Code, or any MCP
client) via that client's server configuration. No HISS credential is
required to run it; it calls only public HISS surfaces and public chain
reads. Never pass wallet keys, recovery phrases, or API credentials to any
tool — credential-shaped inputs are rejected and never echoed.

## Tools

The server registers **22 tools** — 12 read, 10 prepare. This list mirrors the
MCP server source (`packages/mcp-server/src/tools.ts`); the server's own
`list_tools` response is always authoritative.

**Read (12)** — `hiss_get_protocol_status`, `hiss_get_contract_registry`,
`hiss_get_fee_schedule`, `hiss_get_supported_assets`, `hiss_get_vaults`,
`hiss_get_vault`, `hiss_get_vault_holdings`, `hiss_get_vault_performance`,
`hiss_get_staking_status`, `hiss_get_reward_status`, `hiss_get_receipt`,
`hiss_verify_receipt`.

**Prepare (10)** — `hiss_create_vault_candidate`, `hiss_validate_vault_candidate`,
`hiss_prepare_vault_creation`, `hiss_prepare_vault_deposit`,
`hiss_prepare_vault_withdrawal`, `hiss_prepare_hiss_stake`,
`hiss_prepare_xhiss_cooldown`, `hiss_prepare_xhiss_redeem`, `hiss_validate_coil`,
`hiss_compile_coil`.

**Not MCP tools — HTTP API only.** CoilOps generation/scoring, receipts and share
cards, the Bankrbot → Robinhood path, autonomy-fuse validation, and Bankr
stock-token trading are **HTTP endpoints** on `https://app.hiss.finance` (e.g.
`POST /api/tools/generate-coil`, `POST /api/bankrbot/compile-robinhood-path`,
`POST /api/stocks/prepare-bankr-command`) — they are **not** MCP tools. See
`hiss-coilops`, `hiss-bankrbot-robinhood`, and `hiss-stock-tokens` for those
routes. Tool names and counts can change; the server's own list is authoritative.

## Hard rules for tool use

1. **Prepare/read only.** No tool executes a trade or a deposit. Signing and
   sending always belong to the user's wallet, Safe, or Bankr/Robinhood
   session.
2. **planned ≠ funded ≠ claimable.** A prepared intent or a split plan is
   data. Completion requires an on-chain receipt — never infer it from a
   tool's success.
3. **A failed read is "unknown"**, never "not deployed" and never "live".
4. **Fuses are binding.** Compilation tools refuse to weaken or drop a
   mandatory fuse.
5. **No credentials, ever.** Tools reject credential-shaped fields; pass
   wallet addresses and public inputs only.

## Example prompts

- "Using the HISS MCP tools, validate this Coil and write a receipt."
- "Call hiss_get_staking_status and tell me if staking is live."
- "Prepare a USDG vault deposit intent for the flagship vault."
- "Reconcile this Bankr stock-token trade by tx hash."
