# Current fees (snapshot)

> **Generated at:** 2026-07-16 (UTC)
> **Source:** the launch fee schedule and reward-split constants in
> `@hiss-finance/core` (`vaults/vaultFees`, `hiss-rewards/rewardSplit`).
> **Chain:** Robinhood Chain mainnet, chain ID **4663**.
> **Freshness limitations:** This is a **point-in-time snapshot**. The deployed
> `VaultFactory` and vault contracts are authoritative at execution time; USDG
> amounts are candidate values, and per-vault fees come from each vault's on-chain
> config. External $HISS pool parameters are enforced by the pool, not by HISS —
> verify on-chain. Values can change after this stamp.

## Vault fees — launch phase

| Fee                     | Value                                  | Enforcement         | Notes                                                         |
| ----------------------- | -------------------------------------- | ------------------- | ------------------------------------------------------------- |
| Vault candidate save    | **0 USDG**                             | policy              | always free                                                   |
| Public vault creation   | **50 USDG**                            | factory (candidate) | paid once on publish; standard-phase reference 100 USDG       |
| Creator performance fee | **10%** (1,000 bps)                    | contract (bounded)  | above high-water mark only; cap 10% unverified / 20% verified |
| HISS protocol share     | **10%** (1,000 bps) of the creator fee | contract (bounded)  | max 20%; never on principal                                   |
| Deposit fee             | **0**                                  | contract            | —                                                             |
| Withdrawal fee          | **0**                                  | contract            | chain/liquidity/slippage disclosed separately                 |
| Routing fee             | **0** (routing disabled)               | contract (bounded)  | 0.5 bps default / 1 bps standard cap / 2 bps max once live    |
| Creator skin-in-game    | **5%** (500 bps) minimum               | policy/gate         | required before public deposits open                          |

Worked examples: [Vault fees](../fees/vault-fees.md).

## $HISS token trading fees

| Item                     | Value                              | Enforcement                           |
| ------------------------ | ---------------------------------- | ------------------------------------- |
| Uniswap V4 pool swap fee | **0.7%**                           | external pool (Bankr/Doppler)         |
| Swap-fee split           | **95% creator / 5% Doppler**       | external                              |
| Creator premint          | **15%**, 2-year vest, 30-day cliff | **always excluded from reward flows** |
| Claimed WETH             | **100% → Treasury Safe**           | policy (never split)                  |

## Reward split — verified $HISS trading fees (50/15/15/10/10)

HISS Reward Method V2. **Vault contributors** is the current name for the former
**depositor** cohort; **V1** (50/30/10/10, no burn) is historical.

| Leg                | Share (bps)     | Recipient                                      | Deployed?       |
| ------------------ | --------------- | ---------------------------------------------- | --------------- |
| xHISS stakers      | **50%** (5,000) | xHISS vault `0x6998…67Be`                      | Yes             |
| Vault providers    | **15%** (1,500) | vault-provider distributor                     | **No** → `null` |
| Vault contributors | **15%** (1,500) | vault-contributor distributor                  | **No** → `null` |
| Treasury           | **10%** (1,000) | Treasury Safe `0xF100…e36c` (absorbs dust)     | Yes             |
| Economic burn      | **10%** (1,000) | dead address `0x…dEaD` (totalSupply unchanged) | Yes             |

Provider scoring components: **40% equal / 30% external-TVL-days / 20% retention /
10% operational**, with a **25%** per-group dominance cap. Vesting: **vault contributor
30 days**, **vault provider 90 days**. Lifecycle: weekly provisional → monthly final →
**7-day challenge** → funded → vesting → claimable. The economic-burn leg is an
ERC-20 transfer to the dead address and does not reduce `HISS.totalSupply` (burn metric
= dead-address balance).

Full mechanism: [Reward flywheel](../fees/reward-flywheel.md) and
[Rewards](../rewards/index.md).

## Honesty

Fee illustrations are **static fee math, not forecasts and not performance claims**.
There is no guaranteed yield or APY. **Planned ≠ funded ≠ vesting ≠ claimable.**
