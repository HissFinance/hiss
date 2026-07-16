# verify-receipt

Recomputes a HISS **paper** receipt's canonical content hash with
`@hiss-finance/core` (`hashCanonical`) and compares it to the receipt's stored
hash — demonstrating both a valid match and a detected tamper.

## Run

```bash
pnpm --filter @hiss-finance/example-verify-receipt start
```

## Expected output

```
Receipt id:   example-0001
Anchoring:    paper (local proof, not on-chain)
Hash:         0x...
Verified:     true
Tampered ok:  false  (expected false)
```

A paper receipt is a local, content-addressed proof of what was generated. It is
not an on-chain anchor, not a signature, and not a performance claim. In a React
app, `@hiss-finance/react`'s `useReceiptVerification` hook wraps this same check.
