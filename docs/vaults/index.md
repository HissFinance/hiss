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
- **Routing disabled today.** Protocol-wide, live routing is off; a vault holds its
  base asset until per-asset live-rebalance readiness passes.

## The flagship vault

The reference vault (HISS Vault) at
`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` declares a target-weight basket of
mega-cap tech Stock Tokens, tokenized ETFs, and a USDG cash reserve. **Declared target
weights are not current holdings** — always read live state; do not copy a snapshot.

## Not investment advice

A vault is a transparent strategy container, not a recommendation. **No guaranteed
yield, no APY, no passive income.** Tokenized Stock Tokens are economic exposure only
and confer no ownership rights. See [Stock Tokens](../stock-tokens.md).
