/**
 * HISS Finance MCP tool registry — READ and PREPARE only.
 *
 * Every tool is one of two kinds:
 *   - a read over public protocol state (via the injected SDK client), or
 *   - a prepare that returns an UNSIGNED transaction or a local validation /
 *     compilation verdict.
 *
 * No tool in this server can expose a private key, sign or submit a
 * transaction, perform an owner-only / Safe / admin action, publish a reward
 * root, move or fund rewards, call a private Bankr endpoint, read internal
 * status, or read another wallet's data. There is simply no code path for any
 * of those, and the output guard blocks any result that reads like a
 * completed on-chain action.
 */

import { assertNoCredentials } from "./lib/credentials.js";
import { validateVaultManifest, VAULT_MANIFEST_SCHEMA } from "./lib/validate.js";
import { validateCoil, compileCoil, CoilCompileError } from "./lib/coil.js";
import { verifyReceipt } from "./lib/receipt.js";
import type { HissClient, JsonRecord, UnsignedTx } from "./lib/types.js";

export interface ToolContext {
  client: HissClient;
  nowIso: string;
}

export interface ToolOutcome {
  /** One-line human summary (guard-checked before it leaves the process). */
  summary: string;
  /** Structured JSON payload (guard-checked). */
  structured: JsonRecord;
  /** True only when the outcome verifies a real on-chain receipt. */
  receiptVerified?: boolean;
}

export type ToolKind = "read" | "prepare";

export interface ToolDefinition {
  name: string;
  title: string;
  kind: ToolKind;
  description: string;
  inputSchema: JsonRecord;
  handler: (args: JsonRecord, ctx: ToolContext) => Promise<ToolOutcome> | ToolOutcome;
}

export class ToolInputError extends Error {
  constructor(
    message: string,
    public readonly issues: Array<{ code: string; message: string }> = [],
  ) {
    super(message);
    this.name = "ToolInputError";
  }
}

// ---------------------------------------------------------------------------
// input helpers
// ---------------------------------------------------------------------------

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireString(args: JsonRecord, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new ToolInputError(`\`${key}\` is required and must be a non-empty string.`);
  }
  return v;
}

function requireAddress(args: JsonRecord, key: string): string {
  const v = requireString(args, key);
  if (!ADDRESS_RE.test(v)) {
    throw new ToolInputError(`\`${key}\` must be a 0x-prefixed 20-byte address.`);
  }
  return v;
}

function requireRecord(args: JsonRecord, key: string): JsonRecord {
  const v = args[key];
  if (!isRecord(v)) throw new ToolInputError(`\`${key}\` must be an object.`);
  return v;
}

function nowIsoFrom(args: JsonRecord, ctx: ToolContext): string {
  const v = args.nowIso;
  if (typeof v === "string" && v.length > 0) {
    if (Number.isNaN(Date.parse(v))) throw new ToolInputError("`nowIso` must be ISO-8601.");
    return v;
  }
  return ctx.nowIso;
}

const NOW_ISO_SCHEMA = {
  type: "string",
  description: "Optional ISO-8601 timestamp for deterministic output. Defaults to now.",
} as const;

const PREPARE_NOTE =
  "This is an UNSIGNED transaction. HISS holds no keys and sends nothing; review it and submit it with your own wallet. " +
  "The target address is always shown. An action is complete only after your own on-chain receipt confirms.";

function unsignedStructured(tx: UnsignedTx): JsonRecord {
  return { ...(tx as unknown as JsonRecord), note: PREPARE_NOTE };
}

// ---------------------------------------------------------------------------
// read tools
// ---------------------------------------------------------------------------

const READ_TOOLS: ToolDefinition[] = [
  {
    name: "hiss_get_protocol_status",
    title: "Get protocol status",
    kind: "read",
    description: "Read a HISS Finance protocol status snapshot (network, token, treasury Safe, vault count).",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const status = await ctx.client.getProtocolStatus();
      return { summary: "HISS Finance protocol status read.", structured: status };
    },
  },
  {
    name: "hiss_get_contract_registry",
    title: "Get contract registry",
    kind: "read",
    description: "Read the deployed contract registry (name → address) for Robinhood Chain.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const registry = await ctx.client.getContractRegistry();
      return { summary: "Contract registry read.", structured: registry };
    },
  },
  {
    name: "hiss_get_vaults",
    title: "List vaults",
    kind: "read",
    description:
      "List USDG Creator Vaults on Robinhood Chain. Factual listing only — never a recommendation.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const vaults = await ctx.client.listVaults();
      return { summary: `${vaults.length} vault(s) listed.`, structured: { vaults } };
    },
  },
  {
    name: "hiss_get_vault",
    title: "Get vault",
    kind: "read",
    description:
      "Read a single vault by address or slug. Deposit state is always a live chain read, never assumed.",
    inputSchema: {
      type: "object",
      required: ["ref"],
      properties: { ref: { type: "string", description: "Vault address or slug." } },
    },
    handler: async (args, ctx) => {
      const ref = requireString(args, "ref");
      const vault = await ctx.client.getVault(ref);
      return { summary: `Vault ${ref} read.`, structured: vault };
    },
  },
  {
    name: "hiss_get_vault_holdings",
    title: "Get vault holdings",
    kind: "read",
    description: "Read a vault's current holdings from a live chain read.",
    inputSchema: {
      type: "object",
      required: ["vault"],
      properties: { vault: { type: "string", description: "Vault address." } },
    },
    handler: async (args, ctx) => {
      const vault = requireAddress(args, "vault");
      const holdings = await ctx.client.getVaultHoldings(vault);
      return { summary: `Holdings read for ${vault}.`, structured: holdings };
    },
  },
  {
    name: "hiss_get_vault_performance",
    title: "Get vault performance",
    kind: "read",
    description:
      "Read a vault's historical performance. Historical figures are not forecasts and not a performance claim.",
    inputSchema: {
      type: "object",
      required: ["vault"],
      properties: { vault: { type: "string", description: "Vault address." } },
    },
    handler: async (args, ctx) => {
      const vault = requireAddress(args, "vault");
      const perf = await ctx.client.getVaultPerformance(vault);
      return {
        summary: `Historical performance read for ${vault}. Not a forecast; not a performance claim.`,
        structured: perf,
      };
    },
  },
  {
    name: "hiss_get_staking_status",
    title: "Get staking status",
    kind: "read",
    description:
      "Read xHISS staking status. Not a performance claim. Historical fee distributions are not forecasts.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const status = await ctx.client.getStakingStatus();
      return { summary: "xHISS staking status read.", structured: status };
    },
  },
  {
    name: "hiss_get_reward_status",
    title: "Get reward status",
    kind: "read",
    description:
      "Read reward-split status. planned ≠ funded ≠ claimable. Reports only — never scores or funds.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const status = await ctx.client.getRewardStatus();
      return { summary: "Reward status read. planned ≠ funded ≠ claimable.", structured: status };
    },
  },
  {
    name: "hiss_get_receipt",
    title: "Get receipt",
    kind: "read",
    description: "Read a HISS receipt by id.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string", description: "Receipt id." } },
    },
    handler: async (args, ctx) => {
      const id = requireString(args, "id");
      const receipt = await ctx.client.getReceipt(id);
      return { summary: `Receipt ${id} read.`, structured: receipt };
    },
  },
  {
    name: "hiss_verify_receipt",
    title: "Verify receipt",
    kind: "read",
    description:
      "Verify a receipt's integrity hash locally. Proves internal consistency; on-chain settlement is a separate, explicit proof.",
    inputSchema: {
      type: "object",
      required: ["receipt"],
      properties: { receipt: { type: "object", description: "The receipt object to verify." } },
    },
    handler: (args) => {
      const receipt = requireRecord(args, "receipt");
      const result = verifyReceipt(receipt);
      return {
        summary: result.ok
          ? `Receipt integrity verified${result.onchainConfirmed ? " (on-chain confirmed)" : ""}.`
          : `Receipt verification failed: ${result.issues.length} issue(s).`,
        structured: result as unknown as JsonRecord,
        receiptVerified: result.onchainConfirmed,
      };
    },
  },
  {
    name: "hiss_get_supported_assets",
    title: "Get supported assets",
    kind: "read",
    description: "List source-verified assets vaults may hold on Robinhood Chain.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const assets = await ctx.client.getSupportedAssets();
      return { summary: `${assets.length} supported asset(s) listed.`, structured: { assets } };
    },
  },
  {
    name: "hiss_get_fee_schedule",
    title: "Get fee schedule",
    kind: "read",
    description: "Read the current HISS fee schedule (vault fees and reward-split legs).",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const schedule = await ctx.client.getFeeSchedule();
      return { summary: "Fee schedule read.", structured: schedule };
    },
  },
];

// ---------------------------------------------------------------------------
// prepare tools
// ---------------------------------------------------------------------------

const PREPARE_TOOLS: ToolDefinition[] = [
  {
    name: "hiss_create_vault_candidate",
    title: "Create vault candidate",
    kind: "prepare",
    description:
      "Assemble a candidate VaultManifest from inputs. A candidate is a draft for you to validate — nothing is created or deployed.",
    inputSchema: {
      type: "object",
      required: ["name", "allowedAssets", "creator"],
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        chainId: { type: "number", description: "Robinhood Chain id (default 4663)." },
        allowedAssets: { type: "array", items: { type: "string" } },
        fees: { type: "object" },
        creator: { type: "object" },
        rebalance: { type: "object" },
      },
    },
    handler: (args) => {
      const candidate: JsonRecord = {
        schema: VAULT_MANIFEST_SCHEMA,
        chainId: typeof args.chainId === "number" ? args.chainId : 4663,
        name: requireString(args, "name"),
        slug: typeof args.slug === "string" ? args.slug : undefined,
        baseAsset: "USDG",
        allowedAssets: Array.isArray(args.allowedAssets) ? args.allowedAssets : [],
        fees: isRecord(args.fees) ? args.fees : { managementBps: 0, performanceBps: 0 },
        creator: requireRecord(args, "creator"),
        rebalance: isRecord(args.rebalance) ? args.rebalance : { fuses: {} },
      };
      const verdict = validateVaultManifest(candidate);
      return {
        summary:
          "Assembled a vault candidate (draft). Nothing was created or deployed. Validate it before preparing.",
        structured: { candidate, validation: verdict },
      };
    },
  },
  {
    name: "hiss_validate_vault_candidate",
    title: "Validate vault candidate",
    kind: "prepare",
    description:
      "Validate a VaultManifest fail-closed: Robinhood Chain only, USDG base, fee bounds, creator skin, fuses.",
    inputSchema: {
      type: "object",
      required: ["manifest"],
      properties: { manifest: { type: "object" } },
    },
    handler: (args) => {
      const manifest = requireRecord(args, "manifest");
      const verdict = validateVaultManifest(manifest);
      return {
        summary: verdict.ok
          ? "Vault manifest valid."
          : `Vault manifest invalid: ${verdict.issues.length} issue(s).`,
        structured: verdict as unknown as JsonRecord,
      };
    },
  },
  {
    name: "hiss_prepare_vault_creation",
    title: "Prepare vault creation",
    kind: "prepare",
    description:
      "Prepare an UNSIGNED vault-creation transaction from a valid manifest. Refuses an invalid manifest.",
    inputSchema: {
      type: "object",
      required: ["manifest"],
      properties: { manifest: { type: "object" } },
    },
    handler: async (args, ctx) => {
      const manifest = requireRecord(args, "manifest");
      const verdict = validateVaultManifest(manifest);
      if (!verdict.ok) {
        throw new ToolInputError(
          "Refusing to prepare: manifest is invalid.",
          verdict.issues.map((i) => ({ code: i.code, message: `${i.path}: ${i.message}` })),
        );
      }
      const tx = await ctx.client.prepareVaultCreation(manifest);
      return {
        summary: "Prepared an unsigned vault-creation transaction. Nothing was sent.",
        structured: unsignedStructured(tx),
      };
    },
  },
  {
    name: "hiss_prepare_vault_deposit",
    title: "Prepare vault deposit",
    kind: "prepare",
    description: "Prepare an UNSIGNED USDG deposit transaction to a vault.",
    inputSchema: {
      type: "object",
      required: ["vault", "amount"],
      properties: {
        vault: { type: "string", description: "Vault address." },
        amount: { type: "string", description: "USDG amount (decimal string)." },
      },
    },
    handler: async (args, ctx) => {
      const vault = requireAddress(args, "vault");
      const amount = requireString(args, "amount");
      const tx = await ctx.client.prepareVaultDeposit(vault, amount);
      return {
        summary: `Prepared an unsigned deposit of ${amount} USDG to ${vault}. Nothing was sent.`,
        structured: unsignedStructured(tx),
      };
    },
  },
  {
    name: "hiss_prepare_vault_withdrawal",
    title: "Prepare vault withdrawal",
    kind: "prepare",
    description: "Prepare an UNSIGNED withdrawal transaction from a vault.",
    inputSchema: {
      type: "object",
      required: ["vault", "shares"],
      properties: {
        vault: { type: "string", description: "Vault address." },
        shares: { type: "string", description: "Share amount (decimal string)." },
      },
    },
    handler: async (args, ctx) => {
      const vault = requireAddress(args, "vault");
      const shares = requireString(args, "shares");
      const tx = await ctx.client.prepareVaultWithdrawal(vault, shares);
      return {
        summary: `Prepared an unsigned withdrawal of ${shares} shares from ${vault}. Nothing was sent.`,
        structured: unsignedStructured(tx),
      };
    },
  },
  {
    name: "hiss_prepare_hiss_stake",
    title: "Prepare HISS stake",
    kind: "prepare",
    description: "Prepare an UNSIGNED transaction to stake HISS into the xHISS vault.",
    inputSchema: {
      type: "object",
      required: ["amount"],
      properties: { amount: { type: "string", description: "HISS amount (decimal string)." } },
    },
    handler: async (args, ctx) => {
      const amount = requireString(args, "amount");
      const tx = await ctx.client.prepareHissStake(amount);
      return {
        summary: `Prepared an unsigned stake of ${amount} HISS. Nothing was sent.`,
        structured: unsignedStructured(tx),
      };
    },
  },
  {
    name: "hiss_prepare_xhiss_cooldown",
    title: "Prepare xHISS cooldown",
    kind: "prepare",
    description: "Prepare an UNSIGNED transaction to start an xHISS cooldown (exits are user-initiated).",
    inputSchema: {
      type: "object",
      required: ["xhissAmount"],
      properties: { xhissAmount: { type: "string", description: "xHISS share amount (decimal string)." } },
    },
    handler: async (args, ctx) => {
      const xhissAmount = requireString(args, "xhissAmount");
      const tx = await ctx.client.prepareXhissCooldown(xhissAmount);
      return {
        summary: `Prepared an unsigned cooldown for ${xhissAmount} xHISS. Nothing was sent.`,
        structured: unsignedStructured(tx),
      };
    },
  },
  {
    name: "hiss_prepare_xhiss_redeem",
    title: "Prepare xHISS redeem",
    kind: "prepare",
    description: "Prepare an UNSIGNED xHISS redeem transaction within your open redeem window.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const tx = await ctx.client.prepareXhissRedeem();
      return {
        summary: "Prepared an unsigned xHISS redeem. Nothing was sent.",
        structured: unsignedStructured(tx),
      };
    },
  },
  {
    name: "hiss_validate_coil",
    title: "Validate coil",
    kind: "prepare",
    description:
      "Validate a CoilOps playbook manifest (universe, rules, mandatory risk fuses). Local and deterministic.",
    inputSchema: {
      type: "object",
      required: ["manifest"],
      properties: { manifest: { type: "object" } },
    },
    handler: (args) => {
      const manifest = requireRecord(args, "manifest");
      const verdict = validateCoil(manifest);
      return {
        summary: verdict.ok
          ? "Coil manifest valid."
          : `Coil manifest invalid: ${verdict.issues.length} issue(s).`,
        structured: verdict as unknown as JsonRecord,
      };
    },
  },
  {
    name: "hiss_compile_coil",
    title: "Compile coil",
    kind: "prepare",
    description:
      "Compile a coil manifest into a deterministic, hash-stamped artifact. A compiled coil is a plan, not an executed order.",
    inputSchema: {
      type: "object",
      required: ["manifest"],
      properties: { manifest: { type: "object" }, nowIso: NOW_ISO_SCHEMA },
    },
    handler: (args, ctx) => {
      const manifest = requireRecord(args, "manifest");
      try {
        const compiled = compileCoil(manifest, nowIsoFrom(args, ctx));
        return {
          summary: `Compiled coil "${compiled.name}" — hash ${compiled.coilHash}. This is a plan, not an executed order.`,
          structured: compiled as unknown as JsonRecord,
        };
      } catch (err) {
        if (err instanceof CoilCompileError) {
          throw new ToolInputError(
            "Refusing to compile: coil manifest is invalid.",
            err.issues.map((i) => ({ code: i.code, message: `${i.path}: ${i.message}` })),
          );
        }
        throw err;
      }
    },
  },
];

export const HISS_TOOLS: ToolDefinition[] = [...READ_TOOLS, ...PREPARE_TOOLS];

export function getTool(name: string): ToolDefinition | undefined {
  return HISS_TOOLS.find((t) => t.name === name);
}

/** Reject credential-shaped input before any handler runs. */
export function assertToolInputClean(args: JsonRecord): void {
  assertNoCredentials(args);
}
