# CLI

`@hiss-finance/cli` is a terminal client for HISS Finance: read protocol state,
validate manifests, and **prepare** transactions. Like the SDK, it **prepares only** —
it does not sign, broadcast, or hold keys.

> Packages are **not yet published to npm**. Run from the workspace after
> `pnpm build`.

## Running

```bash
pnpm --filter @hiss-finance/cli start <command> [options]
```

Common global options:

- `--network mainnet|testnet` (chain 4663 / 46630)
- `--rpc-url <url>` to override the default RPC
- `--json` for machine-readable output

## Commands

### status

Read deployments, readiness, staking, and reward state from chain.

```bash
pnpm --filter @hiss-finance/cli start status --network mainnet
pnpm --filter @hiss-finance/cli start status --json
```

### vault

```bash
# Read a vault (live share price, TVL, readiness)
pnpm --filter @hiss-finance/cli start vault read 0x6d962604df1c6c5ef4b59d88863600fe71bb63e6

# Validate a manifest file and print its hash
pnpm --filter @hiss-finance/cli start vault validate ./my-vault.manifest.json

# Preview fees for a manifest (performance-fee and protocol-share math)
pnpm --filter @hiss-finance/cli start vault fees ./my-vault.manifest.json

# Prepare an approve + deposit (prints unsigned transactions)
pnpm --filter @hiss-finance/cli start vault prepare-deposit \
  --vault 0x6d96...63e6 --depositor 0xYou --amount-usdg 1000
```

### stake

```bash
# Read xHISS staking state
pnpm --filter @hiss-finance/cli start stake status

# Prepare a stake / cooldown / redeem (unsigned)
pnpm --filter @hiss-finance/cli start stake prepare --staker 0xYou --amount-hiss 500
pnpm --filter @hiss-finance/cli start stake cooldown --staker 0xYou --x-shares 250
pnpm --filter @hiss-finance/cli start stake redeem --staker 0xYou --x-shares 250 --receiver 0xYou
```

### rewards

```bash
# Show the current 50/30/10/10 split plan (planned != funded != claimable)
pnpm --filter @hiss-finance/cli start rewards split
```

## Output and signing

`prepare-*` commands print **unsigned** transactions (with `--json`, structured
calldata). Sign and broadcast them with your own wallet or `cast send`. The CLI never
sends a transaction for you.

## Exit codes

- `0` success.
- Non-zero on any refusal — validation failure, unverified config, low-confidence
  classification, or hash mismatch. The CLI **fails closed**; a non-zero exit means
  "unknown/refused", not "safe to retry blindly".

## Related

- [SDK](./sdk.md) for programmatic use.
- [Vaults](./vaults/index.md) and [Fees](./fees/index.md) for what the commands act on.
