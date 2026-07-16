import { truncateAddress } from "../internal/format";
import type { ReceiptLike, ReceiptVerification } from "../types";

export type ReceiptCardProps = {
  receipt: ReceiptLike;
  /** Optional verification result from `useReceiptVerification`. */
  verification?: ReceiptVerification;
  className?: string;
};

/**
 * Renders a HISS paper receipt. Always labels it as a local "paper" proof —
 * not an on-chain anchor, signature, or performance claim. When a verification
 * result is supplied, it surfaces well-formedness and hash-match state.
 */
export function ReceiptCard({ receipt, verification, className }: ReceiptCardProps) {
  return (
    <div className={["hiss-card", className].filter(Boolean).join(" ")}>
      <div className="hiss-row" style={{ justifyContent: "space-between" }}>
        <strong>{receipt.kind} receipt</strong>
        <span className="hiss-badge hiss-badge--unknown" title="Local proof, not an on-chain anchor">
          paper
        </span>
      </div>
      <div className="hiss-row hiss-muted">
        <span>ID</span>
        <span className="hiss-mono">{truncateAddress(receipt.receiptId, 8, 6)}</span>
      </div>
      <div className="hiss-row hiss-muted">
        <span>Hash</span>
        <span className="hiss-mono" style={{ overflowWrap: "anywhere" }}>
          {truncateAddress(receipt.manifestHash, 10, 8)}
        </span>
      </div>
      {receipt.validationStatus ? (
        <div className="hiss-row hiss-muted">
          <span>Validation</span>
          <span>{receipt.validationStatus}</span>
        </div>
      ) : null}
      {verification ? (
        <div className="hiss-row">
          <span
            className={[
              "hiss-badge",
              verification.wellFormed ? "hiss-badge--live" : "hiss-badge--unknown",
            ].join(" ")}
          >
            {verification.wellFormed ? "well-formed" : "malformed"}
          </span>
          {verification.hashMatches != null ? (
            <span
              className={[
                "hiss-badge",
                verification.hashMatches ? "hiss-badge--live" : "hiss-badge--degraded",
              ].join(" ")}
            >
              {verification.hashMatches ? "hash verified" : "hash mismatch"}
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="hiss-plan__note">
        A paper receipt is a local, content-addressed proof of what was generated. It is not anchored on-chain
        and is not a performance claim.
      </p>
    </div>
  );
}
