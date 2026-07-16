# read-vault-performance

Reads a vault's observed performance points via `@hiss-finance/sdk` and prints a
summary. Demonstrates honest empty-series handling.

## Run

```bash
pnpm --filter @hiss-finance/example-read-vault-performance start
```

## Expected output

When history exists:

```
Vault:  0x6d962604df1c6c5ef4b59d88863600fe71bb63e6
Read:   live
Points: 30
First:  2026-06-16T00:00:00.000Z -> 1.0000
Last:   2026-07-16T00:00:00.000Z -> 1.0000
Note: past performance is not a forecast.
```

When there is no observed history:

```
Vault:  0x6d962604df1c6c5ef4b59d88863600fe71bb63e6
Read:   unknown
Performance: no observed history available (not a flat line — simply no data).
```
