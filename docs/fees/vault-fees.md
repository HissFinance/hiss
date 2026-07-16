# Vault fees

Every fee a creator or depositor encounters around a USDG vault, with exact current
values, worked examples, and caveats. Denomination is **USDG (6 decimals)** unless
stated otherwise.

> **Source of truth.** The deployed `VaultFactory` and vault contracts are
> authoritative at execution time. The values below are the **launch fee schedule**
> (`launch` phase). USDG amounts are candidate values set by the factory; percentage
> **caps** are contract-enforced bounds. The pure fee math (previews, receipts) is
> deterministic and lives in `@hiss-finance/core`.

## 1. Vault candidate creation — free to save

- **Source:** launch fee schedule.
- **Exact current value:** **0 USDG**.
- **Version:** launch schedule.
- **Where verifiable:** the candidate-save path takes no fee; nothing on-chain is
  written until you publish.
- **Contract-enforced vs policy:** policy — a saved candidate is off-chain draft
  state.
- **Example:** compose and iterate on a manifest, validate its risk fuses, preview
  fees — pay nothing.
- **Caveat:** saving a candidate does **not** require creator skin-in-game and does
  **not** open deposits. Only _publishing_ does.

## 2. Public vault creation fee

- **Source:** launch fee schedule (`publicCreationFeeUsdg`).
- **Exact current value:** **50 USDG** (launch). Standard-phase reference value is
  100 USDG.
- **Version:** launch schedule; an early-creator promotional value (25 USDG) may
  apply where offered.
- **Where verifiable:** read the active fee from the deployed `VaultFactory`; the
  charge appears as an on-chain event when the vault is published.
- **Contract-enforced vs policy:** the factory charges it on publish. The **amount**
  is a candidate configured on the factory — treat it as a candidate, confirm with a
  live read.
- **Example:** a creator publishes their first public vault → pays a one-time **50
  USDG** software fee for writing the manifest and deploying the vault instance.
  Depositors pay nothing for this.
- **Caveat:** this is a **software/publishing fee**, paid once by the **creator** —
  never a recurring charge and never a cut of anyone's money flow.

## 3. Creator performance fee

The core creator incentive. It is charged **only on new profit above the vault's
high-water mark**.

- **Source:** vault fee config (`performanceFeeBps`), default from the launch
  schedule.
- **Exact current value:** **10%** (1,000 bps) default.
- **Bounds (contract-enforced):** **0–10%** for unverified creators;
  **0–20%** for verified creators. Configuring above the cap is rejected.
- **Version:** launch schedule; per-vault value pinned in the manifest's fee config.
- **Where verifiable:** read the vault's fee config; recompute with
  `calculatePerformanceFee` in `@hiss-finance/core`.
- **Contract-enforced vs policy:** the **cap** is contract-enforced; the exact
  configured rate is set by the creator within the cap and disclosed in the manifest.

### High-water mark: no fee on losses

A performance fee is charged **only** when the vault's share price exceeds its prior
peak (the high-water mark, HWM):

- Share price **below** HWM → **no fee** (no fee on losses).
- Share price **equal to** HWM → no new gains → **no fee**.
- Share price **above** HWM → fee applies **only to the gain above the HWM**, and
  the HWM crystallizes up to the new price.

This means depositors are never charged a performance fee to "recover" losses: prior
drawdowns must be fully recovered before any new fee accrues.

### Share-dilution behavior

Performance fees crystallize as a claim on the vault's new profit, denominated in
USDG. When a fee is realized, it reduces the value attributable to existing shares by
exactly the fee amount (the creator's share of _new profit only_) — depositor
principal is never touched, and the fee is transparent in the receipt. The HWM is
per-vault accounting so that later gains are measured from the crystallized peak.

### Worked example

A vault has **10,000 shares**, prior high-water mark **1.00 USDG/share**, current
share price **1.10 USDG/share**, performance fee **10%**.

```
Gain per share above HWM = 1.10 − 1.00 = 0.10 USDG
Total new profit          = 0.10 × 10,000 = 1,000 USDG
Creator performance fee   = 1,000 × 10%   = 100 USDG
New high-water mark       = 1.10 USDG/share
```

Depositors keep the other **900 USDG** of new profit. If instead the share price had
been **0.95**, the fee would be **0** and the HWM would stay at **1.00** — no fee
until 1.00 is recovered.

- **Caveat:** this is **static fee math, not a forecast and not a performance
  claim**. Vaults can lose value; there is no floor.

## 4. HISS protocol share

The protocol's only take on vault economics — a slice of the **creator's**
performance fee, never of depositor principal.

- **Source:** vault fee config (`protocolShareBps`), default from the launch
  schedule.
- **Exact current value:** **10%** (1,000 bps) of the creator performance fee at
  launch.
- **Bounds (contract-enforced):** **0–20%** maximum.
- **Version:** launch schedule.
- **Where verifiable:** read the vault fee config; recompute with
  `splitPerformanceFee`.
- **Contract-enforced vs policy:** the **max** is contract-enforced; launch runs at
  10%.

### Worked example (continuing from above)

```
Creator performance fee   = 100 USDG
HISS protocol share (10%) = 100 × 10% = 10 USDG  → HISS protocol
Creator receives          = 100 − 10  = 90 USDG
Depositors keep           = 900 USDG (unchanged)
```

An optional, always-disclosed **referral share** (bounded, up to 50% of the creator
remainder) can be carved from the **creator's** portion only — never from the
protocol share and never from depositor principal.

- **Caveat:** the protocol share is a share **of the creator fee**. It is not an
  additional depositor fee and does not appear unless a performance fee is realized.

## 5. Deposit fee and withdrawal fee

- **Source:** launch fee schedule.
- **Exact current value:** **deposit 0**, **withdrawal 0**.
- **Version:** launch schedule.
- **Where verifiable:** the vault charges no protocol deposit/withdrawal fee; confirm
  in the deposit/withdraw preview.
- **Contract-enforced vs policy:** contract behavior — no protocol fee is levied.
- **Example:** deposit 1,000 USDG → 1,000 USDG of value enters the vault (subject to
  live share price). Withdraw → you receive your shares' USDG value.
- **Caveat:** **actual chain gas, liquidity-unwind costs, and slippage are disclosed
  separately** and are not a HISS fee — there is no hidden spread.

## 6. Routing fee

Applies only to rebalances routed through HISS routing infrastructure, and only once
that infrastructure is **live and used**.

- **Source:** vault fee config (`routingFeeTenthBps`), stored in **tenth-bps** so
  0.5 bps is representable.
- **Exact current value:** **0** — routing is disabled protocol-wide today.
- **Bounds (contract-enforced):** **0** (disabled), or **0.5–2 bps** once live: 0.5
  bps default, 1 bps standard cap, 2 bps maximum for advanced explicitly
  HISS-routed strategies.
- **Version:** launch schedule.
- **Where verifiable:** read the vault fee config; recompute with
  `calculateRoutingFee` (returns 0 unless `routingLive` is true).
- **Contract-enforced vs policy:** bounds are contract-enforced; the fee is **0**
  until routing is live.
- **Example (illustrative, once live):** a 100,000 USDG rebalance notional at 1 bps →
  `100,000 × 0.0001 = 10 USDG` routing fee. **Today this is 0.**
- **Caveat:** candidate saves, validation, receipts, and blocked intents are **never**
  routing-fee events — they carry no notional through HISS routing.

## 7. Creator skin-in-game (not a fee)

Not a fee, but a required commitment: a creator must hold **at least 5%** (500 bps)
of their own vault before **public deposits** open. It is **not** required to save a
candidate. This aligns the creator with depositors and is disclosed in the manifest.

## Putting it together — the launch fee table

```
Vault candidate save:   0 USDG (free)
Public vault creation:  50 USDG (launch), paid once by the creator on publish
Creator performance:    10% of new profit above the high-water mark (no fee on losses)
HISS protocol share:    10% of the creator performance fee (never on principal)
Deposit fee:            0
Withdrawal fee:         0 (chain/liquidity/slippage disclosed separately)
Routing fee:            0 until HISS live routing is enabled (then 0.5–2 bps)
Creator skin-in-game:   5% minimum before public deposits open
```

See also: [Vault performance](../vaults/performance.md) ·
[Receipts](../receipts.md) · [$HISS token fees](./hiss-token-fees.md).
