# Contributing to HISS Finance

Thanks for your interest in improving HISS Finance. This repository holds the open
SDK, smart-contract interfaces, and documentation for creator-run vaults, staking,
rewards, and agent rails on Robinhood Chain. Contributions of all sizes are
welcome — fixes, tests, docs, examples, and well-scoped features.

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Ground rules

HISS is safety-critical financial software. A few principles are non-negotiable:

1. **Honesty in copy and status.** Never claim guaranteed yield, APY, passive
   income, risk-free returns, or an external audit. A failed read is `unknown`,
   never "live" and never "not deployed". Negative claims need affirmative
   evidence.
2. **Prepare, never execute.** SDK/CLI/MCP code builds transactions and artifacts
   for the user to sign. Do not add code that broadcasts on a user's behalf, holds
   keys, or takes custody.
3. **Fail closed.** Missing artifacts, low-confidence classifications, absent
   authorization, or hash mismatches must refuse — not guess.
4. **No secrets in the repo.** Keys, RPC credentials, and API tokens are referenced
   by environment-variable **name** only. Never commit a value.
5. **On-chain state is the source of truth.** Do not hardcode balances or "live"
   status; read the chain.

## Getting set up

Requirements: **Node.js 20+**, **pnpm 9+**, and (for contracts)
[Foundry](https://book.getfoundry.sh/).

```bash
git clone https://github.com/hiss-finance/hiss-finance.git
cd hiss-finance
pnpm install
pnpm build
pnpm test
```

For Solidity work:

```bash
cd contracts
forge build
forge test
```

## Development workflow

1. **Open an issue first** for anything non-trivial, so we can agree on the
   approach before you invest time.
2. **Branch** from `main` (e.g. `fix/manifest-hash-edge-case`).
3. **Write tests.** New behavior needs unit or property tests; bug fixes need a
   regression test. Pure math (fees, rewards, vesting) must stay deterministic.
4. **Keep changes focused.** One logical change per pull request.
5. **Run the full gate locally** before pushing:
   ```bash
   pnpm typecheck
   pnpm test
   pnpm build
   ```
6. **Update docs** in the same PR when you change behavior, a fee constant, or a
   public interface.

## Commit and PR conventions

- Use clear, imperative commit subjects. [Conventional Commits](https://www.conventionalcommits.org/)
  prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) are appreciated.
- Describe **what** and **why** in the PR body, link the issue, and note any
  user-facing or on-chain impact.
- Sign off that your contribution is your own work and licensed under Apache-2.0
  (see below).
- Ensure CI is green. PRs that lower coverage of safety-critical math or weaken a
  copy/secret guard will be asked for changes.

## What makes a great contribution

- A failing test that reproduces a bug, plus the fix.
- Docs that make a trust boundary or a fee/reward parameter clearer, with the exact
  value and where it is verifiable.
- New examples under `examples/` that are self-contained and read-only or
  prepare-only.
- Additional test vectors for fee, reward-split, share-seconds, or vesting math.

## What we will not accept

- Anything that adds execution, custody, or key handling on the user's behalf.
- Copy that promises returns, implies an external audit, or hides a fee.
- Widening a guard exemption to make copy or a check "pass" — fix the copy instead.
- Committed secrets, private endpoints, or personal data.

## Licensing of contributions

Unless you state otherwise in writing, every contribution you submit is licensed
under the [Apache License 2.0](./LICENSE), the same license as this project. You
confirm you have the right to contribute the work. See the "Submission of
Contributions" section of the license for details.

## Questions

Open a discussion or a non-sensitive issue. For anything security-related, follow
[SECURITY.md](./SECURITY.md) — never file a public issue for a vulnerability.
