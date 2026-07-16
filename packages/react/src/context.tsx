import { createContext, createElement, useContext, type ReactNode } from "react";
import type { HissClient } from "./types";

const HissClientContext = createContext<HissClient | null>(null);

export type HissProviderProps = {
  /** Any object satisfying the {@link HissClient} contract. */
  client: HissClient;
  children?: ReactNode;
};

/**
 * Provides a {@link HissClient} to the hook tree. Wrap your app (or the
 * subtree that uses HISS hooks) once:
 *
 * ```tsx
 * <HissProvider client={client}>
 *   <App />
 * </HissProvider>
 * ```
 */
export function HissProvider({ client, children }: HissProviderProps) {
  return createElement(HissClientContext.Provider, { value: client }, children);
}

/** Returns the client from context, or throws a clear error if unprovided. */
export function useHissClient(): HissClient {
  const client = useContext(HissClientContext);
  if (!client) {
    throw new Error(
      "useHissClient must be used within a <HissProvider client={...}>. " +
        "Pass a HissClient (e.g. from @hiss-finance/sdk or createMockHissClient).",
    );
  }
  return client;
}
