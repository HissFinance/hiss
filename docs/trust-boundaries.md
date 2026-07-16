# Trust boundaries

Who can do what, and where trust starts and stops. Understanding these boundaries is
how you assess what HISS can and cannot do to your funds — and how to scope a security
report.

## The signing boundary

```
┌── USER ─────────────────────────────┐        ┌── PROTOCOL ───────────────────────┐
│ User wallet signs USER actions:      │        │ Treasury Safe (2-of-3) signs       │
│  • deposit / withdraw                │        │ PROTOCOL actions:                  │
│  • stake / cooldown / redeem         │        │  • ownership / admin               │
│  • publish manifest                  │        │  • reward funding                  │
│  Keys held by the USER only.         │        │  • injector authorization          │
└──────────────────────────────────────┘        │  • emergency pause (where enabled) │
                                                 │  Threshold 2 of 3 owners.          │
       SDK / CLI / MCP / x402 PREPARE ONLY       └────────────────────────────────────┘
        (build transactions + artifacts;
         never sign, never custody)                 Audited contracts hold value
```

## Who holds keys

- **The user** holds the keys that sign user actions. HISS never has them.
- **The Treasury Safe** (2-of-3, `0xF100Fc28dd1721C698046Dbd60408c523b69e36c`) is the
  only protocol authority. No single party — including any maintainer — can act alone.
- **No server-held user keys.** There is no HISS server that can sign for a user.

## What HISS software does

- **Prepares** transactions and artifacts (SDK, CLI, React, MCP, x402).
- **Reads** on-chain state.
- **Scores, validates, compiles, audits** (facts-only; no performance inputs).

## What HISS software does not do

- **No custody.** It never holds pooled assets outside the audited contracts.
- **No execution on your behalf.** It never broadcasts your transaction for you.
- **No brokerage orders.** HISS never places a brokerage order; any Robinhood-MCP
  surface is compile-only (`liveOrderSent` hard-typed false) and never used for pooled
  vault execution.
- **No guaranteed returns.** Vaults share profit and loss; there is no yield or APY
  promise.

## Contract-level guarantees

- **xHISS:** the Safe cannot rescue staked $HISS, mint xHISS, or change the immutable
  timing constants; **exits are never pausable**. The Safe can only authorize the
  injector and pause staking/injections.
- **Vaults:** risk fuses bound what a vault can hold and how it rebalances; strategy
  changes require a disclosed notice; performance fees never touch principal.
- **Rewards:** distribution requires Safe funding after a challenge window; undeployed
  distributors have `null` recipients and cannot move value.

## Third-party boundaries

- **Bankr rails** are region- and provider-dependent, limited-rollout, and **never a
  hard dependency**. Completion is always an on-chain receipt; an unconfirmed job is not
  settled.
- **Stock Tokens** are **economic exposure, not ownership** — no legal/beneficial
  rights, no voting, no direct dividend; **region-restricted**.
- **Robinhood, Chainlink, Uniswap, Doppler** are external systems. HISS is **not
  affiliated** with them and does not control them.

## Where to send a security report

Anything that crosses a boundary above — custody where there should be none, execution
without the user's signature, protocol action without the Safe, a fail-closed path made
fail-open — is in scope. Report privately per [SECURITY.md](../SECURITY.md).
