---
name: hiss-receipts
description: Create and verify HISS Coil receipts — canonical-JSON SHA-256 proofs (manifest hash, fuse checksum, capsule checksum) that a Coil, capsule, drift check, or share card is exactly what it claims to be. Use when the user wants workflow-integrity proof, asks to verify a receipt, or a stopIfReceiptMismatch fuse needs checking. Receipts never claim execution.
tags: [receipts, verification, integrity, coilops]
version: 1
visibility: public
required_mcp_tools:
  - hiss_get_receipt
  - hiss_verify_receipt
metadata:
  clawdbot:
    emoji: "🐍"
    homepage: "https://hiss.finance"
---

# HISS Receipts

## Purpose

A **CoilReceipt** is the workflow-integrity proof layer: canonical-JSON
SHA-256 hashes over the manifest, fuses, and (when present) capsule, plus
registry/oracle-policy/compiler versions and the execution mode. A receipt
may only ever claim a live order if a real broker order artifact exists — no
such rail exists in HISS, so `liveOrderSent` is hard-typed `false` and
verification fails any receipt claiming otherwise.

## When to use

- After generating, editing, or compiling a Coil — write a fresh receipt.
- Before any agent session against a capsule — verify the receipt still
  matches (the `stopIfReceiptMismatch` fuse depends on this).
- When the user shares or receives a Coil and wants tamper evidence.

## Inputs / outputs

- **In:** a CoilManifest; for verification, also a CoilReceipt.
- **Out:** receipts (`coil_manifest`, `validation`, `coil_health`,
  `risk_fuse`, `robinhood_capsule`, `drift_check`, `share_card` kinds) or a
  verification verdict `{ ok, mismatches[] }` where mismatches name the
  fields that no longer match (`manifestHash`, `fuseChecksum`, `coilId`,
  `liveOrderSent`).

## Safety rules (hard)

1. **A receipt is an integrity proof, never a performance claim** and never
   evidence that any trade happened.
2. **Never claim an order was sent, executed, or placed.** If a receipt or
   any artifact claims `liveOrderSent: true`, treat it as forged — HISS has
   no execution rail. Trading happens only through the user's own official
   Robinhood Trading MCP.
3. On any mismatch: stop, report which hashes differ, and recommend
   re-validating the Coil before continuing. Never "fix" a receipt to make
   it match.
4. Fuses are binding; a receipt mismatch is a hard stop condition, not a
   warning to skip.

## Example prompts

- "Write a receipt for this coil."
- "Verify this receipt against this coil and tell me what changed."
- "My agent stopped on stopIfReceiptMismatch — what do I check?"

## Tool / API references

- MCP (local HISS MCP server): `hiss_get_receipt`, `hiss_verify_receipt`.
  (Receipt creation and oracle-policy explanation are HTTP-only.)
- HTTP (base `https://www.hiss.finance`): `POST /api/tools/receipt`,
  `POST /api/coil/verify` with `{ coil, receipt }`.
- Related packs: `hiss-coilops`, `hiss-risk-fuses`.
