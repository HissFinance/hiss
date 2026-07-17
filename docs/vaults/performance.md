# Vault performance

How a vault's value is measured, how the high-water mark works, and how the creator
performance fee is charged. This page describes **mechanics**, not expected outcomes:
**there is no guaranteed yield, no APY, and past results are not forecasts.**

## Share price

A vault is ERC-4626. **Share price** = vault net asset value ÷ total shares, in USDG.
It rises and falls with the vault's holdings. A depositor's value = their shares ×
current share price. **Always read share price live** — never copy a snapshot.

## Profit and loss are shared

Depositors share the vault's gains **and** losses pro-rata by share. If the basket
falls, share price falls, and depositors bear it. There is no floor and no protection
against loss.

## The high-water mark (HWM)

Each vault tracks a **high-water mark** — the highest share price at which a
performance fee was last crystallized. The performance fee is charged **only on new
profit above the HWM**:

- Share price **below** HWM → **no fee** (no fee on losses).
- Share price **equal to** HWM → no new gains → no fee.
- Share price **above** HWM → fee applies **only to the gain above the HWM**; the HWM
  then rises to the new price.

This guarantees depositors are never charged twice for the same gains and never charged
to recover a drawdown.

## Performance fee — worked example

Vault: **10,000 shares**, prior HWM **1.00 USDG**, current price **1.10 USDG**,
performance fee **10%**, protocol share **10%**.

```
Gain above HWM per share = 1.10 − 1.00 = 0.10 USDG
Total new profit         = 0.10 × 10,000 = 1,000 USDG
Creator performance fee  = 1,000 × 10%   = 100 USDG
  HISS protocol share    = 100 × 10%     =  10 USDG
  Creator receives       = 100 − 10      =  90 USDG
Depositors keep          = 1,000 − 100   = 900 USDG of new profit
New HWM                  = 1.10 USDG
```

If price had instead fallen to **0.95**, the fee is **0** and the HWM stays at
**1.00** — no fee until 1.00 is recovered. See the full breakdown in
[Vault fees](../fees/vault-fees.md).

## Share dilution behavior

When a performance fee crystallizes, it is a claim on **new profit only**, denominated
in USDG. It reduces the value attributable to existing shares by exactly the fee
amount (the creator's slice of new profit) — **depositor principal is never touched**,
and the effect is visible in the [receipt](./receipts.md). The HWM is per-vault
accounting so subsequent gains are measured from the crystallized peak.

## Reading performance

```ts
const vault = await hiss.vaults.read("0x6d962604df1c6c5ef4b59d88863600fe71bb63e6");
console.log(vault.sharePriceUsdg, vault.highWaterMarkUsdg, vault.totalShares);
```

You can also preview fee math with `calculatePerformanceFee` / `splitPerformanceFee`
from `@hiss-finance/core`, or read the schedule with the MCP tool
`hiss_get_fee_schedule`.

## Honesty rules

- Historical or hypothetical performance is **not a forecast and not a performance
  claim**.
- No "guaranteed yield", "APY", "passive income", or "risk-free" framing anywhere.
- Comparisons between vaults are facts-only and carry **no recommendation**
  (`hiss_compare_vaults_without_recommendation`).
