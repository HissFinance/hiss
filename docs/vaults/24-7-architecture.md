# 24/7 Vault Architecture (LIVE — the canonical V2 vault)

> **Status: LIVE.** The V2 vault (`HissUsdGVaultV2`,
> `0x432e90b1B35995EBE46eD93B4Db369abfc230E69`, chain 4663) is deployed on
> Robinhood Chain mainnet and is the **canonical new-deposit vault**. Its 24/7
> lanes — the request queue, the in-kind exit, and bounded instant paths — are
> in production. The V1 flagship
> (`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6`) is **LEGACY · EMPTY**: closed
> to new deposits, with nothing to migrate. Review state: **Internally
> verified · not externally audited.**

This page describes the continuous, around-the-clock HISS vault valuation and
settlement architecture that the canonical V2 vault runs. Live values —
queue depth, keeper state, capacity, pause flags — are **always live chain
reads**, never copies from this page.

## The V2 contract stack (chain 4663)

| Contract                      | Address                                      | Role                                                                                         |
| ----------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| HissUsdGVaultV2               | `0x432e90b1B35995EBE46eD93B4Db369abfc230E69` | The canonical new-deposit vault (queue-routed epoch settlement)                              |
| HissRequestQueue              | `0x317d1eEC013a91a316858e80BF782496F231729a` | 24/7 deposit / USDG-redemption escrow + epoch queue                                          |
| HissBatchSettler              | `0x32A60abB48235b158dd515B84C5B039F6Dc4f7dD` | Constrained keeper settlement (settles queued epochs — bounded, never discretionary custody) |
| HissLiveness                  | `0x424b634AA340832Cf548bB501204a6cf8A6d9136` | Liveness heartbeat — permissionless chain-liveness evidence                                  |
| HissPriceMeshV2               | `0xd57E9fC8fF8b1aCe73a7D6c32F1101879fDeF3c6` | Side-aware price mesh + dynamic capacity (safe-notional) evidence                            |
| HissV2RiskPolicy              | `0x9aDE5804ad1b4F6231E46b1E806dFc7464069BB4` | The binding V2 risk policy                                                                   |
| HissReceiptRegistry           | `0x0A6232fD54C8e4B3eCBd0df261706001dfAF55Da` | V2 receipts (preparation / submission / settlement distinguished)                            |
| HissV2AssetRegistry           | `0xC2619B2Bf3f075A73FF29f9e6cc2a8C532c0395F` | Canonical-address asset registry for V2                                                      |
| HissV2UniswapExecutionAdapter | `0x306A800226CAF794238CBB0BdE9A49bAb7156d31` | The registry-approved execution adapter                                                      |

## Why 24/7 at all

Robinhood Chain does not close. Its on-chain liquidity venues (see
[Liquidity and trading venues](../stock-tokens.md#liquidity-and-trading-venues))
can quote and clear at any hour, while the reference Chainlink equity feeds update
on a **24/5** cadence that follows market hours. The 24/5 property is a fact about
**one price feed**, not about on-chain trading. The architecture's goal is to let
vault valuation and settlement track the on-chain market continuously, without
ever relabeling a stale Friday close as a live price.

**The honest liquidity reality.** On-chain 24/7 stock-token liquidity is **real
but thin today**, and capability is staged to measured liquidity rather than
assumed depth. This is why capacity is dynamic (see below) and why priced
execution at meaningful size is bounded by proven, corroborated depth.

## The calendar-is-context-only rule

The single governing rule: **calendar/session state is descriptive context and
never independently authorizes or blocks anything.** A weekend, an overnight, a
holiday, or "the underlying exchange is closed" is never, by itself, a reason to
close the vault, revert valuation, zero NAV, or relabel a carried close as live.

Availability is decided by **evidence**, not the clock. Valid reasons to constrain
or halt are always about on-chain market health — no executable liquidity, an
invalid or insufficient price corroboration, excessive price impact for the size,
an unresolved corporate action, a stablecoin depeg, a sequencer/chain fault, a
code-hash mismatch, or an accounting-reconciliation failure. The session label only
chooses the **wording** of a state ("reference session closed"), never the state
itself.

## The live lanes

Every lane is user-signed: **you sign your own transactions**; HISS never holds
keys and never executes for you. Settlement of queued epochs is performed by the
constrained keeper path in `HissBatchSettler` — a bounded on-chain contract
action, never a discretionary custodian.

1. **Queued USDG deposit.** USDG is escrowed by the request queue at enqueue;
   shares mint at **epoch settlement** at the epoch clearing rate — not at
   enqueue, and never from a pre-trade midpoint. Requests carry an owner, a
   nonce, an expiry, and an optional minimum-shares-out floor.
2. **Queued USDG redemption.** Shares are escrowed and settled to USDG at the
   epoch clearing rate, with an optional minimum-USDG-out floor.
3. **In-kind redemption (the always-available exit).** A redeemer receives their
   pro-rata basket of held tokens plus USDG directly. This path is
   **valuation-free** — it needs no sell into thin liquidity and no fresh oracle
   mark — so it is the honest around-the-clock exit even when priced execution
   is constrained.
4. **Instant bounded lanes.** Flow inside the live capacity bound can clear
   immediately from realized value, under stricter size caps.

Receipts for every lane distinguish **PREPARATION** (an unsigned plan),
**SUBMISSION** (a sent-but-unconfirmed transaction), and **SETTLEMENT** (a
confirmed on-chain outcome). Only settlement proves completion. See
[Receipts](../receipts.md).

## Five execution modes

Per asset, per instant, the architecture resolves one of five modes from measured
on-chain health (never from the calendar):

| Mode                     | Meaning                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MULTI_VENUE_EXECUTABLE` | Two or more independent, corroborating venues can clear the proposed size.                                                                                                              |
| `SINGLE_VENUE_BOUNDED`   | One verified venue authorizes execution under **stricter** size caps (a single verified pool is enough — a second venue improves capacity and corroboration but is not a prerequisite). |
| `BATCH_EXECUTABLE`       | Immediate depth is insufficient for the size; flow is accepted continuously and cleared in on-chain epochs.                                                                             |
| `IN_KIND_ONLY`           | No executable priced path; only the valuation-free in-kind exit is available.                                                                                                           |
| `TEMPORARILY_HALTED`     | A health input (divergence, depeg, sequencer, corporate action, reconciliation) fails closed; priced execution is unavailable while the in-kind exit stays open.                        |

A degraded input degrades the **smallest scope that restores safety**, in order:
**source → venue → asset → action-size → vault**. One unpriceable asset pauses only
that asset's authorization; every other asset and the cash leg stay live. Only a
chain-wide fault (sequencer/RPC) has no smaller scope than the vault.

## Rebalancing: inactive by policy

Rebalancing on the canonical V2 vault is **INACTIVE BY POLICY** — an owner
decision, not a fault state (never render it as degraded): "AAPL is currently
the only execution-grade Stock Token asset. Initial public operation uses
settlement-driven allocation and preserves the current USDG cash reserve." If
the on-chain settler flag ever reads `rebalanceActive == true`, the live read
wins over any written declaration.

## Price Mesh V2 — side-aware pricing

The architecture rejects the idea of a single generic "price". A single mid used
for both entry and exit is exactly the dilution bug. Instead, per asset, three
**distinct marks** are derived, each with one legitimate consumer:

- **Reporting mark** — a robust, manipulation-resistant fair mark (mid), used for
  NAV, share price, and the high-water mark. It is derived from corroborated
  independent sources and never from a single thin pool or a single block; a
  pool-derived time-average is a divergence tripwire only, never a NAV weight.
- **Deposit (execution) mark** — an **ask-side** mark. A depositor is causing the
  vault to acquire exposure at the ask plus the real cost to acquire it, so the
  entry is valued at what it would cost — spread, impact, fees — with that
  differential retained by the vault for all holders.
- **Redemption (execution) mark** — a **bid-side** mark. A redeemer receives their
  pro-rata value **less** the realistic cost to liquidate their slice.

Rounding always favors the vault (against the actor). A missing or invalid price is
**`UNKNOWN`, never `0`**, and a source that fails is never silently dropped from NAV
— the aggregate degrades to a labeled partial/unavailable state with a reason. The
spread is **execution spread (anti-dilution) retained by the vault for all
holders** — never a fee, never yield, never income.

## Dynamic capacity (safe-notional)

"How much can move right now, safely?" is answered by a live, expiring
**capacity** figure read from `HissPriceMeshV2` — derived from actual executable
depth, price impact, corroboration quality, rolling flow, inventory,
corporate-action state, stablecoin peg, sequencer health, and configured loss
bounds. **Capacity is always a live Price Mesh read, never a fixed promise**,
never a static config, and never near-zero merely because a second venue is
absent. Flow within the cap can settle immediately; flow above the cap is
reduced, routed to a batch epoch, or offered the in-kind exit — the vault is
always open for the safe size and never open for an unsafe size.

## Corporate-action handling (multiplier applied exactly once)

Tokenized instruments carry a corporate-action **multiplier** (ERC-8056) for splits
and similar events. The correctness-critical rule the architecture enforces:

- The **on-chain Chainlink feed price is already multiplier-adjusted.** Never apply
  the multiplier to it again — doing so is the double-multiplier bug.
- The **REST `/prices` quote is raw underlying** (not multiplier-adjusted). Any use
  of it for corroboration must be brought into token space (× the current
  multiplier) before comparison.
- Identity is by **canonical address**, never ticker match; a ticker change never
  re-points value by symbol.
- A pending or in-progress corporate action pauses **only the affected asset** and
  is reconciled across the API, token, feed, and venue surfaces before that asset
  transacts again; an ambiguous multiplier forces explicit review rather than a
  best guess. A split is **not** a weekend closure, and a weekend closure is **not**
  a corporate action — the two are kept orthogonal.
- Oracle-pause is advisory; **staleness stays the primary on-chain guard.**

## Manipulation resistance (stated, not a how-to)

The reporting mark is manipulation-resistant by construction: it requires
independent corroboration within a bounded corridor, uses a multi-block time-average
(never a single block) only as a tripwire, caps how much of an order any single
venue may back, and requires that the cost to move a price past the corridor exceeds
what could be extracted from mispricing the flow. When that floor cannot hold on
thin depth, the price is not execution-grade and the action **fails closed**. Exact
thresholds are policy internals and are not published here.

## The legacy V1 flagship

The V1 flagship HISS Vault (`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6`) is
**LEGACY · EMPTY**: it is closed to new deposits and holds no depositor value.
Its address and history remain documented (see
[Verified history & USDG accounting](./verified-history-and-usdg-accounting.md));
there is **no migration flow, because there is nothing to migrate**. All new
deposits are the canonical V2 vault's queue lane.

## What HISS still does not do

The V2 launch does not change the HISS trust boundary. HISS **prepares and
verifies**; it never takes custody of your keys, never signs for you, and never
places a brokerage order (`liveOrderSent` is hard-typed `false` in every
artifact). The SDK, MCP tools, and CLI are **read/prepare-only**
(`signed: false`, `liveTransactionSent: false`); you sign your own transactions.
Any executed value movement is settled by the user's own wallet or the deployed
on-chain contracts and is complete only on an on-chain settlement
[receipt](../receipts.md). Review state: **Internally verified · not externally
audited.** See [Trust boundaries](../trust-boundaries.md) and
[Security](../security.md).

## Related

- [Vaults overview](./index.md) · [Deposit](./deposit.md) · [Withdraw](./withdraw.md)
- [Risk fuses](./risk-fuses.md) · [Stock Tokens](../stock-tokens.md)
- [Status and data freshness](../status-and-data-freshness.md)
- Agent skill: [hiss-price-mesh](../../skills/hiss-price-mesh/SKILL.md)
