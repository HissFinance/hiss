# Verified history & USDG accounting

How a vault's historical series is recorded and served, and how the vault's USDG
reserve is valued. Two truth models, kept permanently separate:

1. **Verified history** — a time series of _real, block-pinned observations_. A
   gap is a gap; nothing is interpolated, padded, or bridged.
2. **The USDG accounting identity** — the vault keeps its books in USDG, so the
   USDG reserve's value _in USDG_ is its balance. That is a unit conversion, and
   it is **never a claim that 1 USDG = 1 USD** — the market peg is observed and
   reported separately.

This page describes **mechanics**, not expected outcomes: there is no guaranteed
yield, and historical series are **not forecasts and not performance claims**.

## Verified history

Every point in a vault's history series is backed by a real observation at a
**pinned block** (an archive read, a committed snapshot artifact, or one clearly
labeled live read). Points carry a state:

| State              | Meaning                                                               |
| ------------------ | --------------------------------------------------------------------- |
| `VERIFIED_HISTORY` | A verified, block-pinned observation with an evidence hash.           |
| `LIVE`             | A request-time chain read — labeled, and never persisted as history.  |
| `DEGRADED`         | An observation captured while a source was impaired — shown, labeled. |
| `MISSING`          | No verified observation exists for this interval. Value is `null`.    |

### The honesty rules

- **Gaps are never bridged.** A bucket with no verified observation is `MISSING`
  with a `null` value, and contiguous missing runs are summarized in `gaps[]`.
  Charts render disconnected segments — no line is ever drawn across a gap.
- **History begins when it begins.** Buckets before the first verified
  observation are omitted entirely (history had not started — that is different
  from a gap), and `verifiedHistoryBeginsAt` states the boundary.
- **Unknown is `null`, never zero.** A failed read is "unknown"; a zero is only
  ever an affirmative on-chain fact.
- **Net flows come from events only.** The net-flow series is a per-bucket delta
  of the cumulative _on-chain event ledger_ (deposits minus redemptions). It is
  **never inferred from NAV changes** — until an event-derived ledger exists for
  a vault, the metric reports itself unavailable with that exact reason.
- **Duplicates resolve deterministically.** Multiple observations of the same
  bucket resolve by a total, documented ordering (block time, capture type, data
  state, block number) — identical inputs always produce identical series.
- **Exact integers only.** Every value is an exact decimal-string integer in a
  stated denomination (USDG base units are 6-decimal; share price is 18-decimal).
  No floats in money math.

### The history API

The app serves vault history at `GET /api/vaults/{slug}/history` with `range`
(`24H|7D|30D|90D|ALL`), `metric` (`SHARE_PRICE|NAV|TVL|NET_FLOW|RESERVE`), and
`resolution` (`5m|15m|1h|6h|1d`, defaulted per range) parameters. The response
carries the points and gaps described above plus coverage counts, the
denomination of every value, `verifiedHistoryBeginsAt`, and the backing block
numbers/evidence hashes — so anything displayed can be independently re-derived.
Buckets are UTC-aligned.

## The USDG accounting identity

A HISS vault is denominated in USDG. Its USDG reserve therefore has an
**accounting price of exactly `1.000000` USDG** — "83.000017 USDG is worth
83.000017 USDG" is a unit conversion, true by construction. This identity:

- renders whenever the on-chain `balanceOf` read succeeds — a quiet or
  unreadable USDG/USD price feed can **never** blank the reserve;
- is **not** a USD claim: the USD translation of anything USDG-denominated is a
  market observation and stays feed-gated;
- carries **identity-zero unrealized PnL** — cash in its own unit of account has
  no market return, which is an affirmative `0`, not missing data.

## The market peg reference (separate, may be unknown)

Whether 1 USDG currently trades at 1 USD is an **observation**, reported
alongside — never substituted into — the accounting identity:

| Peg state       | Meaning                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `LIVE`          | Fresh in-corridor observation from the pinned Chainlink USDG/USD feed.                                    |
| `DEGRADED`      | Only a stale or secondary observation exists — shown, labeled, not trusted for execution.                 |
| `DEPEG_WARNING` | Fresh observation outside the warning corridor.                                                           |
| `DEPEG_TRIPPED` | Fresh observation outside the close corridor — a depeg event.                                             |
| `UNKNOWN`       | No usable observation. **Fails closed** for risk-sensitive execution; never erases the displayed reserve. |

- The observed market price is **never defaulted to $1.00** — unobservable means
  `null` with a reason.
- Independent external references may only **escalate** a peg state (disagreement
  is uncertainty, not health), never soothe one, and an external quote alone
  never yields `LIVE`.
- Risk-sensitive execution is usable **only** in `LIVE` — every other state
  fails closed.

## Custody scopes (no double counting)

USDG connected to a vault is classified by custody scope. Only the vault
contract's own balance (`VAULT_NAV`) is NAV-recognized and appears in the
holdings row; escrow-type scopes (queued deposits, pending settlement, claimable
redemptions — where a vault version deploys them) are reported separately and
are **never summed into the reserve**. A scope with no deployed contract is
_structurally absent_ — an affirmative zero by construction, not a failed read.

## Reading it

- **[Performance](./performance.md)** — share price, high-water mark, and fees.
- **[Deposit](./deposit.md)** / **[Withdraw](./withdraw.md)** — the flows that
  move NAV/TVL but, by design, not share price (flow-neutrality).
- **[Data freshness](../status-and-data-freshness.md)** — how live reads,
  last-verified display, and degraded states are labeled everywhere else.
