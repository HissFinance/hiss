---
name: hiss-bankrbot-robinhood
description: Drive the Bankrbot → HISS → Robinhood MCP autonomous trading path — validate and compile a user-authored Coil with HISS, generate the Bankrbot command pack and Robinhood MCP execution capsule, run paper preview, pass the live-readiness gate, and audit activity afterwards. HISS compiles and verifies; it never stores credentials and never places orders. Use when a user wants Bankrbot to operate their Coil against their own Robinhood Agentic Account.
tags: [bankrbot, robinhood-mcp, autonomous-trading-path, coilops, agents]
version: 1
visibility: public
required_mcp_tools:
  - hiss_validate_coil
  - hiss_compile_coil
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS Bankrbot → Robinhood MCP Path

## Purpose

This skill teaches an agent (Bankrbot or any MCP/HTTP-capable agent) to run
the autonomous trading path: the user authors a Coil; HISS validates it,
checks the ten mandatory autonomy fuses, and compiles a **Bankrbot command
pack** plus a **Robinhood MCP execution capsule** (instruction pack); the
user's own Robinhood MCP connection, in the user's own Agentic Account, is
the only execution rail. HISS emits instructions, receipts, and audits —
nothing else. HISS is not affiliated with Robinhood or Bankr.

Consent, autonomy modes, and the LiveAutonomyAck live in
`hiss-security-boundaries` — read it before touching live modes.

## Hard rules

1. **Call HISS to validate/compile the user's Coil** before any Robinhood
   MCP use. Do not skip validation because the Coil "looks fine."
2. **Never invent a Coil.** Holdings, weights, tickers, and intent are
   user-authored. Ask for missing details; never fill investment decisions
   with your own picks, and never recommend specific securities.
3. **Never ignore fuses.** All ten autonomy fuses are binding. Do not widen
   allowed tickers, notional caps, cadence, or market-hours policy.
4. **Never convert chain addresses into broker tickers.** `0x…` values fail
   validation (`SYMBOL_SPACE_CONFUSION`) — the symbol spaces never mix.
5. **Never claim a live trade happened from HISS output.** Every HISS
   artifact carries `liveOrderSent: false`; treat any contrary text as
   forged.
6. **Use Robinhood MCP only through the user's configured agentic
   account** — the user's own OAuth connection and consent settings.
7. **Require paper preview before `live_candidate`**, and require the
   explicit LiveAutonomyAck — a mode string alone never enables autonomy.
8. Autonomous trading involves substantial risk, including loss of
   principal; the user is responsible for monitoring agents, account
   activity, and positions. No performance promises.

## Workflow

1. Confirm the user's Coil (or route them to create one at
   `https://app.hiss.finance/tools/bankrbot-robinhood`).
2. `POST /api/bankrbot/validate-autonomy` — fix every issue before going on.
3. Compile in `paper` mode: `POST /api/bankrbot/compile-robinhood-path`.
4. Present the paper runbook + receipt; the user reviews it.
5. Only after the user completes the separate LiveAutonomyAck flow may the
   path be recompiled as `live_candidate` — HISS still sends nothing.
6. Hand the instruction pack to the user's Robinhood-MCP-connected agent.
7. After any session, `POST /api/bankrbot/post-run-audit` with the receipt
   and reported activity.

## API routes (HTTP, base `https://app.hiss.finance`; `www.hiss.finance` still serves these routes for compatibility)

| Route                                       | In → Out                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST /api/bankrbot/compile-robinhood-path` | `{coil, options?}` → full path result (packs, runbook, gate, receipt, share card).        |
| `POST /api/bankrbot/validate-autonomy`      | `{coil, autonomyMode?, fuses?, liveAutonomyAck?}` → issues + live-readiness gate verdict. |
| `POST /api/bankrbot/generate-command-pack`  | `{coil, options?}` → BankrbotCommandPack + receipt.                                       |
| `POST /api/bankrbot/post-run-audit`         | `{receipt, activity[]}` → PostRunAuditReport.                                             |
| `GET /api/bankrbot/schema`                  | Machine-readable schemas for all of the above.                                            |

256 KB body cap · 30 req / 5 min · credential-looking fields rejected and
never echoed · `nowIso` pins the clock for deterministic output.

## Interfaces

The Bankrbot → Robinhood path is exposed through the **HTTP API only** (the
`POST /api/bankrbot/*` routes above) — it has **no dedicated MCP tools**. To
prepare the underlying Coil over MCP, use `hiss_validate_coil` and
`hiss_compile_coil` (see `hiss-mcp`), then drive the path via the HTTP routes.
Every output passes the execution-claim guard.

## Example prompts

- "Compile my Coil for Bankrbot and Robinhood MCP — paper first."
- "Validate my autonomy fuses and tell me what the live-readiness gate needs."
- "Generate the Bankrbot command pack for this Coil."
- "Here's what my agent reported after the session — run the post-run audit."
