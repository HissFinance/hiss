# validate-vault-manifest

Runs `@hiss-finance/core`'s `validateBasketManifest` over a manifest and prints
the issues. The sample manifest is deliberately over-weighted (weights sum to
11000 bps) so you can see a validation error.

## Run

```bash
pnpm --filter @hiss-finance/example-validate-vault-manifest start
```

## Expected output

```
Valid: false
Issues:
  [error] <weight-sum-code>: weights must sum to 10000 bps ...
```

The exact issue codes come from `@hiss-finance/core`. Validation is fail-closed:
any `error` means the manifest is not eligible to proceed. The process exits
non-zero when invalid. Fix the weights to `6000 + 4000` to see a clean pass.
