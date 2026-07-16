import type { AnchorHTMLAttributes } from "react";
import { explorerAddressUrl, ROBINHOOD_EXPLORER_URL } from "../constants";
import { truncateAddress } from "../internal/format";

export type AddressLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  address: string;
  /** Explorer base URL. Defaults to the public Robinhood Chain explorer. */
  explorerBaseUrl?: string;
  /** Show the full address instead of a truncated form. */
  full?: boolean;
  /** Override the visible label entirely. */
  label?: string;
};

/**
 * Renders an address as a link to a block explorer. Purely presentational —
 * no wallet, no signing. Truncates by default for compact display.
 */
export function AddressLink({
  address,
  explorerBaseUrl = ROBINHOOD_EXPLORER_URL,
  full = false,
  label,
  className,
  ...rest
}: AddressLinkProps) {
  const text = label ?? (full ? address : truncateAddress(address));
  return (
    <a
      className={["hiss-address-link", "hiss-mono", className].filter(Boolean).join(" ")}
      href={explorerAddressUrl(address, explorerBaseUrl)}
      target="_blank"
      rel="noreferrer noopener"
      title={address}
      {...rest}
    >
      {text}
    </a>
  );
}
