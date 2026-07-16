/**
 * Deterministic verification helpers.
 *
 * Manifest and receipt hashing reuse the shared @hiss-finance/vault-kit
 * validators (canonical JSON + SHA-256) so a hash computed here matches the
 * one computed anywhere else in the toolkit. Coil validation/compilation lives
 * in ./coil. None of these touch the network or sign anything.
 */

export {
  manifestHash,
  verifyManifestHash,
  receiptHash,
  verifyReceipt,
  verifyReceiptHash,
} from "@hiss-finance/vault-kit";

export {
  validateCoil,
  compileCoil,
  COIL_SCHEMA_VERSION,
  COIL_COMPILER_VERSION,
  type Coil,
  type CoilAsset,
  type CoilMode,
  type CoilIssue,
  type CoilValidation,
  type CompiledCoil,
} from "./coil";
