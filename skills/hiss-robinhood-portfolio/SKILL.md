---
name: hiss-robinhood-portfolio
description: Instructions for reading the user's Robinhood portfolio through their OWN MCP session — accounts, positions, balances, and order history — scoped BY DEFAULT to the granted account fingerprint only. Robinhood's MCP read scope spans ALL of the user's accounts including full account numbers; this skill renders the granted account only, treats any additional account as explicit read-only opt-in, and never renders or stores a full account number. Reads are local to the user's session; HISS holds no brokerage data. Watchlist writes are user-initiated only, never an engine side effect. Use when a user wants their agent to read their Robinhood portfolio.
tags: [robinhood-mcp, portfolio, positions, account-scoping, read-only, privacy]
version: 1
visibility: public
required_hiss_skills: [hiss-robinhood-agentic]
required_mcp_servers: [robinhood-trading-mcp]
required_capability_families: [account_portfolio_other, watchlist]
local_only_data: false
write_risk: none
runtime_requirement: none
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Robinhood Portfolio

## Purpose

This skill teaches an agent to read the user's Robinhood portfolio through the
user's own MCP session — accounts, equity/option positions, balances, and
order history — under a strict account-scoping rule.

The verified asymmetry that governs everything here: the Robinhood MCP grants
READ access to ALL of the user's accounts, including full account numbers,
while placement is Agentic-account-only. So the default read scope is the
granted account fingerprint alone; anything wider is explicit, separated,
read-only opt-in.

## When to use

- The user asks what they hold, their balances, or their recent orders.
- A Coil needs current positions for a trigger (read-only input).

## Prerequisites

1. The user's own Robinhood Trading MCP session.
2. A granted account fingerprint to scope reads to (from the grant, when one
   exists; otherwise the user's explicit choice of a single account).

## Capability discovery

- Read tool NAMES are verified (`get_accounts`, `get_portfolio`,
  `get_equity_positions`, `get_option_positions`, `get_equity_orders`, …);
  their SCHEMAS are UNKNOWN and discovered per session. Read whatever the tool
  returns; assert no field that is not present.
- Some read tools are policy-denied for engine use (e.g. `get_pnl_trade_history`,
  `get_equity_tax_lots`) — performance and counters are receipt-derived, not
  sourced from unverified broker reads.
- Canonical capability source: `schemas/robinhood-mcp/**` (when landed);
  current authority `docs/mcp/capability-matrix.json`.

## Data boundary

- Reads happen in the user's own session and stay local. HISS servers never
  receive a snapshot, a position, a balance, or an order id.
- The runtime filters broker reads to the granted account fingerprint BEFORE
  anything renders or persists, and refuses to act when account identity
  cannot be proven.
- No full account number is ever rendered, stored, logged, or echoed — only
  the opaque fingerprint.

## Hard safety rules

1. Default scope = the granted account fingerprint only. A second account is
   shown only on explicit opt-in, visually separated, read-only, and
   not-actionable.
2. Reading is not placing. This skill emits no orders and needs no grant to
   read; placement lives in `hiss-robinhood-equities` / `-options`.
3. No full account numbers anywhere.
4. Watchlist writes (`create/update/follow/add_to/remove_from_watchlist`, …)
   are user-initiated only — never an engine side effect and never inside a
   trigger evaluation.
5. A failed read is "unknown", never "flat", "zero", or "no positions".
6. Performance is not computed here — see `hiss-agentic-ledger` (receipt-
   attributed only). No APY, no self-reported returns.

## Deterministic workflow

1. Resolve the account scope (granted fingerprint, or the user's single
   explicit choice). Prove account identity or refuse.
2. Read positions/balances/orders in the user's session for that scope only.
3. Render with the fingerprint, never a full number; label freshness (polled,
   not streamed).
4. If the user opts into another account, show it read-only and separated.

## Inputs

- `{ accountFingerprint, scope: "granted" | "explicit_optin",
include: ("positions" | "balances" | "orders")[], nowIso }`.

## Outputs + schemas

- `PortfolioView` `{ accountFingerprint, positions[], balances,
openOrders[], asOf, source: "user-session-poll" }` — no account number
  field exists in the schema.

## Failure & degraded states

- Account identity unprovable → refuse; show nothing for that account.
- Read tool returns an unknown-schema field → surface raw, claim nothing.
- Read fails → `unknown`, re-poll; never a fabricated flat state.
- User requests all accounts → require explicit per-account opt-in; never a
  single "all accounts" action by default.

## Example prompts

- "Show my positions and balances for my Agentic account."
- "What open orders do I have right now?"
- "Also show my other Robinhood account, read-only." (explicit opt-in)

## Tool references

- The user's Robinhood MCP read tools (discovered): `get_accounts`,
  `get_portfolio`, `get_equity_positions`, `get_option_positions`,
  `get_equity_orders`.

## Related skills

- `hiss-robinhood-agentic` (scoping rule) · `hiss-agentic-ledger`
  (performance) · `hiss-robinhood-market-intelligence` · `hiss-robinhood-equities`.

## Test vectors

1. No account identity proof → refuse, render nothing.
2. Full account number in a read response → replaced by fingerprint; never
   rendered.
3. Engine attempts a watchlist write during a trigger → denied.
4. "Show all my accounts" → per-account opt-in required; default stays granted
   account only.
5. Read failure → `unknown`, not "no positions".

## Version & migration

v1 — spec v4 §28.3. Account-scoping and no-full-number are invariants.
Capability references migrate to `schemas/robinhood-mcp/**` on landing.
