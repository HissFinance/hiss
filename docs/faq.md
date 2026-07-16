# FAQ

### What is HISS Finance?

An open toolkit for building **creator-run vaults**, **staking**, **rewards**, and
**agent tooling** on Robinhood Chain. It prepares, verifies, scores, and records — it
does not take custody, hold your keys, or place brokerage orders. See
[Getting started](./getting-started.md).

### Is this the production app?

No. **This repository is the open SDK, contract interfaces, and documentation.** The
hosted product is at [www.hiss.finance](https://www.hiss.finance). This repo lets you
build against the same primitives.

### Does HISS hold my funds or keys?

No. **You keep signing control.** Deposits, withdrawals, staking, and publishes are
transactions **you** sign from **your** wallet. Pooled assets live only in the audited
on-chain contracts. Protocol actions require the 2-of-3 Treasury Safe. See
[Trust boundaries](./trust-boundaries.md).

### Can I install it from npm?

Not yet — packages are **not published to npm**. Build from source:
`git clone` → `pnpm install` → `pnpm build`. See [Getting started](./getting-started.md).

### What is a vault?

An ERC-4626 basket denominated in **USDG (6dp)**. A creator declares a target-weight
strategy; depositors deposit USDG, get shares, and **share profits and losses**. See
[Vaults](./vaults/index.md).

### Is there guaranteed yield or APY?

**No.** There is no guaranteed yield, no APY promise, no passive income, and no
risk-free framing anywhere. Vaults can lose value; staking value depends on fee
injections HISS does not control. Historical figures are **not forecasts**.

### What are the fees?

Vault: 0 to save a candidate, **50 USDG** (launch) to publish, **10%** creator
performance fee above the high-water mark (no fee on losses), **10%** HISS protocol share
of that fee, **0** deposit/withdraw fee, **0** routing (until routing is live). Full
detail: [Fees](./fees/index.md).

### What is xHISS?

The single-asset **staking vault** for $HISS. You stake $HISS, receive xHISS, and the
exchange rate rises as verified fees are injected (24h drip). Exiting is a 72h cooldown
then a 2-day redeem window; **exits are never pausable**. See [xHISS](./staking/xhiss.md).

### How does the reward flywheel work?

Verified $HISS trading fees split **50/30/10/10** — xHISS stakers / depositors /
providers / Treasury. Claimed WETH is 100% to the Treasury. **Planned ≠ funded ≠ vesting
≠ claimable.** See [Reward flywheel](./fees/reward-flywheel.md).

### Are depositor and provider rewards live?

**No.** Those distributors are **not deployed yet**; in split plans their recipients are
`null` and **nothing moves against them**. The xHISS staking leg and the Treasury leg are
deployed. See [Rewards](./rewards/index.md).

### Are Stock Tokens actual stock?

**No.** Tokenized Stock Tokens and ETF tokens are **economic exposure only** — no legal
or beneficial ownership, no voting, no direct dividend. They are **region-restricted**.
See [Stock Tokens](./stock-tokens.md).

### Can agents trade or move my funds?

No. MCP tools, x402 endpoints, and Bankr rails **prepare** actions; **you** (or your own
wallet/agent) sign and execute. HISS never closes that loop. Bankr rails are region- and
provider-dependent. See [MCP](./mcp.md) and [Bankrbot](./bankrbot.md).

### Was this audited?

The xHISS launch review formulation is, verbatim: **"No known unresolved Critical or High
findings after internal launch review."** That is an **internal** review — **not** an
external audit.

### Is HISS affiliated with Robinhood?

**No.** HISS is **not affiliated with Robinhood, Bankr, Doppler, or Chainlink**. It runs
on Robinhood Chain and interoperates with these systems, nothing more.

### How do I report a security issue?

Use GitHub's private vulnerability reporting on this repo, or follow
[SECURITY.md](../SECURITY.md). **Never** open a public issue for a vulnerability.

### Where do I verify contract addresses?

On-chain, always. Read the chain (e.g. `cast code`), then the
[contracts](./contracts.md) address book and the
[generated snapshot](./generated/current-deployments.md). A failed read is **unknown**.
