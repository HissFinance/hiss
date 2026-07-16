# read-protocol-status

Reads the HISS protocol's chain configuration and contract directory using
`@hiss-finance/sdk`. Read-only — no wallet, no signing.

## Run

```bash
pnpm --filter @hiss-finance/example-read-protocol-status start
```

Optionally copy `.env.example` to `.env` and set `HISS_RPC_URL` to your own RPC.
Without it, the example uses the public Robinhood Chain endpoint.

## Expected output

```
Network:  Robinhood Chain (chain 4663)
Read:     live
Contracts:
  - $HISS token        0x47162135cc8fb253f939Bd70e3D2B83075eaeBa3  [deployed]
  - xHISS vault        0x699861D2C546ab86a7f2AE97ffc7aF89f3FF67Be  [deployed]
  - Flagship vault     0x6d962604df1c6c5ef4b59d88863600fe71bb63e6  [deployed]
```

If the RPC is unreachable, the read fails closed: the status is reported as
`unknown`, never as `live`.
