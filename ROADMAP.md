# Roadmap

This roadmap describes the intended direction of the HISS Finance open SDK,
contract interfaces, and documentation. It is a statement of intent, not a
commitment or a schedule — priorities shift with community input and on-chain
reality. It is **not** a forecast of returns, and nothing here is a financial
promise.

Legend: **Shipped** · **In progress** · **Planned** · **Exploring**

## Foundations — Shipped (0.1.0)

- Public SDK, contract interfaces/ABIs, schemas, skill packs, and documentation.
- Deterministic fee, reward-split, share-seconds, and vesting math in
  `@hiss-finance/core`.
- Read + prepare flows for vault deposit/withdraw, staking, cooldown, and redeem.
- Local MCP server with 22 read/prepare tools.
- Stamped generated snapshots for deployments, fees, and status.

## Near term — In progress / Planned

- **Publish packages to a registry.** Replace the build-from-source quickstart with
  `pnpm add @hiss-finance/…`. Until then, the workspace is the supported path.
- **Expand `examples/`.** End-to-end, copy-pasteable examples for status reads,
  manifest authoring, fee previews, deposit preparation, and MCP-driven flows.
- **Reward epoch tooling.** Public, reproducible builders and verifiers for weekly
  provisional checkpoints and monthly finalized epoch scores, with the 7-day
  challenge window surfaced in the SDK.
- **Richer React surfaces.** Headless components for reward status, epoch lifecycle,
  and receipt verification.
- **Testnet playground.** Guided flows against chain `46630` so contributors can
  exercise create/deposit/stake without mainnet value.

## Contracts and rewards — Planned

- **Vault Contributor and Vault Provider reward distributors.** Under HISS Reward
  Method V2 (the 50/15/15/10/10 split — 50% xHISS stakers, 15% Vault Providers,
  15% Vault Contributors, 10% Treasury Safe, 10% economic burn), reward-split plans
  currently carry `null` recipients for the Vault Contributor vesting and Vault
  Provider distributors until those contracts are deployed and verified. When
  deployed, the SDK and docs will move them from "planned" to "funded/claimable" —
  with affirmative on-chain evidence, never before. The 10% economic-burn leg
  transfers HISS to the canonical dead address (dead-address balance is the burn
  metric; `HISS.totalSupply` is not reduced).
- **Live rebalance routing.** Routing is disabled protocol-wide today; when HISS
  routing infrastructure is live and verified, routing-fee behavior (0.5–2 bps) and
  per-asset readiness gating will be documented end to end.
- **Additional rebalance adapters.** Interfaces and reference adapters for new
  venues, behind the same verification and audit gates.

## Agents and integrations — Planned / Exploring

- **Deeper MCP coverage.** More read/score tools and clearer prepare-only contracts,
  keeping the no-execution guarantee intact.
- **x402 endpoint catalog.** Documented, agent-discoverable paid endpoints with
  stable schemas.
- **Bankr rails.** Continued, clearly-scoped documentation of deposit and
  stock-token command rails, always region- and provider-dependent and never a hard
  dependency.

## Principles that will not change

- **Prepare, never execute.** The SDK and agents build transactions the user signs.
- **No custody, no key handling, no brokerage execution.**
- **Free first-party surfaces.** The HISS website and first-party app tools stay
  free — no subscriptions, credits, or paywalls — and the packages stay
  open-source (Apache-2.0). Users retain signing control. Normal network gas and
  contract-enforced protocol fees may still apply; any `x402` machine-to-machine
  agent rails are separate from the free first-party surfaces.
- **Honest status and copy.** No guaranteed yield, APY, passive income, or
  external-audit claims. Unknown is unknown; live requires proof.
- **Fail closed.** Missing artifacts, low-confidence classification, or missing
  authorization refuse rather than guess.
- **On-chain state wins.** Documentation describes the chain; it never overrides it.

## Contributing to the roadmap

Have a proposal? Open a discussion or issue. Well-scoped PRs that advance an item
above — especially tests and examples — are the fastest way to move it forward. See
[CONTRIBUTING.md](./CONTRIBUTING.md).
