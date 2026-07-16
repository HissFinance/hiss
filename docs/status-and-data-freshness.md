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

## Freshness in practice

- **Share price, TVL, balances, staking rate** — always live reads; never cache and
  present as current.
- **Deployment status** — verify with a bytecode read (`cast code`) before asserting
  live or not-deployed.
- **Reward epochs** — check the epoch state; a challenge-window epoch is not claimable.
- **Generated docs** — check the "Generated at" stamp and re-read chain if it matters.

## Reading status safely

```ts
const status = await hiss.status.read();
// Treat every field as a point-in-time read. For a transaction, re-read immediately
// before preparing, and confirm completion via the on-chain receipt.
```

If a read throws or returns degraded, surface **unknown** — do not fall back to an
optimistic default.
