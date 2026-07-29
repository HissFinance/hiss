# HISS CLI — Output Contract (the spec Agents 2 & 3 implement)

> Agent 1 (architecture-auditor). Normative. Public
> `HissFinance/hiss` main `aa6a9d4d`. This is **the** contract for the
> renderer (Agent 2) and command migration (Agent 3); Agent 4 tests
> against it; Agent 5 gates on it. Where this document says MUST, it is a
> release-blocking requirement.

Design ruling (fixed): the CLI must feel like the CLI for "the Agentic
Trading Control Plane for Robinhood" — precise, compact, fast, readable,
colorful **only when appropriate**, plain when required, deterministic,
scriptable, accessible, truthful. Color is **semantic, never decorative**.
Never claim a read/prepare/submit/settle state that isn't verified (the
existing execution-claim guard stays authoritative and runs on all human
text).

---

## 1. Three output modes

Exactly three modes. Every command renders through one.

### HUMAN (default, interactive)

- Semantic color **when the terminal supports it and it is enabled**
  (see §3). Colors carry meaning only: success/ok, warning, error,
  muted/secondary, accent/heading, address, numeric/amount. No rainbow,
  no per-word coloring, no emoji walls, no novelty animation. A spinner
  is permitted **only** on stderr for genuinely long reads and MUST be
  suppressed when non-interactive (§3, §4).
- Unicode box-drawing / symbols **when supported** (§3); ASCII fallback
  otherwise. Width-aware: tables and wrapping respect the detected
  terminal width; content never causes horizontal overflow garbage.
- Hyperlinks (OSC 8) **only** when the terminal advertises support;
  otherwise print the bare URL.
- Layout: one-line `summary` first, then indented `detail`. Tables for
  columnar data (registry, vault list, holdings). Compact and scannable.

### JSON (`--json` / `--output json`)

- **stdout MUST be valid JSON and nothing else.** No ANSI, no spinner, no
  banner, no prose, no progress. A consumer MUST be able to
  `hiss … --json | jq` with zero preprocessing.
- Stable schema (§2). Diagnostics, warnings, progress, and errors go to
  **stderr** (§4), never into the stdout JSON.
- **bigint and chain-scale integers MUST be serialized as strings**
  (wei values, token amounts, share counts, block numbers). Never emit a
  JS `number` that could exceed 2^53 or lose precision. Use a canonical
  serializer, not raw `JSON.stringify` (which throws on `bigint`).
- Deterministic key ordering (canonical) so output diffs cleanly and
  golden-snapshots are stable.
- `--color always` MUST NOT contaminate JSON — JSON never carries ANSI
  under any flag combination (§3, hard rule).

### PLAIN (`--plain` / `--output plain`)

- Human-readable text, **no ANSI**, **no Unicode requirement** (ASCII
  only), **stable labels**. This is the accessibility / dumb-terminal /
  log-friendly mode: `TERM=dumb`, screen readers, `NO_COLOR` maximalists,
  and greppable logs. Labels (`Network:`, `Chain:`, `To:`, …) are stable
  identifiers Agent 4 can assert on. Same information as HUMAN, minus
  color and box-drawing.

> `quiet` and `verbose` are **verbosity levels**, orthogonal to mode (see
> §5). Today's `quiet` (summary-only) becomes `--quiet` applied within
> HUMAN/PLAIN. The legacy `"quiet"` `OutputMode` value is folded into
> verbosity; do not keep it as a fourth mode.

---

## 2. JSON schema envelope (stable)

Current behavior emits raw `result.data` with no envelope, and the shape
differs per command (array vs object). Target: a **stable top-level
envelope** that wraps the existing payload without breaking it.

```jsonc
{
  "ok": true, // boolean — false for fail-closed/business failure
  "code": 0, // integer — the process exit code (§6)
  "command": "vault validate", // canonical command path
  "cliVersion": "0.1.0",
  "summary": "Vault manifest VALID (vault-manifest-1.0.0).",
  "data": {/* the existing per-command payload, unchanged in shape */},
  "warnings": [], // array of strings; may be omitted when empty
}
```

Rules:

- `data` keeps today's per-command shape (so existing scripts that read
  `data` after unwrapping keep working). Migration note: consumers move
  from top-level to `.data`. Agent 3 documents this in `--help`/release
  notes.
- `ok`/`code` make fail-closed outcomes machine-detectable (fixes the
  "everything is exit 0 / no failure signal in JSON" defect).
- Errors render as a JSON envelope too (§4): `ok:false`, `code:<n>`,
  `error:{ code, message, kind }`, emitted to **stderr** for `--json`
  (stdout stays clean/empty on hard error) — see §4.
- `bigint`/large integers inside `data` are strings (§1 JSON).

---

## 3. Global flags, color/unicode env, and PRECEDENCE

### Flags (preserve all existing; add the rest)

| Flag                  | Values                        | Meaning                                        |
| --------------------- | ----------------------------- | ---------------------------------------------- |
| `--output <mode>`     | `human` \| `json` \| `plain`  | select mode explicitly                         |
| `--json`              | —                             | shorthand for `--output json` (kept; existing) |
| `--plain`             | —                             | shorthand for `--output plain`                 |
| `--color <when>`      | `auto` \| `always` \| `never` | color policy                                   |
| `--unicode <when>`    | `auto` \| `always` \| `never` | Unicode/box-drawing policy                     |
| `--quiet`             | —                             | verbosity: summary only (kept; existing)       |
| `--verbose`           | —                             | verbosity: extra diagnostic detail to stderr   |
| `--rpc-url <url>`     | —                             | existing; unchanged                            |
| `--chain-id <id>`     | —                             | existing; unchanged                            |
| `--version`, `--help` | —                             | existing commander built-ins; exit 0           |

### Mode precedence (highest wins) — MUST be implemented exactly

1. `--json` (explicit shorthand) →
2. `--output <mode>` →
3. `--plain` (shorthand) →
4. environment (`HISS_OUTPUT` if adopted; otherwise none) →
5. terminal detection (non-TTY stdout defaults toward machine-plain
   posture, but **not** JSON — absence of a flag never silently produces
   JSON) →
6. default = **HUMAN**.

Conflicting explicit flags (e.g. `--json --plain`) resolve by this order
(`--json` wins) rather than erroring, so scripts are robust; document the
resolution in `--help`.

### Color resolution (§6 color env) — precedence, highest wins

1. `--color never` → color **OFF** (always, unconditional).
2. `--color always` → color **ON for HUMAN only**. It MUST NOT enable
   color in JSON or PLAIN, and MUST NOT put ANSI into a piped JSON stream.
3. `NO_COLOR` present (any value, per the NO_COLOR standard) → color OFF.
4. `--color auto` (default) / no flag →
   a. `FORCE_COLOR` (`1/2/3/true`) → ON; `FORCE_COLOR=0` → OFF.
   b. `TERM=dumb` → OFF (and PLAIN posture).
   c. stdout is not a TTY (piped/redirected) → OFF.
   d. CI detected (`CI` env) → OFF by default (stable, non-colored logs)
   unless `FORCE_COLOR` explicitly opts in.
   e. otherwise TTY with a capable `TERM` → ON.

Hard invariants:

- **Mode JSON ⇒ color OFF, always**, regardless of `--color always`/`FORCE_COLOR`.
- **`NO_COLOR` and `--color never` are absolute** for HUMAN/PLAIN.
- Piped output (`| cat`, `| jq`, file redirect) is always usable: no ANSI
  leaks, no cursor control, no spinner residue.

### Unicode resolution — precedence, highest wins

1. `--unicode never` → ASCII only.
2. `--unicode always` → Unicode allowed (HUMAN only; PLAIN stays ASCII).
3. `--unicode auto` / none →
   a. `TERM=dumb` → ASCII.
   b. locale is UTF-8 (`LC_ALL`/`LC_CTYPE`/`LANG` contains `UTF-8`/`utf8`)
   and stdout is a TTY → Unicode allowed.
   c. otherwise → ASCII.

- PLAIN mode is ASCII regardless of `--unicode`.
- JSON content is UTF-8 JSON text (data), independent of the box-drawing
  Unicode toggle.

---

## 4. stdout / stderr contract (§9)

| Stream     | Carries                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| **stdout** | the primary requested output only: HUMAN/PLAIN rendered result, or the JSON envelope. Nothing else.     |
| **stderr** | progress/spinners, warnings, retry/backoff notices, `--verbose` diagnostics, debug, and error messages. |

Rules (MUST):

- In `--json`, stdout is parseable JSON with **zero** non-JSON bytes;
  warnings never mix into stdout; spinners/progress never write to stdout
  and never overwrite piped output.
- Spinners/progress and any cursor control are stderr-only **and** only
  when stderr is a TTY and mode is HUMAN; suppressed for PLAIN, JSON,
  non-TTY, CI, `TERM=dumb`.
- On a hard error:
  - HUMAN/PLAIN → human error line to **stderr** (`hiss: <message>`),
    stdout empty, process exit = mapped code (§6).
  - JSON → a JSON error envelope (`{ok:false, code, error:{…}}`) to
    **stderr**; stdout stays empty (a consumer that only reads stdout sees
    nothing and checks the exit code; a consumer that captures stderr gets
    structured detail). This keeps "stdout is either valid result-JSON or
    empty" true.
- The execution-claim guard (`assertNoExecutionClaim`) runs on every
  human/plain string (summary + detail + warnings + error text). A guard
  trip is an internal fault → exit `1` (general), never a silent downgrade.

---

## 5. Verbosity (orthogonal to mode)

| Level   | Flag        | HUMAN/PLAIN behavior                                                                                                                                     |
| ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| quiet   | `--quiet`   | summary line only; no `detail`; no spinner                                                                                                               |
| normal  | (default)   | summary + detail                                                                                                                                         |
| verbose | `--verbose` | summary + detail + extra diagnostics to **stderr** (timing, rpc endpoint, chain id, retry notes). Never adds noise to stdout; never affects JSON `data`. |

`--quiet` + `--verbose` together: `--verbose` wins for stderr diagnostics,
`--quiet` still trims stdout to the summary. In JSON mode both are inert on
`data` (verbosity never changes the JSON payload shape); `--verbose` may
add stderr diagnostics only.

---

## 6. Exit codes (§16) — stable taxonomy

### Baseline (MUST be recorded before change — for Agent 4 regression)

Today only **two** codes occur: `0` (any rendered result, incl. business
INVALID/FAILED, plus help/version) and `1` (any thrown error + all
commander usage errors). See `COMMAND_INVENTORY.md` §Exit-code baseline.
**Business fail-closed outcomes currently exit 0** — that is the defect
this section fixes.

### Target stable set

| Code | Name                             | When                                                                                                                                                             |
| ---- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | success                          | command completed; result is affirmative (VALID, VERIFIED, prepared, read OK)                                                                                    |
| 1    | general error                    | unexpected/uncaught fault, guard trip, unknown internal error                                                                                                    |
| 2    | invalid input / usage            | commander usage errors (unknown command, missing/excess arg, unknown option), malformed JSON input, credential-shaped field rejected (`CredentialRejectedError`) |
| 3    | config failure                   | missing/invalid rpc-url or chain-id, unreadable/missing input **file** (ENOENT), no skills dir when one was required                                             |
| 4    | dependency / network degradation | RPC/SDK network failure, timeout, `@hiss-finance/sdk` method not implemented, degraded read                                                                      |
| 5    | policy / fuse block              | a fail-closed **refusal** to prepare/compile due to a rule/fuse: `vault prepare-create` refusal on INVALID manifest, `coil compile` `CoilCompileError` refusal   |
| 6    | verification failure             | a verification that ran and returned **not-valid**: `vault validate` INVALID, `coil validate` INVALID, `receipt verify` FAILED                                   |
| 7    | partial / unknown outcome        | outcome could not be fully determined: degraded/last-verified read surfaced as unknown, `skill print` not-found, partial list                                    |

### Mapping (per current surfaces)

- `vault validate` INVALID → **6** (was 0). VALID → 0.
- `coil validate` INVALID → **6** (was 0). VALID → 0.
- `coil compile` `CoilCompileError` refusal → **5** (was 0). success → 0.
- `vault prepare-create` refusal on INVALID → **5** (was 0). prepared → 0.
- `receipt verify` FAILED → **6** (was 0). VERIFIED → 0.
- `skill print` not-found → **7** (was 0). found → 0. `skill list`
  no-dir → **3** if a dir was required, else 0 with empty list (keep 0 —
  "no skills found" is a valid answer, not an error).
- missing input file → **3** (was 1). malformed JSON → **2** (was 1).
- `assertNoCredentials` reject → **2** (was 1).
- commander usage errors → **2** (was 1).
- SDK/RPC failure → **4** (was 1).
- `--help`/`--version` → **0** (unchanged).

### Implementation & migration notes (Agent 3 + Agent 4)

- Add a typed error taxonomy (`lib/exit.ts`): an error class carrying an
  exit code, plus a mapping from `CommandResult` fail-closed states to
  codes. Fail-closed _results_ (that today return a `CommandResult`
  without throwing) need a signal: recommended is an optional
  `exitCode?: number` (or `ok:false` + `severity`) on `CommandResult`, set
  by the handler, read by `runCli`. Do **not** turn business failures into
  thrown exceptions if that would change the rendered human output — keep
  the same rendered result, just carry the code.
- `runCli` maps: resolved result → its `exitCode ?? 0`; thrown typed error
  → its code; thrown untyped error → 1; commander error → 2 (override
  commander's default 1 for usage). Preserve help/version → 0.
- **This is a behavior change.** Agent 4 MUST land a regression matrix
  that (a) captures the baseline {0,1} table first, then (b) asserts the
  new per-command codes. Agent 5 gates on that matrix being green.
- **Do NOT collapse all failures to 1** and do NOT change any code without
  a matrix row justifying it.

---

## 7. Semantic color palette (HUMAN only)

Small, meaning-bound token set (Agent 2 maps to picocolors). No other
colors.

| Token    | Use                                                           | Suggested picocolors                                            |
| -------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| `ok`     | VALID / VERIFIED / success summary                            | green                                                           |
| `warn`   | non-fatal caveats, "planned ≠ funded", degraded/last-verified | yellow                                                          |
| `err`    | INVALID / FAILED / refusal / error                            | red                                                             |
| `muted`  | labels, secondary detail, notes                               | dim / gray                                                      |
| `accent` | headings, command names                                       | cyan/bold                                                       |
| `addr`   | 0x addresses                                                  | (muted mono; no rainbow)                                        |
| `num`    | amounts / bps / hashes                                        | default weight; never colored by sign in a way that implies P&L |

Rules: never color to imply performance/gain/loss (no green "profit" / red
"loss" framing — that would read as a performance claim). Color reflects
**state validity**, not value. When color is OFF, meaning is still carried
by the stable words (VALID/INVALID/FAILED/VERIFIED) and PLAIN labels.

---

## 8. The OutputContext object (§8) — every command receives it

Injectable, deterministic, the single source of terminal truth. No
component reads `process.stdout`/`process.env`/`isTTY`/`Date.now`
independently — they read the context.

```ts
export interface OutputContext {
  mode: "human" | "json" | "plain";
  color: boolean; // resolved (§3)
  unicode: boolean; // resolved (§3)
  width: number; // resolved terminal columns (fallback 80)
  verbosity: "quiet" | "normal" | "verbose";
  interactive: boolean; // stdout AND stderr are TTYs (spinners allowed)
  stdout: (chunk: string) => void; // writer, not the raw stream
  stderr: (chunk: string) => void;
  clock: () => Date; // injectable for deterministic tests
  redact: (s: string) => string; // redaction policy hook (defense-in-depth)
}
```

- Built once in `cli.ts` from resolved flags + env + capability detection
  (`lib/capabilities.ts`), then passed to the renderer (and, where a
  handler needs width/verbosity, to the handler). Tests construct a fake
  context with fixed `width`, `color:false`, a frozen `clock`, and
  capturing `stdout`/`stderr` buffers — no process globals, fully
  deterministic.
- `redact` is a defense-in-depth hook: even though inputs are guarded by
  `assertNoCredentials`, any string that could echo user input passes
  through `redact` before printing.
- `clock` exists so timestamped/verbose output is reproducible in golden
  tests.

---

## 9. Preserved invariants (do not regress)

- Read-and-prepare only. No signing/submission/custody/keys ever.
- `assertNoExecutionClaim` on all human/plain strings; `assertNoCredentials`
  on all file/JSON inputs. Guard behavior is **frozen** — do not widen an
  exemption to make copy pass; fix the copy.
- Required staking copy lines rendered verbatim (see inventory ¹).
- All command `summary` strings and their truthful wording
  ("Prepared an UNSIGNED …. Nothing was sent.", "planned ≠ funded ≠
  claimable", "Not a forecast; not a performance claim.") are preserved by
  Agent 3 — the overhaul changes _presentation_, never the truth claims.
- Boundary clean (see `ARCHITECTURE_AUDIT.md` §5).
