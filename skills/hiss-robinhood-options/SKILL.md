---
name: hiss-robinhood-options
description: Capability-gated, discovery-first instructions for options through the user's OWN Robinhood MCP session. Options tool schemas, the account's options level, and whether single-leg or multi-leg (spread) or index options are supported are ALL UNKNOWN until proven in an authorized session — so this skill hard-codes NO options level, NO leg-count claim, and NO index-option claim, and stays fail-closed until a session proves each. When supported, the flow is the same review→place→reconcile under a signed grant that must explicitly cover options, with assignment and early-assignment risk disclosed. HISS compiles (liveOrderSent:false); the user's session executes. Use when a user asks about options and only after capability is proven.
tags: [robinhood-mcp, options, capability-gated, discovery-first, autonomy-grant]
version: 1
visibility: public
required_hiss_skills: [hiss-robinhood-agentic, hiss-risk-fuses, hiss-receipts]
required_mcp_servers: [robinhood-trading-mcp]
required_capability_families: [options?, market_data, account_portfolio_other]
local_only_data: false
write_risk: user_signed
runtime_requirement: session_harness
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Robinhood Options

## Purpose

This skill teaches an agent how to approach options through the user's own
Robinhood MCP session under strict capability gating. Options are the most
schema-uncertain part of the surface: the tool schemas are UNKNOWN, the
account's options level is UNKNOWN, and whether multi-leg spreads or index
options are supported is UNKNOWN. This skill therefore asserts none of those
and stays fail-closed until a session proves each one.

## When to use

- The user asks about an options strategy AND you can prove options capability
  in their session.
- Until capability is proven, this skill explains why options are unavailable
  and offers the equity path.

## Prerequisites

1. The user's own Robinhood MCP session with options tools present AND their
   schemas proven this session.
2. A proven account options level for the specific action.
3. A signed `LiveAutonomyGrant` whose `assetClasses` explicitly include
   options — options are prohibited by an absent asset class. A general
   equities grant never authorizes options.
4. Paper review before any live candidate.

## Capability discovery (the core of this skill)

Everything is discovered, nothing assumed:

- Do the option tools exist this session? (`review_option_order`,
  `place_option_order`, `cancel_option_order`, `get_option_positions`,
  `get_option_quotes`, `get_index_quotes`) — names are verified, schemas are
  UNKNOWN.
- What options level does this account have for this action? UNKNOWN until
  proven; assert none.
- Is multi-leg / spread submission supported? UNKNOWN — do NOT claim
  single-leg-only and do NOT claim multi-leg support; fail closed either way
  until proven.
- Are index options supported? UNKNOWN — make no index-option claim.
- Canonical capability source: `schemas/robinhood-mcp/**` (when landed);
  current authority `docs/mcp/capability-matrix.json`. Any UNKNOWN → the
  action is unavailable.

## Data boundary

- Reads in the user's own session, scoped to the granted account fingerprint;
  placement Agentic-account-only; nothing transits a HISS server; no full
  account number renders.

## Hard safety rules

1. No hard-coded options level, leg-count capability, or index-option
   capability. Each is proven per session or the action is refused.
2. Options require a grant that explicitly covers the options asset class.
   Every option intent is evaluated against the effective fuse set at
   execution time — strictest-wins and tighten-only, the grant's bounds
   containing it (notional, position/assignment-risk concentration, allowed
   symbols, session/expiry windows) — and halts on any trip, UNKNOWN, kill
   switch, or grant revocation, exactly as [[hiss-robinhood-equities]] and
   [[hiss-coil-runner]] do. Options never get a looser bound than equities.
3. Review before place is structural; no bypass. No blind retry; reconcile by
   order-list diff.
4. Assignment and early-assignment risk are disclosed for any short-option or
   spread leg; expiration and exercise mechanics are the user's responsibility.
5. `liveOrderSent: false` on every HISS artifact; the execution receipt is the
   user session's.
6. Not investment advice; options carry substantial risk including total loss
   of premium and, for short legs, losses exceeding premium. No performance
   promises, no APY, no income-strategy framing presented as yield.

## Deterministic workflow

1. Prove options tools + schemas + level for the requested action; if any is
   UNKNOWN, refuse and offer the equity path.
2. Confirm the grant covers options; refuse otherwise.
3. Compile a bounded option intent (only shapes proven supported this session).
4. Evaluate fuses at execution; the user's session reviews (assignment
   warnings surfaced), places in the Agentic account, writes the `xrcpt_`.
5. Reconcile by order-list diff; write the `orcpt_`.

## Inputs

- `{ coil, optionIntent, grant, sessionCapabilityProof, nowIso }`.

## Outputs + schemas

- A `PreparedOptionIntent` `{ legs[], provenCapabilities, bounds,
fuseEvaluations[], liveOrderSent: false }` plus an `hrcpt_` — produced only
  when capability is proven.

## Failure & degraded states

- Options tools absent / schema unproven → refuse; equity path offered.
- Grant lacks the options asset class → refuse.
- Multi-leg requested but multi-leg support unproven → refuse; no single-leg
  substitute claimed as a fix.
- Level unproven for the action → refuse.
- Any of the above renders as "options unavailable this session", never as a
  capability that exists.

## Example prompts

- "Can my agent trade options in my session right now?" (prove first)
- "What options level and leg support does my session actually have?"
- "Prepare a covered call under a grant that covers options." (only if proven)

## Tool references

- The user's Robinhood MCP option tools (discovered): `review_option_order`,
  `place_option_order`, `cancel_option_order`, `get_option_positions`,
  `get_option_quotes`, `get_index_quotes`.

## Related skills

- `hiss-robinhood-equities` (proven order lifecycle) · `hiss-robinhood-agentic`
  · `hiss-risk-fuses` · `hiss-agentic-ledger`.

## Test vectors

1. Options requested, tools absent → refuse, equity path offered.
2. Options requested under an equities-only grant → refuse.
3. Multi-leg requested, support unproven → refuse; no single-leg-only claim
   and no multi-leg claim asserted.
4. Index option requested, support unproven → refuse; no index claim.
5. Short leg prepared (proven) → assignment/early-assignment risk disclosed.

## Version & migration

v1 — spec v4 §28.3, aligned with the disposition matrix (options are spec-only
pending an options grant scope + matrix-verified options tools). This skill
compiles nothing live until capability is proven per session. Capability
references migrate to `schemas/robinhood-mcp/**` on landing.
