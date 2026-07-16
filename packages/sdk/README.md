# @hiss-finance/sdk

TypeScript SDK for **HISS Finance** on Robinhood Chain (mainnet `4663`, testnet
`46630`). It does two things:

1. **Public chain reads** via [viem](https://viem.sh) — no HISS API key needed.
2. **Typed, unsigned `ActionPlan`s** you review and sign with your own wallet
   or Safe.

HISS is compilation and verification software. This SDK prepares and verifies;
it never signs a transaction, never submits one, never accepts a private key,
and never calls a credentialed endpoint. Your wallet or Safe signs — always.

## Install

```sh
pnpm add @hiss-finance/sdk viem
```

`viem` is a peer dependency (`^2.21.0`).

## Reads (fail-soft)

Every read is fail-soft: on an RPC error it comes back labeled `degraded` with
`value: null` — never a fabricated `0`, never silently `live`. Treat a degraded
read as **unknown**.

```ts
import { HissClient } from "@hiss-finance/sdk";

const hiss = new HissClient(); // defaults to the public Robinhood Chain RPC

const status = await hiss.getProtocolStatus(); // reachability + block
const registry = hiss.getContractRegistry(); // canonical addresses
const vault = await hiss.getVault(); // flagship vault state
const staking = await hiss.getStakingStatus(); // xHISS status
const position = await hiss.getStakingPosition("0x…"); // one staker
```

Read methods: `getProtocolStatus`, `getContractRegistry`, `getVaults`,
`getVault`, `getVaultHoldings`, `getVaultPerformance`, `getVaultStrategy`,
`getVaultFees`, `getStakingStatus`, `getStakingPosition`, `getRewardStatus`,
`getRewardMethod`, `getReceipts`, `verifyReceipt`.

Point the client at any RPC: `new HissClient({ rpcUrl, chainId })`.

## Action plans (unsigned)

A `prepare*` method returns an `ActionPlan`: `{ chainId, target, function,
decodedArgs, calldata, value, summary, warnings, requiredAcknowledgments,
planHash, expiry }`. Hand it to a wallet to sign — nothing here submits it.

```ts
import { prepareVaultDeposit, prepareHissStake } from "@hiss-finance/sdk";

const plan = prepareVaultDeposit({
  vault: "0x6d962604df1c6c5ef4b59d88863600fe71bb63e6",
  amountUnits: 250_000000n, // 250 USDG (6 decimals)
  receiver: "0xYourWallet…",
  acks: { riskAckHash: "0x…", jurisdictionAckHash: "0x…" },
});

// plan.calldata is ready for your wallet's `data` field. You sign and send.
```

Approve USDG for the vault first (`prepareHissApproval({ token, spender, … })`),
and deposit only when the vault is accepting public deposits — a live read.

Prepare methods: `prepareVaultDeposit`, `prepareVaultWithdrawal`,
`prepareVaultCreation`, `prepareVaultManagementAction`, `prepareHissApproval`,
`prepareHissStake`, `prepareXhissCooldown`, `prepareXhissRedeem`,
`createVaultManifest`, `validateVaultManifest`, `calculateAllocationBps`.

### The plan hash

`planHash = keccak256` over the execution-relevant fields (chain, target,
function, calldata, value) in canonical form — advisory fields (summary,
warnings, expiry) are excluded, so the same call always hashes the same way.

## Verification & coils

- `verifyManifestHash`, `verifyReceiptHash` — reuse the shared
  `@hiss-finance/vault-kit` canonical hasher.
- `validateCoil`, `compileCoil` — deterministic, compile-only strategy specs.
  A compiled coil is always `executable: false`. Nothing here routes an order.

## Safety model

- No key ever enters this SDK. It builds calldata; your wallet signs.
- Fail-closed: an unsupported chain, a bad address, or a non-positive amount
  throws instead of returning a questionable plan.
- Reads never fabricate: unknown is unknown, never `0`, never "live", never
  "not deployed".
- No guaranteed yield, APY, or returns. Not a performance claim.

## License

Apache-2.0.
