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
- **No HISS subscription.** The website and app tools that prepare this deposit are free
  (no subscription, credits, or paywall). The only costs are on-chain: network gas and
  any contract-enforced protocol fee — never a HISS charge.

## Completion = on-chain receipt

A deposit is settled only when the on-chain deposit transaction confirms and its
[receipt](./receipts.md) exists. A prepared-but-unsigned or pending transaction is
**not** a completed deposit. If a status read fails, treat it as **unknown** — re-read
the chain.

## Deposit availability (when deposits are advertised open)

Deposits are advertised open only when every provable condition holds — the
contract's deposit switch, the on-chain readiness registry, usable live pricing,
not-paused, and the per-basis feed-freshness policy (trading session open, every
required basket feed within its bound). Outside those windows the deposit entry
reports the honest reason (for example market-closed or oracle-unavailable) and
reopens when feeds resume. See
[the effective deposit gate](./risk-fuses.md#the-effective-deposit-gate-advertised-availability).

## Deposit-anytime intents (pending activation — NOT live)

A forward-priced "deposit anytime" path is **designed and fork-tested but not
active**: the user would sign **once** at intent time (a USDG permit that is
itself the intent — amount, vault, acknowledgments, and expiry pinned), and a
keeper would submit the strike at the next fresh-price window, with shares
minting directly to the user's wallet at that window's NAV and the intent
cancellable any time before the strike. The executor contract
(`HissDepositIntentExecutor`) is **not deployed** — deployment remains
owner-gated behind the audit gate. Until it is deployed and activated, this
path does not exist on-chain and nothing here should be read as an available
action: deposits open when feeds resume publishing.

## Via Bankr (optional, region-dependent)

Some deposits can be prepared as [Bankr commands](../bankrbot.md) (packs bounded in
size, `hissExecutesDeposit: false`). Bankr rails are **region- and provider-dependent**
and only complete on the on-chain receipt. HISS never executes the deposit for you.

## Next

- [Withdraw](./withdraw.md) · [Performance](./performance.md) · [Receipts](../receipts.md)
