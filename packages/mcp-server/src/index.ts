/**
 * Programmatic entry point for `@hiss-finance/mcp-server`. Read-and-prepare
 * only. Exposes the server factory, the guarded tool caller, the tool
 * registry, and the pure guards/validators for embedding and testing.
 */

export {
  createServer,
  callHissTool,
  SERVER_NAME,
  SERVER_VERSION,
  SERVER_INSTRUCTIONS,
  type ServerDeps,
} from "./server.js";
export {
  HISS_TOOLS,
  getTool,
  ToolInputError,
  type ToolDefinition,
  type ToolContext,
  type ToolOutcome,
  type ToolKind,
} from "./tools.js";
export { createHissClient, type ClientOptions } from "./lib/client.js";
export type { HissClient, UnsignedTx, JsonRecord } from "./lib/types.js";
export { assertNoExecutionClaim, findExecutionClaim, ExecutionClaimError } from "./lib/guard.js";
export { assertNoCredentials, findCredentialLikeFields, CredentialRejectedError } from "./lib/credentials.js";
export { validateVaultManifest, type ValidationVerdict } from "./lib/validate.js";
export { validateCoil, compileCoil, type CompiledCoil } from "./lib/coil.js";
export { verifyReceipt, type ReceiptVerification } from "./lib/receipt.js";
