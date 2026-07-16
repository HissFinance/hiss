# Current status (snapshot)

> **Generated at:** 2026-07-16 (UTC)
> **Source:** committed, chain-verified artifacts + `@hiss-finance/core` resolvers.
> **Chain:** Robinhood Chain mainnet, chain ID **4663**.
> **Freshness limitations:** This is a **point-in-time snapshot**, not a live read.
> On-chain state is authoritative. A failed read is **unknown** — never "live" and
> never "not deployed". Re-read the chain for anything transactional; status can change
> after this stamp.

## Contracts

- **Vault system** — VaultFactory, flagship HISS Vault, registries, oracle adapter, and
  rebalance adapter are **deployed** on chain 4663. See
  [current deployments](./current-deployments.md).
- **xHISS staking vault** — **deployed** at
  `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be`.
- **Treasury Safe** — 2-of-3 multisig at `0xF100Fc28dd1721C698046Dbd60408c523b69e36c`,
  verified on-chain; the protocol authority.

## Vaults

- The flagship vault is **live** and denominated in USDG.
- **Live routing is disabled protocol-wide** — vaults hold their base asset (USDG) until
  per-asset live-rebalance readiness passes. Declared target weights are **not** current
  holdings; read live state.

## Staking

- Staking mechanics are deployed. Reward injections (`injectRewards`, 24h linear drip)
  are **injector-gated** via the Treasury Safe.
- **Nothing is funded by default** — an authorized injector still moves nothing until an
  actual injection occurs. **Planned ≠ funded ≠ injected.**

## Rewards

- The **50/30/10/10** split is defined and reproducible.
- **xHISS leg (50%)** and **Treasury leg (10%)** have deployed recipients.
- **Depositor leg (30%)** and **provider leg (10%)** route to distributors that are
  **not yet deployed** — recipients are `null`; **nothing moves against them**.
- Reward epochs follow weekly provisional → monthly final → **7-day challenge** →
  funded → vesting → claimable. No epoch is claimable during its challenge window.

## What is NOT live

| Item                          | State                             |
| ----------------------------- | --------------------------------- |
| Depositor vesting distributor | not deployed (`null` recipient)   |
| Provider rewards distributor  | not deployed (`null` recipient)   |
| Live rebalance routing        | disabled protocol-wide            |
| Packages on npm               | not published (build from source) |

## How to check anything here

Do not trust this snapshot for a transaction. Read the chain:

```bash
RPC=https://rpc.mainnet.chain.robinhood.com
cast code <address> --rpc-url $RPC          # deployed? (non-empty = has code)
```

Then consult [Contracts](../contracts.md) and
[Status and data freshness](../status-and-data-freshness.md). **On-chain wins.**
