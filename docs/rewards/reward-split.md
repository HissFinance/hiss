# Reward Split (50/15/15/10/10)

The verified HISS-token trading-fee split (**HISS Reward Method V2**) routes value
across five legs. This document restates the canonical figures; CI
(`check:fee-docs`) fails on drift.

## The split

- **50%** — xHISS stakers
- **15%** — vault providers
- **15%** — vault contributors (the former depositor cohort; methodology unchanged)
- **10%** — Treasury Safe (absorbs floor-division dust so the legs sum exactly)
- **10%** — economic burn to the canonical dead address
  `0x000000000000000000000000000000000000dEaD`

The five legs sum to exactly 100. **V1** (50/30/10/10, four legs, no burn) is
**historical**.

## Economic burn

The 10% burn leg is transferred to the canonical dead address. It is an **economic
burn**: the $HISS leaves circulation but the transfer is an ordinary ERC-20 transfer,
so **`HISS.totalSupply` is NOT reduced**. The burn metric is the **dead-address
balance** (a live read of `HISS.balanceOf(0x…dEaD)`), never a supply reduction.

The retroactive V2 migration executed a cumulative economic burn of
**219,158,426,524,474,729,694,326,935 base units (~219.16M HISS)** to the dead address,
with `HISS.totalSupply` unchanged. It is modelled as a **deployer-exclusion +
owner-replenishment pair** so the split accounting stays exact.

## Recipients and deployment state

Not every leg has a live recipient. Undeployed distributors carry a `null`
recipient in split plans, and nothing can move against `null`:

- **Vault-contributor vesting** — distributor NOT deployed. Do not describe
  vault-contributor rewards as live, funded, or claimable.
- **Vault-provider rewards (15% leg)** — distributor NOT deployed for newly
  classified claims.
- **Treasury** and **economic burn** legs are live-capable (Treasury Safe / dead
  address).

The legacy `provider-rewards-policy-v1` program is separate and never
conflated: 30% providers / 70% treasury / 0% WETH, epoch 1
`bootstrap_retained`.

## Fail-closed guarantees

- Classification fails closed: low-confidence fee sources are not distributed.
- Funding is double-gated (owner approval flag + exact plan hash), on a monthly
  Safe epoch cadence.
- Eligibility is facts-only (vault live, deposits open, creator skin present) —
  never PnL or performance inputs.

See also: [fee model](../fees/fee-model.md).
