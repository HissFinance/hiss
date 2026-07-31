# @hiss-finance/cli

`hiss` — the read-and-prepare command-line interface for HISS Finance on
Robinhood Chain. It reads protocol state and builds **unsigned** transactions.
It never signs, submits, holds keys, or requests a brokerage credential.

## Install

```bash
npm install -g @hiss-finance/cli
hiss <command> [options]
```

Requires Node.js >= 18. Published with build provenance (`npm audit signatures`
verifies the attestation). Or run without installing: `npx @hiss-finance/cli
<command>`. Contributors can run the in-repo build instead:
`pnpm install && pnpm --filter @hiss-finance/cli start <command>`.

## Highlights

- **One output system:** `human` (default), `--json`, and `--plain`.
  `json`/`plain` are always ANSI-free; `human` uses semantic color + Unicode
  only on a capable interactive TTY. Respects [`NO_COLOR`](https://no-color.org).
- **Stable exit codes `0–7`:** `0` success · `1` general · `2` usage · `3`
  config · `4` network · `5` policy/refusal · `6` verification-failed · `7`
  partial/unknown. Business fail-closed outcomes exit non-zero.
- **Stable JSON envelope:** `{ cliVersion, code, command, data, ok, summary }`
  on success (payload under `.data`); `{ cliVersion, code, error, ok:false }`
  on a fault. Diagnostics go to stderr; stdout stays clean and pipeable.
- **Read + prepare only.** Every prepared transaction is `signed: false`.

## Commands

`status` · `contracts` · `vault …` · `stake …` · `rewards …` · `coil …` ·
`receipt verify` · `lp …` · `mcp status|tools|doctor` · `agentic …` ·
`skill list|print`. Run `hiss --help` (grouped by intent) or `hiss <group>
--help`.

## Documentation

Full guide, output modes, JSON contract, exit codes, troubleshooting, and
truthful examples: [docs/cli.md](../../docs/cli.md).

## License

Apache-2.0. See [LICENSE](./LICENSE).
