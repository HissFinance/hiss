---
name: hiss-cross-rail-handoff
description: Instructions for preparing and reconciling a cross-rail handoff between the user's Robinhood brokerage account and Robinhood Chain (USDG) — NOT a bridge. There is no transfer, funding, or bridge tool in the Robinhood MCP (verified-absent), so HISS prepares the steps, the USER performs the brokerage-side movement (MANUAL_ACTION_REQUIRED), and HISS reconciles arrival evidence on the destination rail. Never claims an automatic bridge, an auto-deposit, an ETA, or in-flight funds; reconciliation is correlation, not causation. Use when a user asks to move value between their brokerage and chain rails.
tags: [cross-rail, handoff, usdg, robinhood-chain, reconciliation, manual-action]
version: 1
visibility: public
required_hiss_skills: [hiss-robinhood-agentic, hiss-bankrbot-robinhood]
required_mcp_servers: [robinhood-trading-mcp, bankr-agent-api]
required_capability_families: [account_portfolio_other]
local_only_data: false
write_risk: prepare_only
runtime_requirement: none
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Cross-Rail Handoff

## Purpose

This skill teaches an agent how to prepare and reconcile a movement of value
between the user's own two rails — a Robinhood brokerage account and Robinhood
Chain (USDG) — without ever claiming a capability that does not exist.

The single load-bearing fact: **as verified, there is no funding, deposit,
withdrawal, transfer, or bridge tool in the Robinhood Trading MCP.** So the
honest product is a preparer and reconciler:

> HISS **prepares** a handoff. The USER **performs** the brokerage-side
> movement in their own Robinhood app. HISS then **reconciles** arrival
> evidence on the destination rail and writes a receipt.

There is no step where HISS or the user's runtime moves brokerage money,
because no such step exists.

## When to use

- The user asks to fund a Coil, move USDG to/from Robinhood, or "bridge"
  between rails (use "handoff", never "bridge").
- The user wants to confirm whether value from a prepared handoff has arrived.

## Prerequisites

1. A destination the user controls on each rail.
2. For a chain-side leg (e.g. a vault deposit once USDG arrives): the user's
   own wallet, which signs a real chain transaction — a separate authorization.

## Capability discovery

- The transfer surface is `verified-absent`; this verdict has an expiry and is
  re-verified on schedule. If a transfer tool ever appears, it is a NEW
  live-activation gate (a different risk class from placing an order), not an
  extension of this flow.
- Brokerage-side movement is unobservable to HISS: no confirmation counter, no
  progress, no ETA can be rendered for it.

## Data boundary

- Brokerage and chain are different custody domains. A combined figure is a
  display convenience across two domains, shown only when both rails are
  verified, with its disclosure never omitted.
- No full account number renders anywhere.

## Hard safety rules

1. Money movement is **MANUAL_ACTION_REQUIRED**. Never say "automatic bridge",
   "auto-deposit", "auto-transfer", or "bridge ETA". The word "bridge" is
   banned as a HISS capability — the object is a _prepared handoff_.
2. A brokerage leg never has a transaction hash, a confirmation count, a
   progress bar, or an ETA. Those are chain-side concepts only.
3. No amount is ever "in flight". Until arrival is observed, the only true
   statement is what was _prepared_.
4. No currency conversion or parity is implied ("$X USD → X USDG" claims a
   conversion capability HISS does not have).
5. Reconciliation is correlation, not causation. An arrival matching a
   prepared amount is evidence, not proof this handoff caused it — every
   reconciliation carries a `causalityNote`; ambiguity is a state.
6. Chain → brokerage is drawn as two independent prepared steps with no
   linking arrow: no tool connects chain value to brokerage buying power.
7. A chain-side vault deposit after USDG arrives is a real, user-signed chain
   transaction — that leg may show real confirmations; it is never automatic.

## Deterministic workflow (the eight states)

1. `prepared` — exact steps, amounts, destinations compiled. Nothing has moved.
2. `manual_transfer_required` — the user performs the transfer in their
   brokerage app; render MANUAL TRANSFER REQUIRED + the exact steps.
3. `user_reported_sent` — the user self-reported initiating it; labelled
   self-reported (unverified attestation).
4. `awaiting_arrival` — watching the destination rail; no progress, no ETA.
5. `arrival_observed` — arrival evidence on the destination (chain) rail; chain
   tx hash + real confirmations, chain side only.
6. `reconciled` — arrival matched to this handoff; receipt written with the
   causality note.
7. `ambiguous` — evidence exists but cannot be attributed; show the candidate
   count and what the user must resolve.
8. `plan_cancelled` — cancels the PLAN, never a transfer.

## Inputs

- `{ direction: "brokerage_to_chain" | "chain_to_brokerage", amount,
sourceRail, destinationRail, nowIso }`.

## Outputs + schemas

- A `HandoffRecord` `{ state, preparedSteps[], amountPrepared,
arrivalEvidence?, reconciliation?: { matched, causalityNote }, candidates? }`.
- A handoff receipt on `reconciled`.

## Failure & degraded states

- No arrival within the window → stays `awaiting_arrival`; never a failure
  claim, never an ETA.
- Multiple candidate arrivals → `ambiguous`; user resolves.
- Chain source with its own timing (e.g. an xHISS unstake: 72h cooldown then a
  2-day redeem window, exits not pausable) → rendered as an independent
  prepared step, never a continuous flow.

## Example prompts

- "Prepare a handoff of 2,500 USDG from Robinhood to my chain wallet."
- "Has my prepared handoff arrived on chain yet?"
- "Why is this handoff ambiguous?"

## Tool references

- Chain reads via public RPC (`rpc.mainnet.chain.robinhood.com`) for arrival
  evidence. No brokerage-side observation exists.
- `hiss-vault-agent-kit` for a subsequent user-signed vault deposit.

## Related skills

- `hiss-robinhood-agentic` · `hiss-price-mesh` (per-rail valuation) ·
  `hiss-vault-agent-kit` (chain-side deposit) · `hiss-agentic-ledger`.

## Test vectors

1. Prompt asks to "bridge" funds → reframed as a prepared handoff; word
   "bridge" not used as a capability.
2. Brokerage leg rendered with a confirmation count or ETA → defect; withheld.
3. Arrival matches amount → `reconciled` WITH a causality note (not "caused").
4. Two arrivals match → `ambiguous` with candidate count.
5. Chain→brokerage → two independent steps, no linking arrow.

## Version & migration

v1 — spec v4 §28.3. Documents the shipped Cross-Rail Handoff Tracker (8
states). If `semantics.transferSurface` ever upgrades from verified-absent,
this skill re-opens under a new live-activation gate.
