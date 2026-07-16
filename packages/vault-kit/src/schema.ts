/**
 * JSON Schemas (draft 2020-12) for a vault candidate and for the
 * agent-compatible action envelope. These are plain data so any tool — an
 * agent, a form, a CI check — can validate a candidate without importing the
 * TypeScript types.
 */

/** JSON Schema for a {@link import("./manifest").VaultCandidate}. */
export const VAULT_CANDIDATE_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://hiss.finance/schemas/vault-candidate-1.0.0.json",
  title: "HISS Vault Candidate",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "chainId",
    "name",
    "symbol",
    "asset",
    "allocations",
    "fees",
    "minSkinBps",
    "lockupSeconds",
    "strategy",
    "jurisdiction",
    "fuses",
  ],
  properties: {
    schemaVersion: { const: "hiss-vault-candidate-1.0.0" },
    chainId: { type: "integer", enum: [4663, 46630] },
    name: { type: "string", minLength: 1, maxLength: 64 },
    symbol: { type: "string", minLength: 1, maxLength: 16 },
    asset: {
      type: "object",
      additionalProperties: false,
      required: ["symbol", "address", "decimals"],
      properties: {
        symbol: { type: "string", minLength: 1 },
        address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
        decimals: { type: "integer", minimum: 0, maximum: 36 },
      },
    },
    allocations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["symbol", "address", "weightBps"],
        properties: {
          symbol: { type: "string", minLength: 1 },
          address: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
          weightBps: { type: "integer", minimum: 0, maximum: 10000 },
          locked: { type: "boolean" },
        },
      },
    },
    fees: {
      type: "object",
      additionalProperties: false,
      required: ["performanceFeeBps"],
      properties: {
        performanceFeeBps: { type: "integer", minimum: 0, maximum: 3000 },
        referralBps: { type: "integer", minimum: 0, maximum: 1000 },
        referral: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
      },
    },
    minSkinBps: { type: "integer", minimum: 0, maximum: 5000 },
    lockupSeconds: { type: "integer", minimum: 0 },
    strategy: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "rebalanceMethod", "noticePeriodSeconds"],
      properties: {
        summary: { type: "string", minLength: 1 },
        rebalanceMethod: {
          type: "string",
          enum: ["calendar", "drift", "hybrid", "manual", "agent-suggested"],
        },
        noticePeriodSeconds: { type: "integer", minimum: 0 },
      },
    },
    jurisdiction: {
      type: "object",
      additionalProperties: false,
      required: ["usPersonsRestricted"],
      properties: {
        usPersonsRestricted: { type: "boolean" },
        requiredRiskAckHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
        requiredJurisdictionAckHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
      },
    },
    fuses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "value"],
        properties: {
          kind: {
            type: "string",
            enum: [
              "maxAssetWeightBps",
              "minAssetWeightBps",
              "maxAssetsCount",
              "maxSlippageBps",
              "maxRebalanceTurnoverBps",
              "oracleMaxStalenessSeconds",
              "maxDrawdownBps",
              "depegHaltBps",
              "minReserveBps",
            ],
          },
          value: { type: "integer", minimum: 0 },
        },
      },
    },
    notes: { type: "array", items: { type: "string" } },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

/**
 * JSON Schema for the agent-compatible action envelope — the shape a HISS
 * SDK "prepare" method returns. An agent can plan and display an action from
 * this without ever holding a key: the envelope carries calldata to review,
 * never a signature.
 */
export const VAULT_ACTION_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://hiss.finance/schemas/vault-action-1.0.0.json",
  title: "HISS Action Plan",
  type: "object",
  additionalProperties: false,
  required: [
    "chainId",
    "target",
    "function",
    "decodedArgs",
    "calldata",
    "value",
    "summary",
    "warnings",
    "requiredAcknowledgments",
    "planHash",
  ],
  properties: {
    chainId: { type: "integer", enum: [4663, 46630] },
    target: { type: "string", pattern: "^0x[0-9a-fA-F]{40}$" },
    function: { type: "string", minLength: 1 },
    decodedArgs: { type: "object" },
    calldata: { type: "string", pattern: "^0x[0-9a-fA-F]*$" },
    value: { type: "string", description: "wei as a decimal string" },
    summary: { type: "string", minLength: 1 },
    warnings: { type: "array", items: { type: "string" } },
    requiredAcknowledgments: { type: "array", items: { type: "string" } },
    planHash: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
    expiry: { type: ["string", "null"] },
  },
} as const;
