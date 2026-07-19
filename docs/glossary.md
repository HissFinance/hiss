# Glossary

**Allocation / target weights** — a vault's intended composition, in basis points
summing to 10,000. Intended, not a snapshot of holdings. See
[Allocations](./vaults/allocations.md).

**Basis point (bps)** — 1/100 of a percent. 10,000 bps = 100%.

**Bankr rails** — prepare-and-reconcile command rails for Bankr agents (vault deposits,
stock-token trades). Region- and provider-dependent; never a hard dependency. See
[Bankrbot](./bankrbot.md).

**Candidate (vault)** — a saved, off-chain draft manifest. Free; no skin-in-game
required; not yet published on-chain.

**Challenge window** — the 7-day public window after a monthly epoch is finalized,
during which the score can be challenged and is **not claimable**.

**Coil** — a compiled, validated, scored representation of an intended rebalance/strategy
action, produced by [CoilOps](./coilops.md). Data, never execution.

**CoilOps** — the compile-and-verify workbench. Compiles/validates/scores/audits; never
executes.

**Cooldown** — the 72-hour waiting period to begin an xHISS exit. Escrowed, partial-able,
additive-restart, non-pausable. See [Cooldown and redeem](./staking/cooldown-and-redeem.md).

**Creator** — the party who composes and publishes a vault and configures its (bounded)
fees.

**Creator skin-in-game** — the ≥5% of a vault a creator must hold before public deposits
open. A commitment, not a fee.

**Depositor rewards** — historical name for the reward cohort now called **Vault
Contributors**. Only the reward-cohort name changed; vault _depositors_ (the deposit
action) are unchanged. See **Vault Contributors**.

**Economic burn** — the 10% burn leg of the reward split: verified $HISS fees are
transferred to the canonical dead address
(`0x000000000000000000000000000000000000dEaD`). The HISS leaves circulation (nobody
holds the key), but this is **not** an ERC-20 supply burn — `HISS.totalSupply` is
**not** reduced. The "amount burned" is the live dead-address balance
(`HISS.balanceOf(0x…dEaD)`).

**Distributor** — a contract that pays out a reward leg (merkle-claimable, with vesting).

**Epoch** — the reward accounting period: weekly provisional checkpoints, monthly
finalization. See [Epochs and vesting](./rewards/epochs-and-vesting.md).

**ERC-4626** — the tokenized-vault standard HISS vaults and xHISS follow.

**High-water mark (HWM)** — the peak share price at which a performance fee was last
crystallized. No fee below it; no fee until it is recovered.

**$HISS** — the protocol token (`0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3`, 18dp).

**Injection (reward injection)** — adding the 50% staker leg to the xHISS vault via
`injectRewards`; drips linearly over 24h; reverts with zero stakers.

**Manifest** — the signed, hashed description of a vault's strategy, fees, and fuses. See
[Vault manifest](./vaults/vault-manifest.md).

**Manifest hash** — the integrity hash of a manifest; any change alters it.

**MCP (Model Context Protocol)** — the agent-integration protocol; HISS ships a local MCP
server with 22 read/prepare tools. See [MCP](./mcp.md).

**Planned ≠ funded ≠ vesting ≠ claimable** — the reward state chain. Plans are data;
funding is Safe-gated and on-chain; only vested, past-challenge, funded amounts are
claimable.

**Prepare (vs execute)** — HISS software builds transactions the user signs; it never
signs or broadcasts for the user.

**Provider** — a creator/operator who runs vaults. A provider's vaults count as one
**group** for rewards.

**Provider rewards** — the **Vault Providers** leg (15%), facts-only scoring
(40/30/20/10), 25% dominance cap, 90-day vest. Distributor **not yet deployed**
(`null`). See **Vault Providers**.

**Receipt** — a verifiable on-chain record of an action. Completion is a receipt, never a
pending/unsigned transaction. See [Receipts](./receipts.md).

**Redeem window** — the 2-day window after cooldown completes, during which xHISS can be
redeemed for $HISS.

**Risk fuses** — the enforced safety constraints in a vault's rebalance policy
(concentration, slippage, oracle freshness, venues, readiness). Fail closed. See
[Risk fuses](./vaults/risk-fuses.md).

**Routing fee** — a fee on HISS-routed rebalance notional; **0** until routing is live,
then 0.5–2 bps.

**Share-seconds** — Σ(shares × seconds held) over an epoch; the Vault Contributors
reward measure. No performance inputs. See [Share-seconds](./rewards/share-seconds.md).

**Stock Token / ETF token** — a tokenized equity/ETF on Robinhood Chain; **economic
exposure only**, region-restricted. See [Stock Tokens](./stock-tokens.md).

**Treasury Safe** — the 2-of-3 multisig protocol authority
(`0xF100Fc28dd1721C698046Dbd60408c523b69e36c`).

**USDG** — the 6-decimal base asset for vaults
(`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`).

**Vault Contributors** — the current name for the reward cohort formerly called
"depositor rewards": the 15% leg of the [50/15/15/10/10 split](./fees/reward-flywheel.md),
allocated by [share-seconds](./rewards/share-seconds.md) (Σ shares × seconds held),
30-day linear vest, no PnL/APY/performance inputs. Distributor **not yet deployed**
(`null`). The methodology is unchanged from V1; only the cohort name changed. Vault
_depositors_ (the deposit action) keep that name.

**Vault Providers** — the provider reward cohort: the 15% leg of the
[50/15/15/10/10 split](./fees/reward-flywheel.md), facts-only quality scoring
(40/30/20/10), 25% dominance cap, 90-day vest. Distributor **not yet deployed**
(`null`).

**Vesting** — linear release of a reward allocation over time (Vault Contributors 30
days, Vault Providers 90 days).

**x402** — an HTTP-native pay-per-call standard; HISS uses it for metered compute
endpoints. See [x402](./x402.md).

**xHISS** — the 18-decimal share token of the staking vault
(`0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be`). See [xHISS](./staking/xhiss.md).
