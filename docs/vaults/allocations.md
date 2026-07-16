# Allocations

A vault's strategy is expressed as **target weights in basis points (bps)** over its
allowed assets. 10,000 bps = 100%. Allocations are the _intended_ composition; actual
holdings are read live and may differ (routing is disabled today).

## Basis points

- `900 bps = 9%`, `1,500 bps = 15%`, `10,000 bps = 100%`.
- **Target weights must sum to exactly 10,000 bps.**
- Every asset must be in the vault's `allowedAssetSymbols` and resolvable to a
  **canonical address** via the asset registry.

## Example

```jsonc
"targetWeightsBps": {
  "AAPL": 900, "MSFT": 900, "NVDA": 900, "GOOGL": 800, "AMZN": 800, "META": 700, // tech 50%
  "SPY": 1500, "QQQ": 1000, "SGOV": 1000, "SLV": 500,                             // ETFs 40%
  "USDG": 1000                                                                    // cash 10%
}
// sum = 10,000 bps
```

## Allocation constraints (risk fuses)

Allocations are checked against the vault's [risk fuses](./risk-fuses.md). Typical
constraints (per the flagship vault's policy) include:

| Fuse                            | Example value | Meaning                           |
| ------------------------------- | ------------- | --------------------------------- |
| `maxAllocationPerAssetBps`      | 3,000         | No single asset above 30%.        |
| `maxAllocationPerProviderBps`   | 8,000         | Concentration cap per provider.   |
| `maxTokenizedEquityExposureBps` | 7,000         | Cap on tokenized-equity exposure. |
| `maxEtfExposureBps`             | 6,000         | Cap on ETF exposure.              |
| `minUsdgCashReserveBps`         | 1,000         | Minimum USDG cash reserve.        |

A candidate whose weights violate a fuse is refused at validation — fix the weights,
do not bypass the fuse.

## Composing and validating

```ts
import { composeAllocations, validateAllocations } from "@hiss-finance/vault-kit";

const weights = composeAllocations({ AAPL: 900, MSFT: 900, SPY: 1500, USDG: 6700 });
const issues = validateAllocations(weights, rebalancePolicy); // caps + sum-to-10000
if (issues.length) throw new Error(JSON.stringify(issues));
```

## Rebalancing toward targets

When live routing is enabled and per-asset readiness passes, a rebalance moves holdings
toward the target weights within the fuses (max slippage, oracle freshness, verified
route, frequency limits). Until then, a vault holds its base asset. Every rebalance
produces a [receipt](./receipts.md) and a post-run audit. See
[Strategy updates](./strategy-updates.md) and [CoilOps](../coilops.md).

## Declared targets are not holdings

Target weights are **committed intent**, not a snapshot of holdings. Read live vault
state for actual composition; never copy a manifest's weights as if they were balances.
