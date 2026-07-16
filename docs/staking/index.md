# Staking — Overview

Staking $HISS means depositing it into the **xHISS** vault and receiving **xHISS**
share tokens. As verified $HISS trading fees are injected, the xHISS-to-$HISS exchange
rate rises for everyone staked. Staking is a **mechanical position**, not a yield
product.

> **Not a performance claim. Historical fee distributions are not forecasts.** No
> known unresolved Critical or High findings after internal launch review (internal
> review — not an external audit).

## The pages

- **[xHISS](./xhiss.md)** — the staking vault mechanics: shares, exchange rate,
  injections, what the Safe can and cannot do.
- **[Cooldown and redeem](./cooldown-and-redeem.md)** — the two-step, non-pausable exit.
- **[Reward injections](./reward-injections.md)** — how the 50% staker leg drips in.

## Key facts

| Property                     | Value                                                           |
| ---------------------------- | --------------------------------------------------------------- |
| Staked asset                 | $HISS (`0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3`, 18dp)      |
| Share token                  | xHISS (18dp)                                                    |
| Vault                        | `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be` (chain 4663)       |
| Starting rate                | 1:1                                                             |
| Reward injection             | Verified $HISS fees, linear drip over **24h** (`injectRewards`) |
| Cooldown                     | **72h** (259,200s), partial allowed, escrowed, additive-restart |
| Redeem window                | **2 days** (172,800s) after cooldown completes                  |
| Exits pausable?              | **No** — exits are never pausable                               |
| Staking/injections pausable? | Yes                                                             |
| Immutable                    | Timing constants; the Safe cannot change them                   |

## How value accrues

1. You **stake** $HISS → receive xHISS at the current rate.
2. Verified $HISS trading fees (the 50% staker leg of the
   [flywheel](../fees/reward-flywheel.md)) are **injected** and drip in over 24h.
3. The exchange rate rises → each xHISS is redeemable for more $HISS over time.
4. To exit, you **start a 72h cooldown**, then **redeem** within the 2-day window.

Nothing is guaranteed: injections depend on trading activity HISS does not control,
and there is no promised rate of return.

## Prepare and sign

Staking, cooldown, and redeem are transactions **you** sign:

```ts
const stakeTxs = await hiss.staking.prepareStake({ staker: "0xYou", amountHiss: 500n * 10n ** 18n });
const cooldownTx = await hiss.staking.prepareStartCooldown({ staker: "0xYou", xShares: 250n * 10n ** 18n });
const redeemTx = await hiss.staking.prepareRedeem({
  staker: "0xYou",
  xShares: 250n * 10n ** 18n,
  receiver: "0xYou",
});
```

See [xHISS](./xhiss.md) for the full mechanics.
