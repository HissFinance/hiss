# stake-hiss

Builds an **unsigned** stake plan with `@hiss-finance/react` and prints the
xHISS exit timing (72h cooldown, then a 2-day redeem window). No wallet, no
network, no execution.

## Run

```bash
pnpm --filter @hiss-finance/example-stake-hiss start
```

## Expected output

```
Stake HISS, receive xHISS. Fee-funded HISS injections increase the HISS-per-xHISS share value over time.

Plan:     Stake HISS for xHISS
Executed: false
Cooldown: 3d 0h
Redeem:   2d 0h window after cooldown
Notes:
  - The exact xHISS minted is computed on-chain at execution using the live rate.
  - Staking is not a performance claim. Exiting requires a 72-hour cooldown, then a 2-day redeem window.
  - You sign this transaction in your own wallet. This library never sends transactions.

Not a performance claim. Historical fee distributions are not forecasts.
```

Staking is not yield, APY, or income. Nothing here is guaranteed.
