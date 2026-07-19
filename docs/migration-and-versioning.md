# Migration and versioning

How HISS Finance versions its packages, schemas, contracts, and reward methodology, and
what to expect as it evolves toward 1.0.

## Semantic versioning

The packages aim to follow [Semantic Versioning](https://semver.org/):

- **MAJOR** — breaking API changes.
- **MINOR** — backwards-compatible features.
- **PATCH** — backwards-compatible fixes.

The project is **pre-1.0** (currently `0.1.0`). Before 1.0, minor releases may include
breaking changes; **pin to a tag** for stability and read the
[CHANGELOG](../CHANGELOG.md).

## Packages are not published yet

Packages are **not on npm**. A "release" is a **tagged commit** in this repository.
Consume via the workspace (`pnpm build`) or a local `file:`/`link:` reference. When
publishing begins, the quickstart switches to `pnpm add @hiss-finance/…` and this page
will document the transition.

## Versioned artifacts

Several artifacts carry their own explicit versions so consumers can pin behavior:

| Artifact                          | Version identifier                                                        |
| --------------------------------- | ------------------------------------------------------------------------- |
| Vault manifest schema             | `vault-manifest-1.0.0`                                                    |
| Reward split                      | `hiss-reward-split-v2` (was `hiss-reward-split-v1`, historical)           |
| Reward methodology                | `HISS_REWARD_METHOD_V2` (was `HISS_REWARD_METHOD_V1`, historical)         |
| Vault-contributor scoring         | `hiss-depositor-scoring-v1` (share-seconds; methodology unchanged)        |
| Provider rewards                  | `hiss-provider-rewards-v1`                                                |
| Vesting                           | `hiss-reward-vesting-v1`                                                  |
| Weekly checkpoint / monthly epoch | `hiss-reward-weekly-checkpoint-v1` / `hiss-reward-monthly-epoch-score-v1` |

A change to a methodology or schema bumps its version; older artifacts remain
interpretable under the version they declare. The scoring/vesting/epoch identifiers
keep their `-v1` strings because their math is **unchanged** by the V2 split — V2
changed the leg proportions and added the economic-burn leg, not the per-cohort
scoring. See [Reward Method V2](#reward-method-v2-migration).

## Contracts and addresses

- **Contracts are immutable once deployed.** New behavior ships as new deployments, not
  in-place mutation. Immutable constants (e.g. xHISS timing) never change.
- **Addresses are load-bearing.** The [contracts](./contracts.md) address book and the
  [generated snapshot](./generated/current-deployments.md) track current deployments;
  **on-chain reads are authoritative**. Always verify with `cast code` before trusting a
  status.
- **Undeployed → null.** Reward distributors not yet deployed appear with `null`
  recipients in plans; when deployed and verified, docs and the SDK move them from
  "planned" to "funded/claimable" — with affirmative evidence, never before.

## Reward methodology changes

The reward methodology is a **frozen, versioned bundle** — currently
`HISS_REWARD_METHOD_V2`. If parameters or curves change, a new version is introduced;
existing epochs remain scored under the version they were finalized with. The lifecycle
(weekly → monthly → 7-day challenge → funded → vesting → claimable) is part of the
versioned method. See [Epochs and vesting](./rewards/epochs-and-vesting.md).

## Reward Method V2 migration

**V1 (`HISS_REWARD_METHOD_V1`) is historical.** It split verified $HISS trading fees
four ways — **50/30/10/10** (xHISS stakers / depositors / providers / Treasury), with no
burn leg. Do not present 50/30/10/10 as the current split.

**V2 (`HISS_REWARD_METHOD_V2`, `hiss-reward-split-v2`) is current.** It splits verified
$HISS trading fees five ways — **50/15/15/10/10**:

| Leg                    | Share           | Recipient                                                           |
| ---------------------- | --------------- | ------------------------------------------------------------------- |
| xHISS stakers          | 50% (5,000 bps) | xHISS staking vault (`injectRewards`, 24h drip)                     |
| **Vault Providers**    | 15% (1,500 bps) | vault-provider rewards distributor (not deployed → `null`)          |
| **Vault Contributors** | 15% (1,500 bps) | vault-contributor vesting distributor (not deployed → `null`)       |
| Treasury Safe          | 10% (1,000 bps) | 2-of-3 Treasury Safe (absorbs floor-division dust)                  |
| **Economic burn**      | 10% (1,000 bps) | canonical dead address `0x000000000000000000000000000000000000dEaD` |

The five legs sum to exactly 10,000 bps. What changed from V1: the former 30% depositor
leg was split into **Vault Providers (15%)** and **Vault Contributors (15%)**, and a new
**10% economic-burn** leg was added (the Treasury leg stays 10%). "Vault Contributors" is
purely a **rename** of the former depositor reward cohort — the share-seconds methodology
(pro-rata by Σ shares × seconds held, 30-day linear vest, no PnL/APY inputs) is unchanged.
Vault _depositors_ (the deposit action) keep that name; only the reward-cohort label moved.

### Economic burn is not a supply burn

The burn leg is an **economic burn**: HISS is transferred to the canonical dead address
(`0x…dEaD`), so it leaves circulation (nobody holds the key), but **`HISS.totalSupply` is
NOT reduced** — it is not an ERC-20 supply burn. The "amount burned" is measured as the
live dead-address balance (`HISS.balanceOf(0x…dEaD)`), always described as economic burn.

### Retroactive economic-burn migration

The V2 upgrade included a **retroactive** economic-burn migration. Cumulative economic
burn to the dead address is **219,158,426,524,474,729,694,326,935 base units**
(~**219.16M HISS**, 18 decimals). This dead-address transfer leaves `HISS.totalSupply`
**unchanged**.

The retroactive migration is modelled as a **deployer-exclusion + owner-replenishment
pair**: deployer-held / excluded HISS is excluded from reward accounting, and an
owner-authorized replenishment funds the corresponding economic-burn transfer. The pair
**nets out**, so accounting stays exact. (Described conceptually; verify any specific
transfer with a live chain read.)

## Deprecation policy

- Deprecations are announced in the [CHANGELOG](../CHANGELOG.md) and, where relevant, in
  the [ROADMAP](../ROADMAP.md).
- A deprecated API keeps working for at least one minor release after announcement
  (pre-1.0, best-effort) with a migration note.
- Security fixes take precedence and may land faster; see [SECURITY.md](../SECURITY.md).

## Upgrading checklist

1. Read the [CHANGELOG](../CHANGELOG.md) for the target tag.
2. Re-run `pnpm install && pnpm build && pnpm test`.
3. Re-verify any pinned addresses/status with **live chain reads**.
4. Check schema/methodology version identifiers against artifacts you persist.
