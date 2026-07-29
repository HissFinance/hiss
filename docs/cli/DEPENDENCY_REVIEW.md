# HISS CLI — Dependency Review (color / width / unicode)

> Agent 1 (architecture-auditor). Public `HissFinance/hiss` main
> `aa6a9d4d`. Recommendation for Agent 2 (renderer). Versions verified
> against the npm registry at audit time.

## Current state

The CLI has **zero** presentation dependencies today — no picocolors,
chalk, kleur, string-width, strip-ansi, cli-table, or ora. Runtime deps
are only `@hiss-finance/core` (workspace), `@hiss-finance/sdk` (workspace),
and `commander ^12.1.0`. The overhaul adds color/width capability; the goal
is the **smallest** dependency footprint that meets the contract, with a
**preference for a small internal renderer** over a TUI framework.

## Recommendation summary

| Concern                                  | Recommendation                                                                     | Add a dep?                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------- |
| Semantic color                           | **picocolors `1.1.1`** (exact)                                                     | **YES — the one runtime dep** |
| ANSI strip (for width + PLAIN sanitize)  | internal ~1-line regex helper                                                      | no (vendored)                 |
| Visible string width (ANSI + wide chars) | internal helper; escalate to `string-width` only if real CJK/emoji content appears | no (start internal)           |
| Unicode-support detection                | internal (env/locale/TTY, per contract §3)                                         | no                            |
| Tables / columns                         | internal `lib/table.ts`                                                            | no                            |
| Spinner / progress                       | internal, stderr-only, minimal                                                     | no                            |
| Full-screen TUI (Ink/blessed)            | **do NOT add** for ordinary commands                                               | no                            |

Net: **one** new production dependency (picocolors). Everything else is a
small internal renderer, consistent with the ruling.

## picocolors — the color dependency

| Field               | Value                                                      |
| ------------------- | ---------------------------------------------------------- |
| Recommended version | **`1.1.1`** (pin exact; it is the current latest)          |
| License             | **ISC** (permissive; compatible with the CLI's Apache-2.0) |
| Dependencies        | **none** (zero transitive)                                 |
| Unpacked size       | ~6.4 KB                                                    |
| Module format       | ships both CJS and ESM (works under this ESM package)      |
| Node compat         | Node ≥6; fine for `engines: >=18` and CI Node 26           |
| Advisories          | none known                                                 |

Why picocolors over chalk/kleur:

- Zero dependencies and ~6 KB — smallest maintained option; fastest cold
  start (matters for a "fast" CLI).
- Respects `NO_COLOR` / `FORCE_COLOR` conventions and lets us pass an
  explicit enable flag, so the renderer keeps full control of the §3
  precedence rather than the lib guessing. Agent 2 should construct
  picocolors with color **explicitly enabled/disabled from the resolved
  `OutputContext.color`**, not letting the library auto-detect — detection
  lives in `lib/capabilities.ts`, single-sourced.
- chalk v5 is ESM-only and heavier; kleur is fine but picocolors is
  smaller and the de-facto minimal choice.

Add to `packages/cli/package.json` `dependencies`:

```jsonc
"picocolors": "1.1.1"
```

(Exact pin — deterministic builds; Agent 5 bumps deliberately.)

## ANSI strip — internal, no dep

Needed to (a) compute visible width for alignment and (b) sanitize any
string before PLAIN output. A single well-known regex is sufficient and
avoids a dependency:

- Reference maintained lib: `strip-ansi 7.2.0` (MIT, dep `ansi-regex
^6.2.2`) — **ESM-only** in v7, pulls one transitive dep.
- **Recommendation:** vendor the ansi-regex pattern in `lib/width.ts`
  (well-documented, stable escape-sequence regex) rather than add
  strip-ansi + ansi-regex. If a maintenance concern is raised later,
  `strip-ansi 7.2.0` is the drop-in escalation.

## Visible string width — internal first

Correct width matters for table alignment and wrapping (contract §1
HUMAN). Two options:

- `string-width 8.2.2` (MIT) — deps: `get-east-asian-width ^1.5.0`,
  `strip-ansi ^7.1.2` (→ `ansi-regex`). **ESM-only.** Handles CJK
  full-width, zero-width joiners, and emoji correctly. ~3 transitive deps.
- **Internal `lib/width.ts`:** strip ANSI, count Unicode code points, add
  +1 for the East-Asian wide/fullwidth ranges. For HISS CLI content —
  0x addresses, hex hashes, USDG/HISS amounts, bps, ASCII labels — this is
  effectively exact; there is no CJK/emoji payload today.

**Recommendation:** ship the internal helper (keeps the dep count at 1).
Document `string-width 8.2.2` as the escalation IF a future command
renders user-supplied wide/emoji strings in aligned columns. Do not add it
speculatively.

## Unicode-support detection — internal

No dependency. Resolve per contract §3: `--unicode` flag → `TERM=dumb`
(ASCII) → UTF-8 locale (`LC_ALL`/`LC_CTYPE`/`LANG`) + TTY → else ASCII.
Lives in `lib/capabilities.ts` alongside color detection so all terminal
truth is single-sourced into the `OutputContext`.

## Explicitly rejected: full-screen TUI frameworks

Do **NOT** add Ink, react-blessed, blessed, or any full-screen TUI for
ordinary command coloring/tables. They bring React/reconciler runtimes,
large dep trees, alt-screen buffers, and interactivity the CLI does not
need, and they fight the "scriptable, pipeable, deterministic" ruling.

- If (and only if) an **optional** `hiss dashboard` command is later
  scoped as a live full-screen view, a TUI lib _may_ be justified — but it
  MUST be an **optional/lazy** dependency isolated to that one command,
  MUST NOT load for any other command, and MUST fall back to plain output
  when non-interactive. Flag the cost (dep tree, cold start, alt-screen)
  to the owner before adopting. Ordinary commands stay on the internal
  renderer + picocolors.

## commander

`commander ^12.1.0` is declared; latest is `15.0.0`. v12 is stable and
meets the contract (global options, `exitOverride`, `optsWithGlobals`).
**Upgrading is optional and out of scope for the renderer work** — if
Agent 5 chooses to bump, it is a separate, tested change; nothing in this
contract requires it.

## Footprint after the overhaul

Production deps: `@hiss-finance/core`, `@hiss-finance/sdk`, `commander`,
**`picocolors`** (new, zero transitive). That is the entire delta: **+1
direct dep, +0 transitive deps.** Everything else — width, strip, unicode
detection, tables, spinner — is a small internal renderer under
`packages/cli/src/lib/`.
