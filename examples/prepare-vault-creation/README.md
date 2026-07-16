# prepare-vault-creation

Builds an **unsigned** vault-creation plan with `@hiss-finance/react`'s pure
`buildVaultCreatePlan`, including weight validation (must sum to 10000 bps).

## Run

```bash
pnpm --filter @hiss-finance/example-prepare-vault-creation start
```

## Expected output

```
Plan:     Create vault candidate "Sample Tech Basket"
Executed: false
Step:     Submit a vault-creation transaction for slug "sample-tech-basket" with 3 weighted positions.
Notes:
  - This is a candidate manifest. Creation is subject to on-chain registry checks and eligibility rules.
  - You sign this transaction in your own wallet. This library never sends transactions.
```

The referenced tickers are illustrative. Stock-Token availability and
eligibility are not universal and are enforced on-chain.
