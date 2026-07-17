<div align="center">

# HISS Finance

### Mint your market thesis. Publish it as a vault. Keep signing control.

**Open SDK, smart-contract interfaces, and agent rails for creator-run vaults on Robinhood Chain.**

[Website](https://www.hiss.finance) · [Documentation](./docs/getting-started.md) · [Contracts](./docs/contracts.md) · [SDK](./docs/sdk.md) · [Security](./SECURITY.md)

**$HISS token** · `0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3` · [Robinhood Chain](./docs/robinhood-chain.md) (chain 4663)

</div>

---

## What is HISS?

HISS is a toolkit for building **transparent, creator-run investment vaults** and
**agent-native financial tooling** on [Robinhood Chain](./docs/robinhood-chain.md).

A HISS vault is an on-chain [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626)
basket denominated in **USDG** (a 6-decimal stablecoin). A creator declares a
target-weight strategy over tokenized equities, ETFs, and cash — as a signed,
hashed [**vault manifest**](./docs/vaults/vault-manifest.md) — and publishes it to
an on-chain registry. Depositors share the vault's profits and losses pro-rata by
share. Every strategy change, rebalance, and fee event is disclosed and, where it
touches the chain, produces a verifiable [receipt](./docs/receipts.md).

HISS is **compilation and verification software**. It prepares, simulates, scores,
and records — it does not take custody of assets, does not hold your keys, and
does not place brokerage orders. **You keep signing control of everything you do.**
Protocol-level actions are governed by a 2-of-3 [Treasury Safe](./docs/trust-boundaries.md).

> **This repository is the open SDK, contract interfaces, and documentation — not
> the production application source.** The hosted product lives at
> [hiss.finance](https://www.hiss.finance). This repo lets you build against the
> same primitives, read the same on-chain state, and integrate agents.

## What can you build?

- **Create and publish vaults** — compose a target-weight basket, validate its
  risk fuses, and publish the manifest to the on-chain registry. See
  [Create a vault](./docs/vaults/create-a-vault.md).
- **Prepare deposits and withdrawals** — build the transactions a depositor signs
  from their own wallet, with full fee and slippage disclosure. See
  [Deposit](./docs/vaults/deposit.md) / [Withdraw](./docs/vaults/withdraw.md).
- **Stake $HISS** — enter the [xHISS](./docs/staking/xhiss.md) single-asset staking
  vault, manage cooldown and redeem windows.
- **Read live protocol state** — deployments, fees, vault readiness, staking and
  reward status, straight from chain reads.
- **Ship agent tooling** — an [MCP server](./docs/mcp.md) exposing 45 tools, plus
  [x402](./docs/x402.md) paid endpoints and [Bankr](./docs/bankrbot.md) command
  rails, so agents can prepare (never execute) financial actions.
- **Score and audit** — run the [CoilOps](./docs/coilops.md) compile-and-verify
  workbench over rebalance policies and produce post-run audits.

## 5-minute quickstart

> The packages are **not yet published to npm**. Build them from source with
> `pnpm`. Node.js 20+ and `pnpm` 9+ are required; the Solidity contracts use
> [Foundry](https://book.getfoundry.sh/).

```bash
# 1. Clone
git clone https://github.com/hiss-finance/hiss-finance.git
cd hiss-finance

# 2. Install workspace dependencies
pnpm install

# 3. Build every package
pnpm build

# 4. (optional) Run the test suites
pnpm test
```

Once built, import the workspace packages into your own app, or run the CLI:

```bash
# Read live protocol status from Robinhood Chain
pnpm --filter @hiss-finance/cli start status --network mainnet
```

When the packages are published, this section will switch to a single
`pnpm add @hiss-finance/sdk`. Until then, consume them via the workspace or a
local `file:` / `link:` reference.

## Repository packages

| Package                                             | What it does                                                                                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@hiss-finance/core`](./docs/sdk.md)               | The shared truth layer: typed constants, fee and reward math, manifest schemas, chain config, address book, and pure resolvers. No I/O — deterministic and testable. |
| [`@hiss-finance/sdk`](./docs/sdk.md)                | High-level client: read vault/staking/reward state and **prepare** (build, never sign) deposit, withdraw, stake, and manifest-publish transactions.                  |
| [`@hiss-finance/vault-kit`](./docs/vaults/index.md) | Vault authoring helpers: compose allocations, validate risk fuses, compute fee previews, and hash a manifest.                                                        |
| [`@hiss-finance/react`](./docs/react.md)            | React hooks and headless components for vault, staking, and reward surfaces. Bring your own wallet connector.                                                        |
| [`@hiss-finance/cli`](./docs/cli.md)                | A terminal client for status reads, manifest validation, and transaction preparation.                                                                                |
| [`@hiss-finance/mcp-server`](./docs/mcp.md)         | A local Model Context Protocol server exposing 45 read/prepare/score tools to any MCP-compatible agent.                                                              |

Smart-contract interfaces and ABIs live under [`contracts/`](./docs/contracts.md);
JSON schemas under `schemas/`; runnable examples under
[`examples/`](./docs/getting-started.md#examples); agent skill packs under
[`skills/`](./docs/agent-skills.md).

## Live product links

- **Product:** [www.hiss.finance](https://www.hiss.finance)
- **Robinhood Chain docs:** [docs.robinhood.com/chain/connecting](https://docs.robinhood.com/chain/connecting)
- **Block explorer (mainnet):** [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com)

## Robinhood Chain configuration

| Field            | Mainnet                                   | Testnet                                        |
| ---------------- | ----------------------------------------- | ---------------------------------------------- |
| Chain ID         | `4663`                                    | `46630`                                        |
| Network name     | Robinhood Chain                           | Robinhood Chain Testnet                        |
| RPC URL          | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com`      |
| Native currency  | ETH (18 decimals)                         | ETH (18 decimals)                              |
| Block explorer   | `https://robinhoodchain.blockscout.com`   | `https://explorer.testnet.chain.robinhood.com` |
| Base vault asset | USDG (6 decimals)                         | —                                              |

Full details in [Robinhood Chain](./docs/robinhood-chain.md). Always verify chain
config against the [official Robinhood docs](https://docs.robinhood.com/chain/connecting).

## Current public contract addresses (chain 4663)

Addresses are load-bearing — never abbreviate them. On-chain state is always the
source of truth; see [`docs/generated/current-deployments.md`](./docs/generated/current-deployments.md)
for the stamped snapshot.

| Contract / account          | Address                                      |
| --------------------------- | -------------------------------------------- |
| USDG (base asset, 6dp)      | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| $HISS token (18dp)          | `0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3` |
| VaultFactory                | `0x278d237c6890a5f7101296a9021ed9D26c821810` |
| HISS Vault (flagship)       | `0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` |
| xHISS staking vault         | `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be` |
| HISS Treasury Safe (2-of-3) | `0xF100Fc28dd1721C698046Dbd60408c523b69e36c` |

The full address book (registries, distributors, adapters) is in
[`docs/contracts.md`](./docs/contracts.md).

## Example: create a vault manifest

The SDK **prepares** artifacts and transactions. Nothing is signed for you.

```ts
import { composeVaultManifest, validateVaultFeeConfig, defaultVaultFeeConfig } from "@hiss-finance/vault-kit";

const feeConfig = defaultVaultFeeConfig("0xYourCreatorFeeRecipient");
// -> 10% performance fee, 10% HISS protocol share, routing fee 0 (routing disabled)

const issues = validateVaultFeeConfig(feeConfig);
if (issues.length) throw new Error(JSON.stringify(issues));

const { manifest, manifestHash } = composeVaultManifest({
  name: "Mega-cap Tech Basket",
  baseAsset: "USDG",
  chainId: 4663,
  targetWeightsBps: { AAPL: 1500, MSFT: 1500, NVDA: 1500, SPY: 3500, USDG: 2000 },
  feeConfig,
  strategyNoticePeriodSeconds: 604_800, // 7-day change notice
});

// Saving a candidate is free. Publishing a public vault costs a one-time
// creation fee and requires >= 5% creator skin before public deposits open.
```

See [Create a vault](./docs/vaults/create-a-vault.md) and
[Vault manifest](./docs/vaults/vault-manifest.md).

## Example: prepare a deposit

```ts
import { HissClient } from "@hiss-finance/sdk";

const hiss = new HissClient({ chainId: 4663, rpcUrl: "https://rpc.mainnet.chain.robinhood.com" });

// A read: current share price and readiness (always a live chain read).
const vault = await hiss.vaults.read("0x6d962604df1c6c5ef4b59d88863600fe71bb63e6");

// A prepare: returns the approve + deposit transactions for the USER to sign.
const txs = await hiss.vaults.prepareDeposit({
  vault: vault.address,
  depositor: "0xDepositor",
  amountUsdg: 1_000_000_000n, // 1,000 USDG (6 decimals)
});

// You sign and send `txs` with your own wallet. The deposit is complete only
// on the on-chain receipt — never before.
```

See [Deposit](./docs/vaults/deposit.md).

## Example: stake $HISS

```ts
import { HissClient } from "@hiss-finance/sdk";

const hiss = new HissClient({ chainId: 4663 });

// Prepare a stake into the xHISS vault (single-asset staking over $HISS).
const stakeTxs = await hiss.staking.prepareStake({ staker: "0xStaker", amountHiss: 500n * 10n ** 18n });

// Exiting is a two-step, non-pausable flow: start a 72h cooldown, then redeem
// within the 2-day window.
const cooldownTx = await hiss.staking.prepareStartCooldown({
  staker: "0xStaker",
  xShares: 250n * 10n ** 18n,
});
```

See [xHISS staking](./docs/staking/xhiss.md) and
[Cooldown and redeem](./docs/staking/cooldown-and-redeem.md).

> Staking is a mechanical position, not a yield promise. **Not a performance
> claim. Historical fee distributions are not forecasts.**

## Example: agent / MCP integration

Run the local MCP server and connect any MCP-compatible agent. Every tool is
read, prepare, or score — **agents never execute trades or move funds**.

```bash
pnpm --filter @hiss-finance/mcp-server start
```

```jsonc
// Example MCP client config (stdio transport)
{
  "mcpServers": {
    "hiss": { "command": "pnpm", "args": ["--filter", "@hiss-finance/mcp-server", "start"] },
  },
}
```

Representative tools: `hiss_create_vault_manifest`, `hiss_calculate_vault_fees`,
`hiss_generate_vault_deposit_intent`, `hiss_get_xhiss_status`,
`hiss_get_hiss_reward_split`, `hiss_score_vault_risk`. Full list in
[MCP tools](./docs/mcp.md). Agents can also call [x402 paid endpoints](./docs/x402.md)
and prepare [Bankr commands](./docs/bankrbot.md).

## How fees work

Every fee is disclosed; there are no hidden spreads. Current launch values:

| Fee                      | Value                        | Notes                                                                                                               |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Vault candidate save     | **0 USDG**                   | Always free.                                                                                                        |
| Public vault creation    | **50 USDG** (launch)         | Paid once, by the creator, when publishing on-chain. Candidate figure; the deployed factory is the source of truth. |
| Creator performance fee  | **10%** default              | Of new profit **above the high-water mark** only. No fee on losses. Cap 10% (unverified) / 20% (verified).          |
| HISS protocol share      | **10%** of the creator fee   | A share of the creator's performance fee — never an extra charge on depositor principal.                            |
| Deposit / withdrawal fee | **0 / 0**                    | Chain gas, liquidity unwind, and slippage are disclosed separately.                                                 |
| Routing fee              | **0** while routing disabled | 0.5–2 bps of rebalance notional only once HISS live routing is enabled.                                             |

The full, worked-through fee guide — including $HISS token trading fees — is in
[`docs/fees/`](./docs/fees/index.md).

## The HISS flywheel

Verified **$HISS token trading fees** (from the Bankr/Doppler launch pool) are, on
the HISS side, split **50 / 30 / 10 / 10**:

- **50%** → [xHISS](./docs/staking/xhiss.md) stakers (an ERC-4626 reward injection)
- **30%** → eligible [depositors](./docs/rewards/depositor-rewards.md) (by share-seconds, 30-day vesting)
- **10%** → eligible [providers](./docs/rewards/provider-rewards.md) (facts-only scoring, 90-day vesting)
- **10%** → the Treasury Safe (absorbs rounding dust; legs sum exactly)

Claimed **WETH** fees are **100%** to the Treasury Safe — never split. State is
always chained: **planned ≠ funded ≠ vesting ≠ claimable**. Read the full
mechanism in [Reward flywheel](./docs/fees/reward-flywheel.md).

## Security and the signing boundary

- **User wallet signs user actions.** Deposits, withdrawals, staking, and manifest
  publishes are transactions **you** sign from **your** wallet. HISS never holds
  your keys.
- **Treasury Safe (2-of-3) signs protocol actions.** Ownership changes, reward
  funding, and injector authorization require the multisig.
- **The SDK/CLI prepare only.** They build transactions and artifacts; they do not
  broadcast on your behalf.
- **No custody, no brokerage execution.** HISS never holds pooled assets outside
  the audited contracts and never places brokerage orders.

See [Security](./docs/security.md), [Trust boundaries](./docs/trust-boundaries.md),
and [SECURITY.md](./SECURITY.md).

## Current protocol lifecycle

Live, stamped snapshots (deployments, fees, status) are regenerated from chain
reads and committed under [`docs/generated/`](./docs/generated/current-status.md).
Because on-chain state changes, treat those files as **snapshots with a freshness
limit** — re-read the chain for anything transactional.

## Regional and Stock Token disclosures

- **Tokenized Stock Tokens and ETF tokens are economic exposure only.** They confer
  **no legal or beneficial ownership** in the underlying issuer, no voting rights,
  and no direct dividend entitlement.
- **Availability is region- and provider-dependent.** Some surfaces (including
  Bankr rails and Robinhood's own agentic trading) have limited, jurisdiction-gated
  rollout. See [Stock Tokens](./docs/stock-tokens.md).
- **HISS is not a fund, broker, or investment adviser**, is **not affiliated with
  Robinhood**, and nothing here is investment advice. **No guaranteed yield, no
  APY promise, no passive income.** Vaults share profits _and_ losses.

## Examples

Runnable, self-contained examples live in [`examples/`](./docs/getting-started.md#examples):
reading status, composing and validating a manifest, previewing fees, preparing a
deposit, and driving the MCP server.

## Documentation map

| Area              | Start here                                                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orientation       | [Getting started](./docs/getting-started.md) · [Architecture](./docs/architecture.md) · [Glossary](./docs/glossary.md) · [FAQ](./docs/faq.md)                                                      |
| Chain & contracts | [Robinhood Chain](./docs/robinhood-chain.md) · [Contracts](./docs/contracts.md)                                                                                                                    |
| Packages          | [SDK](./docs/sdk.md) · [CLI](./docs/cli.md) · [React](./docs/react.md) · [MCP](./docs/mcp.md)                                                                                                      |
| Vaults            | [Overview](./docs/vaults/index.md) · [Create](./docs/vaults/create-a-vault.md) · [Manifest](./docs/vaults/vault-manifest.md) · [Risk fuses](./docs/vaults/risk-fuses.md)                           |
| Fees              | [Overview](./docs/fees/index.md) · [Vault fees](./docs/fees/vault-fees.md) · [$HISS token fees](./docs/fees/hiss-token-fees.md) · [Reward flywheel](./docs/fees/reward-flywheel.md)                |
| Staking           | [Overview](./docs/staking/index.md) · [xHISS](./docs/staking/xhiss.md) · [Cooldown & redeem](./docs/staking/cooldown-and-redeem.md)                                                                |
| Rewards           | [Overview](./docs/rewards/index.md) · [Depositor](./docs/rewards/depositor-rewards.md) · [Provider](./docs/rewards/provider-rewards.md) · [Epochs & vesting](./docs/rewards/epochs-and-vesting.md) |
| Agents            | [Agent skills](./docs/agent-skills.md) · [Bankrbot](./docs/bankrbot.md) · [x402](./docs/x402.md) · [CoilOps](./docs/coilops.md)                                                                    |
| Safety            | [Security](./docs/security.md) · [Trust boundaries](./docs/trust-boundaries.md) · [Receipts](./docs/receipts.md) · [Data freshness](./docs/status-and-data-freshness.md)                           |

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[Code of Conduct](./CODE_OF_CONDUCT.md) first. Maintainers are listed in
[MAINTAINERS.md](./MAINTAINERS.md); the release history is in
[CHANGELOG.md](./CHANGELOG.md) and the plan ahead in [ROADMAP.md](./ROADMAP.md).

## Security reporting

Please **do not** open public issues for security vulnerabilities. Use GitHub's
[private vulnerability reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository, or the process described in [SECURITY.md](./SECURITY.md).

## License

Licensed under the [Apache License 2.0](./LICENSE). See [NOTICE](./NOTICE) and
[THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).

## Disclaimer

HISS Finance is compilation and verification software provided "as is", without
warranty of any kind. It is not a fund, broker, exchange, or investment adviser,
and it is **not affiliated with Robinhood, Bankr, Doppler, or Chainlink**. Nothing
in this repository is investment, legal, or tax advice. Digital assets and
tokenized instruments carry risk, including total loss. Vaults share profits and
losses; there is **no guaranteed yield and no APY promise**. Tokenized Stock Tokens
are economic exposure only and are restricted in some jurisdictions. You are solely
responsible for your own transactions and for complying with the laws that apply to
you.
