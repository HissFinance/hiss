# read-reward-status

Reads the HISS Reward Method V2 split legs (50/15/15/10/10) and their lifecycle
state via `@hiss-finance/sdk`.

## Run

```bash
pnpm --filter @hiss-finance/example-read-reward-status start
```

## Expected output

```
Split version: hiss-reward-split-v2
Read:          live
Legs:
  - xHISS stakers       50%  planned   0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be
  - Vault Providers     15%  none      not deployed
  - Vault Contributors  15%  none      not deployed
  - Treasury            10%  planned   0xF100Fc28dd1721C698046Dbd60408c523b69e36c
  - Economic burn       10%  planned   0x000000000000000000000000000000000000dEaD
Note: rewards are not guaranteed; funding state is read live.
```

A `none` state with "not deployed" means the distributor does not exist yet —
nothing can move against it. The **economic burn** leg sends $HISS to the
canonical dead address `0x…dEaD`: it leaves circulation, but `HISS.totalSupply`
is not reduced. Rewards are never presented as yield or income.
