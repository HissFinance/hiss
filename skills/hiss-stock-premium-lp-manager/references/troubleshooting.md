# Troubleshooting

| Symptom | Meaning | What to do |
|---|---|---|
| A cell reads "unknown" | A live read failed or evidence was low-confidence. | Show "unknown" — never guess, never render "live" or "not deployed." Retry the read; do not fabricate a value. |
| `confidence: UNKNOWN` | Reference, pool output, or dynamic capacity could not be evaluated. | Fail closed. Do not treat capacity as zero or unlimited; surface the degradation reason. |
| `confidence: OVER_CAPACITY` | Notional exceeds the dynamic safe-notional. | The single-range estimate is a conservative under-bound, not authorized capacity. Reduce size or split rungs. |
| `confidence: DISPLAY_ONLY` | Producer mark is display-only (NAV alive, execution not authorized). | Show as reference only; do not present as an executable fill. |
| `confidence: HALTED` | The mesh rejected the asset (corporate action, oracle pause). | Block new positions; surface the reason. Observe/exit remain reachable. |
| A fuse returns `HALT` | A binding constraint failed. | New positions are blocked; observing and exiting stay reachable. Never widen a fuse to force a pass. |
| Preparing is disabled with a location reason | `retailEligible=false` — jurisdiction gate. | Render the owner-handled wording literally (`LOCATION_VERIFICATION_REQUIRED` / `JURISDICTION_UNAVAILABLE`). Do not author or restructure legal copy. |
| Position shows `UNRECONCILED` | Not yet proven on-chain. | Show "not settled." Reconcile the on-chain receipt; retry only after reconciliation, never automatically. |
| Bankr job reports "completed" | A completed job is not settlement. | Only a reconciled on-chain receipt counts. Keep the position `UNRECONCILED` until then. |
| Receipt verify says "Does not match" | Recomputed hash differs. | The receipt does not count. Do not treat it as proof of anything. |
| Fees look positive but net is negative | Expected — fees are not profit. | Render the signed net beside the fees; a negative net is shown negative, never styled as a win. |
| An asset matches by ticker but a different address | Impostor. | Reject — address is identity. A ticker match is never sufficient. |

## Never

- Never emit a signed transaction, a private key, a Bankr API key, arbitrary
  calldata, or an unbounded/unlimited approval.
- Never invent live state, a fill price, a settlement, or a performance number.
- Never use guaranteed / risk-free / passive-income / APY / arbitrage framing.
- Never claim HISS signs, custodies, hedges, shorts, or places orders.
