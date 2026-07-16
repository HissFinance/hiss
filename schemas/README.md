<!-- SPDX-License-Identifier: Apache-2.0 -->

# HISS Finance JSON Schemas

Versioned, self-describing [JSON Schema](https://json-schema.org/) (draft
2020-12) definitions for the public HISS Finance data shapes. They are the
language-neutral contract behind the TypeScript types in
[`@hiss-finance/core`](../packages/core); the two are kept in step.

Every schema carries a `title`, a semantic `version`, a `description`, an
`examples` array, and explicit `required` fields. Where a rule is
cross-cutting (a chain restriction, a status ladder, a fee cap) it is encoded
directly in the schema so a generic validator enforces it.

## Schemas

| Schema                                               | What it describes                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`ContractRegistry`](./ContractRegistry.schema.json) | Canonical public contract addresses on Robinhood Chain 4663 (EIP-55 checksummed).   |
| [`AssetRegistry`](./AssetRegistry.schema.json)       | The base asset USDG (6 decimals) and the $HISS token (18 decimals).                 |
| [`FuseSet`](./FuseSet.schema.json)                   | Typed risk fuses that bound a Coil's compiled instructions.                         |
| [`CoilManifest`](./CoilManifest.schema.json)         | A trading thesis with a 10,000-bps allocation core, fuses, and triggers.            |
| [`FeeSchedule`](./FeeSchedule.schema.json)           | Vault fee configuration and the disclosed launch fee caps.                          |
| [`VaultManifest`](./VaultManifest.schema.json)       | A published USDG Creator Vault (Robinhood Chain only; USDG base).                   |
| [`VaultCandidate`](./VaultCandidate.schema.json)     | A free-to-save, pre-publication vault draft.                                        |
| [`ActionPlan`](./ActionPlan.schema.json)             | A reviewable set of would-be steps — always a plan, never "sent".                   |
| [`ExecutionReceipt`](./ExecutionReceipt.schema.json) | The only place a "confirmed" state exists; strict status ladder.                    |
| [`RewardMethod`](./RewardMethod.schema.json)         | `HISS_REWARD_METHOD_V1`: the 50/30/10/10 split and the depositor/provider formulas. |
| [`RewardEpoch`](./RewardEpoch.schema.json)           | A reward epoch's lifecycle descriptor (planned ≠ funded ≠ claimable).               |
| [`StakingPosition`](./StakingPosition.schema.json)   | A public read of an xHISS staking position.                                         |
| [`VaultPosition`](./VaultPosition.schema.json)       | A public read of a vault depositor position.                                        |
| [`PublicStatus`](./PublicStatus.schema.json)         | A status claim bound to the evidence that justifies it.                             |

## Invariants worth calling out

- **Allocation weights sum to exactly 10,000 bps** (`CoilManifest`).
- **Reward legs sum to exactly 10,000 bps** — 5000 / 3000 / 1000 / 1000
  (`RewardMethod`); the treasury leg absorbs floor-division dust.
- **Provider score is 40 / 30 / 20 / 10** with a **25% dominance cap**;
  depositor rewards use **share-seconds**. Vesting is **30 days** (depositor)
  and **90 days** (provider). No performance inputs.
- **Vaults are Robinhood Chain only** (4663 / 46630); **USDG (6 decimals)** is
  the only base asset. Base is never a vault chain.
- **Status needs proof**: `live` requires a chain read or artifact;
  `not_deployed` requires a no-bytecode read; a failed read is `unknown`.
- **Receipts are the only "confirmed" surface**: `onchain_confirmed` requires
  a `txHash` and `blockNumber`; `paper`/`preview`/`unknown` carry no `txHash`.

## Validating

Any draft-2020-12 validator works. For example, with
[`ajv`](https://ajv.js.org/) (`ajv-cli`, plus `ajv-formats` for `date-time`):

```sh
ajv validate -c ajv-formats \
  -s schemas/CoilManifest.schema.json \
  -r "schemas/FuseSet.schema.json" \
  -d path/to/your-coil.json
```

Some schemas `$ref` others by `$id` (for example `CoilManifest` references
`FuseSet`, and `VaultManifest` references `FeeSchedule`); load the referenced
schemas alongside the one you validate.
