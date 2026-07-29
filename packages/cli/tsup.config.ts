import { defineConfig } from "tsup";

/**
 * Build config for `@hiss-finance/cli`.
 *
 * Produces a self-contained, runnable artifact under `dist/`:
 *   - `dist/bin/hiss.js` — the `hiss` binary (shebang preserved, chmod +x).
 *   - `dist/index.js` (+ `.d.ts`) — the programmatic library entry.
 *
 * BUNDLING MODEL (mission model A): the internal, UNPUBLISHED workspace
 * packages are inlined into the artifact so a global install needs no
 * monorepo, no pnpm, and no `workspace:*` links:
 *   - @hiss-finance/core, @hiss-finance/sdk, @hiss-finance/vault-kit → bundled.
 *
 * The published, well-maintained runtime deps stay EXTERNAL and are declared
 * in `package.json#dependencies` so npm resolves them at install time:
 *   - commander (MIT), picocolors (ISC), viem (MIT).
 *
 * Source maps are DISABLED so no private absolute build path (`/Users/…`) can
 * leak into the published tarball.
 */
export default defineConfig({
  entry: {
    "bin/hiss": "src/bin/hiss.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  target: "node18",
  platform: "node",
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  minify: false,
  shims: false,
  // Inline the internal workspace packages (unpublished) into the artifact.
  noExternal: [/^@hiss-finance\//],
  // Keep the published runtime deps external (declared in package.json deps).
  external: ["commander", "picocolors", "viem"],
  esbuildOptions(options) {
    // Strip third-party license banner comments from the bundle body; the
    // aggregate license notices live in the repo's THIRD_PARTY_LICENSES.md.
    options.legalComments = "none";
  },
});
