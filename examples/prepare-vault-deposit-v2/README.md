# prepare-vault-deposit-v2 (canonical)

The **canonical deposit example**. It discovers the canonical new-deposit vault
(**HISS Vault V2**) from `@hiss-finance/sdk`'s `VAULT_LIFECYCLE` constants,
reads live V2 status + capacity from chain (`getVaultV2Status`), and builds an
**unsigned** queue-deposit plan with `prepareVaultDeposit`, plus the in-kind
redemption plan as the exit path.

Nothing here signs or sends a transaction: every plan prints
`signed: false` and `liveTransactionSent: false`. You review a plan and sign it
with your own wallet or Safe — or not at all.

## What it shows

1. **Discovery** — `VAULT_LIFECYCLE.canonicalDepositVault` is the canonical V2
   vault; the V1 flagship is legacy (closed to new deposits).
2. **Live status** — pause/queue/keeper state and deposit capacity are live
   chain reads. Failed reads print `unknown (degraded read)`, never a
   fabricated value. Vault capacity is computed from current onchain liveness
   evidence. When liveness evidence expires, execution capacity fails closed
   until refreshed.
3. **Unsigned deposit plan** — V2 deposits route through the **request queue**
   (`enqueue`): approve USDG for the _queue_, shares mint at **epoch
   settlement** (never at enqueue), and `minOutShares` floors the clearing
   rate.
4. **Exit path** — the valuation-free **in-kind redemption** (`inKindRedeem`)
   is the always-available 24/7 exit and pays the exact pro-rata basket (USDG
   cash + held tokens). Fallback: `mode: "queue_usdg"` queues a USDG-only
   redemption that settles at the epoch clearing rate.

## Run

```bash
pnpm --filter @hiss-finance/example-prepare-vault-deposit-v2 start
```

Optionally copy `.env.example` to `.env` and set `HISS_RPC_URL` to your own RPC.
Without it, the example uses the public Robinhood Chain endpoint.

## Expected output (shape)

Live numbers vary with chain state; degraded reads print as `unknown`.

```
Canonical vault discovery
  HISS Vault V2 — canonical new-deposit vault (queue-routed epoch settlement, 24/7 lanes)
  address: 0x432e90b1b35995ebe46ed93b4db369abfc230e69
  ...

Deposit plan (V2 request queue)
  signed:              false
  liveTransactionSent: false
  summary:  Queue a deposit of 100000000 USDG units into the canonical V2 vault ...
  target:   0x317d1eEC013a91a316858e80BF782496F231729a (chain 4663)
  function: enqueue((bytes32,address,uint8,uint256,uint256,uint64,uint64,uint64,uint8,bytes32,uint256))
  ...

Exit plan (in-kind redemption — the always-available V2 exit)
  signed:              false
  liveTransactionSent: false
  function: inKindRedeem(uint256,address,address)
```

The plan is a description only. Depositing is not direct ownership of the
underlying securities, and you must sign any transaction yourself.
