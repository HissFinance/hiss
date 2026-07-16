import { ROBINHOOD_CHAIN_ID, ROBINHOOD_CHAIN_NAME, ROBINHOOD_PUBLIC_RPC_URL } from "../constants";
import type { ReadStatus } from "../types";
import { HissStatusBadge } from "./HissStatusBadge";

export type ChainStatusProps = {
  chainId?: number;
  chainName?: string;
  rpcUrl?: string;
  /** Read health of the connection, if known. */
  status?: ReadStatus;
  className?: string;
};

/**
 * Displays the target chain and its public RPC endpoint. Defaults to Robinhood
 * Chain mainnet. Presentational only.
 */
export function ChainStatus({
  chainId = ROBINHOOD_CHAIN_ID,
  chainName = ROBINHOOD_CHAIN_NAME,
  rpcUrl = ROBINHOOD_PUBLIC_RPC_URL,
  status,
  className,
}: ChainStatusProps) {
  return (
    <div className={["hiss-card", className].filter(Boolean).join(" ")}>
      <div className="hiss-row" style={{ justifyContent: "space-between" }}>
        <strong>{chainName}</strong>
        {status ? <HissStatusBadge status={status} /> : null}
      </div>
      <div className="hiss-row hiss-muted">
        <span>Chain ID</span>
        <span className="hiss-mono">{chainId}</span>
      </div>
      <div className="hiss-row hiss-muted">
        <span>RPC</span>
        <span className="hiss-mono" style={{ overflowWrap: "anywhere" }}>
          {rpcUrl}
        </span>
      </div>
    </div>
  );
}
