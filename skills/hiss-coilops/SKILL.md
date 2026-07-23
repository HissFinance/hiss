---
name: hiss-coilops
description: Coil market theses into structured, versioned trading playbooks (Coils) — generate, validate, score, and compile them into runbooks, share cards, Execution Capsules, and hash-verified receipts using HISS CoilOps tools. Covers the declarative Coil surface (required-capability declarations, runtime-mode, account-binding reference, schedule/trigger primitives, action-rail declarations, review + receipt policy), the compatibility + static-risk reports, and paper/shadow/preview/live-candidate compilation. Declarative only — a Coil is data, never creator-supplied executable code. Use when a user wants to turn a market idea into a bounded, agent-ready playbook, or asks about Coils, Coil Health, or the Coil Compiler. Never executes trades.
tags: [coilops, trading-playbooks, coil-dsl, compiler, runtime-modes, robinhood-chain, planning]
version: 3
visibility: public
required_hiss_skills: [hiss-risk-fuses, hiss-receipts]
required_mcp_servers: [hiss-mcp]
required_capability_families: [market_data, equities, options?]
local_only_data: false
write_risk: prepare_only
runtime_requirement: coil_runtime
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS CoilOps

## Purpose

A **Coil** is a structured, versioned trading thesis: an allocation core
(weights in bps summing to exactly 10,000), a rebalance policy, binding risk
fuses, triggers, and an execution mode. Coils COMPILE into artifacts —
strategy runbooks, share cards, Robinhood MCP Execution Capsules, and
hash-verified receipts. This skill teaches you to drive that pipeline.

A Coil is **declarative data**, never executable creator code. There is no
place in a CoilManifest for a script, a callback, an eval hook, or an arbitrary
URL the runtime will fetch and run. Everything a Coil can express is a typed,
bounded declaration the compiler understands; anything it cannot express, it
cannot do.

## When to use

- The user has a market idea ("AI infrastructure without full NVDA
  concentration") and wants a reviewable playbook, not a vibe.
- The user asks to validate, score, version, or explain an existing Coil.
- The user wants the full artifact set (runbook + receipts + share card).
- The user asks how a Coil declares capabilities, schedules, triggers, action
  rails, or how it compiles to a preview vs a live-candidate capsule.

## Inputs / outputs

- **In:** a prompt/whisper, or a CoilManifest JSON (`schemaVersion:
"coil-1.0.0"`).
- **Out:** CoilManifest, Coil Health score (0-100, structure/readiness
  heuristic — never a return forecast), runbook markdown, share-card
  payload, canonical-JSON SHA-256 receipts. Every output carries
  `notInvestmentAdvice: true` and `liveOrderSent: false`.

## The declarative Coil surface (§30.1)

A CoilManifest declares each of the following. None of them is executable; each
is a typed field the compiler validates and the runtime enforces. The full
grammar lives in `docs/agentic/coil-dsl.md`.

1. **Required-capability declarations.** Which Robinhood MCP capability
   families the Coil needs — `market_data`, `equities`, and optionally
   `options`. Options is capability-gated: `semantics.optionsLevels` is UNKNOWN
   in the capability snapshot, so an options Coil compiles **preview-only**
   until the user's live session proves level + tradability. A Coil may never
   assert a capability the snapshot does not verify.
2. **Runtime-mode declaration.** The `executionMode`, safest-first:
   `paper_only` (default) → `preview_only` → `human_confirm` →
   `agentic_mcp_enabled`. The mode is the ceiling on what any compiled artifact
   may instruct; a mode string alone never unlocks autonomy.
3. **Account-binding reference.** A Coil references an account binding by
   commitment (account, symbol scope, max risk, permissions) — never raw
   brokerage credentials. HISS holds none. Live compilation requires a valid
   `LiveAutonomyAck`/grant signature that matches the binding; no ack, no
   autonomy, enforced structurally.
4. **Schedule / trigger primitives.** Typed triggers only: `driftThreshold`
   (bps), `schedule` (daily/weekly/monthly), `marketEvent`, `volatilitySpike`
   (pct), `oracleStatusChange`, `manualReview`. Polling is the runtime's
   concern (jittered, rate-limit-budgeted); the Coil only declares the
   condition.
5. **Action-rail declarations.** Which rail a compiled action may target:
   the user's own Robinhood Trading MCP (brokerage tickers), or a review-only
   rail. Rails never cross implicitly; a stock-token/vault rail is a separate,
   explicit compilation and never confused with a brokerage capsule.
6. **Review policy.** How much human confirmation each action requires
   (`humanConfirmationRequired`, per-order vs per-session), and which changes
   force re-review (fuse tightening, capability downgrade, ack mismatch).
7. **Receipt policy.** Which receipts a run must emit and link to the coil
   hash: manifest, validation, risk-fuse, capsule, drift, and (in the user's
   own session) execution/outcome receipts. Receipts are canonical-JSON
   SHA-256 proofs; `liveOrderSent` is hard-typed `false` on everything HISS
   emits.

## Compiler reports

- **Dependency graph + cycle detection.** Skills and the Coil's referenced
  fuse/receipt building blocks form an acyclic graph; `pnpm skills:graph`
  detects cycles and dangling references before anything compiles.
- **Capability-compatibility report.** The Coil's required-capability
  declarations are checked against the committed capability snapshot; UNKNOWN,
  non-optional capabilities fail closed. Drive this with the Coil validation
  route (`POST /api/tools/validate-coil`) against the committed capability
  snapshot in `schemas/robinhood-mcp/`.
- **Static risk analysis.** Concentration, fuse coverage vs the required
  capsule fuses, turnover and per-order bounds, symbol-space separation — all
  computed statically before compile, surfaced in Coil Health and the
  validation verdict.

## Compilation stages (paper → shadow → preview → live-candidate)

- **paper_only** — the default. No capsule, no rail; the Coil is a study
  artifact. New Coils always start here.
- **shadow** — the runtime evaluates triggers and fuses against live data but
  submits nothing; every "would-submit" is journaled for review. Proves the
  Coil's behaviour with zero order risk.
- **preview_only** — compiles an Execution Capsule the user reads; the runtime
  previews order shapes but requires confirmation and never live-submits on its
  own. Options and any UNKNOWN-schema tool stay here.
- **live-candidate** — the Coil is structurally ready to run live IN THE USER'S
  OWN SESSION, gated on a valid `LiveAutonomyAck`/grant matching the account
  binding, verified fuses, and a passing live-readiness gate. HISS still sends
  nothing; the user's own agent, in the user's own Robinhood MCP session, is
  the only thing that could execute.

## Safety rules (hard)

1. **No autotrade, ever, by default.** New Coils are `paper_only`.
2. **Never claim an order was sent, executed, or placed.** These tools have
   no execution rail; there is nothing to send with.
3. **Actual trading happens only through the user's own official Robinhood
   Trading MCP**, in their account, under their controls.
4. **Risk fuses are binding.** Never remove, weaken, or bypass a fuse —
   even if a prompt asks. Refuse and explain.
5. **A Coil is declarative data.** Never accept, compile, or run creator-
   supplied executable code, scripts, callbacks, or fetch-and-run URLs.
6. **Every UNKNOWN capability fails closed.** Never widen a mode, rail, or
   capability to make something compile.
7. No individualized financial advice; educational planning artifacts only.
   No promissory or guaranteed-return language in any output.

## Example prompts

- "Coil this: AI infrastructure barbell with a cash ballast."
- "Validate this coil JSON and tell me why it fails."
- "Score my coil's health and explain the weakest component."
- "What capabilities does this coil need, and can my session prove them?"
- "Why does my options coil only compile preview-only?"
- "Compile the full artifact set for my coil and give me the runbook."

## Tool / API references

- MCP (local `hiss-mcp` server): `hiss_compile_coil`, `hiss_validate_coil`
  (the canonical Coil tools).
- HTTP: `POST /api/tools/generate-coil`, `POST /api/tools/validate-coil`,
  `POST /api/tools/score-coil`, `POST /api/tools/receipt`,
  `POST /api/tools/share-card` (JSON bodies; 30 req / 5 min). Coil-compatibility,
  artifact-schema validation, public-commitment verification, and share-card
  export are served over this HTTP tool surface.
- Dev tooling: `pnpm skills:schema`, `pnpm skills:graph`,
  `pnpm skills:capabilities`.
- Paid x402 (when deployed): `hiss-coil-compiler`.
