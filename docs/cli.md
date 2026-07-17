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

- `--rpc-url <url>` — the Robinhood Chain JSON-RPC endpoint to read from
- `--chain-id <id>` — chain id (default `4663`; testnet is `46630`)
- `--json` for machine-readable output, `--quiet` for a one-line summary

Reads that hit the chain need `--rpc-url` (mainnet:
`https://rpc.mainnet.chain.robinhood.com`). Local commands (validation, hashing,
coil compile, receipt verify) work offline.

## Commands

### status / contracts

Read protocol state and the deployed contract registry from chain.

```bash
pnpm --filter @hiss-finance/cli start status --rpc-url https://rpc.mainnet.chain.robinhood.com
pnpm --filter @hiss-finance/cli start contracts --json
```

### vault

```bash
# List vaults / inspect one (live share price, readiness)
pnpm --filter @hiss-finance/cli start vault list
pnpm --filter @hiss-finance/cli start vault inspect 0x6d962604df1c6c5ef4b59d88863600fe71bb63e6

# Read live holdings and historical performance (not a forecast)
pnpm --filter @hiss-finance/cli start vault holdings 0x6d962604df1c6c5ef4b59d88863600fe71bb63e6
pnpm --filter @hiss-finance/cli start vault performance 0x6d962604df1c6c5ef4b59d88863600fe71bb63e6

# Validate a manifest file and print its hash (offline)
pnpm --filter @hiss-finance/cli start vault validate ./my-vault.manifest.json

# Prepare unsigned transactions (creation / deposit / withdrawal)
pnpm --filter @hiss-finance/cli start vault prepare-create ./my-vault.manifest.json
pnpm --filter @hiss-finance/cli start vault prepare-deposit 0x6d962604df1c6c5ef4b59d88863600fe71bb63e6 1000
pnpm --filter @hiss-finance/cli start vault prepare-withdraw 0x6d962604df1c6c5ef4b59d88863600fe71bb63e6 250
```

### stake

```bash
# Read xHISS staking state
pnpm --filter @hiss-finance/cli start stake status

# Prepare a stake / cooldown / redeem (unsigned; amounts are positional)
pnpm --filter @hiss-finance/cli start stake prepare 500
pnpm --filter @hiss-finance/cli start stake cooldown 250
pnpm --filter @hiss-finance/cli start stake redeem
```

### rewards / coil / receipt / skill

```bash
# Read reward status (planned != funded != claimable)
pnpm --filter @hiss-finance/cli start rewards status

# Validate / compile a CoilOps playbook (local, deterministic)
pnpm --filter @hiss-finance/cli start coil validate ./my-coil.json
pnpm --filter @hiss-finance/cli start coil compile ./my-coil.json

# Verify a receipt's integrity hash (path or inline JSON)
pnpm --filter @hiss-finance/cli start receipt verify ./receipt.json

# List and print the bundled agent skill packs
pnpm --filter @hiss-finance/cli start skill list
pnpm --filter @hiss-finance/cli start skill print hiss-vault-agent-kit
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
