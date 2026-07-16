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
| Reward split                      | `hiss-reward-split-v1`                                                    |
| Reward methodology                | `HISS_REWARD_METHOD_V1`                                                   |
| Depositor scoring                 | `hiss-depositor-scoring-v1`                                               |
| Provider rewards                  | `hiss-provider-rewards-v1`                                                |
| Vesting                           | `hiss-reward-vesting-v1`                                                  |
| Weekly checkpoint / monthly epoch | `hiss-reward-weekly-checkpoint-v1` / `hiss-reward-monthly-epoch-score-v1` |

A change to a methodology or schema bumps its version; older artifacts remain
interpretable under the version they declare.

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

The reward methodology is a **frozen, versioned bundle** (`HISS_REWARD_METHOD_V1`). If
parameters or curves change, a new version is introduced; existing epochs remain scored
under the version they were finalized with. The lifecycle (weekly → monthly → 7-day
challenge → funded → vesting → claimable) is part of the versioned method. See
[Epochs and vesting](./rewards/epochs-and-vesting.md).

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
