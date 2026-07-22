# Security Policy

HISS Finance is compilation and verification software that prepares, simulates,
scores, and records financial primitives on Robinhood Chain. Because vaults hold
real value on-chain, we take security seriously and welcome coordinated disclosure.

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for a security
vulnerability, and do not disclose it publicly before it is fixed.**

Report privately using **GitHub's private vulnerability reporting** on this
repository:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Provide a clear description, affected component and version, reproduction steps
   or proof of concept, and the impact you believe it has.

A HissFinance security contact monitors these reports. If GitHub private reporting
is unavailable to you, open a minimal, non-sensitive issue asking a maintainer to
open a private advisory — **without** including any exploit detail.

### What to expect

- **Acknowledgement:** within 3 business days.
- **Triage and severity assessment:** within 7 business days, using CVSS-style
  reasoning (impact × exploitability).
- **Coordinated fix and disclosure:** we work with you on a timeline, credit you
  (if you wish), and publish an advisory once a fix or mitigation is available.

Please give us reasonable time to remediate before any public disclosure. We do
not operate a paid bug-bounty program at this time; we gratefully credit reporters.

## Supported versions

This project is pre-1.0 and evolves quickly. Security fixes target the latest
released minor line and the `main` branch.

| Version line        | Supported |
| ------------------- | --------- |
| `main` (unreleased) | Yes       |
| `0.1.x`             | Yes       |
| `< 0.1.0`           | No        |

Because the packages are **not yet published to npm**, "released" means a tagged
commit in this repository. Pin to a tag and watch releases for security updates.

## Scope

In scope for reports:

- The Solidity contracts and interfaces under `contracts/` (vault, staking,
  registries, distributors, adapters, fee logic).
- The SDK, CLI, React, and MCP packages under `packages/` (transaction
  preparation, chain reads, manifest hashing, fee and reward math).
- Schemas under `schemas/` and skill packs under `skills/` where a flaw could
  cause an incorrect or unsafe artifact to be produced.
- Documentation that materially misstates a trust boundary or a safety-critical
  parameter.

## Out of scope

- The hosted production application at hiss.finance (this repository is **not** the
  production application source).
- Robinhood Chain itself, Robinhood's brokerage or agentic-trading systems,
  Chainlink feeds, Uniswap, Bankr, Doppler, or any other third-party service.
- Vulnerabilities requiring a compromised user device, malicious wallet, or leaked
  private keys held by the user.
- Findings that reduce to "returns were lower than hoped" — HISS makes no return
  promise; performance is not a security property.
- Denial of service against public RPC endpoints or explorers you do not own.
- Reports generated solely by automated scanners without a demonstrated, realistic
  impact.

## Responsible disclosure guidelines

- **No public zero-day disclosure.** Do not publish, tweet, or demo an unpatched
  vulnerability.
- Test only against **testnet (chain 46630)** or local forks. Never attack mainnet
  contracts, other users' vaults, or the Treasury Safe.
- Do not exfiltrate data, move funds, or degrade service. Use the minimum access
  needed to demonstrate the issue.
- Do not attempt social engineering of maintainers, contributors, or users.

## Trust boundaries and security model

Understanding these boundaries is essential to assessing a finding. See
[docs/trust-boundaries.md](./docs/trust-boundaries.md) for the full treatment.

- **User wallet signs user actions.** Deposits, withdrawals, staking, cooldown,
  redeem, and manifest publishes are transactions the **user** signs from their own
  wallet. HISS holds **no user keys**.
- **Treasury Safe (2-of-3) signs protocol actions.** Ownership transfers, reward
  funding, and injector authorization require the multisig at
  `0xF100Fc28dd1721C698046Dbd60408c523b69e36c`.
- **SDK and CLI prepare only.** They build transactions and artifacts; they never
  broadcast on the user's behalf and never custody assets.
- **No server-held user keys and no HISS custody.** Pooled assets live only in the
  audited on-chain contracts.
- **No guaranteed returns.** Vaults share profits and losses; there is no yield,
  APY, or passive-income promise anywhere.
- **No HISS brokerage execution.** HISS never places brokerage orders. Where an
  agent rail exists, execution belongs to the user and their provider, not to HISS.
- **Bankr rails are region- and provider-dependent** and have limited rollout;
  they are never a hard dependency of the protocol.
- **Stock Tokens are economic exposure, not direct ownership.** They confer no legal
  or beneficial rights in the underlying issuer.
- **The queued-deposit executor is not active.** The one-signature
  queued-deposit executor contract is implemented and fork-proven but remains
  inactive pending independent audit, production deployment approval,
  deployment, monitoring, keeper authorization, and explicit activation. Until
  every step completes and is verified, no keeper executes user deposit
  intents in production, and findings against a deployed executor are out of
  scope for the simple reason that none exists on chain.

## Fail-closed design

Reward and deployment flows are designed to **fail closed**: a missing artifact,
low-confidence fee classification, absent owner authorization, or a plan-hash
mismatch causes a refusal rather than a best-effort action. A finding that turns a
fail-closed path into a fail-open one is high value — please report it.
