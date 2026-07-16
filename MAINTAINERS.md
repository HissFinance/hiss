# Maintainers

HISS Finance is stewarded by **HissFinance** and the open-source contributors of
the HISS Finance community.

## Current maintainers

| Maintainer  | Role            | Area                                               |
| ----------- | --------------- | -------------------------------------------------- |
| HissFinance | Project steward | Overall direction, releases, security coordination |

Maintainers are reachable through this repository: open an issue or discussion for
general matters, and use GitHub's private vulnerability reporting for anything
security-sensitive (see [SECURITY.md](./SECURITY.md)).

> Individual maintainer handles are added here as the community grows. This file is
> the source of truth for who can merge, cut releases, and coordinate advisories.

## Responsibilities

Maintainers:

- Review and merge pull requests, keeping the honesty, prepare-only, and
  fail-closed principles intact.
- Cut releases and maintain the [CHANGELOG](./CHANGELOG.md).
- Triage issues and coordinate security advisories under [SECURITY.md](./SECURITY.md).
- Uphold and enforce the [Code of Conduct](./CODE_OF_CONDUCT.md).
- Keep the [generated docs](./docs/generated/current-status.md) honest — snapshots
  are labeled with their freshness limits, and on-chain state always wins.

## Decision making

We favor lazy consensus: proposals move forward if no maintainer objects within a
reasonable review window. Changes to safety-critical math, fee or reward constants,
trust boundaries, or public copy require explicit maintainer approval and a passing
test gate. Contentious decisions are resolved by the project steward.

## Becoming a maintainer

Sustained, high-quality contributions — code, tests, docs, and thoughtful reviews —
are the path to maintainership. Existing maintainers nominate and confirm new ones.
If you would like to take on more responsibility, say so in a discussion or a PR and
start reviewing others' work.

## Governance notes

- **License:** Apache-2.0 for code and docs (see [LICENSE](./LICENSE)).
- **Trademarks:** "HISS", "HISS Finance", and related marks are used by the project
  for identification; third-party marks belong to their owners
  (see [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md)).
- **Protocol authority:** on-chain protocol actions are governed by the 2-of-3
  Treasury Safe, not by repository maintainership. Merge rights do not confer
  protocol control.
