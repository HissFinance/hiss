import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncResource<T> = {
  data: T | undefined;
  error: Error | undefined;
  /** True while an initial load or refetch is in flight. */
  loading: boolean;
  /** Manually re-run the fetch. */
  refetch: () => void;
};

export type UseAsyncResourceOptions = {
  /**
   * When false, the fetch is not run and the resource stays idle. Useful for
   * hooks that need an argument (e.g. an account address) before they can
   * fetch. Defaults to true.
   */
  enabled?: boolean;
};

/**
 * Minimal, dependency-free async-resource hook: runs `fetcher` on mount and
 * whenever `deps` change, tracks loading/error/data, supports cancellation via
 * AbortSignal, and ignores results from stale/aborted runs.
 */
export function useAsyncResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options: UseAsyncResourceOptions = {},
): AsyncResource<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(enabled);

  // Bumped to force a manual refetch.
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  // Keep the latest fetcher without making it a dependency.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(undefined);

    fetcherRef.current(controller.signal).then(
      (result) => {
        if (!active || controller.signal.aborted) return;
        setData(result);
        setLoading(false);
      },
      (err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  return { data, error, loading, refetch };
}
