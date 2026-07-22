# Getting started

HISS Finance is an open toolkit for building **creator-run vaults**, **staking**,
**rewards**, and **agent tooling** on [Robinhood Chain](./robinhood-chain.md). This
guide gets you from clone to first read/prepare.

> **This repository is the open SDK, contract interfaces, and documentation — not the
> production application.** The hosted product is at
> [www.hiss.finance](https://www.hiss.finance). Build against the same primitives
> here.

> **Hosts.** The hosted product spans three hosts:
> [www.hiss.finance](https://www.hiss.finance) (marketing and top-level agent
> files), [app.hiss.finance](https://app.hiss.finance) (the application and the
> public HTTP API), and [docs.hiss.finance](https://docs.hiss.finance) (product
> documentation). Legacy `www.hiss.finance/app/*` and `www.hiss.finance/docs/*`
> URLs 308-redirect (one hop) to their canonical hosts.

> **Free to use.** The HISS website and first-party app tools are free — no
> subscriptions, no credits, no paywalls — and these packages are open-source
> (Apache-2.0). You keep signing control; HISS prepares and verifies while your own
> wallet or Safe signs and submits. Normal network gas and contract-enforced protocol
> fees still apply (on-chain, not HISS charges). [x402](./x402.md) services are separate
> machine-to-machine agent rails, distinct from the free first-party surfaces.

## Prerequisites

- **Node.js 20+** and **pnpm 10+** (the repo pins `pnpm@10.28.1`)
- **Foundry** for the Solidity contracts (`forge`, `cast`)
- A wallet you control for signing (HISS never holds your keys)

## Install

Packages are **not yet published to npm**. Build from source:

```bash
git clone https://github.com/HissFinance/hiss.git
cd hiss
pnpm install --frozen-lockfile
pnpm build
```

Optional:

```bash
pnpm test          # run package test suites
cd contracts && forge build && forge test
```

## Core concepts in five minutes

- **Vault** — an ERC-4626 basket denominated in **USDG (6dp)**. A creator declares a
  target-weight strategy; depositors share profits and losses by share. See
  [Vaults](./vaults/index.md).
- **Manifest** — the signed, hashed description of a vault's strategy, weights, fees,
  and risk fuses. See [Vault manifest](./vaults/vault-manifest.md).
- **Prepare, not execute** — the SDK builds transactions **you** sign. It never
  broadcasts for you, never holds keys, never takes custody.
- **$HISS + xHISS** — the protocol token and its single-asset [staking vault](./staking/xhiss.md).
- **Rewards** — verified $HISS trading fees split [50/15/15/10/10](./fees/reward-flywheel.md):
  xHISS stakers / Vault Providers / Vault Contributors / Treasury / economic burn.
- **Agents** — an [MCP server](./mcp.md), [x402](./x402.md) endpoints, and
  [Bankr](./bankrbot.md) rails that prepare (never execute) actions.

## Your first read

Read live protocol status straight from the chain (no keys required):

```ts
import { HissClient } from "@hiss-finance/sdk";

const hiss = new HissClient({
  chainId: 4663,
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
});

const status = await hiss.status.read();
console.log(status.vaults.flagship.address); // 0x6d96...63e6
console.log(status.staking.xhiss.address); // 0x6998...67Be
```

Or from the terminal:

```bash
pnpm --filter @hiss-finance/cli start status --rpc-url https://rpc.mainnet.chain.robinhood.com
```

## Your first prepare

Preparing a transaction returns unsigned calldata for **you** to sign and send:

```ts
const txs = await hiss.vaults.prepareDeposit({
  vault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
  depositor: "0xYourAddress",
  amountUsdg: 1_000_000_000n, // 1,000 USDG (6 decimals)
});
// Sign and broadcast `txs` with your wallet. Deposit completes on the on-chain receipt.
```

## Examples

Self-contained examples live under `examples/`:

- **read-status** — read deployments, fees, and readiness from chain.
- **compose-manifest** — build and validate a vault manifest, print its hash.
- **preview-fees** — compute performance-fee and protocol-share previews.
- **prepare-deposit** — build the approve + deposit transactions.
- **mcp-quickstart** — run the MCP server and call a read tool.

Run one with, e.g.:

```bash
pnpm --filter ./examples/read-status start
```

## Where to go next

- [Architecture](./architecture.md) — how the packages fit together.
- [SDK](./sdk.md) · [CLI](./cli.md) · [React](./react.md) · [MCP](./mcp.md)
- [Vaults](./vaults/index.md) · [Fees](./fees/index.md) · [Staking](./staking/index.md) · [Rewards](./rewards/index.md)
- [Security](./security.md) · [Trust boundaries](./trust-boundaries.md)
- [FAQ](./faq.md) · [Glossary](./glossary.md)
