# Status and data freshness

HISS treats **honest status** as a safety property. This page explains the evidence
rules the SDK, APIs, and docs follow, and why you should always re-read the chain for
anything transactional.

## The source-of-truth hierarchy

When two sources disagree, the higher one wins:

1. **On-chain state** — fresh reads on chain 4663.
2. **Committed, chain-verified artifacts** — `deployments/`, `vaults/`, `token/`,
   `rewards/`.
3. **`@hiss-finance/core`** — typed constants and resolvers.
4. **Live APIs** — which derive from 1–3.
5. **Docs and generated snapshots** — descriptions of 1–4, never a source.

The [generated snapshots](./generated/current-status.md) are level 5: convenient, but
**snapshots with a freshness limit**. Never treat them as live.

## Evidence rules

- **A failed fetch is `unknown`** — never "live", never "not deployed".
- **Negative claims require affirmative evidence.** "Not deployed" needs a no-bytecode
  read or an artifact; "live" needs a positive read. Absence of data is not proof of
  either.
- **Degraded reads show the last verified state, labeled.** A stale read is presented as
  stale, not silently as current.
- **Planned ≠ funded ≠ vesting ≠ claimable.** Reward status must never collapse these.
- **Completion is on-chain.** Only a confirmed transaction / [receipt](./receipts.md)
  means an action occurred.

## Why this matters

Vaults hold real value; rewards are gated. A UI or agent that reports "live" or
"claimable" without evidence can lead someone to act on a false state. HISS surfaces are
built to say **"unknown"** honestly rather than guess — and to fail closed rather than
proceed on thin evidence.

## Display continuity vs execution strictness (24/7)

Vault surfaces separate what may be **shown** from what may be **executed**:

- **Display is continuous.** Valuation state stays visible 24/7. Outside feed
  hours it is computed from the **last verified** prices and labeled with its
  price basis: `EXCHANGE_LIVE` (live feed round), `CARRIED_CLOSE` (a carried
  close — display-only, **never** an execution basis), or `MODEL_ACCRUAL`
  (accrual-like feeds, e.g. SGOV's once-daily round). A stale or carried value is
  always presented as such, never as live.
- **Execution stays strict.** Priced settlement requires execution-grade,
  corroborated pricing; when the evidence is not there, priced execution fails
  closed while the in-kind exit stays open. Availability is decided by on-chain
  market health — never by the calendar. See
  [24/7 architecture](./vaults/24-7-architecture.md).
- **Unknown is not closed.** A failed read yields `UNKNOWN`: it is never collapsed
  into "closed" (or "open"); surfaces keep the last verified state, labeled,
  instead of overriding to a hard claim.

The continuous, around-the-clock **valuation + settlement** architecture — where
calendar/session state is context only and on-chain market health (not the clock)
decides availability — is **LIVE on the canonical V2 vault**
(`0x432e90b1B35995EBE46eD93B4Db369abfc230E69`); its dynamic capacity is always a
**live Price Mesh read, never a fixed promise**. The legacy V1 flagship is
closed to new deposits and empty. See
[24/7 vault architecture](./vaults/24-7-architecture.md); the legacy
V1-style direct-deposit gate is documented in
[the effective deposit gate](./vaults/risk-fuses.md#the-effective-deposit-gate-advertised-availability).

## Freshness in practice

- **Share price, TVL, balances, staking rate** — always live reads; never cache and
  present as current.
- **Deployment status** — verify with a bytecode read (`cast code`) before asserting
  live or not-deployed.
- **Reward epochs** — check the epoch state; a challenge-window epoch is not claimable.
- **Generated docs** — check the "Generated at" stamp and re-read chain if it matters.

## Reading status safely

```ts
const status = await hiss.getProtocolStatus();
// Treat every field as a point-in-time read. For a transaction, re-read immediately
// before preparing, and confirm completion via the on-chain receipt.
```

If a read throws or returns degraded, surface **unknown** — do not fall back to an
optimistic default.
