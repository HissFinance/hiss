# xHISS staking vault

`XHissVault` is a **single-asset staking vault** over **$HISS**. Stakers deposit $HISS
and receive **xHISS** (the 18-decimal share token). As verified $HISS trading fees are
injected, the xHISS-to-$HISS exchange rate rises. This is the mechanical description of
the vault — **not a performance claim, and historical fee distributions are not
forecasts.**

- **Vault (chain 4663):** `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be`
- **Staked asset:** $HISS `0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3` (18dp)
- **Share token:** xHISS (18dp)

## Shares and exchange rate

- The rate starts **1:1** (1 $HISS → 1 xHISS).
- xHISS is a **claim on a growing pool of $HISS**. When fees are injected, total $HISS
  rises while xHISS supply is unchanged, so **each xHISS redeems for more $HISS**.
- Your xHISS balance does not change on injection; its **value in $HISS** does.

## Reward injections

The 50% staker leg of the [reward flywheel](../fees/reward-flywheel.md) is added via
`injectRewards`:

- **Injector-gated.** Only an authorized injector (set by the Treasury Safe via
  `setInjector`) may inject.
- **Linear 24h drip.** An injection unlocks linearly over 24 hours — no instantaneous
  rate jump.
- **Reverts with zero stakers.** An injection cannot happen if there is nothing staked.

Details and history: [Reward injections](./reward-injections.md).

## Staking

```ts
const { transactions, disclosure } = await hiss.staking.prepareStake({
  staker: "0xYou",
  amountHiss: 500n * 10n ** 18n, // 500 $HISS (18 decimals)
});
// Sign and send. You receive xHISS at the current rate.
```

Staking (and injections) **can be paused** by the owner; exits cannot (below).

## Exiting: cooldown then redeem

Exiting is a deliberate, two-step, **non-pausable** flow:

1. **`startCooldown(xShares)`** — begins a **72-hour** (259,200s) cooldown. Partial
   cooldowns are allowed; cooled xHISS is **escrowed**; starting another cooldown
   **restarts additively**.
2. **`redeem(xShares, receiver)`** — after cooldown completes, a **2-day** (172,800s)
   redeem window opens. Redeem returns the $HISS value of your xHISS to `receiver`.
3. **Missed the window?** Call **`restartCooldown()`**.
4. **Change your mind?** Call **`cancelCooldown()`** at any time.

See [Cooldown and redeem](./cooldown-and-redeem.md) for the timeline.

## What the Treasury Safe can and cannot do

The vault is constructed with the **Treasury Safe as owner** — no ownership migration
is needed. The Safe **can**:

- Authorize/deauthorize the reward **injector** (`setInjector`).
- **Pause** staking and injections.

The Safe **cannot**:

- **Rescue or seize staked $HISS.**
- **Mint xHISS** or alter balances.
- **Change the immutable timing constants** (cooldown 72h, redeem window 2 days,
  injection drip 24h).
- **Pause exits** — cooldown, redeem, restart, and cancel are always available.

## Review state

Verbatim, the only approved formulation:

> **No known unresolved Critical or High findings after internal launch review.**

This is an **internal** launch review — **never** described as an external audit.

## Reading status

```ts
const s = await hiss.staking.read();
// exchange rate, total staked $HISS, xHISS supply, injection schedule, pause state
```

MCP: `hiss_get_xhiss_status`, `hiss_get_staking_position`,
`hiss_get_reward_injection_history`.

## Honesty rules

- **Not a performance claim.** No guaranteed yield, APY, or passive income.
- Injections depend on trading activity HISS does not control; the rate can be flat.
- **Historical fee distributions are not forecasts.**
