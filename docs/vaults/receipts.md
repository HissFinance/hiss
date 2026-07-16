# Vault receipts

Every meaningful on-chain vault action — publish, deposit, withdraw, rebalance,
strategy update — produces a **receipt**: a verifiable record of what happened. Receipts
are how "it happened" is proven, and how planned/intended is distinguished from settled.

> This page focuses on vault receipts. For the protocol-wide receipt model, see
> [Receipts](../receipts.md).

## What a receipt records

- **The action** — deposit, withdraw, rebalance, publish, strategy update.
- **The vault** and the actor (depositor/creator address).
- **Amounts** — in base units (USDG 6dp, shares 18dp).
- **The on-chain reference** — transaction hash / block, recorded in the
  `VaultReceiptRegistry`.
- **Integrity data** — hashes that let anyone verify the receipt was not altered.

## Why receipts matter

- **Completion is on-chain.** A deposit or withdrawal is complete only when its receipt
  exists — never on a prepared-but-unsigned or pending transaction.
- **Rebalances are auditable.** A post-run audit reconciles the intended rebalance
  (the compiled [coil](../coilops.md)) against what the receipt shows occurred.
- **Honesty.** Receipts are affirmative evidence; a missing receipt is **unknown**,
  never assumed done.

## Creating and verifying

Via the SDK/MCP:

```ts
// Build a receipt for an action
const receipt = await hiss.receipts.create({ vault, action: "deposit", txHash });

// Verify a receipt's integrity
const ok = await hiss.receipts.verify(receipt);
```

MCP tools: `hiss_generate_vault_receipt`, `hiss_create_receipt`, `hiss_verify_receipt`.
x402 endpoints: `generate-vault-receipt`, `hiss-receipt-verify`.

## Receipt lifecycle around a deposit

```
prepareDeposit ──▶ user signs ──▶ tx pending ──▶ tx confirmed ──▶ receipt recorded
   (not done)       (not done)     (not done)      (settled)        (verifiable)
```

Only the last two states mean the deposit occurred. Treat everything before as **not
complete**.

## Related

- [Deposit](./deposit.md) · [Withdraw](./withdraw.md) · [Strategy updates](./strategy-updates.md)
- [Receipts (protocol-wide)](../receipts.md) · [CoilOps](../coilops.md)
