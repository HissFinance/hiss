/**
 * docs:check — verifies that every relative link and image reference in the
 * repository's Markdown resolves to a real file.
 *
 * Checks:
 *   - `[text](./path)` and `![alt](path)` relative links point at existing
 *     files (anchors and query strings are stripped before resolution).
 *   - Pure in-page anchors (`#section`) and external URLs (http, https, mailto,
 *     tel) are skipped.
 *
 * Exit 1 on any broken relative link.
 */
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { listFiles, readLines, rel, REPO_ROOT } from "./lib/walk.ts";

// Markdown inline links and images: ![alt](target) or [text](target)
const LINK_RE = /!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

const EXTERNAL_RE = /^(https?:|mailto:|tel:|ftp:|data:|#)/i;

function isMarkdown(path: string): boolean {
  const p = path.toLowerCase();
  return p.endsWith(".md") || p.endsWith(".mdx") || p.endsWith(".markdown");
}

function main(): void {
  const files = listFiles(REPO_ROOT, { textOnly: true }).filter(isMarkdown);
  const broken: { file: string; line: number; target: string }[] = [];
  let checked = 0;

  for (const file of files) {
    const r = rel(file);
    const baseDir = dirname(file);
    const lines = readLines(file);
    for (let i = 0; i < lines.length; i++) {
      for (const m of lines[i].matchAll(LINK_RE)) {
        const raw = m[1].trim();
        if (!raw || EXTERNAL_RE.test(raw)) continue;

        // Strip anchor / query for filesystem resolution.
        const targetPath = raw.split("#")[0].split("?")[0];
        if (!targetPath) continue; // was a pure anchor

        checked++;
        const abs = targetPath.startsWith("/")
          ? join(REPO_ROOT, targetPath.slice(1))
          : resolve(baseDir, targetPath);

        if (!existsSync(abs)) {
          broken.push({ file: r, line: i + 1, target: raw });
        }
      }
    }
  }

  for (const b of broken) {
    console.error(`  ${b.file}:${b.line}  broken link -> ${b.target}`);
  }
  console.log(`DOC_LINKS_CHECKED=${checked}  MARKDOWN_FILES=${files.length}`);
  if (broken.length > 0) {
    console.error(`\ndocs:check FAILED — ${broken.length} broken relative link(s).`);
    process.exit(1);
  }
  console.log("docs:check OK — all relative doc links resolve.");
}

main();
