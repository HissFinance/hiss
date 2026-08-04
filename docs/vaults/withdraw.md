# Withdraw

Withdrawing redeems your **shares**. You prepare the transaction with the SDK/CLI and
**sign it yourself**. Like deposits, a withdrawal is complete only on its **on-chain
settlement receipt**.

## The canonical V2 vault: two exits, both 24/7

The canonical V2 vault (`0x432e90b1B35995EBE46eD93B4Db369abfc230E69`) offers two
user-signed exit paths:

1. **In-kind redemption (the default — the always-available exit).** You redeem
   shares directly on the vault (`inKindRedeem`) and receive your **pro-rata
   basket** of held tokens plus USDG. This path is **valuation-free** — it needs
   no sell into thin liquidity and no fresh oracle mark — so it stays open
   around the clock even when priced settlement is constrained.
2. **Queued USDG redemption.** You enqueue shares in the request queue
   (`0x317d1eEC013a91a316858e80BF782496F231729a`); they settle to **USDG** in an
   epoch batch at the epoch clearing rate, with an optional minimum-USDG-out
   floor. Settlement, not enqueue, completes the redemption.

## What you receive

Redeeming returns the current value of your shares — in-kind as the pro-rata
basket, or queued as USDG at the epoch clearing rate — which reflects the vault's
gains and losses since you deposited. Because depositors share profit and loss,
you may receive **more or less** than you deposited. There is no guaranteed
return. Queued USDG exit pricing is side-aware (a bid-side mark — your pro-rata
value less the realistic cost to liquidate your slice, retained by the vault for
all holders as anti-dilution). See
[24/7 architecture](./24-7-architecture.md#price-mesh-v2--side-aware-pricing).

## Prepare and sign

```ts
import { createHissClient, prepareVaultWithdrawal } from "@hiss-finance/sdk";

const hiss = createHissClient({ chainId: 4663 });
const vault = await hiss.getVault(); // canonical V2 by default

// Default: an unsigned in-kind redemption (pro-rata basket, 24/7).
const inKind = prepareVaultWithdrawal({
  sharesUnits: 500n * 10n ** 18n, // 18-decimal share units
  receiver: "0xYou",
});

// Or: a queued USDG redemption (epoch settlement, optional USDG floor).
const queued = prepareVaultWithdrawal({
  sharesUnits: 500n * 10n ** 18n,
  receiver: "0xYou",
  mode: "queue_usdg",
  minOutUsdg: 0n,
});
// Sign and send `{ to: plan.target, data: plan.calldata }` with your own wallet.
// (For queue_usdg, approve the V2 share token for the queue first — the plan's
// warnings say so.)
```

Or from the terminal:

```bash
# In-kind (default)
hiss vault prepare-withdraw 0x432e90b1B35995EBE46eD93B4Db369abfc230E69 500 0xYou \
  --rpc-url https://rpc.mainnet.chain.robinhood.com

# Queued USDG redemption
hiss vault prepare-withdraw 0x432e90b1B35995EBE46eD93B4Db369abfc230E69 500 0xYou \
  --mode queue_usdg --min-out-usdg 0
```

## Fees on withdrawal

- **Withdrawal fee: 0.** There is no protocol withdrawal fee.
- **Chain gas** is yours to pay; queued-exit pricing discloses its bid-side basis —
  **no hidden spread** (the anti-dilution differential is retained by the vault for
  all holders, never a HISS fee).
- Any **performance fee** is a matter of vault-level crystallization above the
  high-water mark; it is never an extra charge on your principal at exit. See
  [Fees](../fees/vault-fees.md).
- **No HISS subscription.** Preparing and reading this withdrawal through the HISS
  website and app tools is free; the only costs are on-chain (gas and any
  contract-enforced protocol fee), never a HISS charge.

## In-kind redemption (the always-available exit)

The in-kind path is first-class, not a fallback: a redeemer receives their
pro-rata basket of held tokens plus USDG directly, valuation-free, as the honest
unconditional around-the-clock exit — including while priced settlement is
constrained. It is jurisdiction-gated where required, not permissionless
everywhere. See [24/7 architecture](./24-7-architecture.md#the-live-lanes).

## The legacy V1 flagship

The V1 flagship (`0x6d962604df1c6c5ef4b59d88863600fe71bb63e6`) is
**LEGACY · EMPTY** — closed to new deposits with no depositor value remaining,
so there is nothing to withdraw and **no migration flow**. V1-style vaults use
plain ERC-4626 `redeem` for any remaining balances; the address and history stay
documented.

## Lockups

A vault may declare a lockup in its manifest's `depositorPolicy` — check the
manifest before depositing. Any lockup is disclosed up front, never hidden.

## Completion = on-chain settlement receipt

Receipts distinguish **PREPARATION**, **SUBMISSION**, and **SETTLEMENT**. A
withdrawal is settled only when its on-chain transaction confirms (in-kind) or
its epoch settles (queued). A pending or unsigned transaction is not a completed
withdrawal. A failed status read is **unknown** — re-read the chain.

## Emergency conditions

If a vault's `emergencyPauseEnabled` fuse is active, an owner may pause deposits and
rebalances in an emergency. Pause is a safety control, not a way to trap funds; it is
disclosed and bounded by the vault's policy. (On the staking side, xHISS exits are
**never** pausable — see [Cooldown and redeem](../staking/cooldown-and-redeem.md).)

## Next

- [Deposit](./deposit.md) · [Performance](./performance.md) · [Receipts](../receipts.md)
  · [24/7 architecture](./24-7-architecture.md)
