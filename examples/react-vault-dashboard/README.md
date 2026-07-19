# react-vault-dashboard

A tiny, read-only dashboard built from `@hiss-finance/react` hooks and
components: chain status, a vault summary, allocation bars, an accessible SVG
performance chart, the reward-split lifecycle, and an unsigned stake plan.

It runs with the **mock client** (`createMockHissClient`) — no RPC, no SDK, no
wallet — so you can see the components immediately.

## Run

```bash
pnpm --filter @hiss-finance/example-react-vault-dashboard dev
```

Then open the printed local URL (default http://localhost:5173).

## What you should see

- A chain card (Robinhood Chain, 4663) with a "Live" badge.
- The flagship vault summary with a truncated, explorer-linked address.
- Allocation bars for AAPL / MSFT / NVDA (illustrative demo weights).
- A small performance line chart (illustrative demo series).
- The 50/15/15/10/10 reward split (xHISS stakers / Vault Providers / Vault
  Contributors / Treasury / economic burn), with undeployed legs shown as "Not
  deployed".
- A stake panel rendering the approved xHISS copy and an **unsigned, not
  executed** stake plan.

## Going live

Swap the mock for the SDK client to read real chain state:

```ts
import { createHissClient } from "@hiss-finance/sdk";
const client = createHissClient();
```

Nothing in this example signs or sends a transaction. Deposit/stake plans are
descriptions the user would sign in their own wallet.
