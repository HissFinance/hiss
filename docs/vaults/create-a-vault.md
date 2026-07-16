# Create a vault

Creating a vault is a compose → validate → publish flow. Saving a **candidate** is
free and off-chain; **publishing** writes the vault on-chain and charges a one-time
creation fee. You sign the publish transaction yourself.

## 1. Compose a candidate (free)

Use `@hiss-finance/vault-kit` to build a [manifest](./vault-manifest.md): name, base
asset (USDG), chain (4663), [target weights](./allocations.md), [fee config](../fees/vault-fees.md),
[risk fuses](./risk-fuses.md), and the strategy-change notice period.

```ts
import { composeVaultManifest, defaultVaultFeeConfig } from "@hiss-finance/vault-kit";

const feeConfig = defaultVaultFeeConfig("0xYourCreatorFeeRecipient");
// 10% performance fee, 10% HISS protocol share, routing fee 0 (routing disabled)

const { manifest, manifestHash } = composeVaultManifest({
  name: "Mega-cap Tech Basket",
  baseAsset: "USDG",
  chainId: 4663,
  targetWeightsBps: {
    AAPL: 900,
    MSFT: 900,
    NVDA: 900,
    GOOGL: 800,
    AMZN: 800,
    META: 700, // 50% tech
    SPY: 1500,
    QQQ: 1000,
    SGOV: 1000,
    SLV: 500, // 40% ETFs
    USDG: 1000, // 10% cash
  },
  feeConfig,
  strategyNoticePeriodSeconds: 604_800, // 7-day change notice
});
```

Saving a candidate costs **0 USDG** and requires **no** creator skin-in-game.

## 2. Validate

Validate fees and risk fuses before publishing. Validation **fails closed** — fix
issues, do not bypass them.

```ts
import { validateVaultFeeConfig, validateRiskFuses } from "@hiss-finance/vault-kit";

const feeIssues = validateVaultFeeConfig(feeConfig); // performance-fee cap, etc.
const fuseIssues = validateRiskFuses(manifest.rebalancePolicy); // caps, oracle policy, etc.
if (feeIssues.length || fuseIssues.length) {
  throw new Error(JSON.stringify({ feeIssues, fuseIssues }));
}
```

Common bounds: performance fee 0–10% (unverified) / 0–20% (verified); weights sum to
10,000 bps; per-asset and per-provider caps; a minimum USDG cash reserve; oracle
freshness. See [Allocations](./allocations.md) and [Risk fuses](./risk-fuses.md).

## 3. Publish (on-chain, creation fee)

Prepare and sign the publish transaction. The `VaultFactory` charges the creation fee
(**50 USDG** launch) and deploys the vault instance.

```ts
import { HissClient } from "@hiss-finance/sdk";
const hiss = new HissClient({ chainId: 4663 });

const publishTx = await hiss.vaults.preparePublish({ manifest, manifestHash });
// Sign and send `publishTx` with your wallet → vault instance + on-chain receipt.
```

## 4. Open deposits (creator skin-in-game ≥ 5%)

Before **public deposits** open, the creator must hold **at least 5%** (500 bps) of the
vault. This is a commitment, not a fee, and is not required to save a candidate.

```ts
const skinTx = await hiss.vaults.prepareCreatorSkinDeposit({ vault: publishTx.vault, amountUsdg });
// Once skin >= 5% is met on-chain, public deposits can open.
```

## What you did and didn't pay

| Step                         | Cost                                                      |
| ---------------------------- | --------------------------------------------------------- |
| Compose + validate candidate | 0 USDG                                                    |
| Publish on-chain             | 50 USDG creation fee (launch) + gas                       |
| Creator skin-in-game         | a deposit of ≥5% of the vault (your own funds, not a fee) |

## Next

- [Vault manifest](./vault-manifest.md) — the full schema.
- [Fees](../fees/vault-fees.md) — every fee, worked through.
- [Strategy updates](./strategy-updates.md) — changing the strategy later.
