# Contracts

The on-chain system for HISS Finance on **Robinhood Chain (4663)**. Interfaces and
ABIs live under [`contracts/`](../contracts). **On-chain state is always the source of
truth** — read the chain; do not rely on any address or status without a live read.
For a stamped snapshot, see [current deployments](./generated/current-deployments.md).

## Address book (chain 4663)

Full addresses only — never abbreviate a load-bearing address.

| Contract / account          | Address                                      | Notes                                         |
| --------------------------- | -------------------------------------------- | --------------------------------------------- |
| USDG (base asset, 6dp)      | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Vault denomination                            |
| $HISS token (18dp)          | `0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3` | Protocol token, staked in xHISS               |
| VaultFactory                | `0x278d237c6890a5f7101296a9021ed9D26c821810` | Deploys vault instances, charges creation fee |
| HISS Vault (flagship)       | `0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` | ERC-4626 USDG vault                           |
| XHissVault (xHISS)          | `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be` | Single-asset $HISS staking                    |
| HISS Treasury Safe (2-of-3) | `0xF100Fc28dd1721C698046Dbd60408c523b69e36c` | Protocol authority                            |
| VaultAssetRegistry          | `0xcf9609B30f565813b87d1998c8b3b2aD073a4cE1` | Allowed assets / canonical addresses          |
| VaultReceiptRegistry        | `0x379dAaA0B7bb172A67f37a9bC53E42Ec8C9af170` | On-chain receipts                             |
| VaultAccessPolicy           | `0x7e292bCD2C7A3420dA4a7036B99CFf32BcF9B663` | Access/jurisdiction gating                    |
| VaultFeeDistributor         | `0x354686dD8480aF9bBa590dbA8D900C9b8055C71B` | Fee routing                                   |
| HissOracleAdapter           | `0x8461a6137Da8064D7Eb3a13dB674af2eDf05A2c0` | Oracle/price feeds                            |
| Rebalance adapter           | `0xd9a097d2e119FDcd7A22E6F4b85C26E437419A15` | Registry-approved venue adapter               |

Additional registries (readiness, legal, deposit) and the vault contract instance are
listed in the generated snapshot. ABIs for each are under `contracts/abi/`.

## Core contracts

### VaultFactory

Deploys vault instances from a validated manifest, charges the one-time creation fee,
and wires the vault to the registries. See [Create a vault](./vaults/create-a-vault.md).

### HISS Vault (ERC-4626)

A USDG-denominated basket. Depositors mint shares and share profits and losses
pro-rata. Enforces the [fee model](./fees/vault-fees.md) (high-water-mark performance
fee, protocol share; zero deposit/withdraw fees), a strategy-change notice period, and
[risk fuses](./vaults/risk-fuses.md).

### HissDepositIntentExecutor (implemented — not deployed, not active)

A queued-deposit executor for the one-signature "deposit anytime" flow: a user
signs a single EIP-2612 permit-as-intent (amount, vault, risk-acknowledgment
hashes, deadline, cancel nonce) and a keeper later submits the strike
transaction when the vault's freshness and pricing gates pass, minting shares
to the signer at the fresh mark. Funds stay in the user's wallet until the
single atomic execution; a second signature is never required.

**Status: implemented and fork-proven but inactive.** It remains inactive
pending independent audit, production deployment approval, deployment,
monitoring, keeper authorization, and explicit activation. It has **no
deployed address**, and no queued-deposit execution occurs in production. The
deposit page reflects the same state. See
[Deposits](./vaults/deposit.md) for the user-facing behavior and
[SECURITY.md](../SECURITY.md#trust-boundaries-and-security-model) for the
boundary treatment.

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
viem/ethers/`cast`, or the typed reads in `@hiss-finance/sdk`.

## Verifying state

```bash
# Is the xHISS vault deployed? (non-empty code)
cast code 0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be \
  --rpc-url https://rpc.mainnet.chain.robinhood.com

# Read the Treasury Safe threshold (expect 2)
cast call 0xF100Fc28dd1721C698046Dbd60408c523b69e36c "getThreshold()(uint256)" \
  --rpc-url https://rpc.mainnet.chain.robinhood.com
```

A failed or empty read is **unknown** — never assume "live" or "not deployed" without
affirmative evidence. See [Status and data freshness](./status-and-data-freshness.md).
