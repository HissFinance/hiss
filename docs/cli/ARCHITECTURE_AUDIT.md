# HISS CLI — Architecture Audit (baseline + refactor targets)

> Agent 1 (architecture-auditor). Public `HissFinance/hiss` main
> `aa6a9d4d`. Companion to `COMMAND_INVENTORY.md`, `OUTPUT_CONTRACT.md`,
> `DEPENDENCY_REVIEW.md`. Read-only audit — no runtime code is rewritten
> here; this specifies what Agent 2 (renderer) and Agent 3 (commands)
> implement.

## 1. Current architecture (as-built)

```
bin/hiss.ts        # shebang entry: runCli(argv) → sets process.exitCode
  └─ cli.ts        # commander wiring; buildProgram() + runCli()
       ├─ lib/client.ts      # ONLY importer of @hiss-finance/sdk; builds HissClient
       ├─ lib/types.ts       # HissClient interface (read + prepare), UnsignedTx
       ├─ commands/*.ts      # pure handlers: (client,args) → Promise<CommandResult>
       └─ lib/output.ts      # render(result, mode, printer) — the single sink
            ├─ lib/guard.ts        # assertNoExecutionClaim (last-line copy guard)
            └─ lib/credentials.ts  # assertNoCredentials (input guard)
       (+ lib/validate.ts, coil.ts, receipt.ts, hash.ts, validate helpers)
```

Design strengths already present (preserve these):

- **Pure-handler pattern.** Every command is a pure async function
  returning `CommandResult`; it does no I/O to the terminal. Rendering is
  fully separated. This is exactly the shape the new context-object
  contract needs — it generalizes cleanly.
- **Single output sink.** `render()` is the only formatter. Zero
  `console.*` in `src/`. Only raw writers: `consolePrinter`
  (`output.ts:27`), the two fatal paths (`cli.ts:265`, `bin/hiss.ts:14`),
  and commander's internal help/version writer.
- **Injection seam for tests.** `BuildOptions.makeClient` and
  `onResult` already let a test drive `buildProgram` with a mock client
  and capture results without touching stdout. Underused, but present.
- **Transport isolation.** `client.ts` is the sole `@hiss-finance/sdk`
  importer; handlers depend only on the `HissClient` shape.
- **Two safety guards.** Output-side `assertNoExecutionClaim` (blocks
  false completion claims) and input-side `assertNoCredentials` (rejects
  key/seed/token-shaped fields).

## 2. The output seam — detailed

`CommandResult` (`output.ts:11`):

```ts
interface CommandResult {
  summary: string; // one line, guard-checked
  data: unknown; // structured payload; printed verbatim in --json
  detail?: string[]; // extra human lines, each guard-checked
  receiptVerified?: boolean; // relaxes the execution-claim guard
}
```

`render(result, mode, printer)`:

- `mode === "json"` → `printer.out(JSON.stringify(result.data, null, 2))`
  and **returns before the guard runs**. JSON is `data` only — `summary`
  and `detail` are dropped in JSON mode.
- otherwise → `assertNoExecutionClaim(summary)` then every `detail` line;
  `quiet` prints only `summary`; `human` prints `summary` + indented
  `detail`.

### Seam weaknesses to refactor (for Agent 2)

1. **No color / width / Unicode awareness anywhere.** `render` emits
   plain `string + "\n"`. There is no capability detection, no terminal
   width, no semantic color, no table alignment, no link support. This is
   the core of the overhaul: introduce the **OutputContext** (see
   `OUTPUT_CONTRACT.md` §Context object) and pass it into rendering.
2. **`data` is the only JSON payload; `summary`/`detail` are human-only.**
   That is actually good for a clean JSON contract, but the JSON has **no
   stable envelope** (no `ok`, `code`, `schema`, `version` fields) — a
   scripter gets whatever `data` happens to be, which differs per command
   and is sometimes an array, sometimes an object. `OUTPUT_CONTRACT.md`
   §JSON specifies a stable envelope Agent 2 must add without breaking the
   existing `data` shape (nest it under `data`).
3. **bigint / precision.** `data` is `JSON.stringify`-d directly. Any
   `bigint` in a payload would throw (`TypeError`); large numbers passed
   as JS `number` silently lose precision. The contract mandates
   **bigint/large-integer as strings**; Agent 2 needs a canonical
   serializer (reuse `lib/hash.ts:canonicalize` philosophy) rather than
   raw `JSON.stringify`.
4. **The guard runs only on `summary`/`detail`, never on `data`.** Correct
   today (JSON is machine data), but note it: any future human string that
   originates from `data` must be routed through the guard.
5. **Mode is a bare enum with only 3 values** (`human|json|quiet`). The
   contract adds `plain` and reframes `quiet`/`verbose` as _verbosity_
   orthogonal to _mode_. `render`'s signature must widen to accept the
   context, not a bare mode.
6. **`consolePrinter` reads no globals** — good, but it is constructed at
   module load. Under the new contract the printer/streams come from the
   context, so no component reads `process.stdout`/`process.env`/`isTTY`
   independently. Today only `output.ts` and the two fatal paths touch
   process streams; keep that invariant and route them through the
   context too (fatal errors currently bypass the context — acceptable,
   but they must still honor `--json` by emitting a JSON error envelope to
   stderr; see §Errors in `OUTPUT_CONTRACT.md`).

## 3. Error / exit path

- `bin/hiss.ts`: `runCli` resolves an exit code → `process.exitCode`; a
  thrown rejection → stderr `hiss: <msg>` + exit 1.
- `cli.ts:runCli` uses `program.exitOverride()` so commander throws
  instead of calling `process.exit`. Help/version codes → 0; everything
  else → stderr + (`exitCode` or 1).
- **Every failure collapses to exit 1, and every rendered result
  (including business INVALID/FAILED) is exit 0.** See
  `COMMAND_INVENTORY.md` §Exit-code baseline. This is the single biggest
  behavioral defect for a "deterministic, scriptable" CLI and is the
  subject of the exit-code section of the contract. Fix requires: (a) a
  typed error taxonomy that carries an exit code, (b) fail-closed
  _results_ signalling a non-zero code (e.g. a `code` field on
  `CommandResult` or a thrown typed error for INVALID verdicts), and (c)
  `runCli` mapping both to the 0–7 set. **Do not** collapse all failures
  to 1; **do not** silently change 0→non-zero without the regression
  matrix Agent 4 owns.

## 4. What must be refactored (scope handoff to Agent 2/3)

| Area                 | Current                               | Target                                                                                                                                                                  | Owner                                |
| -------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Capability detection | none                                  | `OutputContext` (color/unicode/width/tty/verbosity/streams/clock/redaction) built once in `cli.ts`, injected                                                            | A2 builds primitive, A1 specs        |
| Renderer             | `render()` 3-mode string concat       | context-aware renderer: HUMAN (semantic color, Unicode, width-aware tables, links), JSON (stable envelope, bigint-as-string, stdout-only), PLAIN (ASCII, stable labels) | A2                                   |
| Global flags         | `--json --quiet --rpc-url --chain-id` | + `--output --plain --color --unicode --verbose`; documented precedence                                                                                                 | A2 (parse) → A3 (per-command wiring) |
| Exit codes           | {0,1} only; business fails = 0        | stable 0–7 set; typed error taxonomy                                                                                                                                    | A3 (emit) + A4 (regress)             |
| JSON payload         | raw `JSON.stringify(data)`            | canonical serializer; stable envelope; diagnostics→stderr                                                                                                               | A2                                   |
| Commands             | 22 handlers return `CommandResult`    | unchanged handler purity; adopt context + typed fail-closed codes; **no behavior/copy change to summaries**                                                             | A3                                   |
| Tests                | 8 cases, no in-process CLI drive      | full mode × command × exit matrix via `buildProgram` injection                                                                                                          | A4                                   |
| Color/width libs     | none                                  | picocolors (+ internal width/strip); see `DEPENDENCY_REVIEW.md`                                                                                                         | A2                                   |

**Handler purity is the load-bearing invariant.** Agent 3 must keep every
command a pure `(ctx, client, …args) → CommandResult` (or typed error) and
must NOT move rendering, color, or width logic into a command. All
presentation stays in the renderer.

## 5. Boundary confirmation (§29 — public repo)

Scanned `packages/cli/src` + `package.json` for the private-boundary
tokens (OpenClaw, Bankr API key / Keychain, operator EOA
`0x403bad…`/`0x80c61255…`, Safe-signature coordination, private crons,
local host/mirror paths, internal deployment automation):

**Result: the current CLI is boundary-clean.** No hits. The CLI is
read-and-prepare only, imports only the public `@hiss-finance/sdk` and
`@hiss-finance/core`, and never references signing, submission,
credentials-at-rest, or operator identity. The existing guards
(`assertNoExecutionClaim`, `assertNoCredentials`) actively enforce two
facets of the boundary.

**Boundary rule for Agents 3 & 5 (carry forward):**

- No new command, help string, error message, example, or JSON field may
  name OpenClaw, private cron/scheduler internals, the operator/Bankr EOA
  or its Keychain storage, Safe multisig signature coordination, private
  alert channels, internal deployment automation, or any local host/mirror
  path (`/Users/…`).
- The CLI must never gain a `--private-key`, `--mnemonic`, `--sign`, or
  `--submit` flag, an env var that reads a secret, or any code path that
  broadcasts. `assertNoCredentials` must remain wired on every file/JSON
  input command (`vault validate/prepare-create`, `coil validate/compile`).
- Color/renderer work introduces **no** network, telemetry, or analytics
  calls. The renderer must not phone home.
- Agent 5 (release) must run a boundary + secret scan on the diff before
  tagging, and confirm `files` ships only `dist` + `LICENSE`.

## 6. Recommended file-ownership map (Agents 2–5)

Foundation (this agent, DONE): `docs/cli/**` (4 docs).

| Path                                                                                  | Owner                                                               | Note                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/lib/context.ts` (**new**)                                           | **A2**                                                              | builds/holds `OutputContext`; sole reader of `process.env`/`isTTY`/`process.std*`                             |
| `packages/cli/src/lib/capabilities.ts` (**new**)                                      | **A2**                                                              | color/unicode/width/CI/TTY detection + flag+env precedence resolver                                           |
| `packages/cli/src/lib/color.ts` (**new**)                                             | **A2**                                                              | picocolors wrapper; semantic tokens (ok/warn/err/muted/accent/addr/num); no-op when disabled                  |
| `packages/cli/src/lib/width.ts` (**new**)                                             | **A2**                                                              | ANSI-strip + visible-width + wrap/pad/truncate (internal; see dep review)                                     |
| `packages/cli/src/lib/table.ts` (**new**)                                             | **A2**                                                              | width-aware key/value + columnar renderer                                                                     |
| `packages/cli/src/lib/output.ts`                                                      | **A2**                                                              | rewrite `render` to consume `OutputContext`; add HUMAN/JSON/PLAIN; canonical JSON envelope + bigint-as-string |
| `packages/cli/src/lib/exit.ts` (**new**)                                              | **A3**                                                              | exit-code taxonomy + typed errors (see contract §Exit codes)                                                  |
| `packages/cli/src/cli.ts`                                                             | **A3**                                                              | add global flags, build context, map results/errors → exit codes; keep handler wiring                         |
| `packages/cli/src/bin/hiss.ts`                                                        | **A3**                                                              | honor context for the fatal path (JSON error envelope when `--json`)                                          |
| `packages/cli/src/commands/*.ts`                                                      | **A3**                                                              | thread `ctx`; emit typed fail-closed codes; **preserve summaries/copy**                                       |
| `packages/cli/src/lib/{guard,credentials,validate,coil,receipt,hash,types,client}.ts` | shared, **change-minimal**                                          | A2/A3 read; edits only if contract requires (e.g. bigint helper). Guards' behavior frozen.                    |
| `packages/cli/test/**`                                                                | **A4**                                                              | mode × command × exit matrix; capability/precedence unit tests; golden JSON/PLAIN snapshots                   |
| `packages/cli/package.json`                                                           | **A2** (add picocolors) / **A5** (version, publish config, prepack) | A2 adds the one runtime dep; A5 owns release metadata                                                         |
| release gate / CI                                                                     | **A5**                                                              | build+pack verify, boundary+secret scan, exit-code regression green                                           |

**Conflict-avoidance:** A2 works almost entirely in **new** `lib/*.ts`
files + `output.ts`; A3 works in `cli.ts` + `commands/*` + new `exit.ts`.
The only shared file both touch is `output.ts` (A2 owns) and `cli.ts` (A3
owns) — A3 consumes A2's `OutputContext` type, so A2's context/renderer
type surface should land first (that is the sequential dependency the lane
order already encodes).
