# Rewards — Overview

The rewards system routes **verified $HISS trading fees** to program participants via
the [50/15/15/10/10 split](../fees/reward-flywheel.md) (**HISS Reward Method V2**). This
section documents the two distributed off-chain legs (vault contributors and vault
providers), the scoring inputs, and the epoch and vesting lifecycle. Rewards are a
**mechanical routing of fees**, gated at every step — **not a yield product, not a
performance claim.** **Vault contributors** is the current name for the former
**depositor** reward cohort; **V1** (50/30/10/10, no burn) is historical.

## The legs

| Leg                                          | Share | Basis                               | Vesting                  | Recipient                                      |
| -------------------------------------------- | ----- | ----------------------------------- | ------------------------ | ---------------------------------------------- |
| xHISS stakers                                | 50%   | staked share                        | (24h drip)               | xHISS vault (deployed)                         |
| [Vault providers](./provider-rewards.md)     | 15%   | facts-only score                    | 90-day linear (modelled) | distributor — **not yet deployed** (`null`)    |
| [Vault contributors](./depositor-rewards.md) | 15%   | [share-seconds](./share-seconds.md) | 30-day linear            | distributor — **not yet deployed** (`null`)    |
| Treasury                                     | 10%   | —                                   | —                        | Treasury Safe (deployed)                       |
| Economic burn                                | 10%   | —                                   | —                        | dead address `0x…dEaD` (totalSupply unchanged) |

## Read the pages

- **[Vault-contributor rewards](./depositor-rewards.md)** — 15% by share-seconds,
  30-day vest.
- **[Provider rewards](./provider-rewards.md)** — 15% facts-only (40/30/20/10), 25% cap,
  90-day vest.
- **[Share-seconds](./share-seconds.md)** — how vault-contributor participation is
  measured.
- **[Epochs and vesting](./epochs-and-vesting.md)** — the weekly/monthly lifecycle,
  7-day challenge window, and linear vesting.

## Principles across all rewards

- **Facts-only scoring.** No PnL, APY, return, rank, volatility, or turnover inputs —
  enforced by runtime guards. Rewards incentivize **participation and operations**,
  never predicted performance.
- **Planned ≠ funded ≠ vesting ≠ claimable.** Plans are data (with a keccak plan hash);
  funding is owner-gated (2-of-3 Treasury Safe, monthly epoch cadence) and
  chain-verified; only vested, past-challenge, funded amounts are claimable.
- **Fail closed.** Low-confidence classification, missing artifacts, or missing
  authorization refuse.
- **Not deployed = null.** The vault-contributor and vault-provider distributors are
  **not yet deployed**; their recipients are `null` and nothing moves against them.
- **Economic burn is not a supply burn.** The 10% burn leg transfers $HISS to the dead
  address `0x000000000000000000000000000000000000dEaD`; it leaves circulation but
  `HISS.totalSupply` is **not** reduced. The burn metric is the dead-address balance.

## The undeployed distributors

Two of the five legs route to distributors that are **not deployed yet**:

- **Vault-contributor vesting distributor** — the 15% leg. Recipient `null`.
- **Vault-provider rewards distributor** — the 15% leg. Recipient `null`.

Do not describe these legs as live, funded, or claimable. The xHISS staking vault, the
Treasury Safe, and the economic-burn dead address **are** live-capable. This state is
honest by construction: a leg with a `null` recipient cannot move value.
