---
name: hiss-agentic-ledger
description: Instructions for keeping the local agentic journal and the three-layer receipt spine — compile receipts (hrcpt_, liveOrderSent:false), execution receipts (xrcpt_, executedBy user-agent-session), and outcome receipts (orcpt_) — plus Verified Performance that attributes pnl ONLY from reconciled execution-receipt lineage, never self-reported numbers, with paper and live kept in separate tables. Covers custody, retention, export/delete, and reconstructed portfolio curves. The journal is local to the user's runtime; HISS holds no brokerage data. Use when a user wants provable records or honest performance.
tags: [receipts, journal, verified-performance, attribution, privacy, agentic-trading]
version: 1
visibility: public
required_hiss_skills: [hiss-receipts]
required_mcp_servers: [robinhood-trading-mcp]
required_capability_families: [account_portfolio_other, equities, options]
local_only_data: true
write_risk: none
runtime_requirement: coil_runtime
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Agentic Ledger

## Purpose

This skill teaches an agent how the local journal and the three-layer receipt
spine record what a Coil did, and how HISS derives performance that is provable
rather than asserted. Every claim the product makes about "what happened"
resolves to a hash in this ledger.

- **Compile receipt** `hrcpt_` — HISS produced a plan; `liveOrderSent: false`;
  transmitted nothing.
- **Execution receipt** `xrcpt_` — the user's own agent session submitted and
  the broker acknowledged; `executedBy: "user-agent-session"`.
- **Outcome receipt** `orcpt_` — flow-neutral attribution derived only from
  execution-receipt lineage.

The journal is a local artifact held by the user's runtime. HISS servers never
receive it.

## When to use

- The user asks for a record of what a Coil did, or to verify a receipt.
- The user asks "how did it actually do?" — answer only from reconciled
  outcome receipts.
- The user wants to export or delete their journal.

## Prerequisites

1. A local journal contract (the shipped `LocalJournal`) with custody,
   retention, export/delete, and migrations.
2. Reconciled execution receipts before any performance is shown.

## Capability discovery

- Performance needs reconciled fills. Because there is no broker push and no
  published idempotency key, fills are established by order-list diff (C6),
  not by trusting an acknowledgement.
- No broker-provided returns series exists; the only honest "returns over
  time" is a curve reconstructed from journaled snapshots, hidden below a
  minimum snapshot count.

## Data boundary

- The journal, receipts, and any signature live locally. Nothing transits a
  HISS server.
- Secret slots (signatures, keys) are sealed envelopes referencing the OS
  keystore; strike-capable signatures carry a hard expiry and are deleted on
  cancel.
- No full account number is ever journaled or rendered — only the opaque
  account fingerprint. Receipts carry no PII.

## Hard safety rules

1. A receipt is an integrity proof, never a performance claim and never
   evidence a trade happened. A forged artifact might claim `liveOrderSent: true`;
   HISS has no execution rail and never sends orders.
2. Attribution is execution-receipt-lineage only. No self-reported numbers, no
   backtest presented as performance, no APY, no projected return.
3. Paper and live never appear in one table or one figure. Backtests are
   labelled `simulated`.
4. Risk metrics (Sharpe, max drawdown, win rate) render only with sufficient
   observations, a flow-neutral series, and disclosed methodology — otherwise
   they are withheld, not estimated.
5. On any receipt mismatch: stop, name which hashes differ, re-validate. Never
   edit a receipt to make it match.
6. Every performance surface carries "Not a performance claim."

## Deterministic workflow

1. On compile, write an `hrcpt_` over the manifest/fuse/capsule hashes.
2. On submit, the user's session writes an `xrcpt_` naming the broker order
   reference (opaque) and `executedBy: "user-agent-session"`.
3. On reconciliation (order-list diff matched to the journaled snapshot),
   write an `orcpt_` with flow-neutral attribution and a causality note where
   correlation is not causation.
4. To show performance: fold only reconciled `orcpt_` lineage; keep paper and
   live separate; withhold metrics without enough observations.
5. Export/delete on request; migrations preserve receipt hashes.

## Inputs

- `{ receipts[], journalSnapshots[], nowIso }` for reads; `{ coil, receipt }`
  for verification.

## Outputs + schemas

- Receipts of kinds `coil_manifest`, `validation`, `coil_health`,
  `risk_fuse`, `robinhood_capsule`, `drift_check`, `share_card`, plus the
  execution/outcome layers.
- A verification verdict `{ ok, mismatches[] }` (mismatches name fields:
  `manifestHash`, `fuseChecksum`, `coilId`, `liveOrderSent`).
- A reconstructed portfolio curve `{ points[], minSnapshotsMet: boolean }`.

## Failure & degraded states

- Fewer than the minimum snapshots → curve hidden, not interpolated.
- Unreconciled submissions → excluded from performance; flagged in a backlog.
- Ambiguous reconciliation → recorded as `ambiguous`, never attributed.
- Verification mismatch → hard stop, not a warning to skip.

## Example prompts

- "Write and then verify a receipt for this Coil."
- "Show my live performance from reconciled receipts only — keep paper out."
- "Export my journal, then delete it."

## Tool references

- MCP (local `hiss-mcp`): `hiss_verify_receipt` (canonical verify tool).
- HTTP: `POST /api/tools/receipt` (create a receipt), `POST /api/coil/verify`;
  oracle-policy explanation is served over the same HTTP tool surface.

## Related skills

- `hiss-receipts` (receipt mechanics) · `hiss-coil-runner` (journal fold) ·
  `hiss-robinhood-agentic` (truth model) · `hiss-robinhood-portfolio`.

## Test vectors

1. Performance requested with only paper receipts → live table empty, paper
   labelled `simulated`, no blended figure.
2. Receipt with `liveOrderSent: true` → verification fails; flagged forged.
3. Snapshots below minimum → curve withheld.
4. Sharpe requested with 3 observations → withheld with a reason.
5. Export then delete → hashes preserved in export; journal cleared.

## Version & migration

v1 — spec v4 §28.3. Documents the shipped `LocalJournal` contract and the
frozen `hrcpt_`/`xrcpt_`/`orcpt_` receipt namespaces.
