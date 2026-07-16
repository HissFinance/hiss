# Agent skills

Skill packs under [`skills/`](../skills) bundle instructions and tool references so an
agent can carry out a HISS workflow end to end — while staying inside the **prepare,
never execute** boundary. They pair with the [MCP tools](./mcp.md), [x402
endpoints](./x402.md), and [Bankr rails](./bankrbot.md).

## What a skill pack is

A skill pack is a self-contained set of guidance (a `SKILL.md`-style document plus
supporting references) describing:

- **When to use it** — the trigger and the goal.
- **Which tools to call** — the MCP tools / endpoints, in order.
- **The guardrails** — what the agent must never do (execute, custody, promise
  returns, bypass jurisdiction gates).
- **The output** — the artifact or unsigned transaction it produces for a human/wallet
  to sign.

## Representative packs

| Skill          | What it helps an agent do                                                         |
| -------------- | --------------------------------------------------------------------------------- |
| Vault creation | Compose and validate a manifest, preview fees, and prepare a publish transaction. |
| xHISS staking  | Read staking status and prepare stake / cooldown / redeem transactions.           |
| Reward split   | Explain and read the 50/30/10/10 split and epoch lifecycle honestly.              |
| Safe admin     | Describe and prepare 2-of-3 Treasury Safe actions (authorization only).           |
| CoilOps        | Compile, validate, score, and audit rebalance policies.                           |

The exact set installed in a repository is the source of truth — browse `skills/`.

## Universal guardrails (every pack enforces)

- **Prepare, never execute.** Produce unsigned transactions and artifacts; never claim
  an order was placed or funds moved.
- **No custody or keys.** Never request, accept, or store a private key, seed, or API
  secret.
- **Honest status and copy.** No guaranteed yield, APY, passive income, risk-free, or
  external-audit claims. Unknown is unknown; "live" needs proof. Include the required
  staking lines where staking is shown.
- **Planned ≠ funded ≠ vesting ≠ claimable.** Never imply an unfunded/undeployed leg
  is claimable.
- **Region awareness.** Bankr and Robinhood-MCP rails are limited-rollout and
  jurisdiction-gated; never assume universal availability.
- **Fail closed.** Missing artifact, low-confidence classification, or missing
  authorization → refuse.

## Using a pack with an agent

1. Point your agent at the [MCP server](./mcp.md).
2. Load the relevant skill pack as context/instructions.
3. Let the agent read → score → **prepare**.
4. A human or the user's wallet **signs**. The agent never closes that loop.

## Building your own

Follow the pattern above: state the trigger and goal, list the tools in order, encode
the guardrails verbatim, and describe the signed-by-the-user output. Keep any status
language evidence-based, and never widen a guardrail to make copy "pass" — fix the
copy. See [CONTRIBUTING.md](../CONTRIBUTING.md).
