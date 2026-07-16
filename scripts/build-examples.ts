/**
 * examples:build — builds every example package under `examples/`.
 *
 * Discovers `examples/<name>/package.json`. For each one that defines a
 * `build` script, runs `pnpm --filter <name> run build`. If there are no
 * example packages yet, it prints a clear message and succeeds (this is the
 * normal state of a fresh scaffold, not an error).
 *
 * Exit code mirrors the underlying build: non-zero if any example build fails.
 */
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT, readText, rel } from "./lib/walk.ts";

const EXAMPLES_DIR = join(REPO_ROOT, "examples");

interface Ex {
  dir: string;
  name: string;
  hasBuild: boolean;
}

function discover(): Ex[] {
  if (!existsSync(EXAMPLES_DIR)) return [];
  const out: Ex[] = [];
  for (const entry of readdirSync(EXAMPLES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(EXAMPLES_DIR, entry.name, "package.json");
    if (!existsSync(pkgPath)) continue;
    let pkg: { name?: string; scripts?: Record<string, string> };
    try {
      pkg = JSON.parse(readText(pkgPath));
    } catch {
      continue;
    }
    out.push({
      dir: rel(join(EXAMPLES_DIR, entry.name)),
      name: pkg.name ?? entry.name,
      hasBuild: Boolean(pkg.scripts?.build),
    });
  }
  return out;
}

function main(): void {
  const examples = discover();
  if (examples.length === 0) {
    console.log("examples:build — no example packages under examples/ yet; nothing to build.");
    return;
  }

  let failures = 0;
  for (const ex of examples) {
    if (!ex.hasBuild) {
      console.log(`examples:build — skipping ${ex.name} (${ex.dir}): no build script.`);
      continue;
    }
    console.log(`examples:build — building ${ex.name} (${ex.dir})…`);
    const res = spawnSync("pnpm", ["--filter", ex.name, "run", "build"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    if (res.status !== 0) {
      console.error(`examples:build — ${ex.name} FAILED (exit ${res.status}).`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error(`\nexamples:build FAILED — ${failures} example(s) did not build.`);
    process.exit(1);
  }
  console.log("examples:build OK");
}

main();
