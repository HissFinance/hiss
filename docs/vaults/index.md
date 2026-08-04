# Vaults — Overview

A HISS vault is an on-chain **ERC-4626 basket** denominated in **USDG (6 decimals)** on
Robinhood Chain. A **creator** declares a target-weight strategy over tokenized
equities, ETFs, and cash; **depositors** deposit USDG, receive shares, and **share the
vault's profits and losses** pro-rata. There is **no guaranteed yield** and no floor.

## The lifecycle

```
compose candidate ──▶ validate fuses & fees ──▶ publish (creation fee) ──▶
open deposits (creator skin ≥5%) ──▶ deposits/withdrawals ──▶ rebalances (audited) ──▶
strategy updates (7-day notice) ──▶ performance fees at high-water mark
```

- **[Create a vault](./create-a-vault.md)** — compose, validate, publish.
- **[Vault manifest](./vault-manifest.md)** — the signed, hashed strategy description.
- **[Allocations](./allocations.md)** — target weights in basis points.
- **[Risk fuses](./risk-fuses.md)** — the safety constraints every rebalance honors.
- **[Deposit](./deposit.md)** / **[Withdraw](./withdraw.md)** — the depositor flows.
- **[Strategy updates](./strategy-updates.md)** — the disclosed change process.
- **[Receipts](./receipts.md)** — verifiable records of on-chain actions.
- **[Performance](./performance.md)** — share price, high-water mark, and fees.
- **[Verified history & USDG accounting](./verified-history-and-usdg-accounting.md)** —
  block-pinned history (gaps never bridged) and the USDG accounting identity vs
  market-peg separation.
- **[24/7 architecture](./24-7-architecture.md)** — the LIVE continuous
  valuation + settlement model the canonical V2 vault runs.

## Key properties

- **Denomination:** USDG (6dp). Account in base units (`1,000 USDG = 1_000_000_000`).
- **Shares:** ERC-4626 shares represent a pro-rata claim on vault assets.
- **Profit and loss are shared.** Depositors are exposed to gains **and** losses.
- **Canonical assets only.** Vaults reference Stock/ETF tokens by canonical address via
  the asset registry.
- **Fees are disclosed.** Zero deposit/withdraw fee; performance fee only above the
  [high-water mark](./performance.md); see [Fees](../fees/vault-fees.md).
- **The website and app are free.** The HISS website and first-party app tools carry no
  subscription, credits, or paywall (packages are open-source, Apache-2.0). Only normal
  network gas and contract-enforced protocol fees apply — those are on-chain, not HISS
  charges. You keep signing control; HISS never signs, submits, or takes custody.
- **Change notice.** Strategy changes require a disclosed **7-day** notice.
- **24/7 settlement is LIVE on the canonical V2 vault.** Deposits and USDG
  redemptions settle through a 24/7 request queue in epoch batches; a
  valuation-free **in-kind redemption** is the always-available exit; capacity is
  a **live Price Mesh read**, never a fixed promise. Availability is decided by
  on-chain market health evidence — never by the calendar. See
  [24/7 architecture](./24-7-architecture.md).
- **Rebalancing on the canonical V2 vault is inactive by policy** (an owner
  decision, not a fault state): "AAPL is currently the only execution-grade
  Stock Token asset. Initial public operation uses settlement-driven allocation
  and preserves the current USDG cash reserve." For V1-style factory vaults,
  protocol-wide live routing remains off until per-asset live-rebalance
  readiness passes.

## The canonical V2 vault

New deposits go to the canonical **HISS Vault V2** (`HissUsdGVaultV2`) at
`0x432e90b1B35995EBE46eD93B4Db369abfc230E69`. It settles queued flow in epoch
batches via `HissRequestQueue` (`0x317d1eEC013a91a316858e80BF782496F231729a`)
with constrained keeper settlement, a liveness heartbeat, side-aware Price Mesh
pricing, and an unconditional in-kind exit. Queue, keeper, capacity, and pause
state are **always live chain reads** — do not copy a snapshot. See
[24/7 architecture](./24-7-architecture.md) for the full contract stack.

## The legacy V1 flagship

The V1 flagship HISS Vault at `0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` is
**LEGACY · EMPTY** — closed to new deposits, holding no depositor value. Its
address and [verified history](./verified-history-and-usdg-accounting.md) remain
documented; there is **no migration flow** (nothing to migrate). Never present
the V1 address as a deposit target.

## Not investment advice

A vault is a transparent strategy container, not a recommendation. **No guaranteed
yield, no APY, no passive income.** Tokenized Stock Tokens are economic exposure only
and confer no ownership rights. See [Stock Tokens](../stock-tokens.md).
