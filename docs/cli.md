# CLI

`@hiss-finance/cli` (bin: `hiss`) is a terminal client for HISS Finance: read
protocol state, validate manifests, inspect the hosted MCP server, and
**prepare** transactions. Like the SDK, it **prepares only** — it never signs,
broadcasts, holds keys, or requests a brokerage credential. Every prepared
transaction is `signed: false`; nothing is sent.

## Install & run

```bash
npm install -g @hiss-finance/cli
hiss <command> [options]
```

Requires Node.js >= 18. Published to npm with build provenance (`npm audit
signatures` verifies the attestation); or run without installing via
`npx @hiss-finance/cli <command>`.

> Contributors can run the in-repo build instead of the published package:
> `pnpm install` from the repo root, then
> `pnpm --filter @hiss-finance/cli start <command>` — the workspace equivalent of
> the `hiss <command>` short form used in the examples below.

Reads that hit the chain need `--rpc-url` (mainnet:
`https://rpc.mainnet.chain.robinhood.com`, testnet chain id `46630`). Local
commands (manifest validation, coil compile, receipt verify, skill list/print,
the `lp`/`agentic` informational reporters) work fully offline.

```bash
hiss --version          # 0.2.0
hiss --help             # top-level help, grouped by intent
hiss <group> --help     # per-group help
```

## Output modes

One global output system, resolved once per invocation.

| Mode      | Flag                         | What it is                                                                            |
| --------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| **human** | default (interactive)        | Rich, semantic color + Unicode box-drawing when the terminal supports it.             |
| **json**  | `--json` / `--output json`   | A stable JSON envelope on **stdout only** — never any ANSI. Diagnostics go to stderr. |
| **plain** | `--plain` / `--output plain` | Strict ASCII, no color, stable labels — for logs, screen readers, and dumb terminals. |

Precedence: `--json` and `--plain` are shorthands for `--output json|plain`;
`--output` also accepts `human`. Verbosity: `--quiet` prints only the one-line
summary; `--verbose` adds a diagnostic line to **stderr** (never stdout).

### Color and `NO_COLOR`

Color resolution (OUTPUT_CONTRACT §3):

- **json** and **plain** are **always** ANSI-free, under every flag.
- `--color never` disables color.
- `--color always` forces color — this is an explicit user override and wins
  even when `NO_COLOR` is set.
- Otherwise (`--color auto`, the default) color is on only for an interactive
  TTY, and the [`NO_COLOR`](https://no-color.org) environment variable (any
  value) disables it.

```bash
NO_COLOR=1 hiss status --rpc-url https://rpc.mainnet.chain.robinhood.com   # no ANSI
hiss vault list --plain          # ASCII, pipe/log friendly
hiss status --json | jq .data    # machine-readable, ANSI-free
```

Unicode/box-drawing follows the same `--unicode auto|always|never` policy;
`plain` is always ASCII.

## JSON envelope contract

With `--json`, stdout is a single JSON object. It is stable and safe to pipe
into `jq`. There are two shapes.

**Success / rendered result:**

```json
{
  "cliVersion": "0.2.0",
  "code": 0,
  "command": "lp status",
  "data": { "...": "the command payload" },
  "ok": true,
  "summary": "Stock-Premium LP manager HissLpManagerV1 is DEPLOYED_PAUSED on chain 4663."
}
```

- `ok` is `true` only when `code === 0`.
- `code` is the process exit code (see the taxonomy below); it is non-zero for
  business fail-closed outcomes (INVALID / FAILED / refusal / unknown).
- The command payload lives under **`data`** (see migration note below).

**Error / thrown fault:**

```json
{
  "cliVersion": "0.2.0",
  "code": 1,
  "error": { "code": 1, "kind": "general", "message": "…" },
  "ok": false
}
```

The error shape carries an `error` object instead of `data`/`summary`. Program
against `.ok` and `.code`; read `.data` on success and `.error` on failure.

## Exit codes

A stable 0–7 taxonomy (OUTPUT_CONTRACT §6). Scripts can branch on the exit code
without parsing text.

| Code | Kind         | Meaning                                                               |
| ---- | ------------ | --------------------------------------------------------------------- |
| `0`  | success      | Affirmative result: VALID / VERIFIED / prepared / read OK.            |
| `1`  | general      | Uncaught fault, guard trip, unknown internal error.                   |
| `2`  | usage        | Usage error, malformed input JSON, or a credential-shaped field.      |
| `3`  | config       | Missing/invalid `--rpc-url` or `--chain-id`, or a missing input file. |
| `4`  | network      | RPC / SDK / hosted-endpoint failure, timeout, degraded read.          |
| `5`  | policy       | Fail-closed **refusal** to prepare/compile (rule/fuse block).         |
| `6`  | verification | A verification that ran and returned **not valid** (INVALID/FAILED).  |
| `7`  | partial      | Outcome could not be fully determined (unknown / partial).            |

```bash
hiss vault validate ./vault.json ; echo "exit=$?"   # 0 if VALID, 6 if INVALID, 2 if bad JSON / credential field, 3 if file missing
```

## Command reference

Local (offline) commands are marked · chain-reading commands need `--rpc-url`.

### Protocol

```bash
hiss status --rpc-url https://rpc.mainnet.chain.robinhood.com   # compact protocol snapshot (chain read)
hiss contracts --json                                           # deployed contract registry (chain read)
hiss mcp status | hiss mcp tools | hiss mcp doctor              # inspect the hosted HISS MCP server
```

`hiss mcp doctor` runs every public probe and reports per-check verdicts:

```
HISS MCP doctor: all 3 checks pass at https://mcp.hiss.finance.
  PASS - GET /version (introspection)
  PASS - GET /healthz (liveness)
  PASS - GET /readyz (RPC + chain match)
```

### Vaults (USDG Creator Vaults)

```bash
hiss vault list                                   # list vaults + lifecycle state (chain read)
hiss vault inspect <addressOrSlug>                # inspect one vault (chain read)
hiss vault holdings <address>                     # live holdings (chain read)
hiss vault performance <address>                  # point-in-time performance — not a forecast (chain read)
hiss vault validate <manifest>                    # · validate a manifest (VALID→0, INVALID→6)
hiss vault prepare-create <manifest>              # prepare unsigned creation tx (refusal→5)
hiss vault prepare-deposit <vault> <amount>       # prepare unsigned USDG deposit tx
hiss vault prepare-withdraw <vault> <shares>      # prepare unsigned withdrawal tx
```

`vault validate` fails closed. A valid manifest prints its summary and exits 0;
a manifest with a credential-shaped field is **refused** (exit 2):

```
hiss: HISS never accepts credentials. Remove these fields: privateKey. HISS reads state and prepares unsigned transactions only.
```

### Staking (xHISS)

```bash
hiss stake status                # read xHISS staking state (chain read)
hiss stake prepare <amount>      # prepare unsigned HISS stake tx
hiss stake cooldown <xhissAmt>   # prepare unsigned cooldown tx
# HISS never sends: every stake command READs or PREPAREs an unsigned tx.
hiss stake redeem                # prepare unsigned redeem tx
```

Staking output always renders the required framing verbatim: `Not a performance
claim.` · `Historical fee distributions are not forecasts.` · `No known
unresolved Critical or High findings after internal launch review.`

### Rewards (read-only)

```bash
hiss rewards status                    # planned != funded != claimable (chain read)
hiss rewards contributor <address>     # vault-contributor reward status
hiss rewards provider <groupId>        # provider reward status
```

### CoilOps

```bash
hiss coil validate <manifest>    # · validate a coil manifest (INVALID→6)
hiss coil compile <manifest>     # · compile to a deterministic plan (refusal→5)
```

Compile emits a plan (a deterministic hash) and a **binding** risk-fuse
coverage table — never an order:

```
Compiled coil "Momentum Demo Coil" — hash 0xe13bbf82…b73a0. This is a plan, not an executed order.
…
| This is a plan (a deterministic hash), not an order. Risk fuses are binding
| and may never be bypassed.
```

An invalid manifest is refused (exit 5), listing each issue.

### Receipts

```bash
hiss receipt verify <receiptPathOrInlineJson>   # · recompute + compare integrity hash (FAILED→6)
```

A hash mismatch reports `FAILED` and exits 6 — the CLI never asserts a receipt
is valid without recomputing it.

### Stock-Premium LP

```bash
hiss lp status | hiss lp fees                         # · canonical LP manager record + immutable fee policy
hiss lp scan | hiss lp pools | hiss lp positions      # · UNKNOWN in this public build (exit 7)
hiss lp position <id>
hiss lp prepare-mint | prepare-collect | prepare-close  # · unavailable in this build
```

`HissLpManagerV1` is launched **paused/inert**; `scan`/`pools`/`positions`
honestly report `UNKNOWN` (exit 7) rather than fabricate state.

### Agentic (informational) & Skills

```bash
hiss agentic status|setup|coils|grants|receipts   # · control-plane orientation (no credential request)
hiss skill list                                   # · list bundled agent skill packs
hiss skill print <skill>                          # · print a pack's SKILL.md (not-found→7)
```

## Signing & the execution boundary

`prepare-*` commands print an **unsigned** transaction (with `--json`,
structured calldata). Sign and broadcast with your own wallet, Safe, or
`cast send`. HISS reads and prepares only: it never signs, submits, holds keys,
or requests a brokerage credential. Brokerage execution is entirely user-side.

## Troubleshooting

- **A chain read errors or hangs.** Supply a reachable `--rpc-url`
  (mainnet `https://rpc.mainnet.chain.robinhood.com`). Offline commands
  (validate, compile, receipt verify, skill, lp/agentic reporters) need no RPC.
- **`exit 2` on a manifest.** The input is malformed JSON or contains a
  credential-shaped field (`privateKey`, `mnemonic`, `apiKey`, …) — remove it;
  HISS never accepts credentials.
- **`exit 3`.** A missing input file, or an absent/invalid `--rpc-url` /
  `--chain-id`.
- **`exit 5` vs `exit 6`.** `5` is a fail-closed _refusal_ to prepare/compile
  (a rule/fuse blocked it); `6` is a verification that ran and returned
  _not valid_ (INVALID/FAILED).
- **`exit 7`.** The result is genuinely unknown/partial in this build (e.g.
  `lp scan`) — treat it as "unknown", never "safe to proceed".
- **Color in a pipe or CI.** Piped output is non-interactive, so `human` mode
  drops color automatically; use `--plain` for stable ASCII or `--json` for a
  machine envelope. Set `NO_COLOR=1` to disable color globally.
- **A secret ended up in output.** Output is redacted defense-in-depth — an
  `--rpc-url` carrying `user:pass@` userinfo is masked to `[redacted]` in the
  `--verbose` diagnostic and any rendered line. Report anything that is not.

## Reference & internals

Design and audit records for the CLI (engineering docs):

- [Command inventory](./cli/COMMAND_INVENTORY.md) — the full command tree,
  handlers, and the exit-code baseline.
- [Output contract](./cli/OUTPUT_CONTRACT.md) — modes, color/Unicode
  resolution, the JSON envelope, and the exit taxonomy in full.
- [Architecture audit](./cli/ARCHITECTURE_AUDIT.md) — the render seam and
  output centralization.
- [Dependency review](./cli/DEPENDENCY_REVIEW.md) — the (deliberately minimal)
  dependency posture.

## Related

- [SDK](./sdk.md) for programmatic use.
- [Vaults](./vaults/index.md) and [Fees](./fees/index.md) for what the commands act on.
