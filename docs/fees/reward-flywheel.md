# The HISS reward flywheel

The flywheel routes **verified $HISS trading fees** to the people who use the
protocol — stakers, vault providers, and vault contributors — plus the Treasury,
and burns a share to the canonical dead address. This page is the complete
mechanism. It is a **mechanical routing of fees**, not a yield product:
**Not a performance claim. Historical fee distributions are not forecasts.**

## The one figure that gets split

Only the **eligible amount** of a **verified, high-confidence $HISS trading-fee
claim** is ever split (see [$HISS token fees](./hiss-token-fees.md)). The 15% creator
premint, WETH, pre-existing balances, manual transfers, and unclassified deltas are
excluded upstream and rejected again at the split. If confidence is not high, nothing
splits — the system **fails closed**.

## The 50 / 15 / 15 / 10 / 10 split (HISS Reward Method V2)

Basis points of the eligible $HISS (sum = 10,000):

| Leg                | Share               | Recipient                                | Deployed?                                          |
| ------------------ | ------------------- | ---------------------------------------- | -------------------------------------------------- |
| xHISS stakers      | **50%** (5,000 bps) | xHISS staking vault (ERC-4626 injection) | Yes — `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be` |
| Vault providers    | **15%** (1,500 bps) | Vault-provider rewards distributor       | **Not yet** → recipient `null`                     |
| Vault contributors | **15%** (1,500 bps) | Vault-contributor vesting distributor    | **Not yet** → recipient `null`                     |
| Treasury           | **10%** (1,000 bps) | Treasury Safe (2-of-3)                   | Yes — `0xF100Fc28dd1721C698046Dbd60408c523b69e36c` |
| Economic burn      | **10%** (1,000 bps) | Canonical dead address                   | Yes — `0x000000000000000000000000000000000000dEaD` |

The math is pure bigint floor-division per leg. The **treasury leg absorbs the
floor-division dust**, so the five legs sum **exactly** to the input (re-checked at
runtime). **Claimed WETH is never part of this split — 100% goes to the Treasury
Safe.**

> **Vault contributors** is the current name for the former **depositor** reward
> cohort; the allocation methodology (share-seconds) is unchanged. **V1**
> (50/30/10/10, four legs, no burn) is **historical**.

> Nothing moves against a `null` recipient. Until the vault-provider and
> vault-contributor distributors are deployed and verified, those legs are planned
> data only.

## The xHISS leg — 50%

The 50% staker leg becomes an ERC-4626 **reward injection** into the xHISS vault via
`injectRewards` (injector-gated by the Treasury Safe). The injection **drips linearly
over 24 hours**, raising the xHISS-to-$HISS exchange rate for everyone staked.
Injections revert if there are **zero stakers**. See [xHISS](../staking/xhiss.md) and
[Reward injections](../staking/reward-injections.md).

## The vault-contributor leg — 15% (share-seconds)

The vault-contributor pool is allocated **pro-rata by share-seconds**: each
contributor's vault **share balance integrated over the epoch** (Σ shares × seconds
held), read from chain events. There are deliberately **no PnL, APY, or performance
inputs** — this is a deposit-participation incentive, never a performance claim.
Allocations carry a **30-day linear vest**. Details:
[Vault-contributor rewards](../rewards/depositor-rewards.md) and
[Share-seconds](../rewards/share-seconds.md).

## The vault-provider leg — 15% (facts-only, grouped, capped)

The vault-provider pool rewards **eligible provider groups** (a provider's multiple
vaults count as one group) using **facts-only** scoring — **no PnL/APY/rank/volatility
inputs anywhere** (enforced by a runtime forbidden-key guard). The per-group score:

| Component         | Weight  | Basis                                                                                                                             |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Equal             | **40%** | Split equally among eligible groups                                                                                               |
| External TVL-days | **30%** | Group external TVL × days, concave curve, optional cap                                                                            |
| Retention         | **20%** | 50% external-capital cohort retention + 50% median external contributor age                                                       |
| Operational       | **10%** | 30% maintenance-on-time + 25% receipt freshness + 20% no provider-fault pause + 15% docs current + 10% oracle/adapter/risk health |

A **dominance cap of 25%** of the pool per group is applied after the raw score, with
water-fill redistribution among under-cap groups; anything unplaceable **rolls over to
the next provider epoch** (never to the capped group, never to treasury). Provider
allocations carry a **90-day** vest. Eligibility is facts-only and a group must have
its own wallets declared in the exclusion set (anti-self-dealing). Details:
[Provider rewards](../rewards/provider-rewards.md).

## The economic-burn leg — 10%

The burn leg transfers its 10% share of eligible $HISS to the **canonical dead
address** `0x000000000000000000000000000000000000dEaD`. This is an **economic burn**:
the $HISS leaves circulation (nobody holds that key), but it is an ordinary ERC-20
transfer — **`HISS.totalSupply` is NOT reduced**. The "amount burned" is measured as
the **dead-address balance** (a live read of `HISS.balanceOf(0x…dEaD)`), never as a
supply reduction.

**Retroactive migration (executed).** When V2 activated, the historical share was
migrated: the cumulative economic burn to the dead address is
**219,158,426,524,474,729,694,326,935 base units (~219.16M HISS)**. `HISS.totalSupply`
is unchanged by this transfer. The migration is modelled as a **deployer-exclusion +
owner-replenishment pair** — deployer-held / excluded $HISS is excluded from reward
accounting, and an owner-authorized replenishment funds the corresponding economic-burn
transfer, so the pair nets out and the split accounting stays exact.

## Epoch lifecycle: planned ≠ funded ≠ vesting ≠ claimable

Rewards move through an explicit, gated lifecycle. Nothing is claimable early.

```
provisional → final → challenge → funded → vesting → claimable → claimed
                                        └→ rolled_over (unclaimed remainder)
```

- **Weekly provisional checkpoints** (4–5 per monthly epoch) are computed but
  **never claimable**.
- **Monthly finalization** produces a deterministic, reproducible epoch-score
  artifact (merkle roots + content hash) from source events.
- A **7-day public challenge window** follows publication. Epochs in the challenge
  window are **not claimable**; a sustained challenge forces recomputation.
- **Funding** requires the **2-of-3 Treasury Safe** and happens only after the
  challenge window (**monthly Safe epoch funding**).
- **Vesting** is linear (30 days vault contributor, 90 days vault provider); only
  vested, funded, past-challenge amounts are **claimable**.
- **Rollover:** unclaimed vault-contributor remainder → treasury after the deadline;
  unclaimed/uncapped vault-provider remainder → the next epoch.

Full lifecycle and vesting math: [Epochs and vesting](../rewards/epochs-and-vesting.md).

## Worked split example

Suppose a claim yields **1,000 $HISS** of **verified eligible** trading fees:

```
xHISS stakers       50%  = 500 $HISS   → 24h linear injection into the xHISS vault
Vault providers     15%  = 150 $HISS   → planned to the vault-provider distributor (null today)
Vault contributors  15%  = 150 $HISS   → planned to the vault-contributor distributor (null today)
Treasury            10%  = 100 $HISS   → Treasury Safe (plus any floor-division dust)
Economic burn       10%  = 100 $HISS   → dead address (economic burn; totalSupply unchanged)
                           ─────────
                           1,000 $HISS  (legs sum EXACTLY)
```

With the vault-provider and vault-contributor distributors not yet deployed, their legs
remain **planned data** (recipient `null`) — nothing moves against them. The xHISS,
treasury, and burn legs are live-capable. This is a routing illustration, **not a
forecast**.

## Why the flywheel

Trading $HISS generates fees → verified fees flow to stakers, vault providers, and
vault contributors who use the protocol, with a share economically burned → aligned
participants deepen usage → more activity. Each step is gated and evidence-based:
**planned is data, funded is owner-authorized and chain-verified, claimable requires
vesting past the challenge window.**

## Treasury assets are separate

Treasury holdings (including 100% of claimed WETH and the treasury split leg) are the
protocol's own assets. They are **not contributor funds** and are **not** part of any
further reward split beyond the explicit treasury leg shown above.
