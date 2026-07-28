/**
 * Deployment / runtime version facts for `GET /version`.
 *
 * The MCP SDK version is inlined at build time by esbuild (`--define`), so the
 * self-contained production bundle can report it without a node_modules lookup.
 * In source/dev runs (tsx, vitest) the define is absent and we fall back to a
 * best-effort node_modules resolution. Nothing here reads secrets or network.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SERVER_NAME, SERVER_VERSION } from "../server.js";
import { computeToolsetHash } from "./toolset-hash.js";

/** Robinhood Chain mainnet id — the chain this MCP serves by default. */
const DEFAULT_CHAIN_ID = 4663;

// Replaced by esbuild `--define:__MCP_SDK_VERSION__="..."` in the production
// bundle. `typeof` keeps this safe (no ReferenceError) when the define is absent.
declare const __MCP_SDK_VERSION__: string | undefined;

function resolveSdkVersionFromNodeModules(): string {
  try {
    const require = createRequire(import.meta.url);
    let dir = dirname(require.resolve("@modelcontextprotocol/sdk/server/index.js"));
    for (let i = 0; i < 8; i++) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
          name?: string;
          version?: string;
        };
        if (pkg.name === "@modelcontextprotocol/sdk" && pkg.version) return pkg.version;
      } catch {
        // keep walking up
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // fall through to unknown
  }
  return "unknown";
}

/** The MCP SDK version this build was compiled against (or resolved at runtime). */
export function getMcpSdkVersion(): string {
  if (typeof __MCP_SDK_VERSION__ === "string" && __MCP_SDK_VERSION__.length > 0) {
    return __MCP_SDK_VERSION__;
  }
  return resolveSdkVersionFromNodeModules();
}

/** The Node.js runtime version (e.g. `v20.11.0`). */
export function getNodeVersion(): string {
  return process.version;
}

/**
 * The deployment version: an operator-supplied build/release marker
 * (`HISS_MCP_DEPLOY_VERSION`, typically the released git SHA), falling back to
 * the package version.
 */
export function getDeploymentVersion(): string {
  const env = process.env.HISS_MCP_DEPLOY_VERSION;
  return env && env.length > 0 ? env : SERVER_VERSION;
}

/**
 * The public-safe `GET /version` payload — one shape for every transport that
 * runs this package. It advertises ONLY facts that are true of this open-source
 * package itself: server identity, an operator release marker, the served chain
 * id, and the deterministic toolset identity (dynamic count + hash + names).
 *
 * It deliberately carries NO source-provenance fields (no deployed-commit SHA,
 * no upstream-distribution SHA): those are properties of a particular *hosted
 * deployment*, not of the package, and a hosting layer augments this base with
 * them if it wishes (see the private hosting adapter). Keeping them out of here
 * is what lets this file stay a byte-faithful, host-agnostic public source.
 */
export interface VersionInfo {
  server: { name: string; version: string };
  /** Operator-supplied release marker (`HISS_MCP_DEPLOY_VERSION`, else package version). */
  deploymentVersion: string;
  /** The Robinhood Chain id this instance serves (default 4663 mainnet). */
  chainId: number;
  /** `sha256:<hex>` over the registered toolset. */
  toolsetHash: string;
  /** Dynamic tool count — never hard-coded. */
  toolCount: number;
  /** Sorted tool names. */
  toolNames: string[];
  mcpSdkVersion: string;
  nodeVersion: string;
  transport: string;
}

/**
 * Build the public-safe `/version` payload. This is the SINGLE source of the
 * base version shape: every transport that runs this package calls it, so their
 * `/version` responses cannot drift in shape. `chainId` reflects the configured
 * chain, defaulting to Robinhood Chain mainnet; `toolCount`/`toolsetHash`/
 * `toolNames` are derived dynamically from the registry. A hosting layer may add
 * host-specific provenance fields on top of this object; the package never does.
 */
export function buildVersionInfo(opts: { chainId?: number; transport: string }): VersionInfo {
  const toolset = computeToolsetHash();
  return {
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    deploymentVersion: getDeploymentVersion(),
    chainId: opts.chainId ?? DEFAULT_CHAIN_ID,
    toolsetHash: toolset.hash,
    toolCount: toolset.toolCount,
    toolNames: toolset.toolNames,
    mcpSdkVersion: getMcpSdkVersion(),
    nodeVersion: getNodeVersion(),
    transport: opts.transport,
  };
}
