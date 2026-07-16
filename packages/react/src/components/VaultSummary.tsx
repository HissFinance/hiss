import { formatBaseUnits } from "../internal/format";
import type { VaultSummaryData } from "../types";
import { AddressLink } from "./AddressLink";
import { HissStatusBadge } from "./HissStatusBadge";

export type VaultSummaryProps = {
  vault: VaultSummaryData;
  explorerBaseUrl?: string;
  className?: string;
};

const DEPOSIT_LABEL: Record<VaultSummaryData["depositState"], string> = {
  open: "Deposits open",
  closed: "Deposits closed",
  unknown: "Deposit state unknown",
};

/**
 * A compact vault header: name, address, deposit state, and TVL when known.
 * Deposit state is shown exactly as provided — an `unknown` read is labelled
 * as unknown, never as open.
 */
export function VaultSummary({ vault, explorerBaseUrl, className }: VaultSummaryProps) {
  const tvl =
    vault.tvlBaseUnits != null && vault.assetDecimals != null
      ? `${formatBaseUnits(vault.tvlBaseUnits, vault.assetDecimals)} ${vault.assetSymbol ?? ""}`.trim()
      : null;

  return (
    <div className={["hiss-card", className].filter(Boolean).join(" ")}>
      <div className="hiss-row" style={{ justifyContent: "space-between" }}>
        <strong>{vault.name}</strong>
        <HissStatusBadge status={vault.provenance.status} />
      </div>
      <div className="hiss-row hiss-muted">
        <AddressLink address={vault.address} explorerBaseUrl={explorerBaseUrl} />
        <span aria-hidden="true">·</span>
        <span>chain {vault.chainId}</span>
      </div>
      <div className="hiss-row">
        <span className="hiss-muted">{DEPOSIT_LABEL[vault.depositState]}</span>
      </div>
      {tvl ? (
        <div className="hiss-row">
          <span className="hiss-muted">TVL</span>
          <span className="hiss-mono">{tvl}</span>
        </div>
      ) : null}
    </div>
  );
}
