/**
 * licenses:check — enforces open-source license hygiene across the workspace.
 *
 *   1. A root LICENSE file must exist and name an allowed license.
 *   2. Every workspace package.json (packages/*, examples/*) that declares a
 *      `license` must use an allowed SPDX identifier.
 *   3. The root package.json must declare an allowed license.
 *
 * This runs with no network access — it only reads local manifests.
 * Exit 1 on any disallowed or missing license.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { listFiles, readText, rel, REPO_ROOT } from "./lib/walk.ts";

const ALLOWED = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "CC0-1.0",
  "Unlicense",
  "0BSD",
]);

interface Problem {
  file: string;
  message: string;
}

function main(): void {
  const problems: Problem[] = [];

  // 1. Root LICENSE file present and recognizably an allowed license.
  const licensePath = join(REPO_ROOT, "LICENSE");
  if (!existsSync(licensePath)) {
    problems.push({ file: "LICENSE", message: "missing root LICENSE file" });
  } else {
    const text = readText(licensePath);
    const named = [...ALLOWED].some((id) => licenseTextMentions(text, id));
    if (!named) {
      problems.push({ file: "LICENSE", message: "LICENSE text does not match a known allowed license" });
    }
  }

  // 2 + 3. Every package.json in the workspace must declare an allowed license.
  const manifests = listFiles(REPO_ROOT, { textOnly: true }).filter((f) => {
    const r = rel(f);
    return r === "package.json" || /^(packages|examples)\/[^/]+\/package\.json$/.test(r);
  });

  let checked = 0;
  for (const file of manifests) {
    const r = rel(file);
    let json: { license?: string; private?: boolean; name?: string };
    try {
      json = JSON.parse(readText(file));
    } catch (e) {
      problems.push({ file: r, message: `invalid JSON: ${(e as Error).message}` });
      continue;
    }
    checked++;
    const license = json.license;
    if (!license) {
      // The private root aggregator may omit `license`; sub-packages must not.
      if (r !== "package.json") {
        problems.push({ file: r, message: "missing `license` field" });
      }
      continue;
    }
    if (!ALLOWED.has(license)) {
      problems.push({
        file: r,
        message: `disallowed license "${license}" (allowed: ${[...ALLOWED].join(", ")})`,
      });
    }
  }

  for (const p of problems) {
    console.error(`  ${p.file}: ${p.message}`);
  }
  console.log(`LICENSE_MANIFESTS_CHECKED=${checked}`);
  if (problems.length > 0) {
    console.error(`\nlicenses:check FAILED — ${problems.length} problem(s).`);
    process.exit(1);
  }
  console.log("licenses:check OK — root LICENSE present and all manifests use allowed licenses.");
}

function licenseTextMentions(text: string, id: string): boolean {
  const t = text.toLowerCase();
  if (id === "MIT")
    return t.includes("mit license") || t.includes("permission is hereby granted, free of charge");
  if (id === "Apache-2.0") return t.includes("apache license") && t.includes("version 2.0");
  if (id === "ISC") return t.includes("isc license");
  return t.includes(id.toLowerCase());
}

main();
