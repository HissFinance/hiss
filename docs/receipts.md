# Receipts

A **receipt** is a verifiable record that something happened on-chain. Receipts are how
HISS distinguishes **planned/intended** from **settled**, and how anyone can audit an
action after the fact. They are the backbone of the protocol's honesty guarantees.

## Where receipts apply

- **Vault actions** — publish, deposit, withdraw, rebalance, strategy update (recorded
  in the `VaultReceiptRegistry`). See [Vault receipts](./vaults/receipts.md).
- **Rebalances** — a **post-run audit** reconciles the compiled intent (a
  [coil](./coilops.md)) against what the receipt shows occurred.
- **Agent rails** — Bankr deposits and stock-token jobs must be **reconciled against
  their on-chain receipts** before being called settled.
- **Safe actions** — protocol actions authorized by the Treasury Safe leave on-chain
  transactions that serve as their proof.

## What a receipt proves

- **That it happened** — an on-chain transaction reference (hash/block).
- **What happened** — action type, actor, amounts (base units), and target.
- **Integrity** — hashes so the record cannot be silently altered.

## Completion is on-chain, always

```
prepare ──▶ sign ──▶ pending ──▶ confirmed ──▶ receipt
(not done)  (not done) (not done)  (settled)    (verifiable)
```

Only the last two states mean an action occurred. A prepared, signed-but-pending, or
unconfirmed action is **not** complete. This is why every rail reconciles against a
receipt and why an unconfirmed Bankr job is never reported as settled.

## Creating and verifying

```ts
const receipt = await hiss.receipts.create({ vault, action: "deposit", txHash });
const ok = await hiss.receipts.verify(receipt);
```

MCP tools: `hiss_generate_vault_receipt`, `hiss_create_receipt`, `hiss_verify_receipt`.
x402: `generate-vault-receipt`, `hiss-receipt-verify`.

## Receipts and honesty

- A **missing** receipt is **unknown**, never "done".
- A receipt is **affirmative evidence** — negative and positive claims about an action's
  state should trace to a receipt or an on-chain read, not to a hopeful assumption. See
  [Status and data freshness](./status-and-data-freshness.md).
