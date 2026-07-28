import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LighterReadClient, type FetchLike } from "../../src/lib/lighter/index.js";

/** Load a recorded Lighter REST fixture by file name. */
function raw(name: string): unknown {
  const url = new URL(`../../src/lib/lighter/__fixtures__/${name}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), "utf8"));
}

const ROUTES: Record<string, string> = {
  "/api/v1/orderBooks": "orderBooks.raw.json",
  "/api/v1/orderBookOrders": "orderBookOrders-2049.raw.json",
  "/api/v1/recentTrades": "recentTrades-2049.raw.json",
};

/** A deterministic, offline fetch that routes by path to a recorded fixture. */
export function fixtureFetch(opts: { fail?: boolean } = {}): FetchLike {
  return async (url: string) => {
    if (opts.fail) return { ok: false, status: 503, json: async () => ({}) };
    for (const [needle, file] of Object.entries(ROUTES)) {
      if (url.includes(needle)) return { ok: true, status: 200, json: async () => raw(file) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

/** A fixture-backed Lighter READ client (deterministic, no network, no key). */
export function lighterFixtureClient(opts: { fail?: boolean } = {}): LighterReadClient {
  return new LighterReadClient({
    fetchImpl: fixtureFetch(opts),
    now: () => new Date("2026-07-28T18:00:00.000Z"),
  });
}
