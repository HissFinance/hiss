---
name: hiss-coil-runner
description: Instructions for driving a compiled HISS Coil through the deterministic runtime loop against the user's OWN Robinhood MCP session — preview vs live kernels, at-most-once submit, order-list-diff reconciliation (no server idempotency), execution-time fuse evaluation, and the signed LiveAutonomyGrant gate. HISS compiles and verifies (liveOrderSent:false); the user's session submits and writes execution receipts. This is a set of instructions, not a service, daemon, or hosted runtime. Use when a user wants to operate a validated Coil turn by turn.
tags: [coil-runtime, agentic-trading, autonomy-grant, reconciliation, fuses, receipts]
version: 1
visibility: public
required_hiss_skills:
  [hiss-robinhood-agentic, hiss-coilops, hiss-risk-fuses, hiss-receipts, hiss-agentic-ledger]
required_mcp_servers: [robinhood-trading-mcp]
required_capability_families: [account_portfolio_other, market_data, equities?, options?, scanner?]
local_only_data: false
write_risk: user_signed
runtime_requirement: session_harness
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Coil Runner

## Purpose

This skill teaches an agent how to drive a compiled Coil through HISS's
deterministic runtime discipline: fold the local journal, evaluate fuses at
execution time, prepare an intent, hand it to the user's own Robinhood MCP
session for review-then-place, and reconcile the result. The runtime kernel is
a pure fold over journaled state; the same contract runs in a preview kernel
(no submission member exists) and a live kernel (refuses to construct without a
validated grant).

This is a description of a discipline the user's own runtime follows. It is not
a HISS-hosted daemon, database, or execution service — HISS transmits nothing.

## When to use

- The user has a validated Coil and a compiled capsule and wants to run it.
- The user asks what happens on each runtime tick, or why a tick halted.
- An unacknowledged submit needs reconciling.

## Prerequisites

1. A validated Coil + capsule with a compile receipt (`hiss-robinhood-mcp`).
2. The user's own Robinhood Trading MCP session.
3. For live: a signed `LiveAutonomyGrant` whose bounds contain the effective
   fuse set, whose granted actions cover the request, and that is current.
4. A local journal (`hiss-agentic-ledger`) for at-most-once and reconciliation.

## Capability discovery

- Discover order tools and their schemas per session; never assume an order
  type exists. UNKNOWN order shapes fail closed.
- Reconciliation strategy is fixed by two verified facts: **no published
  server idempotency key** and **no streaming/push**. Therefore order-list
  diffing against the journaled pre-submit snapshot (C6) is the only safe
  reconciliation, permanently, until Robinhood publishes an idempotency
  surface.
- Canonical capability source: `schemas/robinhood-mcp/**` (when landed);
  current authority `docs/mcp/capability-matrix.json`.

## Data boundary

- The journal, the grant signature, and the MCP session live with the user's
  runtime; nothing transits a HISS server.
- Broker reads are scoped to the granted account fingerprint; no full account
  number is journaled or rendered.

## Hard safety rules

1. Preview kernel has no submission member at all; live kernel refuses to
   construct without a validated grant. Two independent structural gates.
2. Fuses validate twice — compile and execution — and execution is
   authoritative. A tripped fuse halts with a typed reason; silent skips are
   defects. UNKNOWN input fails closed to a halt.
3. At-most-once submit. On an unacknowledged submit, DO NOT resend. Reconcile
   by order-list diff; a duplicate placement is the failure this rule exists to
   prevent.
4. Review before place is structural; no bypass path.
5. Halt (kill/pause) beats every state including mid-submit and exempts
   nothing from stopping.
6. `liveOrderSent: false` on every HISS artifact; the execution receipt is the
   user session's, never HISS's.
7. Adaptive tightening is tighter-only and only for grant-covered kinds;
   loosening requires a new signed grant and a recompile.

## Deterministic workflow (one tick)

1. Fold the journal to current state (positions, resting orders, counters,
   unreconciled submissions).
2. Evaluate the Coil's triggers against fresh reads (quote age within the
   grant's `maximumQuoteAgeSeconds`).
3. Compose the effective fuse set (grant `ack` layer → global → sector →
   asset → coil, strictest-wins) and evaluate at execution time.
4. On a pass: prepare an intent + per-operation confirmation; the user's
   session reviews then places in the Agentic account.
5. Record the submission in the journal BEFORE it is acknowledged (so a crash
   cannot lose it).
6. Reconcile by order-list diff; write the execution/outcome receipts.
7. On any halt: stop, record the typed reason, surface it; never retry blind.

## Inputs

- `{ coil, capsule, grant?, journalSnapshot, reads, nowIso }`.

## Outputs + schemas

- A `RuntimeDecision` per tick: `{ action: "prepare" | "halt" | "skip",
reason?, preparedIntent?, fuseEvaluations[] }`.
- A submission acceptance (`outcome: "pending_runtime_journal"`) — never an
  outcome; outcomes come from reconciliation.
- Execution receipts (`xrcpt_`) and outcome receipts (`orcpt_`) via the
  ledger.

## Failure & degraded states

- Stale/absent quote → `unverifiable` → halt (never act on stale data).
- Grant expired/revoked mid-run → halt; `broker_session_revoked` propagates a
  transport kill into the authorization layer.
- Reconciliation backlog over the gate → halt new placement until cleared.
- Missed trigger window → skip and journal; never a catch-up burst.

## Example prompts

- "Run one tick of my Coil and show me the fuse evaluations."
- "My submit wasn't acknowledged — how do I reconcile without double-placing?"
- "Why did the runtime halt on this tick?"

## Tool references

- MCP (local `hiss-mcp`): `hiss_validate_coil` (canonical).
- HTTP: `POST /api/tools/risk-audit` (fuse/risk audit),
  `POST /api/tools/compile-capsule` (capsule compile).
- The user's own Robinhood Trading MCP order + read tools (discovered).

## Related skills

- `hiss-robinhood-agentic` (truth model) · `hiss-robinhood-mcp` (capsule) ·
  `hiss-risk-fuses` (fuse algebra) · `hiss-agentic-ledger` (journal/receipts) ·
  `hiss-robinhood-equities` (order flow) · `hiss-autonomous-trading-safety`.

## Test vectors

1. Live kernel constructed without a grant → refuses to construct.
2. Fuse input missing at execution → `unverifiable` → halt (not a pass).
3. Submit unacknowledged → reconcile by diff; no resend.
4. Grant revoked mid-tick → next tick halts with `GRANT_REVOKED`.
5. Adaptive rule tightens an uncovered kind → dropped with a typed refusal,
   not applied silently.

## Version & migration

v1 — spec v4 §28.3. Documents the shipped `@hiss/core coil-runtime/**`
contract (journal fold, at-most-once submit, C6 reconciliation, preview/live
kernels). Capability references migrate to `schemas/robinhood-mcp/**` on
landing.
