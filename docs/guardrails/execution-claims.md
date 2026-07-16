<!-- execution-claims-guard: allow -->

# Honesty Guardrail: Execution Claims

HISS is compilation and verification software. It never stores brokerage
credentials, never places brokerage orders, and never takes custody. Because of
that, our documentation and tool descriptions must never assert that HISS itself
completed an on-chain or brokerage action unless a receipt-level verification is
stated right next to the claim.

The `check:execution-claims` guard (`scripts/check-execution-claims.ts`)
enforces this across all Markdown, tool descriptions, and skill packs.

## The rule

A sentence whose subject is HISS (or the vault, the agent, Bankrbot, CoilOps)
and whose verb is an execution verb — deposited, staked, withdrew, claimed,
traded, deployed, executed, swapped, redeemed, sent — MUST carry an adjacent
verification qualifier. Acceptable qualifiers include: an on-chain receipt, a
confirmed transaction hash, a "verified on chain" read, `onchain_confirmed`, or
an explicit `unconfirmed` hedge.

This file is allowlisted (via the marker at the top) precisely so it can quote
the phrasing it forbids elsewhere.

## Examples

Not allowed (bare claim):

> The agent deposited 5,000 USDG.

Allowed (receipt-qualified):

> The agent submitted a deposit; it is complete only once the on-chain receipt
> is confirmed. A `job_completed_unconfirmed` status is not settled.

## Rails reminder

- Rail A (vault deposits): complete only on the on-chain receipt.
- Rail B (stock-token trading): `job_completed_unconfirmed` is not settled;
  only `onchain_confirmed` counts.
- The Robinhood MCP surface is compile-only and is never used for pooled vault
  execution.

See also: [fee model](../fees/fee-model.md).
