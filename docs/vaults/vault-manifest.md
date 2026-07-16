# Vault manifest

The **manifest** is the signed, hashed description of a vault's strategy. It is the
contract between a creator and depositors: what the vault holds, at what target
weights, under what fees, notice period, and risk fuses. The manifest is versioned and
its **hash** is committed so any change is detectable.

## Structure

A manifest (schema `vault-manifest-1.0.0`) contains:

| Field                                        | Meaning                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `manifestVersion`                            | Schema version (e.g. `vault-manifest-1.0.0`).                                                                                     |
| `slug`, `name`, `description`                | Human identity of the vault.                                                                                                      |
| `chainId`, `chainName`                       | `4663` / Robinhood Chain.                                                                                                         |
| `baseAsset`, `baseAssetAddress`              | `USDG` / `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`.                                                                            |
| `allowedAssetSymbols`                        | Canonical assets the vault may hold (e.g. AAPL, MSFT, SPY, SGOV, USDG).                                                           |
| `targetWeightsBps`                           | [Target weights](./allocations.md) in basis points (sum 10,000).                                                                  |
| `feeConfig`                                  | Performance fee, protocol share, routing fee, creator fee recipient.                                                              |
| `creatorPolicy`                              | Creator wallet, minimum skin (≥500 bps), notice period, public disclosure flags.                                                  |
| `depositorPolicy`                            | Risk/jurisdiction acknowledgements, profit-and-loss sharing, no-guaranteed-yield, not-FDIC-insured.                               |
| `rebalancePolicy`                            | [Risk fuses](./risk-fuses.md): allocation caps, cash reserve, slippage, oracle freshness, venues, drawdown stop, emergency pause. |
| `strategyDescriptionHash`, `strategyVersion` | The strategy content hash and version.                                                                                            |
| `legalReadinessStatus`                       | Legal/deposit readiness gate (e.g. `candidate`, `blocked`).                                                                       |
| `robinhoodMcpUsedForVaultExecution`          | Always `false` — Robinhood MCP is never used for pooled execution.                                                                |
| `createdAt`, `updatedAt`                     | Timestamps.                                                                                                                       |

## Example (abridged)

```jsonc
{
  "manifestVersion": "vault-manifest-1.0.0",
  "name": "Mega-cap Tech Basket",
  "chainId": 4663,
  "baseAsset": "USDG",
  "baseAssetAddress": "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  "allowedAssetSymbols": [
    "AAPL",
    "MSFT",
    "NVDA",
    "GOOGL",
    "AMZN",
    "META",
    "SPY",
    "QQQ",
    "SGOV",
    "SLV",
    "USDG",
  ],
  "targetWeightsBps": { "AAPL": 900, "MSFT": 900, "SPY": 1500, "USDG": 1000 /* … sums to 10000 */ },
  "feeConfig": {
    "performanceFeeBps": 1000,
    "protocolShareBps": 1000,
    "routingFeeTenthBps": 0,
    "creatorFeeRecipient": "0x…",
  },
  "creatorPolicy": {
    "minCreatorSkinBps": 500,
    "strategyNoticePeriodSeconds": 604800,
    "creatorAddressPublic": true,
  },
  "depositorPolicy": {
    "riskAckRequired": true,
    "jurisdictionAckRequired": true,
    "depositorsShareProfitsAndLosses": true,
    "noGuaranteedYield": true,
    "notFdicInsured": true,
  },
  "rebalancePolicy": {
    "maxAllocationPerAssetBps": 3000,
    "minUsdgCashReserveBps": 1000,
    "maxSlippageBps": 50,
    "oracleFreshnessPolicy": { "requireFreshFeeds": true },
  },
  "robinhoodMcpUsedForVaultExecution": false,
}
```

## Hashing and integrity

The manifest is committed with a **manifest hash** (and a separate strategy-description
hash). Any edit to weights, fees, or policy changes the hash — that is how depositors
and tooling detect a change. Compose and hash with `@hiss-finance/vault-kit`:

```ts
const { manifest, manifestHash } = composeVaultManifest({/* … */});
```

## Declared targets are not holdings

`targetWeightsBps` are **committed target weights, not current holdings**. Because
routing is disabled protocol-wide, a vault may hold **100% USDG** until per-asset
live-rebalance readiness passes. Always read live vault state for actual holdings — do
not infer holdings from the manifest.

## Disclosures baked in

The manifest encodes honesty by construction: depositors acknowledge risk and
jurisdiction, profit-and-loss sharing is explicit, and **no guaranteed yield** /
**not FDIC insured** are recorded. Tokenized stocks/ETFs are **economic exposure only**
and confer no legal or beneficial rights in the underlying issuer.

## Related

- [Allocations](./allocations.md) · [Risk fuses](./risk-fuses.md) ·
  [Strategy updates](./strategy-updates.md) · [Fees](../fees/vault-fees.md)
- JSON schema: `schemas/` (`vault-manifest`).
