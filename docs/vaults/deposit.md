# Deposit

Depositing puts USDG into a vault in exchange for **shares**. You prepare the
transactions with the SDK and **sign them yourself** — HISS never holds your keys and
never deposits on your behalf. A deposit is complete only on its **on-chain receipt**.

## Before you deposit

- The vault must have **public deposits open** (creator skin-in-game ≥5% met, legal/
  deposit readiness satisfied, not paused).
- You may need to acknowledge the vault's **risk** and **jurisdiction** terms
  (`riskAckRequired`, `jurisdictionAckRequired` in the manifest).
- Understand that **you share profits and losses**. There is no guaranteed yield and
  no floor.

## Amounts and decimals

USDG has **6 decimals**. Always use base units:

```
1,000 USDG  = 1_000_000_000n
1 USDG      = 1_000_000n
```

## Prepare and sign

```ts
import { HissClient } from "@hiss-finance/sdk";
const hiss = new HissClient({ chainId: 4663 });

// Live read first (share price is always live — never copy a snapshot).
const vault = await hiss.vaults.read("0x6d962604df1c6c5ef4b59d88863600fe71bb63e6");

// Prepare: returns [approve USDG, deposit] as unsigned transactions + a fee disclosure.
const { transactions, disclosure } = await hiss.vaults.prepareDeposit({
  vault: vault.address,
  depositor: "0xYou",
  amountUsdg: 1_000_000_000n, // 1,000 USDG
});
console.log(disclosure); // every fee and effect, no hidden lines

// Sign and send with your wallet.
for (const tx of transactions) {
  // wallet.sendTransaction({ account: "0xYou", ...tx })
}
```

## Shares and share price

You receive ERC-4626 shares priced at the **live share price** at execution. Shares
represent a pro-rata claim on vault assets; their USDG value moves with the vault's
holdings. See [Performance](./performance.md).

## Fees on deposit

- **Deposit fee: 0.** There is no protocol deposit fee.
- **No performance fee on deposit.** Performance fees apply only to new profit above
  the high-water mark, at crystallization — never on your way in.
- **Chain gas** is yours to pay; **slippage/liquidity costs** (if any, once routing is
  live) are disclosed separately — no hidden spread. See [Fees](../fees/vault-fees.md).

## Completion = on-chain receipt

A deposit is settled only when the on-chain deposit transaction confirms and its
[receipt](./receipts.md) exists. A prepared-but-unsigned or pending transaction is
**not** a completed deposit. If a status read fails, treat it as **unknown** — re-read
the chain.

## Via Bankr (optional, region-dependent)

Some deposits can be prepared as [Bankr commands](../bankrbot.md) (packs bounded in
size, `hissExecutesDeposit: false`). Bankr rails are **region- and provider-dependent**
and only complete on the on-chain receipt. HISS never executes the deposit for you.

## Next

- [Withdraw](./withdraw.md) · [Performance](./performance.md) · [Receipts](../receipts.md)
