/**
 * @hiss-finance/vault-kit
 *
 * Local-first toolkit for building, validating, and hashing HISS USDG Creator
 * Vault candidates. Every export is pure and deterministic: allocation math,
 * risk fuses, worked fee examples, a deployment-readiness validator, manifest
 * hashing, JSON schemas, and receipt verification. A creator can assemble a
 * complete, valid vault candidate entirely on their own machine — no database,
 * no API key, no Bankr key, no private key. Nothing here signs or submits a
 * transaction.
 *
 * Apache-2.0.
 */

export * from "./canonical";
export * from "./bps";
export * from "./allocation";
export * from "./assets";
export * from "./fuses";
export * from "./fees";
export * from "./manifest";
export * from "./readiness";
export * from "./receipts";
export * from "./schema";
