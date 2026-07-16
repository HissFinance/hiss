# Summary

<!-- What does this PR change and why? Keep it concise. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Build / CI / tooling
- [ ] Refactor (no behavior change)

## Checklist

- [ ] `pnpm install --frozen-lockfile` succeeds
- [ ] `pnpm format:check` and `pnpm lint` pass
- [ ] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass
- [ ] `pnpm schemas:validate` and `pnpm docs:check` pass
- [ ] Guards pass: `pnpm check:private-boundary`, `pnpm check:execution-claims`,
      `pnpm check:fee-docs`, `pnpm check:secrets`, `pnpm licenses:check`
- [ ] No secrets, private paths, private handles, or production credentials added
- [ ] Any execution claim in docs/tools carries a receipt/verification qualifier
- [ ] Fee figures match the canonical constants table

## Notes for reviewers

<!-- Anything reviewers should focus on, or context that helps the review. -->
