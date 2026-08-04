# Deposit

Depositing puts USDG into a vault in exchange for **shares**. You prepare the
transactions with the SDK/CLI and **sign them yourself** — HISS never holds your keys
and never deposits on your behalf. A deposit is complete only on its **on-chain
settlement receipt**.

## Where deposits go: the canonical V2 vault

New deposits target the canonical **HISS Vault V2**
(`0x432e90b1B35995EBE46eD93B4Db369abfc230E69`). A V2 deposit is **queue-routed**:

1. You approve USDG for the request queue
   (`HissRequestQueue`, `0x317d1eEC013a91a316858e80BF782496F231729a`).
2. You sign an `enqueue` transaction. The queue escrows your USDG immediately.
3. Your request settles in an **epoch batch** at the epoch clearing rate —
   **shares mint at settlement, not at enqueue**. Nothing is instant by default.

Requests carry an owner (must be the signing wallet), a nonce, an expiry, and an
optional **minimum-shares-out** floor for slippage protection. The queue is open
around the clock; how much can settle safely right now is a **live capacity read
from the Price Mesh — never a fixed promise**. See
[24/7 architecture](./24-7-architecture.md).

The legacy V1 flagship (`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6`) is
**closed to new deposits** (LEGACY · EMPTY). Preparing a V1-targeted deposit
produces an explicit legacy warning — never deposit there.

## Before you deposit

- You may need to acknowledge the vault's **risk** and **jurisdiction** terms
  where the vault requires them.
- Understand that **you share profits and losses**. There is no guaranteed yield and
  no floor.
- Shares mint at the epoch clearing rate at settlement — set `minOutShares` if you
  want a floor.

## Amounts and decimals

USDG has **6 decimals**. Always use base units:

```
1,000 USDG  = 1_000_000_000n
1 USDG      = 1_000_000n
```

## Prepare and sign

```ts
import { createHissClient, prepareVaultDeposit, ADDRESSES } from "@hiss-finance/sdk";

// Live read first (queue/capacity/pause state is always live — never copy a snapshot).
const hiss = createHissClient({ chainId: 4663 });
const vault = await hiss.getVault(); // defaults to the canonical V2 vault
const v2 = await hiss.getVaultV2Status(); // live queue / keeper / capacity snapshot

// Prepare: an unsigned queue `enqueue` plan (approve USDG for the queue first —
// see prepareErc20Approval and the plan's warnings). Nothing is signed or sent.
const plan = prepareVaultDeposit({
  amountUnits: 1_000_000_000n, // 1,000 USDG
  receiver: "0xYou", // the queue-request OWNER — must be the signing wallet
  minOutShares: 0n, // set a floor for slippage protection
});

// Sign and send `{ to: plan.target, data: plan.calldata }` with your own wallet.
```

Or from the terminal:

```bash
hiss vault prepare-deposit 0x432e90b1B35995EBE46eD93B4Db369abfc230E69 1000 0xYou \
  --min-out-shares 0 --rpc-url https://rpc.mainnet.chain.robinhood.com
```

## Shares and share price

You receive ERC-4626 shares priced at the **epoch clearing rate** at settlement.
Shares represent a pro-rata claim on vault assets; their USDG value moves with the
vault's holdings. See [Performance](./performance.md).

## Fees on deposit

- **Deposit fee: 0.** There is no protocol deposit fee.
- **No performance fee on deposit.** Performance fees apply only to new profit above
  the high-water mark, at crystallization — never on your way in.
- **Chain gas** is yours to pay. Entry pricing is side-aware (an ask-side mark —
  the real cost to acquire exposure, retained by the vault for all holders as
  anti-dilution, never a HISS fee). See [Fees](../fees/vault-fees.md) and
  [24/7 architecture](./24-7-architecture.md#price-mesh-v2--side-aware-pricing).
- **No HISS subscription.** The website and app tools that prepare this deposit are free
  (no subscription, credits, or paywall). The only costs are on-chain: network gas and
  any contract-enforced protocol fee — never a HISS charge.

## Completion = on-chain settlement receipt

Receipts distinguish **PREPARATION** (an unsigned plan), **SUBMISSION** (a sent
enqueue transaction), and **SETTLEMENT** (the epoch settled and shares minted).
A deposit is complete only at **settlement** — an enqueued-but-unsettled request
is escrowed, not deposited. If a status read fails, treat it as **unknown** —
re-read the chain. See [Receipts](./receipts.md).

## Availability is evidence-driven, 24/7

The queue accepts requests around the clock. Availability and safe size are
decided by **on-chain market health evidence** — executable depth, price
corroboration, peg and sequencer health — never by the calendar or an exchange
session. Dynamic capacity is a **live Price Mesh read**. When priced settlement
is constrained, requests wait for a settling epoch and the
[in-kind exit](./withdraw.md#in-kind-redemption-the-always-available-exit)
remains open. A failed read is **unknown**, never "open" and never "closed".

## Via Bankr (optional, region-dependent)

Some deposits can be prepared as [Bankr commands](../bankrbot.md) (packs bounded in
size, `hissExecutesDeposit: false`). Bankr rails are **region- and provider-dependent**
and only complete on the on-chain receipt. HISS never executes the deposit for you.

## Next

- [Withdraw](./withdraw.md) · [Performance](./performance.md) · [Receipts](../receipts.md)
  · [24/7 architecture](./24-7-architecture.md)
