# 24/7 Vault Architecture (designed — activation-gated)

> **Status: DESIGNED. Production 24/7 settlement is NOT active; the V2 vault is
> undeployed; activation is separately gated behind independent audits and
> explicit owner authorization; nothing is funded, live, or deployed.**

This page describes the **design** of continuous, around-the-clock HISS vault
valuation and settlement. It is a builder-facing architecture summary, not an
announcement that any of it is running. The deployed flagship vault is unchanged;
its weekend/off-hours behavior is the honest, fail-closed V1 posture described in
[Deposit](./deposit.md), [Withdraw](./withdraw.md), and
[Data freshness](../status-and-data-freshness.md). Read this document as "here is
the shape of the 24/7 system we designed and tested" — every capability below is
gated (see [Status and gating](#status-and-gating)).

## Why 24/7 at all

Robinhood Chain does not close. Its on-chain liquidity venues (see
[Liquidity and trading venues](../stock-tokens.md#liquidity-and-trading-venues))
can quote and clear at any hour, while the reference Chainlink equity feeds update
on a **24/5** cadence that follows market hours. The 24/5 property is a fact about
**one price feed**, not about on-chain trading. The design's goal is to let vault
valuation and (once activated) settlement track the on-chain market continuously,
without ever relabeling a stale Friday close as a live price.

**The honest liquidity reality.** On-chain 24/7 stock-token liquidity is **real
but thin and single-venue today**: proven per-asset USDG pools exist on a
Uniswap-style AMM, but depth is shallow (a deep pool may be only low-five-figures
of TVL) and only one venue is code-verified. Other venues (propAMM, RFQ
aggregators, orderbook) remain **discovered, not proven**. This is why priced
off-hours execution at meaningful size is gated on deeper, again-proven liquidity
— the design stages capability to measured liquidity, it does not assume it.

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

## Five execution modes

Per asset, per instant, the design resolves one of five modes from measured
on-chain health (never from the calendar):

| Mode                     | Meaning                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MULTI_VENUE_EXECUTABLE` | Two or more independent, corroborating venues can clear the proposed size.                                                                                                              |
| `SINGLE_VENUE_BOUNDED`   | One verified venue authorizes execution under **stricter** size caps (a single verified pool is enough — a second venue improves capacity and corroboration but is not a prerequisite). |
| `BATCH_EXECUTABLE`       | Immediate depth is insufficient for the size; flow is accepted continuously and cleared in frequent on-chain epochs.                                                                    |
| `IN_KIND_ONLY`           | No executable priced path; only the valuation-free in-kind exit is available.                                                                                                           |
| `TEMPORARILY_HALTED`     | A health input (divergence, depeg, sequencer, corporate action, reconciliation) fails closed; priced execution is unavailable while the in-kind exit stays open.                        |

A degraded input degrades the **smallest scope that restores safety**, in order:
**source → venue → asset → action-size → vault**. One unpriceable asset pauses only
that asset's authorization; every other asset and the cash leg stay live. Only a
chain-wide fault (sequencer/RPC) has no smaller scope than the vault.

## Three settlement lanes

The design defines three settlement lanes; each preserves the anti-dilution
invariant that existing holders never subsidize an entering or exiting user, and
none of them waits for the equity market to reopen:

1. **Instant.** Quote the exact flow, validate impact and depth, and settle from
   the **realized** value — shares are minted or burned from what actually cleared,
   never from a pre-trade midpoint.
2. **Batch netting.** Accept flow continuously and clear it in frequent on-chain
   epochs: net deposits against redemptions, trade only the residual in safe
   chunks, and settle every participant in an epoch at one documented per-asset
   clearing price (a perfectly-netted epoch charges no spread). Deterministic FIFO
   ordering; no operator queue-jumping.
3. **In-kind (unconditional exit).** A redemption is settled by transferring the
   redeemer their pro-rata basket of Stock Tokens plus USDG directly. This path is
   **valuation-free** — it needs no sell into thin liquidity and no fresh oracle
   mark — so it is the honest around-the-clock exit even when priced execution is
   halted. It is **jurisdiction-gated**, not permissionless.

## Price Mesh V2 — side-aware pricing

The design rejects the idea of a single generic "price". A single mid used for
both entry and exit is exactly the dilution bug. Instead, per asset, three
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

## Dynamic safe-notional

"How much can move right now, safely?" is answered by a live, expiring
**safe-notional** figure derived from actual executable depth, price impact,
corroboration quality, rolling flow, inventory, corporate-action state, stablecoin
peg, sequencer health, and configured loss bounds. It is never a static config and
never near-zero merely because a second venue is absent. Flow within the cap can be
settled immediately; flow above the cap is reduced, routed to a batch epoch, or
offered the in-kind exit — the vault is always open for the safe size and never
open for an unsafe size.

## Corporate-action handling (multiplier applied exactly once)

Tokenized instruments carry a corporate-action **multiplier** (ERC-8056) for splits
and similar events. The correctness-critical rule the design enforces:

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

## Status and gating

Two gates, strictly separated:

- **Code readiness.** The off-chain accounting, mode resolver, safe-notional, and
  the four settlement/rebalance lanes are implemented as pure, deterministic logic
  and tested (unit + adversarial fuzz + property); a new **undeployed** V2 vault
  contract mirrors that accounting with forge fuzz, stateful-invariant, and
  weekend-warped fork tests, plus a policy-parity check that keeps the on-chain and
  off-chain math byte-identical. This certifies the **code** is coherent — it
  authorizes nothing on mainnet.
- **Mainnet activation — BLOCKED.** Turning on real 24/7 settlement requires, as a
  separate owner-authorized action: independent smart-contract and
  oracle/economic-risk audits (an internal review is **not** an external audit),
  verified live per-asset venue depth, a sequencer-liveness substitute (the chain's
  uptime feed is unset), a deployment rehearsal, production monitoring, governance
  (2-of-3 Safe) authorization, a capped-notional pilot, and explicit owner sign-off.

Until every one of those clears, this architecture is **designed and tested,
undeployed, and inactive.** No surface here claims that production 24/7 settlement
is live, funded, or executing.

## What HISS still does not do

This design does not change the HISS trust boundary. HISS **prepares and verifies**;
it never takes custody, never holds keys, never signs, and never places a brokerage
order (`liveOrderSent` is hard-typed `false` in every artifact). Any executed value
movement is settled by the user's own wallet or the audited on-chain contracts and
is complete only on an on-chain [receipt](../receipts.md). See
[Trust boundaries](../trust-boundaries.md) and [Security](../security.md).

## Related

- [Vaults overview](./index.md) · [Deposit](./deposit.md) · [Withdraw](./withdraw.md)
- [Risk fuses](./risk-fuses.md) · [Stock Tokens](../stock-tokens.md)
- [Status and data freshness](../status-and-data-freshness.md)
- Agent skill: [hiss-price-mesh](../../skills/hiss-price-mesh/SKILL.md)
