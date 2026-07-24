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
import { SERVER_VERSION } from "../server.js";

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
