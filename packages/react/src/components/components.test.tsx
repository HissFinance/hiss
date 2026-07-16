import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HissStatusBadge } from "./HissStatusBadge";
import { VaultPerformanceChart } from "./VaultPerformanceChart";
import { ActionPlanReview } from "./ActionPlanReview";
import { buildStakePlan } from "../plans";

describe("HissStatusBadge", () => {
  it("renders an accessible unknown status", () => {
    render(<HissStatusBadge status="unknown" />);
    expect(screen.getByRole("status")).toHaveTextContent("Unknown");
  });
});

describe("VaultPerformanceChart", () => {
  it("shows an honest empty state for no data", () => {
    render(<VaultPerformanceChart points={[]} />);
    expect(screen.getByText(/No performance history/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders an SVG only when there are at least two observed points", () => {
    render(
      <VaultPerformanceChart
        points={[
          { at: "2026-07-01T00:00:00Z", value: "1.00" },
          { at: "2026-07-02T00:00:00Z", value: "1.02" },
        ]}
      />,
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
});

describe("ActionPlanReview", () => {
  it("labels a plan as unsigned and not executed", () => {
    const { plan } = buildStakePlan({
      amountBaseUnits: "5",
      account: "0x00000000000000000000000000000000000000a1",
    });
    render(<ActionPlanReview plan={plan} />);
    expect(screen.getByText(/Unsigned · not executed/i)).toBeInTheDocument();
    expect(screen.getByText(/does not sign or broadcast/i)).toBeInTheDocument();
  });

  it("shows validation errors when there is no plan", () => {
    render(<ActionPlanReview plan={null} errors={["amountBaseUnits must be a positive integer string."]} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/positive integer/);
  });
});
