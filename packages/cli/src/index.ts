/**
 * Programmatic entry point for `@hiss-finance/cli`. Exposes the CLI builder
 * and the pure, testable pieces (guards, validators, client contract) so the
 * commands can be embedded or reused. Read-and-prepare only.
 */

export { buildProgram, runCli, CLI_VERSION, type BuildOptions } from "./cli.js";
export { createHissClient, type ClientOptions } from "./lib/client.js";
export type { HissClient, UnsignedTx, JsonRecord } from "./lib/types.js";
export {
  render,
  renderResult,
  renderErrorResult,
  buildEnvelope,
  consolePrinter,
  type CommandResult,
  type OutputMode,
  type RenderMeta,
  type JsonEnvelope,
  type CliError,
  type Printer,
} from "./lib/output.js";
export {
  buildContext,
  buildProcessContext,
  testContext,
  type OutputContext,
  type RenderMode,
  type Verbosity,
  type ColorLevel,
} from "./lib/context.js";
export {
  resolveCapabilities,
  resolveMode,
  resolveColor,
  resolveUnicode,
  type CapabilityInput,
  type ResolvedCapabilities,
} from "./lib/capabilities.js";
export { renderBlock, renderBlocks, hyperlink } from "./lib/render.js";
export { createSpinner, type Spinner } from "./lib/components/spinner.js";
export { makeTheme, type Theme, type Style } from "./lib/theme.js";
export { makeSymbols, GLYPHS, type SymbolSet, type GlyphName } from "./lib/symbols.js";
export { redact } from "./lib/redact.js";
export { serializeJson, toCanonicalJson, abbreviate, groupDigits, isAddress, isHash } from "./lib/format.js";
export { stripAnsi, visibleWidth, wrapText, truncateEnd, truncateMiddle } from "./lib/width.js";
export type {
  ViewBlock,
  StateToken,
  KVRow,
  TableColumn,
  TableCell,
  PanelVariant,
  FuseRow,
  PnlLine,
  EvidenceRef,
  ReceiptStage,
} from "./lib/view.js";
export {
  EXIT,
  HissCliError,
  classifyThrown,
  classifyCommanderError,
  isCommanderSuccessShortCircuit,
  kindForCode,
  type ExitCode,
  type ExitKind,
  type ClassifiedError,
} from "./lib/exit.js";
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
