# Security

This page summarizes how HISS Finance is built to be safe and how to report issues. The
formal policy — reporting channel, supported versions, scope, and disclosure rules — is
in [SECURITY.md](../SECURITY.md). The precise boundaries are in
[Trust boundaries](./trust-boundaries.md).

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.** Use GitHub's **private
vulnerability reporting** on this repository (Security tab → _Report a vulnerability_),
or follow [SECURITY.md](../SECURITY.md). Test only against **testnet (46630)** or local
forks — never attack mainnet contracts, other users' vaults, or the Treasury Safe. **No
public zero-day disclosure.**

## The security model in one screen

- **User wallet signs user actions.** Deposits, withdrawals, staking, cooldown, redeem,
  and manifest publishes are transactions the **user** signs from their own wallet.
- **Treasury Safe (2-of-3) signs protocol actions.** Ownership changes, reward funding,
  and injector authorization require the multisig
  `0xF100Fc28dd1721C698046Dbd60408c523b69e36c`.
- **SDK / CLI / agents prepare only.** They build transactions and artifacts; they never
  broadcast for the user.
- **No server-held user keys. No HISS custody.** Pooled assets live only in the audited
  on-chain contracts.
- **No brokerage execution.** HISS never places brokerage orders.
- **No guaranteed returns.** Vaults share profit and loss; performance is not a security
  property.

## Fail-closed by design

Reward and deployment flows **refuse rather than guess**:

- Missing artifact → refuse.
- Low-confidence fee classification → excluded (nothing splits).
- Absent owner authorization or plan-hash mismatch → refuse to fund.
- Undeployed distributor → `null` recipient → nothing moves.

A finding that turns a fail-closed path into a fail-open one is high value.

## Honest status is a safety property

- A failed read is **unknown** — never "live" and never "not deployed".
- Negative claims require affirmative evidence (a no-bytecode read, an artifact).
- "Live" requires proof; degraded reads show the last verified state, labeled. See
  [Status and data freshness](./status-and-data-freshness.md).

## Contract safety highlights

- **xHISS exits are never pausable**, and timing constants are **immutable**; the Safe
  cannot rescue staked $HISS, mint xHISS, or change constants. See [xHISS](./staking/xhiss.md).
- **Vault risk fuses** bound concentration, slippage, oracle staleness, venues, and
  readiness, and fail closed. See [Risk fuses](./vaults/risk-fuses.md).
- **Provider-reward revocation** is narrow, objective, Safe-authorized, and never based
  on performance; **vested rewards are never revocable**. See
  [Provider rewards](./rewards/provider-rewards.md).

## Secrets

No secrets live in this repository. Keys, RPC credentials, and API tokens are referenced
by environment-variable **name** only. Never commit a value; never add a credential to
an issue, PR, or example.

## Review state

The xHISS launch review formulation is, verbatim: **"No known unresolved Critical or
High findings after internal launch review."** This is an **internal** review — **never
described as an external audit**.
