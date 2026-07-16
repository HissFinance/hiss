/**
 * Programmatic entry point for `@hiss-finance/cli`. Exposes the CLI builder
 * and the pure, testable pieces (guards, validators, client contract) so the
 * commands can be embedded or reused. Read-and-prepare only.
 */

export { buildProgram, runCli, CLI_VERSION, type BuildOptions } from "./cli.js";
export { createHissClient, type ClientOptions } from "./lib/client.js";
export type { HissClient, UnsignedTx, JsonRecord } from "./lib/types.js";
export { render, type CommandResult, type OutputMode } from "./lib/output.js";
export { assertNoExecutionClaim, findExecutionClaim, ExecutionClaimError } from "./lib/guard.js";
export { assertNoCredentials, findCredentialLikeFields, CredentialRejectedError } from "./lib/credentials.js";
export {
  validateVaultManifest,
  ROBINHOOD_CHAIN_IDS,
  VAULT_MANIFEST_SCHEMA,
  type ValidationVerdict,
  type ValidationIssue,
} from "./lib/validate.js";
export {
  validateCoil,
  compileCoil,
  CoilCompileError,
  COIL_MANIFEST_SCHEMA,
  type CompiledCoil,
} from "./lib/coil.js";
export { verifyReceipt, type ReceiptVerification } from "./lib/receipt.js";
export { canonicalHash, canonicalize } from "./lib/hash.js";
