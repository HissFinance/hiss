# Architecture

HISS Finance is a layered system with one rule at its center: **prepare and verify,
never execute or custody**. Off-chain code builds artifacts and transactions; the
user's wallet and the Treasury Safe sign; the audited contracts hold value.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│  Agents & surfaces                                            │
│  MCP server · x402 endpoints · Bankr rails · CLI · React      │
│  (read / prepare / score — never execute, never custody)      │
├──────────────────────────────────────────────────────────────┤
│  SDK (@hiss-finance/sdk) · Vault Kit (@hiss-finance/vault-kit)│
│  read chain state · prepare transactions · compose manifests  │
├──────────────────────────────────────────────────────────────┤
│  Core (@hiss-finance/core) — the shared truth layer           │
│  chain config · address book · fee math · reward split ·      │
│  share-seconds · vesting · manifest schema · resolvers        │
├──────────────────────────────────────────────────────────────┤
│  Contracts (Robinhood Chain 4663)                             │
│  VaultFactory · HISS Vault · XHissVault · registries ·        │
│  reward distributors · rebalance adapter · Treasury Safe      │
└──────────────────────────────────────────────────────────────┘
                    ▲ on-chain state is the source of truth ▲
```

## The truth hierarchy

When two sources disagree, the higher one wins:

1. **On-chain state** — fresh reads on chain 4663.
2. **Committed, chain-verified artifacts** — deployments, vaults, token, rewards.
3. **`@hiss-finance/core`** — typed constants and pure resolvers.
4. **Live SDK/CLI reads** — which derive from 1–3.
5. **Docs and skill packs** — descriptions of 1–4, never a source.

Documentation (including the [generated snapshots](./generated/current-status.md))
describes the chain; it never overrides it.

## Packages

- **`@hiss-finance/core`** — deterministic, I/O-free. Fee math, the 50/30/10/10
  split, depositor share-seconds, provider facts-only scoring, linear vesting, chain
  config, address book, manifest schema. Everything else depends on it.
- **`@hiss-finance/vault-kit`** — vault authoring: compose allocations, validate
  [risk fuses](./vaults/risk-fuses.md), preview fees, hash a manifest.
- **`@hiss-finance/sdk`** — the client: typed chain reads and transaction
  **preparation** for deposit, withdraw, stake, cooldown, redeem, and publish.
- **`@hiss-finance/react`** — headless hooks/components over the SDK. Bring your own
  wallet connector.
- **`@hiss-finance/cli`** — terminal client for reads, validation, and preparation.
- **`@hiss-finance/mcp-server`** — a local MCP server exposing 45 read/prepare/score
  [tools](./mcp.md).

## Contracts

The on-chain system centers on a `VaultFactory` that deploys vault instances,
supporting registries (asset, receipt, access, readiness), reward distributors, a
rebalance adapter, the `XHissVault` staking contract, and the $HISS token. Protocol
authority is the 2-of-3 **Treasury Safe**. See [Contracts](./contracts.md).

## Data flow: creating and funding a vault

1. **Compose** a manifest (weights, fees, fuses) with `vault-kit` — free, off-chain.
2. **Validate** fees and risk fuses; **hash** the manifest.
3. **Prepare** the publish transaction with the SDK.
4. **Sign** it with your wallet; the factory charges the creation fee and deploys the
   vault instance (an on-chain event / [receipt](./receipts.md)).
5. **Open deposits** once creator skin-in-game (≥5%) is met.
6. Depositors **prepare** and **sign** their own deposits.

## Data flow: rewards

Verified $HISS trading fees are **classified** (fail-closed), **planned** into the
50/30/10/10 split (data with a plan hash), **funded** by the Treasury Safe after a
7-day challenge window, then **vest** before becoming claimable. See the
[reward flywheel](./fees/reward-flywheel.md) and [epochs & vesting](./rewards/epochs-and-vesting.md).

## Design invariants

- **No execution or custody in off-chain code.** SDK/CLI/agents prepare; users sign.
- **Fail closed.** Missing artifact, low-confidence classification, missing
  authorization, or hash mismatch → refuse.
- **Deterministic math.** Fee, split, share-seconds, and vesting functions are pure
  and reproducible.
- **Honest status.** Unknown is unknown; "live" and "not deployed" both require
  affirmative evidence. See [Status and data freshness](./status-and-data-freshness.md).
