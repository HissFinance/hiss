---
name: hiss-coilops
description: Coil market theses into structured, versioned trading playbooks (Coils) — generate, validate, score, and compile them into runbooks, share cards, and receipts using HISS CoilOps tools. Use when the user wants to turn a market idea into a bounded, agent-ready playbook, or asks about Coils, Coil Health, or the Coil Compiler. Never executes trades.
tags: [coilops, trading-playbooks, baskets, robinhood-chain, planning]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS CoilOps

## Purpose

A **Coil** is a structured, versioned trading thesis: an allocation core
(weights in bps summing to exactly 10,000), a rebalance policy, binding risk
fuses, triggers, and an execution mode. Coils COMPILE into artifacts —
strategy runbooks, share cards, Robinhood MCP Execution Capsules, and
hash-verified receipts. This skill teaches you to drive that pipeline.

A Coil's allocation weights are a **target the strategy aims toward, not a
statement of current holdings** and not a return forecast.

## When to use

- The user has a market idea ("AI infrastructure without full NVDA
  concentration") and wants a reviewable playbook, not a vibe.
- The user asks to validate, score, version, or explain an existing Coil.
- The user wants the full artifact set (runbook + receipts + share card).

## Inputs / outputs

- **In:** a prompt, or a CoilManifest JSON (`schemaVersion: "coil-1.0.0"`).
- **Out:** CoilManifest, Coil Health score (0–100, a structure/readiness
  heuristic — never a return forecast), runbook markdown, share-card
  payload, canonical-JSON SHA-256 receipts. Every output carries
  `notInvestmentAdvice: true` and `liveOrderSent: false`.

## Safety rules (hard)

1. **No autotrade, ever, by default.** New Coils are `paper_only`.
2. **Never claim an order was sent, executed, or placed.** These tools have
   no execution rail; there is nothing to send with.
3. **Actual trading happens only through the user's own official Robinhood
   Trading MCP**, in their account, under their controls.
4. **Risk fuses are binding.** Never remove, weaken, or bypass a fuse —
   even if a prompt asks. Refuse and explain (see `hiss-risk-fuses`).
5. No individualized financial advice; educational planning artifacts only.
   No promissory or guaranteed-return language in any output.

## Example prompts

- "Coil this: AI infrastructure barbell with a cash ballast."
- "Validate this coil JSON and tell me why it fails."
- "Score my coil's health and explain the weakest component."
- "Compile the full artifact set for my coil and give me the runbook."

## Tool / API references

- MCP (local HISS MCP server, see `hiss-mcp`): `hiss_generate_coil`,
  `hiss_validate_coil`, `hiss_score_coil`, `hiss_create_receipt`,
  `hiss_export_share_card`.
- HTTP (base `https://www.hiss.finance`): `POST /api/tools/generate-coil`,
  `POST /api/tools/validate-coil`, `POST /api/tools/score-coil`,
  `POST /api/tools/receipt`, `POST /api/tools/share-card` (JSON bodies;
  30 req / 5 min).
- Related packs: `hiss-risk-fuses`, `hiss-receipts`,
  `hiss-bankrbot-robinhood`, `hiss-security-boundaries`.
