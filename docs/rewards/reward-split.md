# Reward Split (50/30/10/10)

The verified HISS-token trading-fee split routes value across four legs. This
document restates the canonical figures; CI (`check:fee-docs`) fails on drift.

## The split

- **50%** — xHISS stakers
- **30%** — depositor vesting
- **10%** — provider rewards
- **10%** — Treasury Safe (absorbs floor-division dust so the legs sum exactly)

## Recipients and deployment state

Not every leg has a live recipient. Undeployed distributors carry a `null`
recipient in split plans, and nothing can move against `null`:

- **Depositor vesting** — distributor NOT deployed. Do not describe depositor
  vesting as live, funded, or claimable.
- **Provider rewards (10% leg)** — distributor NOT deployed for newly
  classified claims.

The legacy `provider-rewards-policy-v1` program is separate and never
conflated: 30% providers / 70% treasury / 0% WETH, epoch 1
`bootstrap_retained`.

## Fail-closed guarantees

- Classification fails closed: low-confidence fee sources are not distributed.
- Funding is double-gated (owner approval flag + exact plan hash).
- Eligibility is facts-only (vault live, deposits open, creator skin present) —
  never PnL or performance inputs.

See also: [fee model](../fees/fee-model.md).
