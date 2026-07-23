---
name: hiss-robinhood-equities
description: Instructions for the equity order lifecycle through the user's OWN Robinhood MCP session — review → place → reconcile — confined to the Agentic account. HISS compiles the bounded intent (liveOrderSent:false); the user's session reviews (structural, no bypass), places, and writes the execution receipt (executedBy user-agent-session); reconciliation is by order-list diff because Robinhood publishes no idempotency key (never a blind retry). Order types and parameters are discovered per session, never assumed. Placement requires a signed LiveAutonomyGrant. Use when a user wants their agent to work equity orders.
tags: [robinhood-mcp, equities, orders, review-place-reconcile, autonomy-grant]
version: 1
visibility: public
required_hiss_skills: [hiss-robinhood-agentic, hiss-risk-fuses, hiss-receipts]
required_mcp_servers: [robinhood-trading-mcp]
required_capability_families: [equities?, market_data, account_portfolio_other]
local_only_data: false
write_risk: user_signed
runtime_requirement: session_harness
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Robinhood Equities

## Purpose

This skill teaches an agent the equity order lifecycle — review, place,
reconcile — as it actually works under the HISS truth model. HISS compiles a
bounded intent and transmits nothing (`liveOrderSent: false`). The user's own
Robinhood MCP session reviews the order, places it in the Agentic account, and
writes the execution receipt. HISS then reconciles by order-list diff.

## When to use

- The user wants to place, review, or reconcile an equity order from a Coil.
- A Coil's trigger fired and an equity intent needs to be prepared.

## Prerequisites

1. A validated Coil + compiled capsule with a compile receipt.
2. The user's own Robinhood MCP session.
3. A signed `LiveAutonomyGrant` covering `place_order` (and `cancel_order` /
   `replace_order` if used), naming the account, symbols, order types, and
   numeric bounds. No grant, no placement.
4. Paper review before any live candidate.

## Capability discovery

- Order tool NAMES are verified (`review_equity_order`, `place_equity_order`,
  `cancel_equity_order`, `get_equity_orders`, `get_equity_tradability`); their
  SCHEMAS and the set of supported order types are UNKNOWN. Discover the
  available order types per session from the live schema — never assume
  `market`, `limit`, `stop_market`, or `stop_limit` exists. An order type the
  grant does not cover is not used.
- No published server idempotency key and no streaming → order-list diffing
  against the journaled pre-submit snapshot (C6) is the only safe
  reconciliation.
- Canonical capability source: `schemas/robinhood-mcp/**` (when landed);
  current authority `docs/mcp/capability-matrix.json`.

## Data boundary

- Placement is Agentic-account-only. Reads are scoped to the granted account
  fingerprint. Nothing transits a HISS server. No full account number renders.

## Hard safety rules

1. Review before place is STRUCTURAL — there is no documented bypass. The
   broker's `review_*` is a simulation returning warnings, not a two-phase
   commit, so the agent-layer review is the only real human gate and it fails
   toward not-sending.
2. No blind placement retry. An unacknowledged submit is reconciled by
   order-list diff, never resent — a duplicate placement is the exact failure
   this prevents.
3. Placement only in the Agentic account, only through the user's session.
   `liveOrderSent: false` stays on every HISS artifact; the execution receipt
   is the user session's `xrcpt_`.
4. Fuses are strictest-wins and tighten-only; the grant's bounds contain the
   effective set. Never widen symbols, notional, turnover, or cadence.
5. Discover order types per session; use only grant-covered types.
6. Not investment advice; substantial risk including loss of principal. No
   performance promises, no APY.

## Deterministic workflow

1. Compile a bounded equity intent from the Coil (symbol, side, size, order
   type ∈ grant-covered ∩ session-supported).
2. Evaluate the effective fuse set at execution time; halt on any trip or
   UNKNOWN.
3. The user's session calls `review_equity_order`; surface the warnings for a
   human gate (per the grant's review policy; an unanswered review expires,
   never approves).
4. On approval, the user's session `place_equity_order` in the Agentic
   account and writes the `xrcpt_`. Journal the submission before it is
   acknowledged.
5. Reconcile by `get_equity_orders` diff against the journaled snapshot; write
   the `orcpt_`.
6. Cancel/replace only if granted; treat each as its own authorized action.

## Inputs

- `{ coil, intent: { symbol, side, size, orderType?, limitPrice? }, grant,
journalSnapshot, nowIso }`.

## Outputs + schemas

- A `PreparedEquityIntent` `{ symbol, side, size, orderType, bounds,
fuseEvaluations[], liveOrderSent: false }` plus an `hrcpt_`.
- Execution `xrcpt_` and outcome `orcpt_` are written by the user session /
  ledger.

## Failure & degraded states

- No grant / grant doesn't cover the action → refuse (`GRANT_MISSING` /
  `GRANT_ACTION_NOT_GRANTED`).
- Order type unsupported this session or not grant-covered → refuse; do not
  substitute.
- Review unanswered within the timeout → expires (never auto-approves).
- Submit unacknowledged → reconcile by diff; no resend.
- Fuse UNKNOWN at execution → halt.

## Example prompts

- "Prepare a limit buy for 100 NVDA under my grant — review first."
- "My place call didn't get acknowledged — reconcile it without double-buying."
- "What equity order types does my session actually support?"

## Tool references

- The user's Robinhood MCP order tools (discovered): `review_equity_order`,
  `place_equity_order`, `cancel_equity_order`, `get_equity_orders`,
  `get_equity_tradability`.
- HISS compile (HTTP): `POST /api/tools/compile-capsule` (capsule),
  `POST /api/tools/risk-audit` (risk audit).

## Related skills

- `hiss-coil-runner` (runtime loop) · `hiss-robinhood-agentic` (truth model) ·
  `hiss-risk-fuses` · `hiss-agentic-ledger` · `hiss-robinhood-options`.

## Test vectors

1. Place requested without a grant → refuse.
2. `stop_limit` requested but not session-supported → refuse, no substitute.
3. Review unanswered past timeout → expires.
4. Unacknowledged submit → reconcile by diff, no resend.
5. Intent notional exceeds grant bound → fuse trip, halt.

## Version & migration

v1 — spec v4 §28.3. Review-before-place (no bypass) and no-blind-retry are
invariants. Capability references migrate to `schemas/robinhood-mcp/**` on
landing.
