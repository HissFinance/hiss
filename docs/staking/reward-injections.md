# Reward injections

Reward injections are how the **50% staker leg** of the [reward flywheel](../fees/reward-flywheel.md)
reaches xHISS stakers. Verified $HISS trading fees are injected into the vault and drip
in linearly, raising the xHISS-to-$HISS exchange rate. Injections are the only way
staker value moves — **planned ≠ funded ≠ injected.**

## Mechanics

- **Function:** `injectRewards` on the xHISS vault.
- **Injector-gated:** only an address authorized by the Treasury Safe (`setInjector`)
  may inject. Authorization is not funding — an authorized injector still moves nothing
  until an actual injection occurs.
- **Linear 24-hour drip:** an injection unlocks linearly over **24 hours**. There is no
  instantaneous rate jump; the rate rises smoothly as the injection vests into the pool.
- **Reverts with zero stakers:** an injection cannot occur if nothing is staked (there
  would be no one to receive it).

## From verified fee to injection

```
verified $HISS trading fee ──▶ classified (fail-closed) ──▶ 50% staker leg ──▶
Treasury Safe authorizes/funds ──▶ injectRewards ──▶ 24h linear drip ──▶ rate rises
```

Every step is gated. The staker leg is **planned** data until the Safe funds it, and it
only affects value once `injectRewards` runs. See the [flywheel](../fees/reward-flywheel.md).

## Reading injection history

```ts
const history = await hiss.staking.readInjections();
// each entry: amount, start, end (start + 24h), and how much has dripped in
```

MCP: `hiss_get_staking_status` surfaces the current drip schedule and exchange
rate. Full reward-injection history is HTTP-only (`GET /api/stake/reward-injections`).

## What an injection is not

- **Not a dividend or holder reward.** It is a mechanical top-up of the staked pool.
- **Not guaranteed.** Injections depend on verified fee income from trading activity
  HISS does not control. There may be long periods with **no injection** and a **flat
  rate**.
- **Not a forecast.** Historical injections do **not** predict future ones.
  **Historical fee distributions are not forecasts. Not a performance claim.**

## Honesty rules for surfaces

If you render injection data:

- Show **actual** injection history and the **current** drip only — never an implied
  future rate.
- Distinguish **authorized injector** (a capability) from **funded/injected** (value
  moved).
- Include **"Not a performance claim."** and **"Historical fee distributions are not
  forecasts."**
- A failed read is **unknown**, not "no rewards" and not "live rewards".
