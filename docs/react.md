# React

`@hiss-finance/react` provides **headless hooks and components** over the
[SDK](./sdk.md) for vault, staking, and reward surfaces. It is UI-agnostic: you bring
your own wallet connector and styling. The hooks **read** and **prepare**; signing
happens in your wallet.

> Packages are **not yet published to npm**. Consume from the workspace after
> `pnpm build`.

## Provider

Wrap your app once with the HISS provider (chain config + RPC).

```tsx
import { HissProvider } from "@hiss-finance/react";

export function App({ children }: { children: React.ReactNode }) {
  return (
    <HissProvider chainId={4663} rpcUrl="https://rpc.mainnet.chain.robinhood.com">
      {children}
    </HissProvider>
  );
}
```

## Read hooks

```tsx
import { useVault, useStakingStatus, useRewardSplit } from "@hiss-finance/react";

function VaultCard() {
  const { data: vault, isLoading } = useVault("0x6d962604df1c6c5ef4b59d88863600fe71bb63e6");
  if (isLoading) return <p>Loading…</p>; // unknown while loading — never assume live
  return <p>Share price: {vault.sharePriceUsdg} USDG</p>;
}
```

Read hooks return live chain data and honest loading/error states. A failed read is
**unknown** — render it as such, never as "live" or "not deployed".

## Prepare hooks

Prepare hooks return unsigned transactions and a disclosure; you send them with your
connector.

```tsx
import { usePrepareDeposit } from "@hiss-finance/react";

function DepositButton({ vault, account }: { vault: `0x${string}`; account: `0x${string}` }) {
  const { prepare, disclosure } = usePrepareDeposit({ vault });

  async function onDeposit() {
    const txs = await prepare({ depositor: account, amountUsdg: 1_000_000_000n }); // 1,000 USDG
    // send `txs` with your wallet connector (wagmi/viem/etc.)
  }

  return (
    <>
      <button onClick={onDeposit}>Deposit</button>
      <pre>{disclosure /* every fee, no hidden lines */}</pre>
    </>
  );
}
```

Other hooks: `usePrepareWithdraw`, `usePrepareStake`, `usePrepareStartCooldown`,
`usePrepareRedeem`, `usePreparePublish`.

## Copy rules for UI

If you render staking or reward surfaces, honor the protocol's honesty rules:

- No "guaranteed yield", "APY", "passive income", "risk-free", or external-audit
  claims.
- Include the required staking lines where you show staking: **"Not a performance
  claim."** and **"Historical fee distributions are not forecasts."**
- Distinguish **planned / funded / vesting / claimable** — never imply an unfunded or
  undeployed leg is claimable.
- A failed status fetch is **unknown**, not "not deployed" and not "live".

## Related

- [SDK](./sdk.md) — what the hooks call underneath.
- [Staking](./staking/xhiss.md) · [Fees](./fees/index.md) · [Rewards](./rewards/index.md)
