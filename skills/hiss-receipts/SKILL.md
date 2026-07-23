---
name: hiss-receipts
description: Create and verify HISS receipts — canonical-JSON hash proofs across the whole lifecycle, from compile-time integrity to execution attribution. Compile receipts are hard-typed liveOrderSent:false and NEVER mutate into execution evidence. Use for workflow-integrity proof, to verify a receipt, when a stopIfReceiptMismatch fuse needs checking, or to explain what each receipt class does and does NOT evidence. Receipts never claim execution and are never a performance claim.
tags: [receipts, verification, integrity, attribution, coilops, agentic]
version: 3
visibility: public
required_mcp_tools: []
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://www.hiss.finance"
---

# HISS Receipts

## Purpose

A HISS receipt is a canonical-JSON hash proof about a specific fact. The system
uses **separate receipt classes for separate facts**, each with its own id
namespace and its own verification level, because they carry _different
evidence_. A submission response is one system saying what it did; a
reconciliation is a second, independent read of the same fact. Collapsing them
would let a lost response masquerade as a verified outcome — so the classes never
collapse, and a **compile receipt never mutates into execution evidence.**

A receipt is an integrity/attribution proof. It is never a performance claim and
never evidence that any trade happened.

## Two families, one direction of travel

**Compile family (integrity of the artifact).** `CoilReceipt` and its kin
(`coil_manifest`, `validation`, `coil_health`, `risk_fuse`, `robinhood_capsule`,
`drift_check`, `share_card`) hash the manifest, the composed fuses, and the
capsule. Compile receipts are hard-typed **`liveOrderSent: false`**; verification
fails any receipt claiming otherwise, and HISS has no execution rail that could
make it true.

**Lifecycle family (what a live run did, in the user's own session).** These
are separate, additive schemas layered on top of the compile chain — never
replacing it. They flow one way and never merge backward:

| Schema (§30.3)          | Shipped class · id                               | Verification level               | Asserts                                                                            | Does NOT assert                                                    |
| ----------------------- | ------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| autonomy-grant          | `LiveAutonomyGrant` · `grant_`                   | signed                           | the account holder signed bounded, expiring, revocable authorization               | that anything was traded                                           |
| trigger-evidence        | journaled trigger instance (`triggerInstanceId`) | derived-from-journal             | which typed conditions fired an intent, reconstructed deterministically            | that an order resulted                                             |
| policy-decision         | fuse-evaluation receipt · `frcpt_`               | derived-from-journal             | which fuses were evaluated, their bounds/observations, proceed-or-halt             | any market outcome                                                 |
| execution-request       | `execution_request` · `xrcpt_`                   | `MCP_SUBMITTED`/`MCP_RECONCILED` | the user's own session requested an order via MCP — never that HISS sent it        | an independent confirmation of broker state                        |
| private-broker-evidence | `PrivateReceiptEnvelope.brokerEvidence`          | private tier only                | raw broker order ids/state, held locally                                           | anything publishable — it is never projected or anchored           |
| fill-reconciliation     | `broker_reconciliation` · `brcpt_`               | `MCP_RECONCILED`                 | an independent order-list diff resolved a submission against a pre-submit baseline | settlement, tax treatment, or any figure the broker did not report |
| outcome-attribution     | outcome receipt · `orcpt_`                       | reconciled                       | the attributed result lineage from journaled evidence                              | a forecast or a repeatable return                                  |
| public-commitment       | anchor payload · `PUBLIC_COMMITMENT_ANCHORED`    | anchored                         | a salted commitment to a public projection existed in a chain at a time            | broker truth, a fill, a balance, or any outcome                    |

The id namespaces (`hrcpt_`/`frcpt_`/`xrcpt_`/`brcpt_`/`orcpt_`/`grant_`) keep
the classes structurally distinct: an `hrcpt_` compile receipt can never be
re-labelled as an `xrcpt_` execution request.

## Verification levels are semantic, never decorative

Each level states what it evidences AND what it does not, and the
`doesNotEvidence` string travels with it so a surface cannot render the
reassuring half alone:

- `PAPER_SIMULATED` / `MARKET_REPLAYED` — a deterministic simulation ran; no
  order existed at any broker and no value moved.
- `MCP_SUBMITTED` — the user's session called a broker tool and journaled the
  response; it is a single system's claim, **not** publishable (reconcile first).
- `MCP_RECONCILED` — an independent order-state read confirmed the outcome
  against a pre-submission baseline; not settlement, not a broker attestation.
- `PUBLIC_COMMITMENT_ANCHORED` — a salted commitment is included in a public
  chain at a stated time; **never** evidence of broker truth, a fill, or an
  outcome (the anchor scope statement renders verbatim).

## Privacy (private vs public)

Every artifact is **private-tier by default**. Publishing goes through an
allowlisted projection (`toPublicReceiptView`), never a redacted copy — a new
private field cannot leak unless someone writes a line of code and a test to put
it there. Low-entropy values (broker order ids, account fingerprints, symbol
sets) travel only as **salted, domain-separated commitments**; a bare hash of a
low-entropy value is dictionary-recoverable and is refused. Raw broker evidence,
account numbers, order ids, and positions can never reach an anchor payload —
`buildAnchorPayload` runs the privacy scan first and has no "anchor anyway" path.
"Verified onchain" next to a trade is an overclaim the guard refuses.

## When to use

- After generating, editing, or compiling a Coil — write a fresh compile receipt.
- Before any agent session against a capsule — verify the receipt still matches
  (the `stopIfReceiptMismatch` fuse depends on this).
- To explain the difference between an execution-request and a fill-reconciliation
  receipt, or why a submitted-but-unreconciled artifact is not publishable.
- When the user shares or receives a Coil and wants tamper evidence.

## Inputs / outputs

- **In:** a CoilManifest; for verification, also a receipt; for a public view, a
  private envelope plus a salt.
- **Out:** receipts of the class above, or a verification verdict
  `{ ok, mismatches[] }` naming the fields that no longer match (`manifestHash`,
  `fuseChecksum`, `coilId`, `liveOrderSent`).

## Safety rules (hard)

1. **A receipt is an integrity/attribution proof, never a performance claim** and
   never evidence that any trade happened.
2. **Never claim an order was sent, executed, or placed.** If any artifact claims
   `liveOrderSent: true`, treat it as forged — HISS has no execution rail.
   Trading happens only through the user's own official Robinhood Trading MCP.
3. **Classes never merge.** A compile receipt does not become execution evidence;
   an `MCP_SUBMITTED` request does not become a reconciled outcome; a private
   broker-evidence value is never published.
4. On any mismatch: stop, report which hashes differ, recommend re-validating the
   Coil, and never "fix" a receipt to make it match.
5. Fuses are binding; a receipt/checksum mismatch is a hard stop, not a warning.

## Example prompts

- "Write a receipt for this coil and confirm liveOrderSent is false."
- "Explain the difference between an xrcpt_ and a brcpt_ receipt."
- "Verify this receipt against this coil and tell me what changed."
- "Can I anchor this receipt publicly yet?"

## Tool / API references

- MCP (local `hiss-mcp` server): `hiss_verify_receipt` (canonical verify tool).
- HTTP: `POST /api/tools/receipt` (create a receipt), `POST /api/coil/verify`
  with `{ coil, receipt }`; oracle-policy explanation is served over the same
  HTTP tool surface.
- Core: `@hiss/core` `receipts`, `coil-runtime/receiptClasses`,
  `agentic/privacy` (tiers, commitments, verification).
- Design: `docs/agentic/receipt-privacy.md`.
- Paid x402 (when deployed): `hiss-receipt-verify`.
