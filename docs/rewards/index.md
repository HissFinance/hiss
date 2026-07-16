# Rewards — Overview

The rewards system routes **verified $HISS trading fees** to program participants via
the [50/30/10/10 split](../fees/reward-flywheel.md). This section documents the two
distributed legs (depositors and providers), the scoring inputs, and the epoch and
vesting lifecycle. Rewards are a **mechanical routing of fees**, gated at every step —
**not a yield product, not a performance claim.**

## The legs

| Leg                                  | Share | Basis                               | Vesting                  | Recipient                                   |
| ------------------------------------ | ----- | ----------------------------------- | ------------------------ | ------------------------------------------- |
| xHISS stakers                        | 50%   | staked share                        | (24h drip)               | xHISS vault (deployed)                      |
| [Depositors](./depositor-rewards.md) | 30%   | [share-seconds](./share-seconds.md) | 30-day linear            | distributor — **not yet deployed** (`null`) |
| [Providers](./provider-rewards.md)   | 10%   | facts-only score                    | 90-day linear (modelled) | distributor — **not yet deployed** (`null`) |
| Treasury                             | 10%   | —                                   | —                        | Treasury Safe (deployed)                    |

## Read the pages

- **[Depositor rewards](./depositor-rewards.md)** — 30% by share-seconds, 30-day vest.
- **[Provider rewards](./provider-rewards.md)** — 10% facts-only (40/30/20/10), 25% cap,
  90-day vest.
- **[Share-seconds](./share-seconds.md)** — how depositor participation is measured.
- **[Epochs and vesting](./epochs-and-vesting.md)** — the weekly/monthly lifecycle,
  7-day challenge window, and linear vesting.

## Principles across all rewards

- **Facts-only scoring.** No PnL, APY, return, rank, volatility, or turnover inputs —
  enforced by runtime guards. Rewards incentivize **participation and operations**,
  never predicted performance.
- **Planned ≠ funded ≠ vesting ≠ claimable.** Plans are data (with a keccak plan hash);
  funding is owner-gated (2-of-3 Treasury Safe) and chain-verified; only vested,
  past-challenge, funded amounts are claimable.
- **Fail closed.** Low-confidence classification, missing artifacts, or missing
  authorization refuse.
- **Not deployed = null.** The depositor and provider distributors are **not yet
  deployed**; their recipients are `null` and nothing moves against them.

## The undeployed distributors

Two of the four legs route to distributors that are **not deployed yet**:

- **Depositor vesting distributor** — the 30% leg. Recipient `null`.
- **Provider rewards distributor** — the 10% leg. Recipient `null`.

Do not describe these legs as live, funded, or claimable. The xHISS staking vault and
the Treasury Safe **are** deployed and live-capable. This state is honest by
construction: a leg with a `null` recipient cannot move value.
