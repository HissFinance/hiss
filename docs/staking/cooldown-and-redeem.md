# Cooldown and redeem

Exiting xHISS is a deliberate, two-step process: a **72-hour cooldown**, then a
**2-day redeem window**. Both steps are **never pausable** — the Treasury Safe cannot
trap staked funds. All four operations are transactions **you** sign.

## The timeline

```
startCooldown(xShares)
        │  72h cooldown (259,200s) — xHISS escrowed
        ▼
   cooldown complete
        │  2-day redeem window (172,800s)
        ▼
  redeem(xShares, receiver)  →  $HISS returned to receiver
```

If the redeem window passes without redeeming, the cooled xHISS is no longer
immediately redeemable — call `restartCooldown()` to begin a new 72h wait.

## The operations

### `startCooldown(xShares)`

- Begins a **72-hour** cooldown on the specified xHISS.
- **Partial cooldowns are allowed** — you can cool part of your balance.
- Cooled xHISS is **escrowed** during the cooldown.
- **Additive restart:** starting another cooldown while one is in progress adds to the
  escrow and restarts the timer for the combined amount.

### `redeem(xShares, receiver)`

- Available only **after** the 72h cooldown completes and **within** the 2-day window.
- Returns the current **$HISS value** of the redeemed xHISS to `receiver`.
- The value reflects the exchange rate at redemption (which may have risen from
  injections).

### `restartCooldown()`

- Use if you **missed the 2-day window**. Starts a fresh 72h cooldown for the escrowed
  xHISS.

### `cancelCooldown()`

- Available **any time**. Cancels the cooldown and returns escrowed xHISS to your
  active staked position.

## Prepare and sign

```ts
const cooldownTx = await hiss.staking.prepareStartCooldown({ staker: "0xYou", xShares: 250n * 10n ** 18n });
const redeemTx = await hiss.staking.prepareRedeem({
  staker: "0xYou",
  xShares: 250n * 10n ** 18n,
  receiver: "0xYou",
});
// restart / cancel are prepared similarly and signed by you.
```

MCP: `hiss_prepare_xhiss_cooldown`, `hiss_prepare_xhiss_redeem`.

## Why a cooldown

The cooldown makes the staker set predictable around reward injections and protects
the vault from instantaneous entry-and-exit gaming. It is a fixed, **immutable**
constant — the Safe cannot lengthen, shorten, or waive it, and cannot pause exits.

## Guarantees

- **Exits are never pausable.** Cooldown, redeem, restart, and cancel are always
  available, even if staking and injections are paused.
- **Timing is immutable.** 72h cooldown and 2-day redeem window cannot be changed.
- **No seizure.** The Safe cannot rescue, mint, or seize your xHISS or staked $HISS.

## Honesty

The value you redeem depends on the exchange rate, which depends on injections, which
depend on trading activity HISS does not control. **Not a performance claim; no
guaranteed yield.**
