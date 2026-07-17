# Bankrbot rails

HISS can prepare commands for **Bankr** agents so an agent with its own wallet can act
on HISS primitives. These rails are **prepare-and-reconcile only** — HISS never
executes, and completion is always an **on-chain receipt**. Bankr rails are **region-
and provider-dependent**, have limited rollout, and are **never a hard dependency** of
the protocol.

## The three rails

### Rail A — vault deposits

- Prepare a Bankr command for a **vault deposit** (packs are bounded in size; the
  current bound is **≤ 10,000 USDG** per pack).
- `hissExecutesDeposit: false` — **HISS does not execute the deposit**. The user's Bankr
  agent/wallet does.
- **Completion = on-chain receipt.** A prepared or submitted command is not a completed
  deposit until the receipt exists.
- Interface: **HTTP API only** (`POST /api/bankrbot/*`) — the Bankr rails are not
  MCP tools. See [tool-name migration](./mcp/tool-name-migration.md).

### Rail B — stock-token trading

- Prepare **stock-token** commands (commands end with "on robinhood").
- A returned `job_completed_unconfirmed` state is **not settled** — only an
  `onchain_confirmed` result counts.
- Interface: **HTTP API only** (`POST /api/stocks/*`) — the stock-token lane is not
  an MCP tool set. The MCP tool `hiss_get_supported_assets` lists the canonical
  tradable assets. See [tool-name migration](./mcp/tool-name-migration.md).
- Stock Tokens are **economic exposure only** — see [Stock Tokens](./stock-tokens.md).

### Rail C — rh-wallet

- A wallet rail whose source is **pending**; it is **never a dependency** of any HISS
  flow. Treat it as optional and unconfirmed until its source is verified.

## Reconciliation is mandatory

Every Bankr action must be **reconciled against its on-chain receipt** before it is
considered done. The reconcile tools exist precisely so an agent never reports a
prepared or unconfirmed command as settled. A missing or unconfirmed result is
**unknown/not settled**, never "complete".

## What HISS does and does not do

- **Does:** compile commands, prepare intents, and reconcile results against receipts.
- **Does not:** hold keys, execute trades or deposits, take custody, or guarantee a fill.

## Separation from Robinhood MCP

Bankr rails are distinct from any **Robinhood MCP** planning surface, which is
**compile-only** (`liveOrderSent` hard-typed false) and **never** used for pooled vault
execution. Rails are kept separate by mode badges and prompt language. See
[CoilOps](./coilops.md) and [Stock Tokens](./stock-tokens.md).

## Honesty rules

- Never claim "Robinhood supports x402" or imply universal availability.
- Never present `job_completed_unconfirmed` / `job_completed` as settled — only
  `onchain_confirmed`.
- Region and provider constraints must be stated wherever a rail is offered.
