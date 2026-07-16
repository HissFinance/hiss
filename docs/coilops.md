# CoilOps

**CoilOps** is the compile-and-verify workbench inside HISS. It turns a rebalance or
strategy intent into a **coil** — a structured, validated, scored, and auditable
artifact — without ever executing anything. CoilOps **compiles and verifies; it never
trades, never routes funds, and never places brokerage orders.**

## What is a coil?

A **coil** is a compiled representation of an intended action (typically a vault or
basket rebalance policy): its inputs, constraints, target weights, risk fuses, oracle
requirements, and the plan derived from them. It is data — reproducible from its
inputs — designed to be validated, scored, and audited before any human decides to act
on it with their own signature.

## The CoilOps pipeline

```
intent ──▶ compile ──▶ validate ──▶ score ──▶ (human/wallet signs) ──▶ post-run audit
           (coil)      (fuses)      (risk)      outside CoilOps           (receipt)
```

1. **Compile** — build the coil from an intent and the vault's manifest/constraints.
2. **Validate** — check risk fuses, oracle freshness, allowed assets/venues, and
   allocation caps. Invalid coils are refused (fail closed).
3. **Score** — a facts-based risk score. **No PnL/APY/performance inputs** — scoring
   is about safety and policy conformance, not predicted returns.
4. **Execute?** — CoilOps does **not** execute. Any action is taken by the user with
   their own wallet, outside CoilOps.
5. **Audit** — after a rebalance happens on-chain, produce a **post-run audit** that
   reconciles what was intended against what occurred, and emit a
   [receipt](./receipts.md).

## Tools and endpoints

Via the [MCP server](./mcp.md):

- `hiss_generate_coil`, `hiss_validate_coil`, `hiss_score_coil`
- `hiss_compile_vault_rebalance_policy`, `hiss_compile_robinhood_capsule`,
  `hiss_compile_bankrbot_robinhood_path`
- `hiss_drift_check`, `hiss_risk_audit`, `hiss_post_run_audit`,
  `hiss_post_vault_rebalance_audit`

Via [x402](./x402.md): `hiss-coil-compiler`, `compile-coil-for-robinhood`,
`compile-vault-rebalance-policy`, `simulate-vault-rebalance`, `post-run-audit`,
`post-vault-rebalance-audit`, `validate-usdg-vault-fuses`, `validate-autonomy-fuses`.

## The compile-only boundary

CoilOps and any Robinhood-MCP surface it references are **compile-only**:

- `liveOrderSent` and equivalent execution flags are hard-typed **false**.
- The Robinhood MCP is **never** used for pooled vault execution.
- A compiled capsule or path is a **plan** the user may choose to act on themselves —
  never an instruction HISS carries out.

## Why compile-and-verify

Separating "decide what should happen" (compile + validate + score) from "make it
happen" (the user signs) keeps HISS firmly on the software side of the line: it
produces auditable evidence and honest risk signals, and leaves execution and custody
entirely with the user and their own tools. See [Trust boundaries](./trust-boundaries.md).
