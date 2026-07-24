/**
 * Readiness probe for the HTTP transport.
 *
 * Readiness = the configured Robinhood Chain RPC is reachable AND reports the
 * expected chain id (4663 mainnet by default). This is a read-only JSON-RPC
 * `eth_chainId` call; it never signs, never mutates, and never returns or logs
 * the RPC URL. The endpoint answers a boolean plus a machine reason — the URL,
 * any credentials it may embed, and any response internals stay inside the
 * process.
 */

export interface ReadinessResult {
  ready: boolean;
  /** The chain id observed on-chain, when the probe succeeded. */
  chainId?: number;
  /** Machine-readable reason when not ready (never contains the URL). */
  reason?: string;
  /** The chain id observed, when it did not match the expected one. */
  observedChainId?: number;
}

export interface ReadinessConfig {
  /** RPC endpoint (never surfaced). Absent => not-ready. */
  rpcUrl?: string;
  /** Expected chain id; a mismatch is not-ready. */
  chainId?: number;
  /** Abort budget for the probe in ms. */
  timeoutMs?: number;
}

type FetchLike = typeof fetch;

/**
 * Probe RPC reachability with a bounded `eth_chainId` read. Fail-closed: any
 * absence, transport error, timeout, malformed reply, or chain-id mismatch is
 * not-ready. The returned object never carries the RPC URL.
 */
export async function checkRpcReadiness(
  config: ReadinessConfig,
  fetchImpl: FetchLike = fetch,
): Promise<ReadinessResult> {
  const { rpcUrl, chainId, timeoutMs = 3000 } = config;
  if (!rpcUrl) return { ready: false, reason: "rpc_url_not_configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: controller.signal,
    });
    if (!res.ok) return { ready: false, reason: `rpc_http_${res.status}` };
    const json = (await res.json()) as { result?: unknown };
    const raw = typeof json?.result === "string" ? json.result : undefined;
    const observed = raw ? Number.parseInt(raw, 16) : Number.NaN;
    if (!Number.isFinite(observed)) return { ready: false, reason: "rpc_bad_response" };
    if (typeof chainId === "number" && observed !== chainId) {
      return { ready: false, reason: "chain_id_mismatch", observedChainId: observed };
    }
    return { ready: true, chainId: observed };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    return { ready: false, reason: name === "AbortError" ? "rpc_timeout" : "rpc_unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
