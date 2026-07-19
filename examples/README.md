# HISS Finance examples

Small, self-contained examples for the public HISS Finance packages. Each
example is its own workspace package with a README, runnable code, and expected
output.

| Example                                              | What it shows                                     | Packages              |
| ---------------------------------------------------- | ------------------------------------------------- | --------------------- |
| [read-protocol-status](./read-protocol-status)       | Read chain + contract directory                   | `@hiss-finance/sdk`   |
| [read-flagship-vault](./read-flagship-vault)         | Read one vault's summary/holdings                 | `@hiss-finance/sdk`   |
| [read-vault-performance](./read-vault-performance)   | Read observed performance (honest empty handling) | `@hiss-finance/sdk`   |
| [read-reward-status](./read-reward-status)           | Read reward-split legs + lifecycle state          | `@hiss-finance/sdk`   |
| [validate-vault-manifest](./validate-vault-manifest) | Validate a basket manifest                        | `@hiss-finance/core`  |
| [create-vault-candidate](./create-vault-candidate)   | Build a candidate manifest + slug                 | `@hiss-finance/core`  |
| [prepare-vault-deposit](./prepare-vault-deposit)     | Build an unsigned deposit plan                    | `@hiss-finance/react` |
| [prepare-vault-creation](./prepare-vault-creation)   | Build an unsigned vault-creation plan             | `@hiss-finance/react` |
| [stake-hiss](./stake-hiss)                           | Build an unsigned stake plan + xHISS timing       | `@hiss-finance/react` |
| [verify-receipt](./verify-receipt)                   | Recompute + verify a paper receipt hash           | `@hiss-finance/core`  |
| [react-vault-dashboard](./react-vault-dashboard)     | A React dashboard with hooks + components         | `@hiss-finance/react` |
| [mcp-agent](./mcp-agent)                             | A read-only MCP server exposing HISS tools        | `@hiss-finance/sdk`   |

## Honesty rules these examples follow

- **Nothing here executes a transaction.** "Plan" outputs describe a transaction
  a user _may_ choose to sign in their own wallet. Signing and broadcasting are
  always the user's responsibility.
- **Stock-Tokens are not universally available.** Availability, eligibility, and
  jurisdiction rules apply and are read live.
- **Depositing is not direct share ownership.** Vaults are compilation/settlement
  software; they do not confer ownership of underlying securities.
- **No guaranteed rewards.** Reward legs may be planned, funded, or not
  deployed. Nothing implies yield, APY, or income. The current split is HISS
  Reward Method V2 (50/15/15/10/10: xHISS stakers / Vault Providers / Vault
  Contributors / Treasury / economic burn to the dead address `0x…dEaD`, which
  leaves circulation without reducing `HISS.totalSupply`).
- **The HISS website and first-party app tools are free.** No subscriptions, no
  credits, no paywalls; these packages are open-source (Apache-2.0). You keep
  signing control — HISS prepares and verifies, your own wallet or Safe signs
  and submits. Normal network gas and contract-enforced protocol fees may still
  apply (they are on-chain, not HISS subscriptions). x402 services, where
  configured, are separate machine-to-machine agent rails.

## Running

From the monorepo root, after installing and building the workspace packages:

```bash
pnpm install
pnpm --filter @hiss-finance/example-read-protocol-status start
```

Read examples accept an optional `HISS_RPC_URL` (see each `.env.example`); they
default to the public Robinhood Chain endpoint.
