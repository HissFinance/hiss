# Current deployments (snapshot)

> **Generated at:** 2026-08-04 (UTC)
> **Source:** committed, chain-verified deployment artifacts + `@hiss-finance/sdk`
> address book.
> **Chain:** Robinhood Chain mainnet, chain ID **4663**.
> **Freshness limitations:** This is a **point-in-time snapshot**, not a live read.
> On-chain state is authoritative — verify every address with a live read
> (e.g. `cast code <address>`) before relying on it. A failed read is **unknown**,
> never "live" and never "not deployed". Deployment status can change after this stamp.

## Deployed and verified (chain 4663)

| Contract / account            | Address                                      | Status                                                                |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| USDG (base asset, 6dp)        | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | base asset                                                            |
| $HISS token (18dp)            | `0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3` | verified                                                              |
| HISS Treasury Safe (2-of-3)   | `0xF100Fc28dd1721C698046Dbd60408c523b69e36c` | verified on-chain                                                     |
| VaultFactory                  | `0x278d237c6890a5f7101296a9021ed9D26c821810` | deployed                                                              |
| HissUsdGVaultV2               | `0x432e90b1B35995EBE46eD93B4Db369abfc230E69` | deployed — CANONICAL new-deposit vault                                |
| HissRequestQueue              | `0x317d1eEC013a91a316858e80BF782496F231729a` | deployed — V2 deposit/redemption queue                                |
| HissBatchSettler              | `0x32A60abB48235b158dd515B84C5B039F6Dc4f7dD` | deployed — V2 constrained keeper settlement                           |
| HissLiveness                  | `0x424b634AA340832Cf548bB501204a6cf8A6d9136` | deployed — V2 liveness heartbeat                                      |
| HissPriceMeshV2               | `0xd57E9fC8fF8b1aCe73a7D6c32F1101879fDeF3c6` | deployed — V2 price mesh / dynamic capacity (live read)               |
| HissV2RiskPolicy              | `0x9aDE5804ad1b4F6231E46b1E806dFc7464069BB4` | deployed — V2 risk policy                                             |
| HissReceiptRegistry (V2)      | `0x0A6232fD54C8e4B3eCBd0df261706001dfAF55Da` | deployed — V2 receipts                                                |
| HissV2AssetRegistry           | `0xC2619B2Bf3f075A73FF29f9e6cc2a8C532c0395F` | deployed — V2 asset registry                                          |
| HissV2UniswapExecutionAdapter | `0x306A800226CAF794238CBB0BdE9A49bAb7156d31` | deployed — V2 execution adapter                                       |
| HISS Vault (flagship V1)      | `0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` | deployed — LEGACY · EMPTY (closed to new deposits)                    |
| xHISS staking vault           | `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be` | deployed                                                              |
| VaultAssetRegistry            | `0xcf9609B30f565813b87d1998c8b3b2aD073a4cE1` | deployed                                                              |
| VaultReceiptRegistry          | `0x379dAaA0B7bb172A67f37a9bC53E42Ec8C9af170` | deployed                                                              |
| VaultAccessPolicy             | `0x7e292bCD2C7A3420dA4a7036B99CFf32BcF9B663` | deployed                                                              |
| VaultFeeDistributor           | `0x354686dD8480aF9bBa590dbA8D900C9b8055C71B` | deployed                                                              |
| HissOracleAdapter             | `0x8461a6137Da8064D7Eb3a13dB674af2eDf05A2c0` | deployed                                                              |
| Rebalance adapter             | `0xd9a097d2e119FDcd7A22E6F4b85C26E437419A15` | deployed, registry-approved                                           |
| HissLpManagerV1 (SPL)         | `0xBE5989a38953D8148B74d45eE6DEB127a32567E0` | deployed; launched-paused initial state; current state is a live read |

## Policy / lifecycle notes

| Component                                       | Status                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 rebalancing                                  | **Inactive by policy** (owner decision, not a fault state) — see [Contracts](../contracts.md#hissusdgvaultv2-the-canonical-new-deposit-vault). |
| Vault-contributor vesting distributor (15% leg) | **Not deployed** — recipient `null` in split plans; nothing moves against it.                                                                  |
| Vault-provider rewards distributor (15% leg)    | **Not deployed** — recipient `null` in split plans; nothing moves against it.                                                                  |
| Live rebalance routing (V1-style vaults)        | **Disabled protocol-wide** — vaults hold base asset until per-asset live-rebalance readiness passes.                                           |

## How to verify

```bash
RPC=https://rpc.mainnet.chain.robinhood.com

# Canonical V2 vault has code?
cast code 0x432e90b1B35995EBE46eD93B4Db369abfc230E69 --rpc-url $RPC

# Contract has code?
cast code 0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be --rpc-url $RPC

# Treasury Safe threshold (expect 2)
cast call 0xF100Fc28dd1721C698046Dbd60408c523b69e36c "getThreshold()(uint256)" --rpc-url $RPC
```

See [Contracts](../contracts.md) and [Status and data freshness](../status-and-data-freshness.md).
