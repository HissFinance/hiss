/**
 * Shared filesystem helpers for the HISS Finance public-repo guard scripts.
 *
 * Dependency-free (Node built-ins only) so the guards can run in a minimal CI
 * job. All helpers operate on the repository root, resolved from this file's
 * location, so scripts work regardless of the current working directory.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Absolute path to the repository root (scripts/lib -> repo root). */
export const REPO_ROOT = join(HERE, "..", "..");

/** Directories never scanned by any guard. */
export const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".turbo",
  ".pnpm-store",
  ".vercel",
]);

/** Binary / non-text extensions we never read as text. */
const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".pdf",
  ".zip",
  ".gz",
  ".wasm",
  ".node",
]);

export interface WalkOptions {
  /** Extra directory names to skip (merged with IGNORE_DIRS). */
  ignoreDirs?: Iterable<string>;
  /** When true, only text-ish files are returned. */
  textOnly?: boolean;
}

/**
 * Recursively list absolute file paths under `root`, honoring IGNORE_DIRS.
 */
export function listFiles(root: string = REPO_ROOT, opts: WalkOptions = {}): string[] {
  const ignore = new Set(IGNORE_DIRS);
  for (const d of opts.ignoreDirs ?? []) ignore.add(d);

  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      // Ignore by name for BOTH dirs and files: in a linked git worktree `.git`
      // is a pointer FILE (not a directory), so a dir-only skip would scan it
      // and leak the operator's local worktree path. Names in IGNORE_DIRS are
      // never legitimate tracked text files, so skipping matching files is safe.
      if (ignore.has(entry.name)) continue;
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        if (opts.textOnly && isBinary(full)) continue;
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

/** True for extensions we treat as binary and never read as text. */
export function isBinary(path: string): boolean {
  return BINARY_EXT.has(extname(path).toLowerCase());
}

/** Path relative to the repo root, using forward slashes. */
export function rel(path: string): string {
  return relative(REPO_ROOT, path).split("\\").join("/");
}

/** Read a UTF-8 file, returning "" on any error. */
export function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

/** Split file content into 1-indexed lines. */
export function readLines(path: string): string[] {
  return readText(path).split(/\r?\n/);
}

export { existsSync, statSync };
