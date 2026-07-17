# AGENTS.md — guidance for AI agents and contributors

This file orients automated agents and contributors working in this repository.

## What this repository is

`HissFinance/hiss` is the **public, open-source HISS repository**: the SDK,
public interfaces, contract ABIs, schemas, examples, agent skills, CLI and MCP
interfaces, and developer/user documentation.

**This is not the production application.** It does not contain the deployed
`hiss.finance` frontend, production APIs, production database configuration, or
internal operations tooling.

## Boundaries (do not cross)

- **No secrets.** Never commit credentials, API keys, private tokens, cookies,
  session tokens, or private RPC URLs. Local environment files are gitignored and
  must stay out of version control; `pnpm check:secrets` gates this.
- **No private implementation.** Do not add production application source,
  internal operations code, or proprietary components not deliberately approved
  for open-source release.
- **No autonomous production executor.** Public SDK and agent tooling follow a
  **prepare / read / simulate / verify** model. They may *prepare* transactions,
  but must not contain autonomous production-execution credentials or internal
  transaction automation.
- **No copying from private sources.** Private/internal content may not be copied
  into this repository without an explicit, sanitized export review.

## Required checks

Before opening a PR, run the repository's checks and make them pass:

```bash
pnpm install --frozen-lockfile
pnpm check:all   # schemas:validate, docs:check, check:private-boundary,
                 # check:execution-claims, check:fee-docs, check:secrets, licenses:check
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

`pnpm check:all` is the umbrella gate — it must pass for any change.

## Addresses and generated files

- Public protocol addresses and deployment snapshots must come from **verified
  on-chain state** and the **approved generated artifacts** — never hand-typed or
  guessed.
- Generated files must be produced by their generators; do not hand-edit generated
  output. Re-run the generator and commit the result.

## Contributing

See `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`. Keep changes
focused, documented, and covered by the checks above.
