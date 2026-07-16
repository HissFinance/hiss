# Withdraw

Withdrawing redeems your **shares** for their USDG value. You prepare the transaction
with the SDK and **sign it yourself**. Like deposits, a withdrawal is complete only on
its **on-chain receipt**.

## What you receive

Redeeming shares returns the **current USDG value** of those shares at the live share
price — which reflects the vault's gains and losses since you deposited. Because
depositors share profit and loss, you may receive **more or less** than you deposited.
There is no guaranteed return.

## Prepare and sign

```ts
import { HissClient } from "@hiss-finance/sdk";
const hiss = new HissClient({ chainId: 4663 });

const vault = await hiss.vaults.read("0x6d962604df1c6c5ef4b59d88863600fe71bb63e6");

// Prepare a redemption of shares (18-decimal share units).
const { transactions, disclosure } = await hiss.vaults.prepareWithdraw({
  vault: vault.address,
  owner: "0xYou",
  shares: 500n * 10n ** 18n,
});
console.log(disclosure);
// Sign and send `transactions` with your wallet.
```

You can redeem a specific share amount, or prepare a full exit of your balance.

## Fees on withdrawal

- **Withdrawal fee: 0.** There is no protocol withdrawal fee.
- **Chain gas, liquidity-unwind, and slippage** are disclosed separately and are not a
  HISS fee — **no hidden spread**. Once routing is live, unwinding non-USDG holdings may
  incur venue slippage, always disclosed.
- Any **performance fee** is a matter of vault-level crystallization above the
  high-water mark; it is never an extra charge on your principal at exit. See
  [Fees](../fees/vault-fees.md).

## Lockups

The flagship vault uses `lockupSeconds: 0` (no lockup). A specific vault may declare a
lockup in its manifest's `depositorPolicy` — check the manifest before depositing. Any
lockup is disclosed up front, never hidden.

## Completion = on-chain receipt

A withdrawal is settled only when its on-chain transaction confirms and its
[receipt](../receipts.md) exists. A pending or unsigned transaction is not a completed
withdrawal. A failed status read is **unknown** — re-read the chain.

## Emergency conditions

If a vault's `emergencyPauseEnabled` fuse is active, an owner may pause deposits and
rebalances in an emergency. Pause is a safety control, not a way to trap funds; it is
disclosed and bounded by the vault's policy. (On the staking side, xHISS exits are
**never** pausable — see [Cooldown and redeem](../staking/cooldown-and-redeem.md).)

## Next

- [Deposit](./deposit.md) · [Performance](./performance.md) · [Receipts](../receipts.md)
