# read-flagship-vault

Reads the flagship HISS vault's summary and target weights via
`@hiss-finance/sdk`. Read-only.

## Run

```bash
pnpm --filter @hiss-finance/example-read-flagship-vault start
```

## Expected output

```
Vault:    HISS Flagship Vault
Address:  0x6d962604df1c6c5ef4b59d88863600fe71bb63e6 (chain 4663)
Asset:    USDG
Deposits: open
Read:     live
Holdings (target weights):
  - ...      ..%
```

Deposit state and holdings are live reads; the exact values depend on chain
state at run time. Depositing is not direct ownership of the underlying
securities.
