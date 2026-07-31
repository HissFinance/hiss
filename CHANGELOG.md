# Changelog

All notable changes to this repository are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The **`@hiss-finance/cli`** package is published to npm — released via `cli-v*`
tags through GitHub OIDC trusted publishing (with build provenance). The other
packages are **not yet published**; for those a "release" is a tagged commit in
this repository. Pin to an npm version or a tag for stability.

## [Unreleased]

Tracks work on `main` ahead of the next tagged release. See [ROADMAP.md](./ROADMAP.md).

### `@hiss-finance/cli` 0.2.0 — world-class terminal

A ground-up terminal-experience overhaul for the `hiss` CLI. **Two behavior
changes are breaking for scripts** — read the migration notes.

#### Added

- **Global output-mode system.** One resolver turns `--output human|json|plain`
  (with `--json` / `--plain` shorthands), `--color auto|always|never`,
  `--unicode auto|always|never`, `--quiet`, and `--verbose` into a single
  output context. `json` and `plain` are **always** ANSI-free; `human` uses
  semantic color + Unicode only on a capable interactive TTY. `NO_COLOR` is
  respected in `auto` (an explicit `--color always` is the one intentional
  override). Diagnostics and the `--verbose` line go to **stderr**; stdout stays
  clean and pipeable.
- **New command families:** `mcp status|tools|doctor` (inspect the hosted HISS
  MCP server), `lp …` (Stock-Premium LP manager records; inert/paused surfaces
  report `UNKNOWN` rather than fabricate), and `agentic status|setup|coils|
grants|receipts` (informational control-plane orientation, no credential
  request). Richer `vault`, `stake`, `rewards`, `coil`, `receipt`, and `skill`
  views with a shared component library (tables, panels, fuse/coverage,
  key-value, evidence).
- **Defense-in-depth output redaction.** Every rendered line — including the
  `--verbose` stderr diagnostic — is passed through a label-based redactor, so a
  secret that reaches an output string (e.g. `--rpc-url` userinfo
  `scheme://user:pass@host`) is masked to `[redacted]` while public identifiers
  (addresses, tx hashes, the `HISS` token symbol) are preserved verbatim.
- **Quality/accessibility matrix** (264 tests): per-command golden snapshots in
  human/json/plain, exit-code regression matrix, color/Unicode independence,
  strict-ASCII PLAIN, redaction, width/wrapping, and streaming purity.

#### Changed (behavior — breaking for scripts)

- **Exit-code taxonomy `0–7`.** Previously the CLI emitted only `0` (any
  rendered result, **including** business INVALID/FAILED/refusal) and `1` (any
  thrown error). It now uses a stable set: `0` success · `1` general · `2` usage
  (incl. malformed JSON / credential-shaped field) · `3` config (missing
  file/rpc/chain) · `4` network · `5` policy/refusal · `6` verification-failed ·
  `7` partial/unknown.
  **Migration:** business fail-closed outcomes now exit **non-zero** —
  `vault validate` INVALID → `6`, `coil validate` INVALID → `6`,
  `receipt verify` FAILED → `6`, `coil compile` refusal → `5`,
  `vault prepare-create` refusal → `5`, `skill print` not-found → `7`,
  `lp scan`/`pools`/`positions` UNKNOWN → `7`. Scripts that treated exit `0` as
  "the check passed" must now branch on the specific code. The rendered
  human/JSON **text is unchanged**; only the process exit code moved.
- **JSON envelope (`--json`).** Machine output is now a stable envelope: on
  success `{ cliVersion, code, command, data, ok, summary }` with the command
  payload under **`.data`** and `ok === (code === 0)`; on a thrown fault
  `{ cliVersion, code, error: { code, kind, message }, ok:false }`.
  **Migration:** the command payload moved to `.data` (was the bare payload) and
  now carries `ok`/`code`. Update `jq` filters from `.field` to `.data.field`,
  and branch on `.ok` / `.code`. Errors expose `.error` instead of
  `.data`/`.summary`.
- **`hiss --version` reports `0.2.0`** (package + `CLI_VERSION` aligned; the
  JSON envelope's `cliVersion` follows).

#### Fixed

- **`--verbose` no longer leaks RPC credentials.** The verbose stderr diagnostic
  wrote the raw `--rpc-url`; a URL carrying `user:pass@` userinfo leaked the
  password. The diagnostic is now routed through the redactor (host preserved,
  secret masked), with a process-level regression test.
- Golden snapshots are hermetic (no absolute build path in `skill` output
  snapshots); intentionally-malformed test fixture excluded from formatting.

### Added

- **Lighter (Robinhood-instance) READ/PREPARE MCP rail — 6 new tools (33 → 39).**
  The MCP server registers `hiss_lighter_markets` / `hiss_lighter_orderbook` /
  `hiss_lighter_depth` (READ public market data, fail-closed to `DEGRADED` /
  `MARKET_NOT_AVAILABLE`, never a fabricated price) and `hiss_lighter_prepare_order`
  / `hiss_lighter_prepare_cancel` / `hiss_lighter_prepare_modify` (typed **UNSIGNED**
  intents, `signed:false`, precision-scaled integers, deterministic `intentHash`).
  HISS holds no Lighter API key, auth token, or nonce and submits nothing — signing
  happens only in the user's local runtime. New `hiss-lighter` skill pack + full
  read/prepare test matrix (positive/negative/credential-reject/serialization/
  stdio≡HTTP parity). Robinhood Stock-Tokens are USDG-quoted spot books.
- **MCP contract-registry object shape, `DEGRADED` read mode, and `/version`
  chain identity.** `hiss_get_contract_registry` now returns a JSON **object**
  (`{ chainId, observedAt, entries }` — never a bare array), with each entry
  carrying a live, fail-soft runtime-bytecode observation
  (`{ name, address, runtimeCodeHash, status }`). The Stock-Premium data-mode
  vocabulary gains **`DEGRADED`** (a partial/failed live read with precise
  reasons and null fields — never a fabricated value, never a demo substitute;
  production read tools never report `DEMO`). The `GET /version` payload is now
  built by a single `buildVersionInfo()` source shared by every transport and
  advertises `chainId` plus the deterministic toolset identity
  (dynamic `toolCount`, `toolsetHash`, sorted `toolNames`) — and deliberately
  carries **no** source-provenance fields (those belong to a hosting layer, not
  this package). New test suites: the registry-derived tool test matrix,
  output-schema conformance, and `/version` shape.
- **Skill catalog generator + guards.** `pnpm skills:catalog` regenerates
  [`skills/skill-catalog.json`](./skills/skill-catalog.json) deterministically
  from the `SKILL.md` frontmatter (schema `hiss-skill-catalog-1.1.0`), and
  `pnpm check:skill-catalog` (in `check:all`) fails when catalog and
  frontmatter drift. `pnpm check:mcp-public-safe` (also in `check:all`) proves
  `packages/mcp-server` and `packages/sdk` stay free of private-hosting
  material.
- **Stock-Premium market & venue truth reference.** New
  [skills/hiss-stock-premium-lp-manager/references/market-and-venue-truth.md](./skills/hiss-stock-premium-lp-manager/references/market-and-venue-truth.md):
  the venue is 24/7 but the reference is not (premium is `UNKNOWN` without a
  verified reference); verified pools only (CREATE2 identity recomputation);
  the quote asset decides the unit (a WETH-quoted price is never a `$` figure);
  depth is not TVL and depth is not authorization; honest fail-closed states.

### Changed

- **Canonical capability encoding in skill frontmatter.** Optional capability
  families now live in a dedicated `optional_capability_families` list; the
  legacy trailing-`?` markers inside `required_capability_families` (which
  broke strict/installer YAML parsers) are migrated across the seven affected
  packs and rejected by `check:skill-catalog`. The
  `hiss-stock-premium-lp-manager` description moved to a folded block scalar
  (`>-`) for the same installer-parser reason. Catalog rows now also carry
  `required_mcp_tools` and the corrected `hiss-price-mesh` version.

- **Vault verified history & USDG accounting guide.** New
  [docs/vaults/verified-history-and-usdg-accounting.md](./docs/vaults/verified-history-and-usdg-accounting.md):
  how vault history is served as **real, block-pinned observations only** (gaps
  are `MISSING` and never bridged/interpolated; buckets before verified history
  begins are omitted and labeled; net flows come from the on-chain event ledger
  and are **never inferred from NAV changes**; every value is an exact
  decimal-string integer), and how the vault's USDG reserve is valued by the
  **accounting identity** (`1.000000` USDG — a unit conversion, never a USD
  claim) with the **market peg reference** observed and reported separately
  (`LIVE / DEGRADED / DEPEG_WARNING / DEPEG_TRIPPED / UNKNOWN`; unknown fails
  closed for execution and never erases the displayed reserve; custody scopes
  are never double-counted). Linked from the vaults overview and the README
  documentation map.

- **Stock-Premium LP manager — launched-paused is the immutable initial state,
  current state is a live read (skill v4).** `HissLpManagerV1` launched paused as
  its **immutable initial state**; the owner-gated Safe unpause has since
  **executed on-chain**, so `paused()` / `feeBps()` / `owner()` / `treasury()` are
  always fresh chain reads (unknown on failure, never assumed). Unpaused alone
  opens nothing — enrollment and every managed action stay owner/beneficiary-
  gated. The deployment registry and the `hiss-stock-premium-lp-manager` skill
  (v3 → **v4**) now separate the immutable launch state from live state and record
  the executed activation reference; the canonical product URL is
  `app.hiss.finance/stock-premium-lp` (the `/tools/stock-premium-lp` compat path
  permanently redirects there, sub-path and query preserved).

- **Stock-Premium LP protocol revenue — `HissLpManagerV1` deployed (launched
  paused) + management-fee SSOT.** The managed-lifecycle contract for
  Stock-Premium LP positions is deployed and source-verified on Robinhood Chain
  mainnet (4663) at `0xBE5989a38953D8148B74d45eE6DEB127a32567E0`, with owner and
  treasury both the HISS Treasury Safe (2-of-3). **Launched paused** (its
  immutable initial state; see the state-model entry above — the unpause has
  since executed on-chain): live `paused()`/`feeBps()` state is always a fresh
  chain read.
  `@hiss-finance/core` gains the `stock-premium` module: the frozen
  `HISS_LP_MANAGEMENT_FEE_V1` policy (500 bps of **realized LP fees only** —
  never principal, never P&L; immutable `MAX_FEE_BPS` 500; 100% to the Treasury
  Safe; independent of the reward split), the `computeManagementFee` arithmetic
  SSOT with committed Solidity parity vectors, the canonical deployment record,
  and the `lpManagerV1` registry entry. Ships the verified contract ABI
  (`contracts/abi/HissLpManagerV1.json`), the deployments-registry entry with
  the live-read bytecode hash, and the new
  [Stock-Premium LP management fee](./docs/fees/stock-premium-lp-management-fee.md)
  guide. Self-managed positions executed by the user's own authority are never
  charged this fee.

- **Stock Premium LP — user-signed execution lifecycle (skill v2).** The
  `hiss-stock-premium-lp-manager` skill advances from `prepare_only` to
  `user_signed`: it now ORCHESTRATES the full LP lifecycle (scan → build →
  eligibility → prepare → user authorization → sign/submit → verify → monitor →
  manage → close/reconcile) across four **user-owned** execution surfaces —
  browser wallet, Safe multisig, authenticated Bankr session, and local runtime
  (see `references/execution-orchestration.md`). HISS remains NONCUSTODIAL: it
  measures, verifies, and prepares typed UNSIGNED operations; it never holds
  keys, signs, or submits. The hosted MCP stays read/prepare-only. Signing is
  fail-closed — DEMO/SHADOW data and UNKNOWN eligibility never unlock a live
  action, and the activation ladder is owner-gated. Returns
  `EXECUTION_AUTHORITY_REQUIRED` when no compatible authority is connected.

- **24/7 vault architecture — designed, tested, undeployed (MAJOR).** Documents
  the designed continuous around-the-clock valuation + settlement architecture:
  the **five execution modes** (`MULTI_VENUE_EXECUTABLE`, `SINGLE_VENUE_BOUNDED`,
  `BATCH_EXECUTABLE`, `IN_KIND_ONLY`, `TEMPORARILY_HALTED`), the **three settlement
  lanes** (instant, batch-netting, and the valuation-free in-kind unconditional
  exit), **Price Mesh V2** side-aware pricing (three distinct marks — a
  manipulation-resistant reporting mid for NAV, an ask-side deposit mark, and a
  bid-side redemption mark — a missing price is `UNKNOWN` never `0`, the spread is
  anti-dilution retained by the vault for all holders), **dynamic safe-notional**,
  **corporate-action handling** (multiplier applied exactly once — the on-chain
  Chainlink feed is already multiplier-adjusted, REST `/prices` is raw), and the
  **calendar-is-context-only** rule with smallest-scope degrade
  (source → venue → asset → action-size → vault). New page
  `docs/vaults/24-7-architecture.md`, reachable from the README Vaults map;
  `docs/stock-tokens.md`, `docs/vaults/{index,deposit,withdraw}.md`,
  `docs/status-and-data-freshness.md`, the `hiss-price-mesh` skill (v1 → v2),
  `llms.txt`, and `llms-full.txt` reference it.
  **Truthful status (on every surface): production 24/7 settlement is NOT active;
  the V2 vault is undeployed; activation is separately gated behind independent
  audits + explicit owner authorization; nothing is funded, live, or deployed.**
  Liquidity is honestly noted as real but thin and single-venue today. No contract,
  address, deployment, or on-chain behavior changed. (Source design release:
  execution-mesh Phase 2, decision log EM-001..EM-012, source commits
  `61f8104..3d48477`.)
- **Skill architecture: nine new agentic-trading skills + capability manifest
  (MAJOR).** The public skill catalog grows from 10 to 19 packs. New packs for
  running a Coil against the user's OWN Robinhood Trading MCP session:
  `hiss-robinhood-agentic` (umbrella truth model + LiveAutonomyGrant),
  `hiss-robinhood-portfolio`, `hiss-robinhood-market-intelligence`,
  `hiss-robinhood-equities`, `hiss-robinhood-options`, `hiss-coil-runner`,
  `hiss-agentic-ledger`, `hiss-cross-rail-handoff`, and `hiss-price-mesh`. HISS
  compiles/verifies (`liveOrderSent: false`); the user's own session executes
  under the user's own OAuth, consent, and a signed autonomy grant. Adds the
  sanitized Robinhood MCP capability manifest under `schemas/robinhood-mcp/`
  (snapshot + family map + JSON schema) and a generated
  `skills/skill-catalog.json` carrying each pack's safety metadata
  (`write_risk`, `runtime_requirement`, required capability families).
  **Migration note:** existing packs are compatible — `hiss-coilops`,
  `hiss-risk-fuses`, `hiss-receipts`, `hiss-security-boundaries`,
  `hiss-bankrbot-robinhood`, `hiss-stock-tokens`, and `hiss-vault-agent-kit`
  are refreshed (tool references normalized to the canonical MCP surface plus
  HTTP routes; no behavior change). No tool, contract, or address changed.
  (Source release: skill-architecture RC `53bbf97`.)
- **Queued-deposit executor: documented as implemented, not active.** The
  one-signature queued-deposit executor (permit-as-intent; keeper strikes at
  the next fresh price; no second signature) is implemented and fork-proven in
  the source release but remains inactive pending independent audit,
  deployment approval, deployment, monitoring, keeper authorization, and
  explicit activation. `docs/contracts.md` and `SECURITY.md` now carry the
  readiness boundary. (Source release: post-release ops closeout, commits
  through the PR referenced by the sync manifest.)

### Fixed (hosted product, observable behavior)

- Unknown vault URLs on the app host now return a real HTTP 404 (previously a
  styled not-found page could answer 200 with mixed robots directives).
- Search and AI crawlers now receive page metadata (title, canonical, social
  tags) in the initial HTML head deterministically; browser streaming
  behavior is unchanged.
- Deposit-gate freshness during open market sessions follows the feeds'
  deviation contract, so calm markets no longer read as stale mid-session.

### Changed

- **Host architecture (www/app/docs).** The hosted product now spans three
  hosts: `www.hiss.finance` (marketing + top-level agent files),
  `app.hiss.finance` (the application and the public HTTP API), and
  `docs.hiss.finance` (documentation). Legacy `www.hiss.finance/app/*` and
  `/docs/*` URLs 308-redirect (one hop) to their canonical hosts. README,
  getting-started, the llms files, and every skill pack now reference
  absolute canonical-host URLs; the canonical API base for the HTTP routes in
  the skills is `https://app.hiss.finance` (www continues to serve the same
  routes for compatibility). Each host now serves its own `/llms.txt`
  (www: identity + top-level surfaces · app: application surfaces · docs:
  full documentation map, plus `llms-full.txt`). Source releases: production
  commit `1d1c50b` (www/app/docs subdomain architecture — SEO/OG/host-routing
  migration + 24/7 vault terminal) and the post-cutover closeout, source
  commit `0057169` (OG v4, per-host discovery files, vault deposit-gate
  honesty and per-basis freshness).
- **24/7 vault display continuity + advertised-deposit narrowing.** Vault
  surfaces now display valuation state around the clock from last-verified
  prices labeled with an explicit basis (`EXCHANGE_LIVE` /
  `CARRIED_CLOSE` display-only / `MODEL_ACCRUAL`), while execution stays
  fail-closed on stale feeds. Deposits are advertised open only while the
  trading session is open and every required basket feed is within its
  per-basis bound — live-feed assets 3,600 s, accrual-like assets (e.g.
  SGOV) 26 h (stale-mark dilution protection, policy P-DEP-2/P-NAV-2) —
  and the deposit entry reports honest gate reasons when closed. The
  effective deposit gate and its states are documented in
  [Risk fuses](./docs/vaults/risk-fuses.md) and
  [Data freshness](./docs/status-and-data-freshness.md). Source releases
  `1d1c50b` and `0057169`.

- **HISS Reward Method V2 (`HISS_REWARD_METHOD_V2`, split version
  `hiss-reward-split-v2`).** The verified $HISS trading-fee split moves from the
  V1 four-leg 50/30/10/10 to a five-leg **50/15/15/10/10**: 50% xHISS stakers /
  15% Vault Providers / 15% Vault Contributors / 10% Treasury Safe / 10% economic
  burn. The five legs sum to exactly 10,000 bps; the Treasury leg absorbs
  floor-division dust. Constants: `XHISS_STAKER_BPS`, `VAULT_PROVIDER_BPS`,
  `VAULT_CONTRIBUTOR_BPS`, `TREASURY_BPS`, `BURN_BPS`. 100% of claimed WETH still
  routes to the Treasury Safe, never split. planned ≠ funded ≠ vesting ≠
  claimable; no guaranteed return.
- **Vault Contributors terminology.** The former "depositor" reward cohort is now
  named **Vault Contributors** (`allocateVaultContributorRewards`, CLI
  `hiss rewards contributor <address>`, client `getVaultContributorReward`). The
  methodology is unchanged — pro-rata by share-seconds with a 30-day linear vest
  (`VAULT_CONTRIBUTOR_VEST_SECONDS`). Depositing into a vault, and the deposit
  ack/consent identifiers, are unchanged (only the reward-cohort name changed);
  on-chain contract artifacts keep their deployed names.

### Added

- **Deposit-anytime intent model — documented as pending activation, NOT
  live.** A forward-priced deposit-intent path (one signature at intent
  time; a keeper strikes at the next fresh-price window; cancellable before
  the strike) is designed and fork-tested, but the executor contract
  (`HissDepositIntentExecutor`) is **not deployed** — deployment stays
  owner-gated behind the audit gate. See
  [Deposit](./docs/vaults/deposit.md). Source `0057169`.
- **Economic burn leg (10%).** A `BURN_BPS` leg transfers verified-fee HISS to the
  canonical dead address `HISS_BURN_ADDRESS`
  (`0x000000000000000000000000000000000000dEaD`). This is an **economic burn**:
  the HISS leaves circulation but `HISS.totalSupply` is **not** reduced (not an
  ERC-20 supply burn). The burn metric is the dead-address balance, a live
  `HISS.balanceOf(0x…dEaD)` read.
- **Retroactive economic-burn migration.** A one-time migration recorded a
  cumulative economic burn of **219,158,426,524,474,729,694,326,935 base units**
  (~**219.16M HISS**) to the dead address; `HISS.totalSupply` is unchanged. The
  migration is modelled as a deployer-exclusion + owner-replenishment pair that
  nets out so reward accounting stays exact.

### Policy

- **Free website / first-party app policy.** The HISS website and first-party app
  tools are free — no subscriptions, credits, or paywalls; the packages remain
  open-source (Apache-2.0). Users retain signing control (HISS prepares and
  verifies; the user's own wallet or Safe signs and submits; HISS never signs,
  submits, or takes custody). Normal network gas and contract-enforced protocol
  fees may still apply. `x402` machine-to-machine agent rails, where configured,
  are separate from the free first-party surfaces.

## [0.1.0] — 2026-07-16

Initial public release of the HISS Finance open SDK, contract interfaces, and
documentation.

### Added

- **Core (`@hiss-finance/core`)** — the shared truth layer: Robinhood Chain config
  (mainnet `4663`, testnet `46630`), the public address book, deterministic vault
  fee math (high-water-mark performance fee, protocol share, routing fee), the
  50/30/10/10 reward split, depositor share-seconds scoring, provider facts-only
  scoring, and linear vesting math. (The 50/30/10/10 split and depositor cohort
  are superseded by HISS Reward Method V2 — see [Unreleased].)
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
  server exposing read/prepare tools; agents never execute or move funds.
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
