# Bankr compatibility

The Stock Premium LP Manager is Bankr-compatible in prepare-only mode: HISS
compiles a typed UNSIGNED LP position package; the user's authenticated Bankr
session is one of the execution authorities that can submit it.

## What HISS does and does not do

- HISS prepares the typed unsigned package (mint / increase / decrease / collect /
  burn) and the exact Signature Review payload with the calldata hash.
- HISS never holds a Bankr API key, never signs, never submits arbitrary
  transactions, and never bypasses Bankr location verification. Bankr's console
  handles location verification externally.
- The user hands the package to their own Bankr session under explicit bounded
  authorization. HISS reconciles the on-chain receipt afterward.

## Settlement truth

A completed Bankr job is NOT settlement. Only an on-chain receipt with the expected
status on chain 4663, reconciled to the prepared package, counts as settled. Until
then the position is `UNRECONCILED`.

## Separation from the Bankr stock-token trade rail

This is NOT the Bankr stock-token trade lane (`hiss-bankr-stock-tokens`, Rail B).
That rail swaps USDG to/from Stock Tokens through the B2 swap adapter. This skill
prepares an LP position through a SEPARATE typed `NonfungiblePositionManager`
adapter. A trade and an LP position are different actions on different contracts —
never conflated. Moving USDG between rails is a manual handoff, never an
auto-bridge.
