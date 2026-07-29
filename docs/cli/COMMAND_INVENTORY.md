# HISS CLI — Command Inventory (baseline)

> Read-only inventory of the `hiss` CLI as it exists on public
> `HissFinance/hiss` main `aa6a9d4d` (worktree branch
> `feature/cli-world-class-terminal`). Authored by Agent 1
> (architecture-auditor). This is a **baseline** record — the current
> surface Agents 2–4 must preserve, not a target.

## Package facts

| Field                      | Value                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical repo             | **public** `HissFinance/hiss` only — no private mirror (the private monorepo carries no `packages/cli` and no `@hiss-finance/cli` dependent) |
| Public main SHA            | `aa6a9d4d2db296597be708aa03b363d9cf0c92e3`                                                                                                   |
| Package name               | `@hiss-finance/cli`                                                                                                                          |
| Version                    | `0.1.0`                                                                                                                                      |
| Bin                        | `hiss` → `dist/bin/hiss.js`                                                                                                                  |
| CLI framework              | `commander` `^12.1.0` (latest published is 15.0.0; **not** currently on latest)                                                              |
| Module type                | ESM (`"type": "module"`)                                                                                                                     |
| Node engines               | `>=18` (dev/CI here runs Node 26)                                                                                                            |
| Package manager            | pnpm (`10.28.1`), turbo monorepo                                                                                                             |
| Build entry                | `tsc -p tsconfig.json` → `dist/`; run entry `src/bin/hiss.ts` (`start` = `tsx src/bin/hiss.ts`)                                              |
| Runtime deps               | `@hiss-finance/core` (workspace), `@hiss-finance/sdk` (workspace), `commander`                                                               |
| Color / width / table deps | **none** — no picocolors, chalk, kleur, string-width, strip-ansi, cli-table, ora                                                             |

## Output seam (one-line summary)

Every command handler is a pure function returning a `CommandResult`
(`summary`, `data`, `detail?`, `receiptVerified?`). `cli.ts` calls
`render(result, mode)` (`lib/output.ts`). `render` is the single sink; the
only raw writers are `consolePrinter` (inside `output.ts`), the two fatal
error paths (`cli.ts:265`, `bin/hiss.ts:14`), and commander's own
help/version writer. **Confirmed: zero `console.*` in `src/`; output is
centralized.** Full seam analysis in `ARCHITECTURE_AUDIT.md`.

## Global options (current)

Declared on the root program in `cli.ts`:

| Flag              | Effect                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `--json`          | `outputMode → "json"` — prints `JSON.stringify(result.data, null, 2)` |
| `--quiet`         | `outputMode → "quiet"` — prints only `summary`                        |
| `--rpc-url <url>` | JSON-RPC endpoint (falls back to `HISS_RPC_URL`)                      |
| `--chain-id <id>` | chain id (default 4663)                                               |
| `--version`       | commander built-in → prints `0.1.0`, exit 0                           |
| `--help` / `-h`   | commander built-in → prints help, exit 0                              |

There is **no** `--output`, `--plain`, `--color`, `--unicode`, or
`--verbose` today. Mode precedence today is only: `--json` beats
`--quiet` beats human (`outputMode()` in `cli.ts:48`). Env is read only
for `--rpc-url`/`HISS_RPC_URL`. See `OUTPUT_CONTRACT.md` for the target
flag set and precedence.

## Full command tree

Legend — **Class**: READ (chain/SDK read) · PREPARE (emits unsigned tx) ·
LOCAL (no network) · META (help/skill). **Exit** column is the _observed
baseline_ (see exit-code section below): `0` = renders a result, `1` =
throws/usage error.

### Top-level

| Command          | Args / opts | Class | Handler            | Output (summary + detail)                                                                     | Exit                |
| ---------------- | ----------- | ----- | ------------------ | --------------------------------------------------------------------------------------------- | ------------------- |
| `hiss status`    | —           | READ  | `statusCommand`    | `HISS Finance status read from <network>.` + Network/Chain/Token/Vaults tracked/Treasury Safe | 0 / 1 on read error |
| `hiss contracts` | —           | READ  | `contractsCommand` | `Contract registry: N entr(y/ies).` + `name: addr` per entry                                  | 0 / 1               |

### `hiss vault …` (USDG Creator Vault)

| Subcommand                                | Args          | Class   | Handler                       | Output                                                                                                                                                   | Exit                                                                            |
| ----------------------------------------- | ------------- | ------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `vault list`                              | —             | READ    | `vaultListCommand`            | `N vaults on Robinhood Chain.` + `slug — address`                                                                                                        | 0 / 1                                                                           |
| `vault inspect <addressOrSlug>`           | ref           | READ    | `vaultInspectCommand`         | `Vault <slug> inspected.` + Name/Address/Base asset/`Deposits: read live on chain`                                                                       | 0 / 1                                                                           |
| `vault holdings <address>`                | addr          | READ    | `vaultHoldingsCommand`        | `Holdings read for vault <addr>.` + live-read source line                                                                                                | 0 / 1                                                                           |
| `vault performance <address>`             | addr          | READ    | `vaultPerformanceCommand`     | `Historical performance read … Not a forecast; not a performance claim.`                                                                                 | 0 / 1                                                                           |
| `vault create`                            | —             | LOCAL   | `vaultCreateCommand`          | key-free two-step flow description                                                                                                                       | 0                                                                               |
| `vault validate <manifest>`               | path          | LOCAL   | `vaultValidateCommand`        | `Vault manifest VALID (schema).` **or** `… INVALID: N issue(s).` + per-issue lines                                                                       | **0 even when INVALID**; 1 if file missing / bad JSON / credential-shaped field |
| `vault prepare-create <manifest>`         | path          | PREPARE | `vaultPrepareCreateCommand`   | INVALID → `Refusing to prepare…`; VALID → `Prepared an UNSIGNED vault-creation transaction. Nothing was sent.` + Chain/To/Value/Calldata/unsigned notice | 0 (incl. refusal); 1 on file/JSON/credential/SDK error                          |
| `vault prepare-deposit <vault> <amount>`  | vault, amount | PREPARE | `vaultPrepareDepositCommand`  | `Prepared an UNSIGNED deposit of <amt> USDG to <vault>. Nothing was sent.` + tx detail                                                                   | 0 / 1                                                                           |
| `vault prepare-withdraw <vault> <shares>` | vault, shares | PREPARE | `vaultPrepareWithdrawCommand` | `Prepared an UNSIGNED withdrawal of <shares> shares from <vault>. Nothing was sent.` + tx detail                                                         | 0 / 1                                                                           |

### `hiss` staking subcommands (xHISS)

| Subcommand                     | Args   | Class   | Handler                | Output                                                                                            | Exit  |
| ------------------------------ | ------ | ------- | ---------------------- | ------------------------------------------------------------------------------------------------- | ----- |
| `stake status`                 | —      | READ    | `stakeStatusCommand`   | `xHISS staking status read.` + vault/asset/cooldown + three required copy lines¹                  | 0 / 1 |
| `stake prepare <amount>`       | amount | PREPARE | `stakePrepareCommand`  | `Prepared an UNSIGNED stake of <amt> HISS. Nothing was sent.` + tx detail                         | 0 / 1 |
| `stake cooldown <xhissAmount>` | amount | PREPARE | `stakeCooldownCommand` | `Prepared an UNSIGNED cooldown for <amt> xHISS. Nothing was sent.` + tx detail                    | 0 / 1 |
| `stake redeem`                 | —      | PREPARE | `stakeRedeemCommand`   | `Prepared an UNSIGNED xHISS redeem within your open redeem window. Nothing was sent.` + tx detail | 0 / 1 |

¹ Required staking lines rendered verbatim: `Not a performance claim.` ·
`Historical fee distributions are not forecasts.` · `No known unresolved
Critical or High findings after internal launch review.`

### `hiss rewards …` (read-only reporters)

| Subcommand                      | Args    | Class | Handler                     | Output                                                                                 | Exit  |
| ------------------------------- | ------- | ----- | --------------------------- | -------------------------------------------------------------------------------------- | ----- |
| `rewards status`                | —       | READ  | `rewardsStatusCommand`      | `Reward status read.` + `planned ≠ funded ≠ claimable` note                            | 0 / 1 |
| `rewards contributor <address>` | address | READ  | `rewardsContributorCommand` | `Vault-contributor reward status read for <addr>.` + null-recipient note + reward note | 0 / 1 |
| `rewards provider <groupId>`    | groupId | READ  | `rewardsProviderCommand`    | `Provider reward status read for group <id>.` + facts-only note                        | 0 / 1 |

### `hiss coil …` (local CoilOps)

| Subcommand                 | Args | Class | Handler               | Output                                                                                                                | Exit                                                                               |
| -------------------------- | ---- | ----- | --------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `coil validate <manifest>` | path | LOCAL | `coilValidateCommand` | `Coil manifest VALID (schema).` **or** `… INVALID: N issue(s).` + per-issue                                           | **0 even when INVALID**; 1 on file/JSON/credential error                           |
| `coil compile <manifest>`  | path | LOCAL | `coilCompileCommand`  | `Compiled coil "<name>" — hash <h>. This is a plan, not an executed order.` **or** `Refusing to compile: … INVALID …` | **0** (incl. `CoilCompileError` → refusal result); 1 on file/JSON/credential error |

### `hiss receipt …`

| Subcommand                 | Args                      | Class | Handler                | Output                                                                                                                                                       | Exit                                         |
| -------------------------- | ------------------------- | ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `receipt verify <receipt>` | path or inline `{…}` JSON | LOCAL | `receiptVerifyCommand` | `Receipt integrity VERIFIED[ (on-chain confirmed)].` **or** `Receipt verification FAILED: N issue(s).` — sets `receiptVerified` only when `onchainConfirmed` | **0 even when FAILED**; 1 on file/JSON error |

### `hiss skill …`

| Subcommand            | Args | Class | Handler             | Output                                                                    | Exit                      |
| --------------------- | ---- | ----- | ------------------- | ------------------------------------------------------------------------- | ------------------------- |
| `skill list`          | —    | META  | `skillListCommand`  | `N skill pack(s) found.` + names — or `No skills directory found …`       | 0                         |
| `skill print <skill>` | name | META  | `skillPrintCommand` | `Skill pack "<n>" (<b> bytes).` + content — or not-found / no-dir message | **0 even when not found** |

## Exit-code baseline (critical finding)

Derived from `runCli` (`cli.ts:249`) + `bin/hiss.ts`. Deps were not
installed in the audit worktree, so this is authoritative from source, not
a live run (a live run failed only on `ERR_MODULE_NOT_FOUND` for the
un-installed `commander`, which is environmental, not behavioral).

**Only two exit codes exist today: `0` and `1`.**

- Success (any command that returns a `CommandResult` and renders) → **0**.
- `--help`, `--version`, and commander help short-circuits
  (`commander.helpDisplayed` / `commander.version` / `commander.help`) →
  **0**.
- Thrown errors caught by `runCli` → **1** (or the commander error's own
  `exitCode` if numeric and non-zero, which for stock commander usage
  errors is `1`). Sources of `1`:
  - missing manifest/receipt file (`ENOENT` from `readFile`),
  - malformed JSON (`SyntaxError` from `JSON.parse`),
  - `CredentialRejectedError` (credential-shaped field in input),
  - `ExecutionClaimError` (guard trip in `render` on human/quiet output),
  - SDK / network / RPC failure, `"…does not implement <method>"`,
  - commander usage errors: unknown command, missing argument, unknown
    option, excess arguments.

**The bug to fix (migration note for Agent 3/4):** _business_ fail-closed
outcomes currently exit **0** — `vault validate` INVALID, `coil validate`
INVALID, `coil compile` refusal, `receipt verify` FAILED, `vault
prepare-create` refusal, `skill print` not-found, `skill list`/`skill
print` no-dir. A caller cannot distinguish "valid" from "invalid" by exit
status; everything that renders is `0`. `OUTPUT_CONTRACT.md` §Exit codes
assigns these to non-zero codes (2 usage, 5 policy/fuse, 6 verification, 7
partial/unknown) — this is a **behavior change** and must be regression-
guarded by Agent 4.

## Current test coverage baseline

`packages/cli/test/` — 3 files, **8 `it()` cases**, vitest:

- `guard.test.ts` (3): blocks unqualified claims, tolerates negations,
  permits claim only with `receiptVerified`.
- `status.test.ts` (2): `statusCommand` snapshot + no-claim; `contractsCommand`.
- `validate.test.ts` (3): valid manifest, invalid manifest codes, fee bounds.

**Untested surface (gap list for Agent 4):** every `prepare-*` command,
`coil validate/compile`, `receipt verify`, `skill list/print`, `stake *`,
`rewards *`, `vault list/inspect/holdings/performance`, the `render()`
sink itself (all three modes), `runCli` exit codes, and the credential
guard end-to-end. No test drives `buildProgram`/`runCli` in-process today
(the `BuildOptions.makeClient`/`onResult` injection seam exists but is
unused by tests).

## Distribution status

- `package.json` `files: ["dist","LICENSE"]`; `bin` points at
  `dist/bin/hiss.js`. **Not yet published** (v0.1.0, no evidence of an npm
  release). Build is `tsc`; no bundler, no shebang-injection step beyond
  the `#!/usr/bin/env node` already in `bin/hiss.ts`.
- No `dist/` committed (correct). No `prepublishOnly`/`prepack` script —
  a release gate (Agent 5) should add build + pack verification.
