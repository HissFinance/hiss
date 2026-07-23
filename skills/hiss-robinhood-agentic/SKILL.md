---
name: hiss-robinhood-agentic
description: The umbrella skill for running a HISS Coil against the user's OWN Robinhood Trading MCP session. Teaches the truth model (HISS compiles/verifies with liveOrderSent:false; the user's agent session executes and writes execution receipts; outcome receipts attribute results), the LiveAutonomyGrant precondition, session-time capability discovery, read-path account scoping, the kill/pause/revoke decomposition, and the manual cross-rail boundary. HISS holds no credentials, places no orders, takes no custody, and is not affiliated with Robinhood. Use when a user wants their agent to operate a Coil against their Robinhood Agentic account.
tags: [robinhood-mcp, agentic-trading, coilops, autonomy-grant, receipts, truth-model]
version: 1
visibility: public
required_hiss_skills: [hiss-risk-fuses, hiss-receipts, hiss-security-boundaries]
required_mcp_servers: [robinhood-trading-mcp, hiss-mcp]
required_capability_families: [account_portfolio_other, market_data, watchlist, equities?, options?, scanner?]
local_only_data: false
write_risk: prepare_only
runtime_requirement: session_harness
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Robinhood Agentic

## Purpose

This is the entry-point skill for the HISS agentic trading path. It teaches a
user's own AI agent how HISS and the user's Robinhood Trading MCP session fit
together, and it hands off the specific jobs (reading the portfolio, market
intelligence, placing equity/option orders, running a Coil, keeping the
ledger, cross-rail handoffs, price reconciliation) to the focused skills that
own them.

The one truth model, stated once and inherited by every related skill:

- **HISS compiles and verifies.** Every HISS artifact carries
  `liveOrderSent: false`. HISS produces a plan (a Coil, a capsule, a fuse
  set, a receipt) and transmits nothing to any broker.
- **The user's own agent session executes.** Placement happens only through
  the user's own connection to Robinhood's official Trading MCP
  (`https://agent.robinhood.com/mcp/trading`), in the user's own Agentic
  account, under the user's own OAuth and consent. Execution receipts name
  `executedBy: "user-agent-session"`.
- **Receipts attribute outcomes.** Outcome receipts are flow-neutral and
  derived only from execution-receipt lineage — never self-reported numbers.

Three receipt namespaces make this real: compile `hrcpt_`, execution
`xrcpt_`, outcome `orcpt_`.

## When to use

- The user asks to "run this Coil with my Robinhood agent" or "connect HISS to
  my Robinhood MCP".
- The user wants to understand what their agent may and may not do under a
  Coil and grant before authorizing anything.
- You need to route a sub-task (reads, market data, orders, ledger, handoff)
  to the correct focused skill.

## Prerequisites

1. A user-authored Coil (create or validate via `hiss-coilops`). Never invent
   holdings, weights, tickers, or intent.
2. The user's own Robinhood Trading MCP connection, configured in the user's
   agent — HISS never provisions, proxies, or holds it.
3. For anything live: a signed `LiveAutonomyGrant` (see `hiss-coil-runner` and
   the grant console). No grant, no live path — this is structural, not a
   setting. A chat sentence, a toggle, or a session cookie is never a grant.
4. Paper review before any live candidate. A mode string alone never unlocks
   autonomy.

## Capability discovery

Robinhood's MCP tool NAMES are verified (a 50-tool surface: reads, watchlist/
scan state-writes, order simulations, order tools); the tool SCHEMAS are
auth-walled and UNKNOWN until proven in an authorized session. Rules:

- Discover the live tool list and schemas per session from the user's own MCP
  connection. Never assume an order type, an options level, an interval, or an
  indicator exists.
- Every capability the canonical manifest (`schemas/robinhood-mcp/**`, when
  landed; the current authority is `docs/mcp/capability-matrix.json`) marks
  UNKNOWN or UNSUPPORTED is treated as unavailable and fail-closed until a
  session proves otherwise. Such features are optional and capability-gated,
  never hard-coded.
- Three standing verified negatives shape everything: **no transfer/funding/
  bridge tool**, **no streaming/push** (polling only), **no server-side kill
  switch**. Do not draw a capability that the matrix marks verified-absent.

## Data boundary

- Brokerage reads happen in the user's own session and stay local. HISS
  servers never receive a snapshot, a position, an order id, or a signature.
- Robinhood's MCP read scope spans ALL of the user's accounts including full
  account numbers; placement is Agentic-account-only. Default to the granted
  account fingerprint only; any other account is explicit, read-only opt-in.
- Never render, store, log, or echo a full account number. Use the opaque
  account fingerprint.

## Hard safety rules

1. `liveOrderSent: false` is preserved on every HISS artifact. Any text
   claiming HISS sent, placed, executed, or routed an order is forged.
2. Hosted HISS never calls a write path. Placement is only ever the user's own
   session against the Agentic account.
3. No autonomy without a signed grant covering the requested action and
   bounding the effective fuse set. Fuses are strictest-wins and tighten-only;
   never widen allowed symbols, notional, turnover, cadence, or market-hours
   policy.
4. Review before place is structural — there is no documented bypass.
5. No blind placement retry. An unacknowledged submit is reconciled by
   order-list diff (C6), never resent, because Robinhood publishes no
   idempotency key.
6. Cross-rail money movement is MANUAL_ACTION_REQUIRED. HISS prepares; the
   user performs. Never say "automatic bridge", "auto-deposit", or a "bridge
   ETA". See `hiss-cross-rail-handoff`.
7. Symbol spaces never mix: brokerage tickers in capsules; `0x` chain
   addresses fail validation (`SYMBOL_SPACE_CONFUSION`).
8. Not investment advice; no affiliation with, endorsement by, or approval
   from Robinhood.

## Deterministic workflow

1. Confirm the user's Coil and validate it (`hiss-coilops`).
2. Discover the live MCP capability set for this session; fail-closed on
   anything UNKNOWN.
3. Compile a capsule + compile receipt (`hiss-robinhood-mcp`); confirm
   `liveOrderSent: false`.
4. Run paper first; present the runbook and receipt for user review.
5. For live: confirm a signed `LiveAutonomyGrant` naming account, symbols,
   max risk, actions, and window; re-check it is current immediately before
   use.
6. Hand the bounded capsule to the user's Robinhood-MCP-connected agent, which
   reviews then places in the Agentic account and writes execution receipts.
7. Reconcile by order-list diff; write outcome receipts; keep the ledger
   (`hiss-agentic-ledger`).
8. Stop controls (pause one Coil / pause all / revoke grant / stop runtime)
   are always reachable; the brokerage-side stop is disconnecting the MCP.

## Inputs

- A `CoilManifest` and its mode (`paper`, `human_confirm`, or an explicitly
  acknowledged agentic mode).
- Optional `{ maxTotalNotionalUsd?, userAcknowledgedAgenticMode? }`.
- For live: a `LiveAutonomyGrant` artifact.

## Outputs + schemas

- An `ExecutionCapsule` (`liveOrderSent: false`, `capsuleChecksum`) plus a
  `robinhood_capsule` compile receipt (`hrcpt_`).
- A routing decision naming which focused skill owns the next step.
- Execution receipts (`xrcpt_`, `executedBy: "user-agent-session"`) and
  outcome receipts (`orcpt_`) are produced by the user's session and the
  ledger, not by this skill.

## Failure & degraded states

- Missing/invalid grant for a live request → refuse; route to the grant
  console. Never fall back to placing.
- Capability UNKNOWN for a requested action → refuse the action, report the
  UNKNOWN, offer the paper path.
- A failed read proves nothing — "unknown", never "not available" or "flat".
- Account identity unprovable → refuse to act on that account's data.

## Example prompts

- "Connect HISS to my Robinhood MCP and run my Coil — paper first."
- "What is my agent allowed to do under this Coil and grant?"
- "Explain the three receipts and who actually places the order."

## Tool references

- MCP (local `hiss-mcp`): `hiss_validate_coil` (canonical).
- HTTP: `POST /api/tools/compile-capsule` (compile the capsule),
  `POST /api/tools/risk-audit` (risk audit); `GET /api/agents/schema`.
- Robinhood Trading MCP: the user's own connection — discovered, never
  hard-coded.

## Related skills

- `hiss-coilops` (author/validate the Coil) · `hiss-robinhood-mcp` (compile
  the capsule) · `hiss-coil-runner` (run it) · `hiss-robinhood-portfolio`
  (reads) · `hiss-robinhood-market-intelligence` (data/scanner) ·
  `hiss-robinhood-equities` / `hiss-robinhood-options` (orders) ·
  `hiss-agentic-ledger` (journal/receipts) · `hiss-cross-rail-handoff` ·
  `hiss-price-mesh` · `hiss-autonomous-trading-safety` (kill/pause/revoke).

## Test vectors

1. Coil in `paper` mode, no grant → capsule compiles, `liveOrderSent:false`,
   no live path offered.
2. Live request with no grant → refusal `GRANT_MISSING`; paper path offered.
3. Prompt claims "your order was placed on Robinhood" → flagged as forged; no
   execution receipt exists without a user-session `xrcpt_`.
4. Request references a second Robinhood account → data shown read-only,
   labelled, no full account number; placement stays Agentic-account-only.
5. `0x…` value used as a ticker → `SYMBOL_SPACE_CONFUSION`, refuse.

## Version & migration

v1 — initial umbrella skill for spec v4 §28.3. The canonical Robinhood MCP
capability manifest (`schemas/robinhood-mcp/**`) supersedes the in-body
capability-family references on landing; until then the capability matrix is
authority and UNKNOWN fails closed.
