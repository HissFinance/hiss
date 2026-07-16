/**
 * schemas:validate — validates every JSON Schema in `schemas/` and checks that
 * each schema's committed example(s) conform.
 *
 * Conventions:
 *   schemas/<name>.schema.json          — a JSON Schema (draft 2020-12 / 7)
 *   schemas/examples/<name>.example.json — an example instance for <name>
 *   schemas/examples/<name>.example.*.json — additional examples for <name>
 *
 * Every schema must parse and compile. Every example must validate against its
 * schema. A schema with zero examples is a warning (encourage coverage) but not
 * a failure. Exit 1 on any parse error, compile error, or non-conforming
 * example.
 */
import { readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { REPO_ROOT, readText, rel } from "./lib/walk.ts";

const SCHEMA_DIR = join(REPO_ROOT, "schemas");
const EXAMPLE_DIR = join(SCHEMA_DIR, "examples");

interface Problem {
  file: string;
  message: string;
}

function listJson(dir: string, filter: (n: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json") && filter(n))
    .map((n) => join(dir, n))
    .sort();
}

function parse(file: string, problems: Problem[]): unknown | undefined {
  try {
    return JSON.parse(readText(file));
  } catch (e) {
    problems.push({ file: rel(file), message: `invalid JSON: ${(e as Error).message}` });
    return undefined;
  }
}

function main(): void {
  const problems: Problem[] = [];
  const schemaFiles = listJson(SCHEMA_DIR, (n) => n.endsWith(".schema.json"));

  if (schemaFiles.length === 0) {
    console.log("schemas:validate — no schemas found under schemas/ (nothing to validate).");
    console.log("schemas:validate OK");
    return;
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  // First pass: parse every schema and REGISTER it, so cross-schema `$ref`s
  // (by `$id`) resolve when we compile. Schemas without an `$id` are compiled
  // standalone in the second pass.
  const parsed: { file: string; schema: Record<string, unknown>; id?: string }[] = [];
  for (const schemaFile of schemaFiles) {
    const schema = parse(schemaFile, problems) as Record<string, unknown> | undefined;
    if (schema === undefined) continue;
    const id = typeof schema.$id === "string" ? schema.$id : undefined;
    if (id) {
      try {
        ajv.addSchema(schema, id);
      } catch (e) {
        problems.push({
          file: rel(schemaFile),
          message: `could not register schema: ${(e as Error).message}`,
        });
        continue;
      }
    }
    parsed.push({ file: schemaFile, schema, id });
  }

  let exampleCount = 0;

  // Second pass: obtain a validator per schema (resolving registered refs) and
  // validate its example instances.
  for (const { file: schemaFile, schema, id } of parsed) {
    let validate;
    try {
      validate = id ? ajv.getSchema(id) : ajv.compile(schema);
    } catch (e) {
      problems.push({ file: rel(schemaFile), message: `schema failed to compile: ${(e as Error).message}` });
      continue;
    }
    if (!validate) {
      problems.push({ file: rel(schemaFile), message: `could not obtain validator (id ${id})` });
      continue;
    }

    const base = basename(schemaFile).replace(/\.schema\.json$/, "");
    const examples = listJson(
      EXAMPLE_DIR,
      (n) => n === `${base}.example.json` || n.startsWith(`${base}.example.`),
    );

    if (examples.length === 0) {
      console.warn(`  ⚠ ${rel(schemaFile)} has no example instance under schemas/examples/`);
    }

    for (const exFile of examples) {
      const instance = parse(exFile, problems);
      if (instance === undefined) continue;
      exampleCount++;
      if (!validate(instance)) {
        const errs = (validate.errors ?? [])
          .map((er: { instancePath?: string; message?: string }) => `${er.instancePath || "/"} ${er.message}`)
          .join("; ");
        problems.push({ file: rel(exFile), message: `does not conform to ${base}.schema.json: ${errs}` });
      }
    }
  }

  for (const p of problems) {
    console.error(`  ${p.file}: ${p.message}`);
  }
  console.log(`SCHEMAS_VALIDATED=${schemaFiles.length}  EXAMPLES_VALIDATED=${exampleCount}`);
  if (problems.length > 0) {
    console.error(`\nschemas:validate FAILED — ${problems.length} problem(s).`);
    process.exit(1);
  }
  console.log("schemas:validate OK — all schemas compile and all examples conform.");
}

main();
