# read-reward-status

Reads the HISS reward-split legs (50/30/10/10) and their lifecycle state via
`@hiss-finance/sdk`.

## Run

```bash
pnpm --filter @hiss-finance/example-read-reward-status start
```

## Expected output

```
Split version: hiss-reward-split-v1
Read:          live
Legs:
  - xHISS stakers       50%  planned   0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be
  - Depositor vesting   30%  none      not deployed
  - Provider rewards    10%  none      not deployed
  - Treasury            10%  planned   ...
Note: rewards are not guaranteed; funding state is read live.
```

A `none` state with "not deployed" means the distributor does not exist yet —
nothing can move against it. Rewards are never presented as yield or income.
