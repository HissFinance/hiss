# SDK

`@hiss-finance/sdk` is the high-level client for HISS Finance. It does two things:

- **Read** vault, staking, and reward state from Robinhood Chain.
- **Prepare** transactions — build the calldata for **you** to sign.

It never signs, never broadcasts on your behalf, never holds keys, and never takes
custody. Preparation returns unsigned transactions; you send them with your own
wallet.

> Packages are **not yet published to npm**. Consume them from the workspace after
> `pnpm build`, or via a local `file:`/`link:` reference.

## Client

```ts
import { HissClient } from "@hiss-finance/sdk";

const hiss = new HissClient({
  chainId: 4663, // or 46630 for testnet
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
});
```

`@hiss-finance/core` provides the underlying chain config, address book, and
deterministic math the SDK builds on.

## Reads (no keys required)

```ts
// Protocol status: deployments, readiness, staking, rewards.
const status = await hiss.status.read();

// A specific vault — always a live chain read (share price, TVL, readiness).
const vault = await hiss.vaults.read("0x6d962604df1c6c5ef4b59d88863600fe71bb63e6");

// Staking state for the xHISS vault.
const staking = await hiss.staking.read();

// The current reward split plan (planned ≠ funded ≠ claimable).
const split = await hiss.rewards.readSplit();
// V2 (`hiss-reward-split-v2`) RewardModel legs, in basis points:
//   split.xhissStakersBps       // 5000
//   split.vaultProvidersBps     // 1500 (distributor not deployed → null recipient)
//   split.vaultContributorsBps  // 1500 (distributor not deployed → null recipient)
//   split.treasuryBps           // 1000
//   split.burnBps               // 1000  → split.burnAddress (canonical dead address)
// The burn leg is an economic burn: HISS leaves circulation but totalSupply is unchanged.

// A Vault Contributor's reward (formerly getDepositorReward).
const contributorReward = await hiss.rewards.getVaultContributorReward("0xYou");
```

Reads reflect on-chain reality at the time of the call. Never cache a balance or a
"live/not-deployed" status; re-read for anything transactional.

## Prepares (you sign)

Every `prepare*` returns one or more unsigned transactions plus a human-readable
disclosure of fees and effects.

```ts
// Deposit USDG (6 decimals) — returns approve + deposit.
const depositTxs = await hiss.vaults.prepareDeposit({
  vault: vault.address,
  depositor: "0xYou",
  amountUsdg: 1_000_000_000n,
});

// Withdraw shares.
const withdrawTxs = await hiss.vaults.prepareWithdraw({
  vault: vault.address,
  owner: "0xYou",
  shares: 500n * 10n ** 18n,
});

// Stake $HISS (18 decimals) into xHISS.
const stakeTxs = await hiss.staking.prepareStake({ staker: "0xYou", amountHiss: 500n * 10n ** 18n });

// Exit: start cooldown, then redeem within the window.
const cooldownTx = await hiss.staking.prepareStartCooldown({ staker: "0xYou", xShares: 250n * 10n ** 18n });
const redeemTx = await hiss.staking.prepareRedeem({
  staker: "0xYou",
  xShares: 250n * 10n ** 18n,
  receiver: "0xYou",
});

// Publish a composed manifest (creation fee applies on-chain).
const publishTx = await hiss.vaults.preparePublish({ manifest, manifestHash });
```

Sign and send with your wallet (viem example):

```ts
import { createWalletClient, http } from "viem";
const wallet = createWalletClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
for (const tx of depositTxs) {
  await wallet.sendTransaction({ account: "0xYou", ...tx });
}
```

## Decimals matter

- **USDG:** 6 decimals — `1,000 USDG = 1_000_000_000n`.
- **$HISS / xHISS:** 18 decimals — `1 HISS = 10n ** 18n`.

Mixing these is the most common integration bug. The SDK takes and returns **base
units** (bigint).

## Fees and receipts

Deposit/withdraw are zero protocol fee; performance and protocol-share fees are
[disclosed](./fees/vault-fees.md) and surfaced in prepare results. On-chain actions
produce [receipts](./receipts.md).

## Error handling: fail closed

The SDK refuses rather than guesses. A missing artifact, an unverified chain config,
a low-confidence classification, or a hash mismatch throws — it never silently
proceeds. Treat every failure as "unknown", not as "safe to ignore".

## Related

- [CLI](./cli.md) — the same reads/prepares from the terminal.
- [React](./react.md) — hooks over the SDK.
- [MCP](./mcp.md) — the same primitives as agent tools.
