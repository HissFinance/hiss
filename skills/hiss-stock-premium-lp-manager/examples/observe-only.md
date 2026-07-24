# Example — observe-only scan

**User:** "Show me the premium and usable depth across Robinhood Chain Stock
Tokens."

**Agent flow (no wallet, no capital, no tx):**

1. `GET /api/stock-premium/scan?sort=premium&dir=desc` → the scan payload over the
   admitted universe. The payload is `dataSource: "DEMO"` at its own boundary; each
   row carries a source stamp and a freshness state.
2. Render per asset: real-price reference, pool price, signed premium/discount bps,
   usable depth (probed with simulated swaps — not TVL), freshness, and the
   admission checks.
3. For any "unknown" cell, say "unknown" — never guess.

**Good answer shape:**

> Admitted assets, matched by canonical address (a ticker match at a different
> address is not official). GME shows a +Xbp premium at a $Y usable-depth ceiling
> (thin, single-venue Uniswap v3 on chain 4663). Depth is probed, not TVL — larger
> size moves the price against you. These are live reads, not a forecast, and not a
> guarantee. GME is admitted for analysis; live execution is separately gated.

**Never:** present the pool price as a fill, call the depth "deep/dependable," or
imply any position is live or profitable.
