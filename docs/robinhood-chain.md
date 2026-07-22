# Robinhood Chain

HISS Finance runs on **Robinhood Chain**, an EVM chain purpose-built for tokenized
equities. Always verify network parameters against the
[official Robinhood documentation](https://docs.robinhood.com/chain/connecting) —
HISS is **not affiliated with Robinhood**.

## Network configuration

| Field           | Mainnet                                                                            | Testnet                                        |
| --------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| Chain ID        | `4663`                                                                             | `46630`                                        |
| Network name    | Robinhood Chain                                                                    | Robinhood Chain Testnet                        |
| RPC URL         | `https://rpc.mainnet.chain.robinhood.com`                                          | `https://rpc.testnet.chain.robinhood.com`      |
| Native currency | ETH (18 decimals)                                                                  | ETH (18 decimals)                              |
| Block explorer  | `https://robinhoodchain.blockscout.com`                                            | `https://explorer.testnet.chain.robinhood.com` |
| Official docs   | [docs.robinhood.com/chain/connecting](https://docs.robinhood.com/chain/connecting) | same                                           |

The canonical config is exported from `@hiss-finance/core` (`ROBINHOOD_CHAIN`,
`ROBINHOOD_CHAIN_TESTNET`) and is only marked "verified against docs" once checked
against the official source.

## Connecting

### viem / SDK

```ts
import { HissClient } from "@hiss-finance/sdk";

const hiss = new HissClient({
  chainId: 4663,
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
});
```

### cast (Foundry)

```bash
cast chain-id --rpc-url https://rpc.mainnet.chain.robinhood.com   # -> 4663
cast call 0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3 "symbol()(string)" \
  --rpc-url https://rpc.mainnet.chain.robinhood.com
```

### Wallet

Add a custom network with Chain ID `4663`, the RPC URL above, ETH as the native
currency, and the Blockscout explorer. Prefer testnet (`46630`) for development.

## The base asset: USDG

Vaults are denominated in **USDG**, a **6-decimal** stablecoin.

- **USDG address (chain 4663):** `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`

Always account in base units: `1,000 USDG = 1_000_000_000` (10⁶ per unit). Confusing
USDG's 6 decimals with $HISS/xHISS's 18 decimals is a common and costly mistake.

## Tokenized Stock Tokens and ETF tokens

Robinhood Chain hosts canonical tokenized equities and ETFs (for example AAPL, MSFT,
NVDA, GOOGL, AMZN, META, SPY, QQQ, SGOV, SLV). HISS vaults reference these by
**canonical address only** and treat them as **economic exposure**:

- They confer **no legal or beneficial ownership**, **no voting rights**, and **no
  direct dividend entitlement** in the underlying issuer.
- Availability is **jurisdiction-restricted** in some regions.
- Price data is oracle-guarded with staleness handling suited to a **24/5** market.

See [Stock Tokens](./stock-tokens.md).

## Oracles and market hours

Vault risk fuses reference oracle-freshness policy (feed-aware, 24/5), maximum price
staleness, and verified-route requirements. A vault will not treat stale-fed assets
as live-rebalanceable. See [Risk fuses](./vaults/risk-fuses.md) and
[Data freshness](./status-and-data-freshness.md).

On top of that execution policy, the hosted vault surfaces distinguish **display**
from **execution** around the clock:

- **Display continuity (24/7).** Vault pages keep showing valuation state outside
  feed hours using the **last verified** prices, labeled with an explicit price
  basis: `EXCHANGE_LIVE` (a live feed round), `CARRIED_CLOSE` (a carried close,
  display-only), or `MODEL_ACCRUAL` (accrual-like feeds such as SGOV's
  once-daily round). A carried close is **never** an execution basis — only
  `EXCHANGE_LIVE` pricing is execution-grade.
- **Advertised deposits narrow beyond the contract.** The contract's oracle
  staleness bound still governs execution (stale feeds make priced entry/exit
  revert — fail closed). Additionally, deposits are **advertised** open only while
  the tokenized-equity trading session is open **and** every required basket
  asset's feed is within its per-basis bound (live-feed assets 3,600 s;
  accrual-like assets such as SGOV 26 h) — stale-mark dilution protection,
  policy P-DEP-2/P-NAV-2. Outside that window the UI reports the deposit entry
  closed with the reason, even where the contract itself would still accept.

See [Risk fuses — the effective deposit gate](./vaults/risk-fuses.md#the-effective-deposit-gate-advertised-availability)
and [Data freshness](./status-and-data-freshness.md#display-continuity-vs-execution-strictness-247).

## Explorer links

- Address: `https://robinhoodchain.blockscout.com/address/<address>`
- Transaction: `https://robinhoodchain.blockscout.com/tx/<txhash>`

The SDK/core expose helpers (`blockscoutAddressUrl`, `blockscoutTxUrl`) so links are
built from the verified chain config.
