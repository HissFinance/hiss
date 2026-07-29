/**
 * `hiss agentic ...` — orientation for the agentic control plane. These
 * commands are INFORMATIONAL and honest about the execution boundary: HISS
 * compiles and prepares, it never signs, submits, or takes custody, and it
 * never asks for a brokerage credential. The Robinhood Trading MCP (which can
 * place brokerage orders) runs entirely in the USER's own agent runtime — HISS
 * only describes how to connect it. Capability posture is reported at its real
 * level (RESEARCH / PAPER / READY_TO_CONNECT), never inflated to "live".
 */

import { ROBINHOOD_CHAIN_MAINNET_ID } from "@hiss-finance/core";
import { EXIT } from "../lib/exit.js";
import type { CommandResult } from "../lib/output.js";
import type { ViewBlock } from "../lib/view.js";

const HISS_MCP_URL = "https://mcp.hiss.finance";

const BOUNDARY = [
  "HISS reads state and prepares UNSIGNED transactions. It never signs, submits, or holds keys.",
  "The Robinhood Trading MCP runs in YOUR agent runtime; HISS never sees or requests a brokerage credential.",
  "Brokerage order placement, confirmation, and custody are entirely user-side.",
];

/** `hiss agentic status` — control-plane posture + execution boundary. */
export function agenticStatusCommand(): CommandResult {
  const view: ViewBlock[] = [
    {
      kind: "keyValue",
      title: "Agentic control plane",
      rows: [
        { label: "Chain", value: ROBINHOOD_CHAIN_MAINNET_ID, token: "value" },
        { label: "HISS MCP", value: HISS_MCP_URL, token: "value" },
        { label: "Execution authority", value: "prepare-only (unsigned)", token: "prepared" },
        { label: "RH Trading MCP", value: "user runtime (READY_TO_CONNECT)", token: "ready" },
        { label: "Default posture", value: "RESEARCH / PAPER", token: "paper" },
        { label: "Custody", value: "none (HISS never holds keys)", token: "muted" },
      ],
    },
    {
      kind: "fuse",
      title: "Execution boundary",
      rows: [
        { fuse: "HISS signs a transaction", result: "pass", current: "never" },
        { fuse: "HISS requests a credential", result: "pass", current: "never" },
        { fuse: "Order placement is user-side", result: "pass", current: "user runtime" },
        { fuse: "Kill / pause available", result: "pass", current: "user-controlled" },
      ],
    },
    { kind: "panel", variant: "info", title: "Boundary", lines: BOUNDARY },
  ];
  return {
    summary: "Agentic control-plane status: prepare-only authority, user-side execution, no custody.",
    data: {
      chainId: ROBINHOOD_CHAIN_MAINNET_ID,
      hissMcp: HISS_MCP_URL,
      executionAuthority: "prepare_only_unsigned",
      rhTradingMcp: "user_runtime_ready_to_connect",
      defaultPosture: "research_paper",
      custody: "none",
    },
    detail: BOUNDARY,
    view,
    exitCode: EXIT.SUCCESS,
  };
}

/** `hiss agentic setup` — how to connect the MCP rails. NO credential request. */
export function agenticSetupCommand(): CommandResult {
  const steps = [
    "1. Connect the HISS MCP (read + prepare): point your agent client at " + HISS_MCP_URL + "/mcp.",
    "2. Verify it with `hiss mcp doctor`.",
    "3. For brokerage actions, run the Robinhood Trading MCP in YOUR OWN runtime and follow its own auth flow.",
    "4. HISS never brokers that credential — it only prepares unsigned chain transactions for you to review.",
  ];
  return {
    summary:
      "Agentic setup: connect the HISS MCP for read/prepare; run the RH Trading MCP in your own runtime.",
    data: {
      hissMcp: `${HISS_MCP_URL}/mcp`,
      rhTradingMcp: "user_runtime",
      credentialRequested: false,
      steps,
    },
    detail: steps,
    view: [
      { kind: "text", lines: steps, token: "value" },
      {
        kind: "panel",
        variant: "warning",
        title: "No credential is ever requested",
        lines: [
          "HISS does not ask for, store, or forward any brokerage credential or private key.",
          "The Robinhood Trading MCP authenticates entirely inside your own agent runtime.",
        ],
      },
    ],
    exitCode: EXIT.SUCCESS,
  };
}

/** `hiss agentic coils` — coil states + how to compile them (local, deterministic). */
export function agenticCoilsCommand(): CommandResult {
  const rows = [
    ["paper_only", "research/backtest posture — nothing leaves the machine", "paper"],
    ["preview_only", "compile + preview an intent — no order path", "info"],
    ["human_confirm", "prepared intents require explicit human confirmation", "ready"],
    ["agentic_mcp_enabled", "user-side MCP execution posture (user runtime only)", "info"],
  ] as const;
  return {
    summary: "Coils compile deterministically to plans. Use `hiss coil validate` then `hiss coil compile`.",
    data: {
      executionModes: rows.map(([mode, meaning]) => ({ mode, meaning })),
      compile: "hiss coil compile <manifest.json>",
      note: "A compiled coil is a plan, not an order. Risk fuses are binding and may never be bypassed.",
    },
    detail: [
      "Execution modes: paper_only, preview_only, human_confirm, agentic_mcp_enabled.",
      "Validate: hiss coil validate <manifest.json>",
      "Compile: hiss coil compile <manifest.json>  (a deterministic plan hash; nothing is executed)",
      "Risk fuses are binding and may never be bypassed.",
    ],
    view: [
      {
        kind: "table",
        title: "Coil execution modes",
        columns: [{ header: "Mode" }, { header: "Meaning" }, { header: "State" }],
        rows: rows.map(([mode, meaning, tok]) => [mode, meaning, { value: tok, token: tok as never }]),
      },
      {
        kind: "panel",
        variant: "info",
        lines: [
          "A compiled coil is a plan (a hash), not an order. Fuses are binding and may never be bypassed.",
        ],
      },
    ],
    exitCode: EXIT.SUCCESS,
  };
}

/** `hiss agentic grants` — capability families. Read-only CLI grants nothing. */
export function agenticGrantsCommand(): CommandResult {
  const families = [
    ["read.protocol", "read chain + protocol state", "ready"],
    ["read.vaults", "read vault state, holdings, performance", "ready"],
    ["prepare.vault", "build UNSIGNED vault create/deposit/withdraw", "prepared"],
    ["prepare.stake", "build UNSIGNED xHISS stake/cooldown/redeem", "prepared"],
    ["coil.compile", "compile coil plans locally (deterministic)", "ready"],
    ["execute.brokerage", "place brokerage orders", "blocked"],
  ] as const;
  return {
    summary:
      "Capability families are declared, not active — this CLI grants read + prepare only, never execution.",
    data: {
      families: families.map(([family, meaning, state]) => ({ family, meaning, state })),
      note: "execute.brokerage is out of scope for HISS — it lives only in the user-runtime RH Trading MCP.",
    },
    detail: families.map(([family, meaning]) => `${family}: ${meaning}`),
    view: [
      {
        kind: "table",
        title: "Capability families",
        columns: [{ header: "Family" }, { header: "Meaning" }, { header: "State" }],
        rows: families.map(([family, meaning, state]) => [
          family,
          meaning,
          { value: state, token: state as never },
        ]),
      },
      {
        kind: "panel",
        variant: "info",
        lines: [
          "This CLI exposes read + prepare families only.",
          "execute.brokerage is never granted by HISS; it belongs to your own RH Trading MCP runtime.",
        ],
      },
    ],
    exitCode: EXIT.SUCCESS,
  };
}

/** `hiss agentic receipts` — the receipt lifecycle + how to verify locally. */
export function agenticReceiptsCommand(): CommandResult {
  const stages = [
    "compilation — a coil/intent is compiled to a deterministic plan hash",
    "authorization — the plan is authorized by its policy/fuses (still a plan)",
    "submission — a stage that only YOUR wallet/runtime can perform",
    "settlement — recorded only from a verified on-chain receipt",
    "reconciliation — settlement reconciled against the plan",
  ];
  return {
    summary:
      "Verify a receipt's integrity locally with `hiss receipt verify` — a missing stage is never implied as done.",
    data: {
      lifecycle: ["compilation", "authorization", "submission", "settlement", "reconciliation"],
      verify: "hiss receipt verify <receipt.json | inline-json>",
      note: "Only a receipt carrying on-chain proof (onchainConfirmed + txHash) renders as settlement.",
    },
    detail: [
      ...stages,
      "Verify: hiss receipt verify <receipt.json>",
      "Only on-chain-proven receipts render as settlement; a missing stage is never implied to have happened.",
    ],
    view: [
      { kind: "text", lines: stages, token: "muted" },
      {
        kind: "panel",
        variant: "info",
        lines: [
          "Verify a receipt's integrity with `hiss receipt verify`.",
          "A stage without proof is shown as pending — never implied to have occurred.",
        ],
      },
    ],
    exitCode: EXIT.SUCCESS,
  };
}
