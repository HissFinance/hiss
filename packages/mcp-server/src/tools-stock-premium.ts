/**
 * Stock Premium LP — the 11 canonical MCP tool DEFINITIONS.
 *
 * Five reads (registry, scan, explain, ladder preview, position read), five
 * prepares (mint / increase / withdraw / collect / close), and one read/verify
 * (verify receipt). Every handler resolves the engine from the injected
 * `ToolContext.stockPremium`, falling back to the deterministic DEMO
 * `stockPremiumFixtureEngine` so the public package is self-contained. The
 * private deployment injects the real `@hiss/core` engine.
 *
 * Boundary: READ + PREPARE only. Every prepared package is UNSIGNED
 * (`signed:false`, `liveTransactionSent:false`, `preparedByHiss:true`) and every
 * summary is written to pass the execution-claim output guard — no summary ever
 * reads like a completed on-chain action. A prepared package is never evidence
 * that anything happened on chain. This is a bounded, uncertain strategy surface
 * — never arbitrage, never a guaranteed return; LP fees are not profit.
 */

import { assertRealizableUnsignedTx } from "./lib/txguard.js";
import {
  stockPremiumFixtureEngine,
  StockPremiumInputError,
  type PrepareResult,
  type StockPremiumEngine,
} from "./lib/stock-premium.js";
import type { JsonRecord } from "./lib/types.js";
import type { ToolContext, ToolDefinition, ToolOutcome } from "./tools.js";
import { ToolInputError } from "./tools.js";

// ---------------------------------------------------------------------------
// input helpers (local — the base helpers in tools.ts are not exported)
// ---------------------------------------------------------------------------

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const UINT_STRING_RE = /^\d+$/;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqString(args: JsonRecord, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new ToolInputError(`\`${key}\` is required and must be a non-empty string.`);
  }
  return v;
}

function reqAddress(args: JsonRecord, key: string): string {
  const v = reqString(args, key);
  if (!ADDRESS_RE.test(v)) throw new ToolInputError(`\`${key}\` must be a 0x-prefixed 20-byte address.`);
  return v;
}

function reqUintString(args: JsonRecord, key: string): string {
  const v = reqString(args, key);
  if (!UINT_STRING_RE.test(v)) {
    throw new ToolInputError(`\`${key}\` must be an integer base-unit string (no decimals).`);
  }
  return v;
}

function reqInt(args: JsonRecord, key: string): number {
  const v = args[key];
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new ToolInputError(`\`${key}\` is required and must be an integer.`);
  }
  return v;
}

function optUintString(args: JsonRecord, key: string): string | undefined {
  const v = args[key];
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !UINT_STRING_RE.test(v)) {
    throw new ToolInputError(`\`${key}\` must be an integer base-unit string (no decimals).`);
  }
  return v;
}

function optStringArray(args: JsonRecord, key: string): string[] | undefined {
  const v = args[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    throw new ToolInputError(`\`${key}\` must be an array of strings.`);
  }
  return v as string[];
}

function reqAuthority(args: JsonRecord): { kind?: string; address: string } {
  const a = args.authority;
  if (!isRecord(a) || typeof a.address !== "string" || !ADDRESS_RE.test(a.address)) {
    throw new ToolInputError("`authority` must be an object with a 20-byte `address`.");
  }
  return { kind: typeof a.kind === "string" ? a.kind : undefined, address: a.address };
}

function engineOf(ctx: ToolContext): StockPremiumEngine {
  return ctx.stockPremium ?? stockPremiumFixtureEngine;
}

/** Wrap an engine call, mapping a StockPremiumInputError to a typed ToolInputError. */
async function run<T>(fn: () => Promise<T> | T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof StockPremiumInputError) throw new ToolInputError(err.message, err.issues);
    throw err;
  }
}

const PREPARE_NOTE =
  "This is an UNSIGNED, prepare-only LP package. HISS holds no keys and sends nothing; review each call and " +
  "submit it with your own wallet, Safe, smart account, or authenticated session. The pinned target is always " +
  "shown. An action is complete only after YOUR OWN on-chain receipt confirms. A one-sided USDG range below pool " +
  "price is a bounded buy ladder, never guaranteed arbitrage: fees are not profit and inventory value can fall.";

/** Turn a prepare result into a guarded outcome; a rejection becomes a typed error. */
function prepareOutcome(result: PrepareResult, opLabel: string): ToolOutcome {
  if (!result.ok) {
    throw new ToolInputError(
      `Refusing to prepare ${opLabel}: fail-closed.`,
      result.rejections.map((r) => ({ code: r.reason, message: r.detail })),
    );
  }
  // Fail-closed structural check: every prepared call is a real target + selector.
  for (const c of result.intent.calls) {
    assertRealizableUnsignedTx(c.target, c.calldata);
  }
  return {
    summary: `Prepared an unsigned ${opLabel} package (${result.intent.calls.length} call(s), ${result.dataMode}). Nothing was signed and nothing was sent.`,
    structured: { ...(result as unknown as JsonRecord), note: PREPARE_NOTE },
  };
}

// ---------------------------------------------------------------------------
// read tools
// ---------------------------------------------------------------------------

const READ: ToolDefinition[] = [
  {
    name: "hiss_stock_token_registry",
    title: "Stock Token registry",
    kind: "read",
    description:
      "List the dynamic, admission-gated Robinhood Chain Stock-Token registry (canonical address is identity; a matching ticker is never sufficient). Facts only — never a recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Optional symbol/address filter (case-insensitive contains).",
        },
      },
    },
    handler: (args, ctx) =>
      run(async () => {
        const result = await engineOf(ctx).registry({
          symbol: typeof args.symbol === "string" ? args.symbol : null,
        });
        return {
          summary: `${result.entries.length} Stock Token(s) listed (${result.dataMode}).`,
          structured: result as unknown as JsonRecord,
        };
      }),
  },
  {
    name: "hiss_stock_premium_scan",
    title: "Stock premium scan",
    kind: "read",
    description:
      "Scan Stock-Token premium/discount, ranked by a bounded, amount-aware, risk-adjusted score (never the largest premium alone). Fees are not profit; a premium is a size-dependent, uncertain edge.",
    inputSchema: {
      type: "object",
      properties: {
        probeUsdg: {
          type: "string",
          description: "Probe size in USDG base units (6-dec integer string). Default 100e6.",
        },
        symbol: { type: "string", description: "Optional symbol/address filter." },
        state: { type: "string", description: "Optional state filter: usable | excluded." },
      },
    },
    handler: (args, ctx) =>
      run(async () => {
        const result = await engineOf(ctx).scan({
          probeUsdg: optUintString(args, "probeUsdg"),
          symbol: typeof args.symbol === "string" ? args.symbol : null,
          state: typeof args.state === "string" ? args.state : null,
        });
        return {
          summary: `${result.rows.length} row(s) scanned (${result.dataMode}). Not a performance claim.`,
          structured: result as unknown as JsonRecord,
        };
      }),
  },
  {
    name: "hiss_stock_premium_explain",
    title: "Explain stock premium",
    kind: "read",
    description:
      "Explain the amount-aware, direction-specific premium/discount for one Stock Token: raw reference, multiplier-once semantics, executable price, impact, capacity, and fuse verdict. Never arbitrage.",
    inputSchema: {
      type: "object",
      required: ["symbol"],
      properties: {
        symbol: { type: "string", description: "Stock Token symbol or canonical address." },
        notionalUsdg: {
          type: "string",
          description: "Probe notional in USDG base units (6-dec integer string). Default 100e6.",
        },
      },
    },
    handler: (args, ctx) =>
      run(async () => {
        const symbol = reqString(args, "symbol");
        const result = await engineOf(ctx).explain({
          symbol,
          notionalUsdg: optUintString(args, "notionalUsdg"),
        });
        return {
          summary: `Premium evidence for ${symbol} read (${result.dataMode}). A premium is a size-dependent, uncertain edge — never a guaranteed return.`,
          structured: result as unknown as JsonRecord,
        };
      }),
  },
  {
    name: "hiss_lp_ladder_preview",
    title: "LP ladder preview",
    kind: "read",
    description:
      "Preview a one-sided Uniswap v3 USDG range-ladder (bounded buy ladder / discount sell ladder) with its full honest cost + inventory model. Preview only — nothing is prepared, signed, or sent.",
    inputSchema: {
      type: "object",
      required: ["symbol", "boundaryPriceUsdE18", "totalCapital"],
      properties: {
        symbol: { type: "string", description: "Stock Token symbol or canonical address." },
        template: {
          type: "string",
          description: "PREMIUM_USDG_BUY_LADDER (default) | DISCOUNT_TOKEN_SELL_LADDER.",
        },
        boundaryPriceUsdE18: {
          type: "string",
          description:
            "Accepted price boundary (USD-18 integer string): BUY floor (< spot) or SELL ceiling (> spot).",
        },
        rungs: { type: "number", description: "Number of ladder rungs (1..20). Default 4." },
        totalCapital: {
          type: "string",
          description: "Total capital base units: USDG 6-dec for BUY, stock 18-dec for SELL.",
        },
      },
    },
    handler: (args, ctx) =>
      run(async () => {
        const symbol = reqString(args, "symbol");
        const result = await engineOf(ctx).ladderPreview({
          symbol,
          template:
            args.template === "DISCOUNT_TOKEN_SELL_LADDER"
              ? "DISCOUNT_TOKEN_SELL_LADDER"
              : "PREMIUM_USDG_BUY_LADDER",
          boundaryPriceUsdE18: reqUintString(args, "boundaryPriceUsdE18"),
          rungs: typeof args.rungs === "number" ? args.rungs : undefined,
          totalCapital: reqUintString(args, "totalCapital"),
        });
        return {
          summary: result.ok
            ? `Previewed a ${result.rungs.length}-rung ${result.direction} ladder for ${symbol} (${result.dataMode}). Bounded, uncertain — never arbitrage.`
            : `Ladder preview declined for ${symbol}: ${result.rejections.length} rejection(s).`,
          structured: result as unknown as JsonRecord,
        };
      }),
  },
  {
    name: "hiss_lp_position_read",
    title: "Read LP position",
    kind: "read",
    description:
      "Read a Uniswap v3 LP position by tokenId (owner, pool, ticks, liquidity, owed fees). A live deployment reads the NonfungiblePositionManager on chain 4663; a value that cannot be read is null, never zero.",
    inputSchema: {
      type: "object",
      required: ["tokenId"],
      properties: {
        tokenId: { type: "string", description: "The Uniswap v3 position NFT tokenId (decimal string)." },
      },
    },
    handler: (args, ctx) =>
      run(async () => {
        const tokenId = reqUintString(args, "tokenId");
        const result = await engineOf(ctx).positionRead({ tokenId });
        return {
          summary: `LP position #${tokenId} ${result.found ? "read" : "not found"} (${result.dataMode}).`,
          structured: result as unknown as JsonRecord,
        };
      }),
  },
  {
    name: "hiss_lp_verify_receipt",
    title: "Verify LP receipt",
    kind: "read",
    description:
      "Verify a Stock-Premium LP receipt's integrity hash locally. Proves internal consistency; a preparation receipt is NEVER evidence of on-chain settlement (onchainConfirmed requires a confirmed tx hash + block).",
    inputSchema: {
      type: "object",
      required: ["receipt"],
      properties: { receipt: { type: "object", description: "The LP receipt object to verify." } },
    },
    handler: (args, ctx) =>
      run(async () => {
        if (!isRecord(args.receipt)) throw new ToolInputError("`receipt` must be an object.");
        const result = await engineOf(ctx).verifyReceipt({ receipt: args.receipt });
        return {
          summary: result.ok
            ? `LP receipt integrity verified${result.onchainConfirmed ? " (on-chain confirmed)" : " (not on-chain settlement)"}.`
            : `LP receipt verification failed: ${result.issues.length} issue(s).`,
          structured: result as unknown as JsonRecord,
          receiptVerified: result.onchainConfirmed,
        };
      }),
  },
];

// ---------------------------------------------------------------------------
// prepare tools (unsigned only)
// ---------------------------------------------------------------------------

function positionArgs(args: JsonRecord): {
  symbol: string;
  authority: { kind?: string; address: string };
  recipient: string;
  tokenId: string;
  poolAddress: string;
  intentNonce: string;
  deadlineUnix: number;
  nowUnix?: number;
  slippageBps?: number;
  seenNonces?: string[];
} {
  return {
    symbol: reqString(args, "symbol"),
    authority: reqAuthority(args),
    recipient: reqAddress(args, "recipient"),
    tokenId: reqUintString(args, "tokenId"),
    poolAddress: reqAddress(args, "poolAddress"),
    intentNonce: reqString(args, "intentNonce"),
    deadlineUnix: reqInt(args, "deadlineUnix"),
    nowUnix: typeof args.nowUnix === "number" ? args.nowUnix : undefined,
    slippageBps: typeof args.slippageBps === "number" ? args.slippageBps : undefined,
    seenNonces: optStringArray(args, "seenNonces"),
  };
}

const POSITION_BASE_SCHEMA = {
  symbol: { type: "string", description: "Stock Token symbol or canonical address." },
  authority: {
    type: "object",
    description: "The signing authority: { kind?, address }. The recipient MUST equal this address.",
  },
  recipient: { type: "string", description: "Position recipient — MUST equal the authority address." },
  tokenId: { type: "string", description: "The Uniswap v3 position NFT tokenId (decimal string)." },
  poolAddress: { type: "string", description: "The verified pool address for this Stock Token." },
  intentNonce: { type: "string", description: "Replay-protection nonce (unique per authority/pool/action)." },
  deadlineUnix: { type: "number", description: "Unix-seconds deadline; must be in the future." },
  nowUnix: { type: "number", description: "Optional current unix time for deterministic checks." },
  slippageBps: { type: "number", description: "Optional slippage tolerance (bps)." },
  seenNonces: {
    type: "array",
    items: { type: "string" },
    description: "Optional replay lookup — if intentNonce is present, the prepare is rejected as a replay.",
  },
} as const;

const PREPARE: ToolDefinition[] = [
  {
    name: "hiss_lp_prepare_mint",
    title: "Prepare LP mint",
    kind: "prepare",
    description:
      "Prepare a typed UNSIGNED one-sided USDG LP mint package (a bounded buy ladder) for the user's own authority. Fail-closed: rejects unknown pool, unsupported token, wrong recipient, expired deadline, replay, or an unbounded approval. Nothing is signed or sent.",
    inputSchema: {
      type: "object",
      required: [
        "symbol",
        "authority",
        "recipient",
        "boundaryPriceUsdE18",
        "totalCapital",
        "intentNonce",
        "deadlineUnix",
      ],
      properties: {
        symbol: { type: "string", description: "Stock Token symbol or canonical address." },
        authority: {
          type: "object",
          description: "The signing authority: { kind?, address }. The recipient MUST equal this address.",
        },
        recipient: { type: "string", description: "Position recipient — MUST equal the authority address." },
        boundaryPriceUsdE18: {
          type: "string",
          description: "BUY floor price (USD-18 integer string), below spot.",
        },
        totalCapital: { type: "string", description: "Total USDG capital (6-dec integer string)." },
        rungs: { type: "number", description: "Number of ladder rungs (1..20). Default 4." },
        slippageBps: { type: "number", description: "Slippage tolerance (bps). Default 50." },
        intentNonce: { type: "string", description: "Replay-protection nonce." },
        deadlineUnix: { type: "number", description: "Unix-seconds deadline; must be in the future." },
        nowUnix: { type: "number", description: "Optional current unix time for deterministic checks." },
        assertPositionManager: {
          type: "string",
          description: "Optional pin — must MATCH the canonical NPM or the prepare is rejected.",
        },
        assertFactory: {
          type: "string",
          description: "Optional pin — must MATCH the canonical factory or the prepare is rejected.",
        },
        assertPool: {
          type: "string",
          description: "Optional pin — must MATCH the verified pool or the prepare is rejected.",
        },
        seenNonces: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional replay lookup — if intentNonce is present, the prepare is rejected as a replay.",
        },
      },
    },
    handler: (args, ctx) =>
      run(async () => {
        const result = await engineOf(ctx).prepareMint({
          symbol: reqString(args, "symbol"),
          authority: reqAuthority(args),
          recipient: reqAddress(args, "recipient"),
          boundaryPriceUsdE18: reqUintString(args, "boundaryPriceUsdE18"),
          totalCapital: reqUintString(args, "totalCapital"),
          rungs: typeof args.rungs === "number" ? args.rungs : undefined,
          slippageBps: typeof args.slippageBps === "number" ? args.slippageBps : undefined,
          intentNonce: reqString(args, "intentNonce"),
          deadlineUnix: reqInt(args, "deadlineUnix"),
          nowUnix: typeof args.nowUnix === "number" ? args.nowUnix : undefined,
          assertPositionManager:
            typeof args.assertPositionManager === "string" ? args.assertPositionManager : undefined,
          assertFactory: typeof args.assertFactory === "string" ? args.assertFactory : undefined,
          assertPool: typeof args.assertPool === "string" ? args.assertPool : undefined,
          seenNonces: optStringArray(args, "seenNonces"),
        });
        return prepareOutcome(result, "LP mint");
      }),
  },
  {
    name: "hiss_lp_prepare_increase",
    title: "Prepare LP increase",
    kind: "prepare",
    description:
      "Prepare a typed UNSIGNED increaseLiquidity package for an existing LP position, with exact (never unbounded) approvals, for the user's own authority. Fail-closed. Nothing is signed or sent.",
    inputSchema: {
      type: "object",
      required: [
        "symbol",
        "authority",
        "recipient",
        "tokenId",
        "poolAddress",
        "intentNonce",
        "deadlineUnix",
        "minAmount0",
        "minAmount1",
      ],
      properties: {
        ...POSITION_BASE_SCHEMA,
        addAmount0: { type: "string", description: "Token0 (USDG) amount to add (base units)." },
        addAmount1: { type: "string", description: "Token1 (stock) amount to add (base units)." },
        minAmount0: { type: "string", description: "Explicit min token0 (base units)." },
        minAmount1: { type: "string", description: "Explicit min token1 (base units)." },
      },
    },
    handler: (args, ctx) =>
      run(async () => {
        const result = await engineOf(ctx).prepareIncrease({
          ...positionArgs(args),
          addAmount0: optUintString(args, "addAmount0"),
          addAmount1: optUintString(args, "addAmount1"),
          minAmount0: reqUintString(args, "minAmount0"),
          minAmount1: reqUintString(args, "minAmount1"),
        });
        return prepareOutcome(result, "LP increase");
      }),
  },
  {
    name: "hiss_lp_prepare_withdraw",
    title: "Prepare LP withdraw",
    kind: "prepare",
    description:
      "Prepare a typed UNSIGNED decreaseLiquidity (withdraw) package for an existing LP position, for the user's own authority. Fail-closed: requires liquidity > 0 and explicit min amounts. Nothing is signed or sent.",
    inputSchema: {
      type: "object",
      required: [
        "symbol",
        "authority",
        "recipient",
        "tokenId",
        "poolAddress",
        "intentNonce",
        "deadlineUnix",
        "liquidity",
        "minAmount0",
        "minAmount1",
      ],
      properties: {
        ...POSITION_BASE_SCHEMA,
        liquidity: { type: "string", description: "Liquidity units to remove (base units)." },
        minAmount0: { type: "string", description: "Explicit min token0 out (base units)." },
        minAmount1: { type: "string", description: "Explicit min token1 out (base units)." },
      },
    },
    handler: (args, ctx) =>
      run(async () => {
        const result = await engineOf(ctx).prepareWithdraw({
          ...positionArgs(args),
          liquidity: reqUintString(args, "liquidity"),
          minAmount0: reqUintString(args, "minAmount0"),
          minAmount1: reqUintString(args, "minAmount1"),
        });
        return prepareOutcome(result, "LP withdraw");
      }),
  },
  {
    name: "hiss_lp_prepare_collect",
    title: "Prepare LP collect",
    kind: "prepare",
    description:
      "Prepare a typed UNSIGNED collect package (fees to the user's own recipient) for an existing LP position. Fail-closed: requires a positive max on at least one side. Nothing is signed or sent.",
    inputSchema: {
      type: "object",
      required: ["symbol", "authority", "recipient", "tokenId", "poolAddress", "intentNonce", "deadlineUnix"],
      properties: {
        ...POSITION_BASE_SCHEMA,
        amount0Max: { type: "string", description: "Max token0 to collect (base units)." },
        amount1Max: { type: "string", description: "Max token1 to collect (base units)." },
      },
    },
    handler: (args, ctx) =>
      run(async () => {
        const result = await engineOf(ctx).prepareCollect({
          ...positionArgs(args),
          amount0Max: optUintString(args, "amount0Max"),
          amount1Max: optUintString(args, "amount1Max"),
        });
        return prepareOutcome(result, "LP collect");
      }),
  },
  {
    name: "hiss_lp_prepare_close",
    title: "Prepare LP close",
    kind: "prepare",
    description:
      "Prepare a typed UNSIGNED burn (close) package for a fully-decreased, fully-collected LP position, for the user's own authority. Fail-closed. Nothing is signed or sent.",
    inputSchema: {
      type: "object",
      required: ["symbol", "authority", "recipient", "tokenId", "poolAddress", "intentNonce", "deadlineUnix"],
      properties: { ...POSITION_BASE_SCHEMA },
    },
    handler: (args, ctx) =>
      run(async () => {
        const result = await engineOf(ctx).prepareClose(positionArgs(args));
        return prepareOutcome(result, "LP close");
      }),
  },
];

export const STOCK_PREMIUM_TOOLS: ToolDefinition[] = [...READ, ...PREPARE];
