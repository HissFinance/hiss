# Contracts

The on-chain system for HISS Finance on **Robinhood Chain (4663)**. Interfaces and
ABIs live under [`contracts/`](../contracts). **On-chain state is always the source of
truth** — read the chain; do not rely on any address or status without a live read.
For a stamped snapshot, see [current deployments](./generated/current-deployments.md).

## Address book (chain 4663)

Full addresses only — never abbreviate a load-bearing address.

| Contract / account            | Address                                      | Notes                                                         |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| USDG (base asset, 6dp)        | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Vault denomination                                            |
| $HISS token (18dp)            | `0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3` | Protocol token, staked in xHISS                               |
| VaultFactory                  | `0x278d237c6890a5f7101296a9021ed9D26c821810` | Deploys vault instances, charges creation fee                 |
| **HissUsdGVaultV2**           | `0x432e90b1B35995EBE46eD93B4Db369abfc230E69` | **CANONICAL new-deposit vault** (queue-routed, 24/7 lanes)    |
| HissRequestQueue              | `0x317d1eEC013a91a316858e80BF782496F231729a` | V2 deposit/USDG-redemption escrow + epoch queue               |
| HissBatchSettler              | `0x32A60abB48235b158dd515B84C5B039F6Dc4f7dD` | V2 constrained keeper settlement                              |
| HissLiveness                  | `0x424b634AA340832Cf548bB501204a6cf8A6d9136` | V2 liveness heartbeat                                         |
| HissPriceMeshV2               | `0xd57E9fC8fF8b1aCe73a7D6c32F1101879fDeF3c6` | V2 side-aware price mesh + dynamic capacity                   |
| HissV2RiskPolicy              | `0x9aDE5804ad1b4F6231E46b1E806dFc7464069BB4` | V2 binding risk policy                                        |
| HissReceiptRegistry (V2)      | `0x0A6232fD54C8e4B3eCBd0df261706001dfAF55Da` | V2 receipts (preparation/submission/settlement)               |
| HissV2AssetRegistry           | `0xC2619B2Bf3f075A73FF29f9e6cc2a8C532c0395F` | V2 canonical-address asset registry                           |
| HissV2UniswapExecutionAdapter | `0x306A800226CAF794238CBB0BdE9A49bAb7156d31` | V2 execution adapter                                          |
| HISS Vault (flagship V1)      | `0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` | **LEGACY · EMPTY** — closed to new deposits                   |
| XHissVault (xHISS)            | `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be` | Single-asset $HISS staking                                    |
| HISS Treasury Safe (2-of-3)   | `0xF100Fc28dd1721C698046Dbd60408c523b69e36c` | Protocol authority                                            |
| VaultAssetRegistry            | `0xcf9609B30f565813b87d1998c8b3b2aD073a4cE1` | Allowed assets / canonical addresses (V1-style vaults)        |
| VaultReceiptRegistry          | `0x379dAaA0B7bb172A67f37a9bC53E42Ec8C9af170` | On-chain receipts (V1-style vaults)                           |
| VaultAccessPolicy             | `0x7e292bCD2C7A3420dA4a7036B99CFf32BcF9B663` | Access/jurisdiction gating                                    |
| VaultFeeDistributor           | `0x354686dD8480aF9bBa590dbA8D900C9b8055C71B` | Fee routing                                                   |
| HissOracleAdapter             | `0x8461a6137Da8064D7Eb3a13dB674af2eDf05A2c0` | Oracle/price feeds                                            |
| Rebalance adapter             | `0xd9a097d2e119FDcd7A22E6F4b85C26E437419A15` | Registry-approved venue adapter (V1-style)                    |
| HissLpManagerV1               | `0xBE5989a38953D8148B74d45eE6DEB127a32567E0` | Stock-Premium LP manager — launched paused (state: live read) |

Additional registries (readiness, legal, deposit) and the vault contract instance are
listed in the generated snapshot. ABIs for each are under `contracts/abi/`.

## Core contracts

### VaultFactory

Deploys vault instances from a validated manifest, charges the one-time creation fee,
and wires the vault to the registries. See [Create a vault](./vaults/create-a-vault.md).

### HissUsdGVaultV2 (the canonical new-deposit vault)

The **canonical new-deposit vault** at
`0x432e90b1B35995EBE46eD93B4Db369abfc230E69`. Deposits and USDG redemptions
route through the **request queue** (`HissRequestQueue`) and settle in epoch
batches via the **constrained keeper** path (`HissBatchSettler`) — shares mint
and USDG pays out at the epoch clearing rate at settlement, never at enqueue. A
valuation-free **in-kind redemption** (`inKindRedeem`) is the always-available
exit. Pricing and dynamic capacity come from `HissPriceMeshV2` (side-aware
marks; **capacity is a live chain read, never a fixed promise**); liveness
evidence from `HissLiveness`; policy bounds from `HissV2RiskPolicy`; receipts
from the V2 `HissReceiptRegistry` (preparation / submission / settlement
distinguished). Rebalancing is **inactive by policy** (an owner decision, not a
fault state): "AAPL is currently the only execution-grade Stock Token asset.
Initial public operation uses settlement-driven allocation and preserves the
current USDG cash reserve." Review state: **Internally verified · not
externally audited.** See [24/7 architecture](./vaults/24-7-architecture.md).

### HISS Vault (flagship V1 — LEGACY · EMPTY)

The original ERC-4626 USDG basket at
`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6`. **Closed to new deposits and
empty** since the V2 cutover — there is no migration flow (nothing to migrate).
The address and its [verified history](./vaults/verified-history-and-usdg-accounting.md)
remain documented. V1-style vaults enforce the [fee model](./fees/vault-fees.md)
(high-water-mark performance fee, protocol share; zero deposit/withdraw fees), a
strategy-change notice period, and [risk fuses](./vaults/risk-fuses.md).

### HissDepositIntentExecutor (superseded — never deployed)

A previously designed one-signature "deposit anytime" executor
(permit-as-intent + keeper strike). It was **never deployed** and is
**superseded by the V2 request queue**, which provides the around-the-clock
deposit path in production. It has no deployed address and no role in the
current system; it is recorded here for historical accuracy only.

### HissLpManagerV1 (Stock-Premium LP manager — deployed; launched-paused initial state)

The managed-lifecycle contract for Stock-Premium LP positions. It holds an
enrolled Uniswap v3 position NFT on-chain while it is under management (with an
emergency path returning it to its beneficiary), enforces the
[Stock-Premium LP management fee](./fees/stock-premium-lp-management-fee.md) — 5%
of **realized LP fees only** (never principal, never P&L; `MAX_FEE_BPS` is an
immutable 500) — and routes every protocol fee to the Treasury Safe. Deployed and
source-verified at `0xBE5989a38953D8148B74d45eE6DEB127a32567E0` (chain 4663);
owner and treasury are both the HISS Treasury Safe.

**Initial state: launched paused (immutable).** The owner-gated Safe unpause has
since executed on-chain, so current `paused()` / `feeBps()` / `owner()` /
`treasury()` state is always a live chain read: a failed read is "unknown", never
"live" and never "not deployed". Unpaused alone opens nothing — enrollment and
every managed action stay owner/beneficiary-gated.
Self-managed positions prepared via the
[Stock Premium LP skill](../skills/hiss-stock-premium-lp-manager/SKILL.md) and
executed by the user's own authority never touch this contract.

### XHissVault (staking)

Single-asset ERC-4626-style staking over $HISS; **xHISS** is the 18-decimal share
token. Exchange rate starts 1:1 and rises with reward injections that drip linearly
over 24h. Exits use a **72-hour cooldown** then a **2-day redeem window**. Timing
constants are **immutable**; **exits are never pausable**. See
[xHISS](./staking/xhiss.md).

### Reward distributors

- **VaultDepositorRewardsDistributor / …VestingDistributor** — the 15%
  **Vault Contributors** leg (the reward cohort formerly named "depositor"; the
  on-chain contract name is unchanged), merkle-claimable with on-chain 30-day linear
  vesting.
- **VaultProviderRewardsDistributor / …VestingDistributor** — the 15% **Vault
  Providers** leg, merkle-claimable (90-day vesting is modelled/metadata pending the
  on-chain vesting delta).

The remaining legs of the 50/15/15/10/10 split are the 50% xHISS staker injection,
the 10% Treasury Safe leg, and the 10% **economic burn** to the canonical dead
address `0x000000000000000000000000000000000000dEaD` (leaves circulation; does **not**
reduce `HISS.totalSupply`).

> Reward-split plans carry `null` recipients for the Vault Contributors and Vault
> Providers distributors until those are deployed and verified. **Nothing moves
> against a `null` recipient.** Confirm deployment with a live no-bytecode/bytecode
> read before describing a distributor as live.

### Registries and adapters

Asset, receipt, access, and readiness registries enforce canonical-address-only
assets, produce receipts, and gate deposits/rebalances on legal and oracle readiness.
The rebalance adapter is registry-approved; **routing is disabled protocol-wide** and
a vault holds its base asset until per-asset live-rebalance readiness passes.

## ABIs

Machine-readable ABIs are under [`contracts/abi/`](../contracts/abi), including
`VaultFactory`, `HissUsdGVault`, `XHissVault`, the registries, the reward
distributors, `HissOracleAdapter`, and `UniswapV4RebalanceAdapter`. Use them with
viem/ethers/`cast`, or the typed reads in `@hiss-finance/sdk`. The V2
call-surface fragments used by the SDK (`VAULT_V2_ABI`, `VAULT_V2_QUEUE_ABI` —
`inKindRedeem`, `enqueue`, and the V2 status reads) ship in
`@hiss-finance/sdk`. The contracts registry
(`contracts/deployments/robinhood-chain-mainnet.json`) is complete for the V2
system: all nine V2 contracts are recorded with their live runtime-bytecode
keccak hashes, creation transactions, and verification state, and
`pnpm check:contract-registry-live` re-verifies every recorded hash against
live chain code.

## Verifying state

```bash
# Is the canonical V2 vault deployed? (non-empty code)
cast code 0x432e90b1B35995EBE46eD93B4Db369abfc230E69 \
  --rpc-url https://rpc.mainnet.chain.robinhood.com

# Is the xHISS vault deployed? (non-empty code)
cast code 0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be \
  --rpc-url https://rpc.mainnet.chain.robinhood.com

# Read the Treasury Safe threshold (expect 2)
cast call 0xF100Fc28dd1721C698046Dbd60408c523b69e36c "getThreshold()(uint256)" \
  --rpc-url https://rpc.mainnet.chain.robinhood.com
```

A failed or empty read is **unknown** — never assume "live" or "not deployed" without
affirmative evidence. See [Status and data freshness](./status-and-data-freshness.md).
