# SDK

`@hiss-finance/sdk` is the high-level client for HISS Finance. It does two things:

- **Read** vault, staking, and reward state from Robinhood Chain.
- **Prepare** transactions — build the calldata for **you** to sign.

It never signs, never broadcasts on your behalf, never holds keys, and never takes
custody. Preparation returns unsigned action plans (`signed: false`,
`liveTransactionSent: false`); you send them with your own wallet.

> The **SDK is not yet published to npm** — consume it from the workspace after
> `pnpm build`, or via a local `file:`/`link:` reference. (The
> [`@hiss-finance/cli`](./cli.md), which bundles the SDK, **is** published:
> `npm install -g @hiss-finance/cli`.)

## Client

```ts
import { createHissClient } from "@hiss-finance/sdk";

const hiss = createHissClient({
  chainId: 4663, // or 46630 for testnet
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
});
```

`@hiss-finance/core` provides the underlying chain config, address book, and
deterministic math the SDK builds on.

## Vault lifecycle: canonical V2, legacy V1

The SDK encodes the vault lifecycle truth:

- **Canonical new-deposit vault:** `HISS_ADDRESSES.vaultV2`
  (`0x432e90b1B35995EBE46eD93B4Db369abfc230E69`) — queue-routed epoch
  settlement, 24/7 lanes. `getVault()` defaults to it.
- **Legacy V1 flagship:** `HISS_ADDRESSES.flagshipVault`
  (`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6`) — **LEGACY · EMPTY**, closed
  to new deposits; never the deposit default.

Queue, keeper, capacity, and pause state are **always live chain reads** —
never values baked into the package.

## Reads (no keys required)

```ts
// Protocol status: network, token, Safe, vault lifecycle facts.
const status = await hiss.getProtocolStatus();

// The canonical V2 vault (default) — always a live chain read.
const vault = await hiss.getVault();

// The live V2 lane snapshot: queue, keeper, capacity, pause, rebalance policy.
const v2 = await hiss.getVaultV2Status();
// v2 capacity is a LIVE Price Mesh read — an expiring figure, never a fixed promise.
// Rebalancing reads as inactive-by-policy (an owner decision, not a fault state).

// Both vaults, canonical first, legacy V1 labeled separately.
const vaults = await hiss.getVaults();

// Staking state for the xHISS vault.
const staking = await hiss.getStakingStatus();

// The current reward model (V2 `hiss-reward-split-v2`, 50/15/15/10/10).
const reward = await hiss.getRewardStatus();
// planned ≠ funded ≠ claimable — funding is owner-gated and chain-verified.
```

Reads reflect on-chain reality at the time of the call. Never cache a balance or a
"live/not-deployed" status; re-read for anything transactional.

## Prepares (you sign)

Every `prepare*` returns an unsigned action plan (target, calldata, decoded
args, warnings, required acknowledgments) plus a deterministic plan hash.

```ts
import {
  prepareVaultDeposit,
  prepareVaultWithdrawal,
  prepareHissStake,
  prepareXhissCooldown,
} from "@hiss-finance/sdk";

// Deposit USDG (6 decimals) into the canonical V2 vault: a request-queue
// enqueue. Shares mint at EPOCH SETTLEMENT (not at enqueue). Approve USDG for
// the queue first (prepareErc20Approval) — the plan's warnings say so.
const deposit = prepareVaultDeposit({
  amountUnits: 1_000_000_000n, // 1,000 USDG
  receiver: "0xYou", // the queue-request owner — must be the signing wallet
  minOutShares: 0n, // set a floor for slippage protection
});

// Withdraw: default is the V2 in-kind redemption (pro-rata basket, 24/7);
// mode "queue_usdg" prepares a queue-routed USDG redemption instead.
const withdraw = prepareVaultWithdrawal({
  sharesUnits: 500n * 10n ** 18n,
  receiver: "0xYou",
  // mode: "queue_usdg", minOutUsdg: 0n,
});

// Stake $HISS (18 decimals) into xHISS, then exit via cooldown + redeem window.
const stake = prepareHissStake({ amountUnits: 500n * 10n ** 18n });
const cooldown = prepareXhissCooldown({ action: "start", xShares: 250n * 10n ** 18n });
```

Each plan is a single unsigned call — `{ target, calldata, value, summary,
warnings, requiredAcknowledgments, planHash }`. Sign and send with your wallet
(viem example):

```ts
import { createWalletClient, http } from "viem";
const wallet = createWalletClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
await wallet.sendTransaction({
  account: "0xYou",
  to: deposit.target,
  data: deposit.calldata,
  value: BigInt(deposit.value),
});
```

## Decimals matter

- **USDG:** 6 decimals — `1,000 USDG = 1_000_000_000n`.
- **$HISS / xHISS / vault shares:** 18 decimals — `1 HISS = 10n ** 18n`.

Mixing these is the most common integration bug. The SDK takes and returns **base
units** (bigint).

## Fees and receipts

Deposit/withdraw are zero protocol fee; performance and protocol-share fees are
[disclosed](./fees/vault-fees.md) and surfaced in prepare results. V2 receipts
distinguish **preparation / submission / settlement** — only settlement proves
completion. See [Receipts](./receipts.md).

## Error handling: fail closed

The SDK refuses rather than guesses. A missing artifact, an unverified chain config,
a low-confidence classification, or a hash mismatch throws — it never silently
proceeds. A failed read leg is `UNKNOWN` (null/degraded), never fabricated. Treat
every failure as "unknown", not as "safe to ignore".

## Related

- [CLI](./cli.md) — the same reads/prepares from the terminal.
- [React](./react.md) — hooks over the SDK.
- [MCP](./mcp.md) — the same primitives as agent tools.
