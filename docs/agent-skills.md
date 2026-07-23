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

## The packs

Nineteen packs ship under [`skills/`](../skills). The filesystem is always the source of
truth — `npx skills add HissFinance/hiss --list` prints the live set. The machine-readable
[`skills/skill-catalog.json`](../skills/skill-catalog.json) enumerates every pack with its
safety metadata (`write_risk`, `runtime_requirement`, required capability families).

**Core packs**

| Skill                                                                   | What it helps an agent do                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [hiss-vault-agent-kit](../skills/hiss-vault-agent-kit/SKILL.md)         | Discover/read vaults, create a candidate, prepare deposits/withdrawals, verify receipts.         |
| [hiss-coilops](../skills/hiss-coilops/SKILL.md)                         | Turn a thesis into a bounded, versioned Coil — generate, validate, score, compile.               |
| [hiss-staking](../skills/hiss-staking/SKILL.md)                         | Read xHISS status and prepare stake / cooldown / redeem transactions.                            |
| [hiss-rewards](../skills/hiss-rewards/SKILL.md)                         | Explain and verify the 50/15/15/10/10 split (incl. economic burn); planned ≠ funded ≠ claimable. |
| [hiss-receipts](../skills/hiss-receipts/SKILL.md)                       | Write and verify canonical-JSON receipts; reject forged execution claims.                        |
| [hiss-risk-fuses](../skills/hiss-risk-fuses/SKILL.md)                   | Audit the binding risk fuses and explain compile failures.                                       |
| [hiss-stock-tokens](../skills/hiss-stock-tokens/SKILL.md)               | Prepare/validate/reconcile Bankr trades of the 15 canonical stock tokens.                        |
| [hiss-bankrbot-robinhood](../skills/hiss-bankrbot-robinhood/SKILL.md)   | Compile a Coil for the Bankrbot → Robinhood MCP path (paper-first, gated).                       |
| [hiss-mcp](../skills/hiss-mcp/SKILL.md)                                 | Drive the HISS tools over the local MCP server rather than raw HTTP.                             |
| [hiss-security-boundaries](../skills/hiss-security-boundaries/SKILL.md) | The trust/custody/consent guardrail the other packs are checked against.                         |

**Agentic-trading packs** — for running a Coil against the user's OWN Robinhood
Trading MCP session. HISS compiles/verifies (`liveOrderSent: false`); the user's own
agent session executes under the user's own OAuth, consent, and signed autonomy grant.

| Skill                                                                                       | What it helps an agent do                                                                     |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [hiss-robinhood-agentic](../skills/hiss-robinhood-agentic/SKILL.md)                         | Umbrella entry point: the truth model, the LiveAutonomyGrant precondition, kill/pause/revoke. |
| [hiss-robinhood-portfolio](../skills/hiss-robinhood-portfolio/SKILL.md)                     | Granted-account-scoped reads (default: the granted account fingerprint only).                 |
| [hiss-robinhood-market-intelligence](../skills/hiss-robinhood-market-intelligence/SKILL.md) | Quotes / historicals / indicators / scanner — scans surface as CANDIDATES, never orders.      |
| [hiss-robinhood-equities](../skills/hiss-robinhood-equities/SKILL.md)                       | Equity review → place → reconcile in the user's session — no bypass, no blind retry.          |
| [hiss-robinhood-options](../skills/hiss-robinhood-options/SKILL.md)                         | Options — capability-gated and fail-closed until a session proves the capability.             |
| [hiss-coil-runner](../skills/hiss-coil-runner/SKILL.md)                                     | The Coil runtime loop — at-most-once submit, reconcile-before-retry.                          |
| [hiss-agentic-ledger](../skills/hiss-agentic-ledger/SKILL.md)                               | The local journal + three-layer receipt spine; export / delete; custody stays with the user.  |
| [hiss-cross-rail-handoff](../skills/hiss-cross-rail-handoff/SKILL.md)                       | Prepared brokerage↔chain handoffs with a MANUAL boundary — reconciliation, never a bridge.    |
| [hiss-price-mesh](../skills/hiss-price-mesh/SKILL.md)                                       | The price/valuation mesh — partial propagates, null is never zero, reference ≠ executable.    |

## Installing packs

Install with the [`skills`](https://github.com/vercel-labs/skills) CLI (supports Claude
Code, Codex, Cursor, and more). See the README's
[Install HISS Agent Skills](../README.md#-install-hiss-agent-skills) section for
per-client details.

```bash
npx skills add HissFinance/hiss --list                                  # list
npx skills add HissFinance/hiss --skill hiss-vault-agent-kit            # one skill
npx skills add HissFinance/hiss --all                                   # every skill, every agent
npx skills add HissFinance/hiss --skill hiss-vault-agent-kit -a codex   # a specific client
```

Or install by hand — every pack is a plain directory:

```bash
mkdir -p .claude/skills && cp -R skills/hiss-vault-agent-kit .claude/skills/
```

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
