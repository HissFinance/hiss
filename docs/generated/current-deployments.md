# Current deployments (snapshot)

> **Generated at:** 2026-07-16 (UTC)
> **Source:** committed, chain-verified deployment artifacts + `@hiss-finance/core`
> address book.
> **Chain:** Robinhood Chain mainnet, chain ID **4663**.
> **Freshness limitations:** This is a **point-in-time snapshot**, not a live read.
> On-chain state is authoritative — verify every address with a live read
> (e.g. `cast code <address>`) before relying on it. A failed read is **unknown**,
> never "live" and never "not deployed". Deployment status can change after this stamp.

## Deployed and verified (chain 4663)

| Contract / account          | Address                                      | Status                      |
| --------------------------- | -------------------------------------------- | --------------------------- |
| USDG (base asset, 6dp)      | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | base asset                  |
| $HISS token (18dp)          | `0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3` | verified                    |
| HISS Treasury Safe (2-of-3) | `0xF100Fc28dd1721C698046Dbd60408c523b69e36c` | verified on-chain           |
| VaultFactory                | `0x278d237c6890a5f7101296a9021ed9D26c821810` | deployed                    |
| HISS Vault (flagship)       | `0x6d962604df1c6c5ef4b59d88863600fe71bb63e6` | live                        |
| xHISS staking vault         | `0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be` | deployed                    |
| VaultAssetRegistry          | `0xcf9609B30f565813b87d1998c8b3b2aD073a4cE1` | deployed                    |
| VaultReceiptRegistry        | `0x379dAaA0B7bb172A67f37a9bC53E42Ec8C9af170` | deployed                    |
| VaultAccessPolicy           | `0x7e292bCD2C7A3420dA4a7036B99CFf32BcF9B663` | deployed                    |
| VaultFeeDistributor         | `0x354686dD8480aF9bBa590dbA8D900C9b8055C71B` | deployed                    |
| HissOracleAdapter           | `0x8461a6137Da8064D7Eb3a13dB674af2eDf05A2c0` | deployed                    |
| Rebalance adapter           | `0xd9a097d2e119FDcd7A22E6F4b85C26E437419A15` | deployed, registry-approved |

## Not yet deployed

| Component                                       | Status                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Vault-contributor vesting distributor (15% leg) | **Not deployed** — recipient `null` in split plans; nothing moves against it.                        |
| Vault-provider rewards distributor (15% leg)    | **Not deployed** — recipient `null` in split plans; nothing moves against it.                        |
| Live rebalance routing                          | **Disabled protocol-wide** — vaults hold base asset until per-asset live-rebalance readiness passes. |

## How to verify

```bash
RPC=https://rpc.mainnet.chain.robinhood.com

# Contract has code?
cast code 0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be --rpc-url $RPC

# Treasury Safe threshold (expect 2)
cast call 0xF100Fc28dd1721C698046Dbd60408c523b69e36c "getThreshold()(uint256)" --rpc-url $RPC
```

See [Contracts](../contracts.md) and [Status and data freshness](../status-and-data-freshness.md).
