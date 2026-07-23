---
name: hiss-price-mesh
description: Instructions for reconciling prices across the user's two rails while strictly separating a REFERENCE QUOTE (informational, may be stale, never executable) from EXECUTABLE LIQUIDITY (what a specific venue could actually fill for a specific size, session-discovered). Combines Robinhood MCP equity/index quotes (schema-unknown) and Robinhood Chain reads under per-source freshness budgets; never presents a reference quote as a fill, never claims a cross-rail parity. This is a set of instructions, not a price oracle service. Use when a user needs a cross-rail price view or asks "what can I actually get".
tags: [price-mesh, quotes, liquidity, cross-rail, robinhood-chain, freshness]
version: 1
visibility: public
required_hiss_skills: [hiss-robinhood-market-intelligence]
required_mcp_servers: [robinhood-trading-mcp]
required_capability_families: [market_data?]
local_only_data: false
write_risk: none
runtime_requirement: none
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Price Mesh

## Purpose

This skill teaches an agent to build a coherent cross-rail price view while
keeping two things that are constantly conflated strictly apart:

- **Reference quote** — an informational price from a source (a Robinhood MCP
  quote, a chain read). It may be stale, it is not a promise, and it is never
  what you will fill at.
- **Executable liquidity** — what a specific venue could actually fill for a
  specific size right now, established only per session against that venue's
  live surface.

A reference quote is never rendered as a fill. A cross-rail price is never
rendered as a parity or a conversion guarantee.

This is a description of a reconciliation discipline, not a HISS-hosted price
oracle or data service.

## When to use

- The user asks for a price across rails, or "what can I actually get for this
  size".
- A Coil needs a freshness-bounded reference for a trigger (the executable
  side is proven at placement, not at trigger time).

## Prerequisites

1. For brokerage quotes: the user's own Robinhood MCP session.
2. For chain prices: public RPC reads on Robinhood Chain (4663).

## Capability discovery

- Robinhood quote tools (equity/index/price-book) have VERIFIED names but
  UNKNOWN schemas: depth semantics, book levels, and intervals are discovered
  per session, never assumed. "Level 2 depth" is not claimed unless the live
  tool returns it and its meaning is proven.
- There is no streaming/push; every quote is a poll with an age. Freshness
  budgets per source are mandatory.
- Canonical capability source: `schemas/robinhood-mcp/**` (when landed);
  current authority `docs/mcp/capability-matrix.json`.

## Data boundary

- Brokerage quotes are read in the user's own session and stay local.
- Chain reads come from public RPC. Brokerage and chain are different custody
  and pricing domains; a combined view is a convenience, never a single book.

## Hard safety rules

1. Separate reference-quote from executable-liquidity on every surface. A
   reference quote is labelled as such and never presented as a fill price.
2. No cross-rail parity or conversion claim. A tokenized-stock price on chain
   and a brokerage quote for the same underlying are two different things.
3. Every quote carries its source and its age; a quote older than its budget
   is `stale`, not shown as current, and never used to place.
4. Executable liquidity is size-specific and session-proven; do not
   extrapolate depth beyond what the venue returned.
5. Tokenized stocks are economic exposure, not direct share ownership; the two
   are never priced as identical.
6. No performance framing, no APY, no yield — this skill prices, it does not
   promise returns.

## Deterministic workflow

1. For each requested symbol/rail, poll the reference source; stamp source +
   age; mark `stale` if over budget.
2. Assemble a reference view: per-rail reference quotes, each labelled, each
   with freshness.
3. If the user needs an executable answer, query the specific venue's live
   surface for the specific size in the user's session; return executable
   liquidity separately, never merged into the reference number.
4. Present both layers with the custody/domain disclosure; never a single
   blended "price".

## Inputs

- `{ symbols[], rails: ("brokerage" | "chain")[], size?, freshnessBudgets,
nowIso }`.

## Outputs + schemas

- `PriceMeshView` `{ reference: { rail, symbol, price, source, ageSeconds,
stale }[], executable?: { venue, symbol, size, indicativeFill, ageSeconds,
sessionProven: boolean }[] }`.

## Failure & degraded states

- Quote over freshness budget → `stale`; not used for placement.
- Executable query unavailable → executable layer omitted (not filled from the
  reference quote).
- Schema-unknown depth field → returned raw, no depth claim layered on top.
- Chain read fails → that rail is `unknown`, never assumed flat or at parity.

## Example prompts

- "Show me reference prices for NVDA on both rails with their freshness."
- "What could I actually fill 200 shares at right now?" (executable, session)
- "Is the chain token price the same as the brokerage quote?" (no — explain)

## Tool references

- The user's Robinhood MCP quote tools (discovered) for brokerage reference.
- Public RPC (`rpc.mainnet.chain.robinhood.com`) for chain reads.

## Related skills

- `hiss-robinhood-market-intelligence` (quotes/scanner) · `hiss-stock-tokens`
  (chain stock-token venue) · `hiss-cross-rail-handoff` · `hiss-robinhood-equities`.

## Test vectors

1. Reference quote 90s old with a 30s budget → `stale`; excluded from
   placement.
2. User asks "what will I fill at" → executable layer, size-specific, session
   -proven; reference number not reused as the fill.
3. Chain vs brokerage same underlying → two prices, no parity claim.
4. Depth field of unknown schema → returned raw, no "level 2" claim.
5. Chain RPC failure → rail `unknown`, not parity.

## Version & migration

v1 — spec v4 §28.3. Reference/executable separation is the invariant.
Capability references migrate to `schemas/robinhood-mcp/**` on landing.
