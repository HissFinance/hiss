# Changelog

All notable changes to this repository are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because the packages are **not yet published to npm**, a "release" is a tagged
commit in this repository. Pin to a tag for stability.

## [Unreleased]

Tracks work on `main` ahead of the next tagged release. See [ROADMAP.md](./ROADMAP.md).

## [0.1.0] — 2026-07-16

Initial public release of the HISS Finance open SDK, contract interfaces, and
documentation.

### Added

- **Core (`@hiss-finance/core`)** — the shared truth layer: Robinhood Chain config
  (mainnet `4663`, testnet `46630`), the public address book, deterministic vault
  fee math (high-water-mark performance fee, protocol share, routing fee), the
  50/30/10/10 reward split, depositor share-seconds scoring, provider facts-only
  scoring, and linear vesting math.
- **SDK (`@hiss-finance/sdk`)** — read vault, staking, and reward state from chain,
  and prepare (build, never sign) deposit, withdraw, stake, cooldown, redeem, and
  manifest-publish transactions.
- **Vault Kit (`@hiss-finance/vault-kit`)** — compose target-weight allocations,
  validate risk fuses, preview fees, and hash a manifest.
- **React (`@hiss-finance/react`)** — headless hooks and components for vault,
  staking, and reward surfaces.
- **CLI (`@hiss-finance/cli`)** — status reads, manifest validation, and
  transaction preparation from the terminal.
- **MCP server (`@hiss-finance/mcp-server`)** — a local Model Context Protocol
  server exposing 22 read/prepare tools; agents never execute or move funds.
- **Contract interfaces & ABIs** — `contracts/` interfaces and ABIs for the vault
  factory, flagship vault, xHISS staking vault, registries, reward distributors,
  and rebalance adapter.
- **Schemas** — JSON schemas for the vault manifest, fee config, and reward epoch
  artifacts.
- **Agent skill packs** — reusable skills for vault creation, staking, reward
  split, safe-admin, and CoilOps flows.
- **Documentation** — getting started, architecture, Robinhood Chain, contracts,
  SDK/CLI/React/MCP guides, the full vaults, fees, staking, and rewards guides,
  Bankrbot, Stock Tokens, x402, CoilOps, security, trust boundaries, receipts, data
  freshness, FAQ, glossary, migration/versioning, and stamped generated snapshots.
- **Governance** — Apache-2.0 license, NOTICE, third-party license inventory,
  security policy, contributing guide, code of conduct, maintainers, and roadmap.

### Security

- Documented the trust and signing boundaries: user wallet signs user actions; the
  2-of-3 Treasury Safe signs protocol actions; SDK/CLI prepare only; no server-held
  user keys; no custody; no brokerage execution.
- Reward and deployment flows are fail-closed by design.

[Unreleased]: https://github.com/HissFinance/hiss/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/HissFinance/hiss/releases/tag/v0.1.0
