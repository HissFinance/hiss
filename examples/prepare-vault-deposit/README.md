# prepare-vault-deposit

**LEGACY EXAMPLE — for existing V1 integrations only. New deposits should
target Vault V2.** The canonical deposit example is
[prepare-vault-deposit-v2](../prepare-vault-deposit-v2) (queue-routed V2
deposits via `@hiss-finance/sdk`).

Builds an **unsigned** V1-style vault deposit plan with `@hiss-finance/react`'s
pure `buildVaultDepositPlan`. No wallet, no network, no execution. The V1
flagship vault is **closed to new deposits**, so the plan carries a
legacy/closed warning and would revert if signed and submitted.

## Run

```bash
pnpm --filter @hiss-finance/example-prepare-vault-deposit start
```

## Expected output

```
Plan:      Deposit into HISS vault
Signed:    no (requiresSignature=true)
Executed:  false
Step:      Approve USDG spend for the vault, then deposit 100000000000000000000 base units.
           chain 4663, to 0x6d962604df1c6c5ef4b59d88863600fe71bb63e6
Notes:
  - Deposit availability is a live on-chain read; confirm the vault is open before signing.
  - You sign this transaction in your own wallet. This library never sends transactions.
```

The plan is a description only. Depositing is not direct ownership of the
underlying securities, and you must sign the transaction yourself.
