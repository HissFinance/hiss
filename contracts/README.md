# HISS Contracts — Public Interface Materials

Public interface data for the HISS Finance smart contracts deployed on
**Robinhood Chain** (Arbitrum-stack L2, chain id **4663** mainnet /
**46630** testnet, ETH gas, Blockscout explorer).

HISS is compilation/verification software. The contracts here never take
custody of user funds, never place brokerage orders, and never store
brokerage credentials. HISS is not affiliated with Robinhood, Bankr, or
Chainlink.

## What's in this directory

| Path                                       | Contents                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `abi/*.json`                               | Exact ABIs of the public contracts, extracted from the compiled Foundry artifacts. Interface data only — no bytecode. |
| `deployments/robinhood-chain-mainnet.json` | Canonical addresses, deployed-bytecode keccak hashes, verification status, and Blockscout links for chain 4663.       |
| `src/interfaces/*.sol`                     | Solidity interfaces authored from the public ABIs, for integrators who want typed calls.                              |

This directory is **interface materials only**. It does not contain
deployment scripts, owner-action scripts, or any private operational
tooling.

## ABIs

`abi/` contains one JSON file per contract, each an exact copy of the
`abi` array from the verified build:

- Core vault system: `VaultFactory`, `HissUsdGVault`, `VaultAssetRegistry`,
  `VaultReceiptRegistry`, `VaultAccessPolicy`, `VaultFeeDistributor`,
  `VaultDepositReadinessRegistry`, `VaultLegalReadinessRegistry`,
  `HissOracleAdapter`.
- Rebalance execution: `UniswapV4RebalanceAdapter` and the minimal
  `IVaultRebalanceAdapter` surface.
- Staking: `XHissVault`.
- Reward distributors: `VaultDepositorRewardsDistributor`,
  `VaultProviderRewardsDistributor`,
  `VaultProviderRewardsVestingDistributor`.

## Addresses & verification

Canonical addresses live in `deployments/robinhood-chain-mainnet.json`.
Every core vault contract is source-verified on the Robinhood Chain
Blockscout explorer, and the on-chain deployed-bytecode keccak matches the
compiled artifact. Explorer base:

<https://robinhoodchain.blockscout.com>

Key notes captured in that file:

- **`VaultDepositReadinessRegistry`** is the factory's active deposit gate
  and ships **closed** (`defaultReady=false`, zero vaults marked ready).
- **`VaultLegalReadinessRegistry`** is a predecessor gate, **superseded**
  as the active deposit gate; it remains on-chain but is no longer
  consulted.
- Deposit state, ownership, balances, and readiness are **always live
  chain reads** — never copied from committed files.

## Compiler settings

The verified builds use:

- **solc** `0.8.24` (`+commit.e11b9ed9`)
- Optimizer **enabled**, **200** runs
- EVM version **cancun**
- `bytecode_hash = "none"`

Match these exactly to reproduce verified bytecode.

## The ERC-8056 corporate-action rule

Robinhood Chain Stock Token Chainlink feeds **already include** the
ERC-8056 `uiMultiplier()` corporate-action multiplier. Never multiply a
feed price by the multiplier again:

```text
tokenValueUsd        = amount * price / 1e18        // multiplier NOT applied
shareEquivalent      = amount * uiMultiplier / 1e18 // display only
underlyingSharePrice = price * 1e18 / uiMultiplier  // divide it OUT
```

`HissOracleAdapter` (and `IHissOracleAdapter`) encode this: use
`tokenValueUsd` for accounting, `shareEquivalent` for display only.

## Fee model (no AUM / no execution fees)

HISS vaults forbid AUM fees and per-execution fees. The only creator fee
is a performance fee, capped at the factory level and split by
`VaultFeeDistributor` between the fee recipient, an optional referral, and
the protocol treasury. Rebalances route only through adapters explicitly
approved in `VaultAssetRegistry`; **no adapter and no live rebalance is
enabled by default.**

## License

Apache-2.0 for authored materials in this directory. Solidity interfaces
derived from `MIT`-licensed contract source that ship with an original
`MIT` SPDX identifier retain that identifier (e.g.
`IVaultRebalanceAdapter.sol`).
