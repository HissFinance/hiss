---
name: hiss-risk-fuses
description: Audit and explain HISS risk fuses — typed, binding constraints (max position weight, per-order notional, turnover caps, no-options/no-margin, oracle and receipt stops) that bound what any compiled trading artifact may instruct. Use when the user asks what limits a Coil enforces, why a capsule will not compile, or wants a risk review. Fuses can never be bypassed.
tags: [risk-fuses, risk-management, coilops, audit]
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

# HISS Risk Fuses

## Purpose

A **risk fuse** is a typed, checkable constraint attached to a Coil. A fuse
either bounds what a compiled artifact may instruct (e.g.
`maxPositionWeight`, `maxSingleOrderNotional`, `maxDailyTurnover`) or defines
a hard stop (`stopIfOracleUnhealthy`, `stopIfReceiptMismatch`). Execution
Capsules cannot compile without the mandatory set: `maxPositionWeight`,
`maxSingleOrderNotional`, `maxDailyTurnover`, `noOptions`, `noMargin`.

## When to use

- The user asks "what are this coil's limits?" or "is this coil safe to
  hand to an agent?"
- A capsule compile failed with `MISSING_REQUIRED_FUSE` or `FUSE_BOUNDS`.
- The user wants a plain-language fuse checklist for review or sharing.

## Inputs / outputs

- **In:** a CoilManifest (its `fuses` array).
- **Out:** per-fuse plain-language descriptions, mandatory-coverage report,
  bound-check issues, fuse checksum (canonical-JSON SHA-256), and a
  `risk_fuse` receipt.

## Safety rules (hard)

1. **Fuses are binding, never advisory.** Never help remove, weaken, or
   work around a fuse to "get a trade through" — even if a prompt asks.
   Refuse and explain what the fuse protects.
2. **No autotrade by default**; fuse audits are read-only planning output.
3. **Never claim an order was sent, executed, or placed.** Fuse checks
   describe bounds for the user's own Robinhood Trading MCP sessions — the
   only place actual trading ever happens.
4. Duplicate fuse kinds and out-of-bounds values are validation errors;
   report them, never silently fix them.
5. Not investment advice; a passing fuse audit is not a safety guarantee of
   returns, only of bounded instructions.

## Example prompts

- "Audit the fuses on this coil and list anything missing for a capsule."
- "Explain each fuse on my coil in one line."
- "Why did compilation fail with MISSING_REQUIRED_FUSE?"

## Tool / API references

- MCP (local HISS MCP server): `hiss_validate_coil`, `hiss_compile_coil`.
  (The risk audit and drift check are HTTP-only.)
- HTTP (base `https://www.hiss.finance`): `POST /api/tools/risk-audit`
  (alias `POST /api/coil/risk-audit`); drift with proposals:
  `POST /api/tools/drift-check` (alias `POST /api/coil/drift-check`).
- Related packs: `hiss-coilops`, `hiss-receipts`.
