import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HissProvider } from "../context";
import { createMockHissClient } from "../client/mockClient";
import { useRewardStatus, useVaults } from "./reads";

function wrap(children: React.ReactNode) {
  return <HissProvider client={createMockHissClient()}>{children}</HissProvider>;
}

function VaultsProbe() {
  const { data, loading } = useVaults();
  if (loading) return <span>loading</span>;
  return <span data-testid="vault-name">{data?.[0]?.name ?? "none"}</span>;
}

function RewardsProbe() {
  const { data } = useRewardStatus();
  if (!data) return <span>loading</span>;
  const undeployed = data.legs.filter((l) => l.recipient === null).length;
  return <span data-testid="undeployed">{undeployed}</span>;
}

describe("read hooks with the mock client", () => {
  it("loads vaults from the provided client", async () => {
    render(wrap(<VaultsProbe />));
    await waitFor(() => expect(screen.getByTestId("vault-name")).toHaveTextContent("HISS Flagship Vault"));
  });

  it("reports undeployed reward legs honestly (null recipients)", async () => {
    render(wrap(<RewardsProbe />));
    await waitFor(() => expect(screen.getByTestId("undeployed")).toHaveTextContent("3"));
  });

  it("throws a clear error when used without a provider", () => {
    // Suppress React's error boundary console noise for this expected throw.
    const spy = () => render(<VaultsProbe />);
    expect(spy).toThrow(/HissProvider/);
  });
});
