# @hiss-finance/vault-kit

Local-first toolkit for building, validating, and hashing **HISS USDG Creator
Vault** candidates on Robinhood Chain (mainnet `4663`, testnet `46630`).

Everything here is pure and deterministic. A creator can assemble a complete,
valid vault candidate **entirely on their own machine** — no database, no API
key, no Bankr key, no private key. This package never signs a transaction,
never takes custody, and never claims a vault is deployed. It prepares and
verifies data; a wallet or Safe signs elsewhere.

Base asset: **USDG** (6 decimals). Target allocations describe what a strategy
aims toward — never a claim about what a vault holds right now (read holdings
live on chain).

## What's inside

| Area                | Exports                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Basis-point math    | `TOTAL_BPS`, `normalizeToTotalBps`, `isNormalized`, `sumBps`, `rescaleBps`                            |
| Allocation builders | `equalWeightAllocation`, `buildAllocation`, `normalizeWithLocks`, `withReserve`, `compareAllocations` |
| Supported assets    | `AssetRegistry`, `assetRegistryFromSnapshot`, `USDG_ASSET`, `HISS_ASSET`                              |
| Risk fuses          | `buildFuse`, `buildFuseSet`, `describeFuse`, `describeFuses`, `validateFuses`                         |
| Fee examples        | `performanceFeeExample`, `highWaterMarkFeeExample`, `creatorSkinExample`, `applyBps`                  |
| Manifest            | `createVaultManifest`, `manifestHash`, `verifyManifestHash`                                           |
| Readiness           | `validateDeploymentReadiness`                                                                         |
| Receipts            | `buildReceipt`, `receiptHash`, `verifyReceipt`, `verifyReceiptHash`                                   |
| Schemas             | `VAULT_CANDIDATE_JSON_SCHEMA`, `VAULT_ACTION_JSON_SCHEMA`                                             |

## Allocations sum to exactly 10,000 bps

Every allocation builder returns integer weights that sum to exactly 10,000
basis points (100%), using largest-remainder rounding so the leftover bps are
distributed deterministically.

```ts
import {
  buildAllocation,
  withReserve,
  createVaultManifest,
  manifestHash,
  validateDeploymentReadiness,
  USDG_ASSET,
} from "@hiss-finance/vault-kit";

const allocations = withReserve(
  buildAllocation([
    { symbol: "AAA", address: "0x…", weight: 2 },
    { symbol: "BBB", address: "0x…", weight: 1 },
  ]),
  { symbol: "USDG", address: USDG_ASSET.address, reserveBps: 1000 },
);

const candidate = createVaultManifest({
  name: "Example Vault",
  symbol: "xEX",
  asset: USDG_ASSET,
  allocations,
  fees: { performanceFeeBps: 1000 },
  minSkinBps: 100,
  lockupSeconds: 0,
  strategy: { summary: "…", rebalanceMethod: "drift", noticePeriodSeconds: 86400 },
  jurisdiction: { usPersonsRestricted: false },
  fuses: [],
});

const readiness = validateDeploymentReadiness(candidate);
const hash = manifestHash(candidate); // deterministic, excludes timestamps
```

## Fee examples are illustrative, not forecasts

`performanceFeeExample`, `highWaterMarkFeeExample`, and `creatorSkinExample`
show how a fee configuration behaves on given inputs. They are worked examples
on integer token units — not a promise of yield, APY, or returns. Depositors
share profits and losses. Not a performance claim.

## License

Apache-2.0.
