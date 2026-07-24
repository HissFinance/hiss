# Supported assets (dynamic, admission-gated)

## Not a hard-coded list

The universe is a DYNAMIC set built from current verified sources — the official
Robinhood issuer registry (`/rhj/assets` shape), the HISS seed registry
(`tokens/robinhoodStockTokens.ts`), and live chain-4663 reads. There is no
permanent hard-coded ticker list. Membership is earned by passing a fail-closed
gate, re-evaluated from live evidence.

## Address is identity

A matching ticker is NEVER sufficient. Contract identity (the canonical on-chain
address) plus official-registry provenance are mandatory. Documented on-chain
symbol aliases are handled explicitly (e.g. docs "CUSO" reconciles to on-chain
"USO") — the address, not the string, is authoritative.

## The 12-check admission gate (`registry.ts`)

Each check defaults to FAIL/UNKNOWN and only passes on affirmative evidence:

1. `chain` — chainId is 4663.
2. `provenance_identity` — official issuer-registry provenance + a valid address.
3. `active_status` — `ASSET_STATUS_ACTIVE` in the issuer registry.
4. `bytecode_present` — non-empty `eth_getCode` on chain 4663.
5. `uid_symbol_reconcile` — issuer UID present; display/on-chain symbols reconcile.
6. `decimals` — on-chain `decimals()` equals the registry-expected value.
7. `valid_multiplier` — a positive current multiplier.
8. `no_pending_multiplier` — no pending multiplier transition.
9. `corporate_action_ok` — no corporate action in progress; oracle not paused.
10. `verified_usdg_pool` — at least one USDG pool passing factory + code-hash +
    liquidity>0.
11. `code_hash_pass` — token bytecode present and counted pools' code-hash +
    factory match the pinned canonical values.
12. `jurisdiction` — `retailEligible=true`.

## Two admission tiers

- **Analysis** (scan / observe / shadow / prepare) admits on checks 1–11
  (`admittedForAnalysis`, `supportState = ADMITTED_ANALYSIS`).
- **Live execution** additionally requires check 12
  (`liveExecutionEligible`). The jurisdiction gate is fail-closed FALSE until the
  owner resolves it, so GME (for example) admits for analysis while live stays
  blocked (`liveBlockReason = jurisdiction`).

A failing analysis check yields `EXCLUDED` with the first-failing check as the
`exclusionReason`. Every entry carries the full 12-check audit trail and an
`evidenceHash`.
