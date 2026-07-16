# create-vault-candidate

Assembles a basket manifest **candidate** in memory using `@hiss-finance/core`
(`slugify`, `deterministicId`, and the `HissBasketManifest` type). Nothing is
deployed or signed.

## Run

```bash
pnpm --filter @hiss-finance/example-create-vault-candidate start
```

## Expected output

```
Candidate slug: sample-semiconductor-basket
Deterministic id: <hash>
Assets: 3, total weight 10000 bps
Status: draft (not deployed, not live, confers no ownership).

{ ...full manifest JSON... }
```

A candidate is a draft. The referenced tickers are illustrative — Stock-Token
availability is not universal, and creating a live vault is a separate,
user-signed, gated action. See [validate-vault-manifest](../validate-vault-manifest)
to check a candidate.
