#!/usr/bin/env node
/**
 * Production bundle for the HISS MCP server.
 *
 * Bundles both bins (stdio + HTTP) into self-contained ESM so the runtime
 * image needs no node_modules. The MCP SDK version is resolved here and inlined
 * via `--define:__MCP_SDK_VERSION__`, so `GET /version` can report it without a
 * node_modules lookup at runtime. `--watch` mirrors the previous dev flow.
 */

import { build, context } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

function resolveSdkVersion() {
  try {
    let dir = dirname(require.resolve("@modelcontextprotocol/sdk/server/index.js"));
    for (let i = 0; i < 8; i++) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        if (pkg.name === "@modelcontextprotocol/sdk" && pkg.version) return pkg.version;
      } catch {
        // keep walking up
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // fall through
  }
  return "unknown";
}

const options = {
  entryPoints: ["src/bin/server.ts", "src/bin/http.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outdir: "dist/bin",
  define: { __MCP_SDK_VERSION__: JSON.stringify(resolveSdkVersion()) },
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
  process.stderr.write("hiss-mcp build: watching…\n");
} else {
  await build(options);
}
