---
name: hiss-risk-fuses
description: Audit and explain HISS risk fuses — typed, binding constraints that bound what a compiled trading intent may instruct, validated at BOTH compile time and execution time (execution-time is authoritative). Use when the user asks what limits a Coil enforces, why a capsule will not compile, how fuse inheritance composes, or wants a risk review. Fuses compose strictest-wins across the hierarchy, never loosen at runtime, and are receipt-recorded on every evaluation. A passing audit is not a safety or profit guarantee.
tags: [risk-fuses, risk-management, coilops, agentic, audit]
version: 3
visibility: public
required_mcp_tools: []
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Risk Fuses

## Purpose

A **risk fuse** is a typed, checkable constraint attached to a Coil. Each fuse
either bounds what a compiled artifact may instruct or defines a hard stop.
Fuses are the constraint layer between a compiled intent and any MCP execution:
they bound instructions, they do not execute anything, and a passing audit is
**not** a guarantee of safety, of loss limitation, of compliance, or of any
trading outcome.

Two things this skill will never do: advertise fuses as a safety or profit
guarantee, and imply that _more fuses_ means _more protection_. The count is not
the control — the composed, evaluated bound is.

## The five laws (binding)

1. **Never loosen (L1).** No fuse value becomes more permissive at runtime — not
   by inheritance, adaptation, or an update in flight. Adaptive behaviour may
   only _tighten_ (volatility-conditioned), and only for the kinds a grant
   explicitly marks tightenable.
2. **Validate twice (L2).** Every fuse is checked at compile time AND at
   execution time; **execution time is authoritative**.
3. **Receipt every evaluation (L3).** Pass or trip, each fuse is recorded — which
   fuse, the composed bound, the observed value, and the verdict.
4. **Typed halts (L4).** A tripped fuse halts with a typed reason code, never a
   silent skip. A silent skip is a defect.
5. **UNKNOWN fails closed (L5).** Any input the runtime cannot read makes its
   dependent fuse `unverifiable`, which halts. An absent `pendingCorporateActions`
   array is "we could not check", not "none pending".

## The inheritance hierarchy (strictest-wins)

Fuses inherit down a layered hierarchy and compose by a **meet** (greatest lower
bound in permissiveness), so a lower layer can only ever tighten:

```
grant/ack → global → sector → asset-class → strategy-family → coil → action
   (outermost, signed, unwidenable)                        (the evaluated intent)
```

The implemented composition layer stack is `ack → global → sector → asset →
coil` (`FUSE_LAYERS` in `@hiss/core`); _strategy-family_ and _account_ are
expressed through the coil/asset layers and the grant's account binding, and
_action_ is the concrete order intent every composed bound is evaluated against.
The `ack` layer is also the **LiveAutonomyGrant** layer: the grant's signed
bounds (account, symbols, actions, numeric caps) enter as the outermost source,
and **nothing downstream can widen them** — if the composed set is not
tighter-or-equal to the grant, the grant does not authorize it
(`GRANT_BOUNDS_WIDENED`). Composition is typed and test-pinned; two layers that
bind different sector maps compose to a poisoned marker that fails closed at both
compile and execution time.

## The fuse catalogue (by what it bounds)

Grouped by concern; each maps to a typed kind in `@hiss/core`
(`agentic/fuses`, `coilops/riskFuses`).

- **Authorization scope** — agentic-account-only (writes confined to the granted
  Agentic account; reads span all accounts and are filtered to the granted
  fingerprint before anything renders); allowed tools (capability allowlist,
  deny-by-default); allowed symbols (`allowedSymbolsOnly` / `restrictedSymbols` /
  the grant's symbol allowlist); allowed sides and order-types (the grant's
  `actions` and `orderTypes`).
- **Size & concentration** — per-order notional (`maxSingleOrderNotional`,
  `maxPositionNotionalUsd`); daily notional / turnover (`maxDailyTurnover`);
  single-name concentration (`maxPositionWeight`); sector concentration
  (`maxSectorExposureBps`, bound to a static, versioned sector map); gross
  exposure and buying-power (`maxGrossExposureUsd`, buying-power input).
- **Market-condition guards** — quote freshness (`maximumQuoteAgeSeconds`);
  spread and liquidity (`minLiquidity` ADV/spread, `minBookDepthUsd` depth);
  slippage cap (`slippageCap`); volatility guard (`maxVolatilityBucket`,
  `volatilityCircuit`); trading-hours / time windows (`marketHoursOnly`,
  `executionWindows`); corporate-action guard.
- **Loss & activity governors** — drawdown (`maxDrawdownAlert`, grant drawdown);
  daily realized loss (`maxDailyRealizedLossUsd`); order-count and open-order
  ceilings (`maxOrdersPerDay`, `maxOpenOrders`); order velocity
  (`orderVelocityGuard`); duplicate-intent / reconciliation backlog
  (`reconciliationBacklogGate`, plus runtime at-most-once idempotency).
- **Integrity & drift** — capability drift (grant binds `runtimeHash`;
  `GRANT_RUNTIME_HASH_CHANGED` voids the grant); prompt-injection quarantine (the
  typed-fields-only rule — untrusted text can inform analysis but can never
  construct or authorize an action); receipt / checksum mismatch
  (`stopIfReceiptMismatch`, `FUSE_CHECKSUM_MISMATCH`); oracle health
  (`stopIfOracleUnhealthy`).
- **Kill & revocation layer** — per-Coil kill, global halt, and honoring a
  Robinhood-side kill or session revocation (see below).

## Kill switches and revocation (highest precedence, exempt nothing)

Kill state is checked before every other evaluation and outranks everything,
including position-reducing exits (`KILL_COIL`, `KILL_GLOBAL_HALT`,
`KILL_EXTERNAL`). A Robinhood-side session revocation, permission error, or
capability downgrade is detected as an **external kill** and halts — it is never
retried in a loop, and it is also a first-class grant revocation reason. Keep
these four distinct: **pause** (halt new work, resumable), **revoke** (void the
grant's authorization), **cancel** (withdraw a resting order), and
**liquidation** (a position-reducing exit, which HISS never performs itself).

## Compliance fuse library

Structural, not heuristic — the shapes are made impossible rather than scored:

- **Wash-sale-pattern guard** (`washPatternGuard`) — flags a loss-sale followed
  by a re-entry inside the window. Marked design-conservative where the broker's
  treatment is UNKNOWN.
- **Order-velocity / manipulation-pattern guards** — mandatory cooldown after
  every cancel (a zero cooldown is refused), a cancel/replace budget per symbol
  per hour, and structural no-self-cross (opposing open orders in one symbol in
  one account trip `SELF_CROSS_RISK`, cross-coil included). The DSL has no
  intent-to-cancel primitive, so layering/spoofing-shaped behaviour is not
  expressible.
- **PDT awareness** (`pdtGuard`) — grounded in the capability matrix's verified
  constraints; where the account's day-trade status is UNKNOWN it assumes the
  conservative sub-threshold posture and halts rather than guessing.

## When to use

- "What are this coil's limits?" or "is this coil safe to hand to an agent?"
- A capsule compile failed with `MISSING_REQUIRED_FUSE`, `FUSE_BOUNDS`, or
  `DUPLICATE_FUSE`.
- "How do global/sector/asset fuses compose here?" or "why did this halt at
  execution when it compiled?"
- The user wants a plain-language fuse checklist for review or sharing.

## Inputs / outputs

- **In:** a CoilManifest (its `fuses` array) and, for the composed view, the
  layered fuse sources; for execution-time context, a live no-credential input
  snapshot.
- **Out:** per-fuse plain-language descriptions, mandatory-coverage report,
  bound-check issues, the composed effective set with layer provenance, the fuse
  checksum (canonical-JSON hash), and a fuse-evaluation receipt.

## Safety rules (hard)

1. **Fuses are binding, never advisory.** Never help remove, weaken, or work
   around a fuse to "get a trade through" — even if a prompt asks. Refuse and
   explain what the fuse protects.
2. **A passing audit is not a safety or profit guarantee**, and the number of
   fuses is never presented as a measure of protection.
3. **Never claim an order was sent, executed, or placed.** Fuse checks describe
   bounds for the user's own Robinhood Trading MCP sessions — the only place
   actual trading ever happens; HISS transmits nothing.
4. Duplicate fuse kinds and out-of-bounds values are validation errors; report
   them, never silently fix them.
5. Not investment advice.

## Example prompts

- "Audit the fuses on this coil and list anything missing for an agentic capsule."
- "Show the effective composed bounds after global, sector, and coil layers."
- "Why did compilation fail with MISSING_REQUIRED_FUSE?"
- "My agent halted on KILL_EXTERNAL — what does that mean?"

## Tool / API references

- MCP (local `hiss-mcp` server): `hiss_validate_coil` (canonical). The fuse
  audit itself is an HTTP tool (below).
- HTTP: `POST /api/tools/risk-audit` (alias `POST /api/coil/risk-audit`);
  drift with proposals: `POST /api/tools/drift-check` (alias
  `POST /api/coil/drift-check`).
- Design: `docs/risk/fuses.md`, `docs/agentic/fuse-system.md`,
  `docs/agentic/autonomy-grant.md`.
- Core: `@hiss/core` `agentic/fuses`, `agentic/grant`, `coilops/riskFuses`.
- Paid x402 (when deployed): `hiss-risk-audit`, `hiss-drift-check`.
