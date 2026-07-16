/**
 * Credential rejection. HISS tooling never accepts private keys, seed
 * phrases, API keys, tokens, cookies, or passwords. Any input object is
 * scanned before use and refused if a credential-shaped field is present.
 */

const CREDENTIAL_KEY_RE =
  /(private[_-]?key|secret|seed|mnemonic|passphrase|password|api[_-]?key|access[_-]?token|bearer|cookie|authorization|credential)/i;

const PRIVATE_KEY_VALUE_RE = /^0x[0-9a-fA-F]{64}$/;
// BIP39-style mnemonic: 12+ whitespace-separated lowercase words. The `\s+`
// between words is required so ordinary multi-word strings do not match.
const MNEMONIC_VALUE_RE = /^([a-z]+\s+){11,}[a-z]+$/i;

/** Returns dot-paths of fields that look like credentials. Empty = clean. */
export function findCredentialLikeFields(value: unknown, path = ""): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => hits.push(...findCredentialLikeFields(item, `${path}[${i}]`)));
    return hits;
  }
  if (value && typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (CREDENTIAL_KEY_RE.test(key)) hits.push(childPath);
      else hits.push(...findCredentialLikeFields(val, childPath));
    }
    return hits;
  }
  if (typeof value === "string") {
    if (PRIVATE_KEY_VALUE_RE.test(value.trim()) || MNEMONIC_VALUE_RE.test(value)) {
      hits.push(path || "(value)");
    }
  }
  return hits;
}

export class CredentialRejectedError extends Error {
  constructor(public readonly fields: string[]) {
    super(
      "HISS never accepts credentials. Remove these fields: " +
        fields.join(", ") +
        ". HISS reads state and prepares unsigned transactions only.",
    );
    this.name = "CredentialRejectedError";
  }
}

/** Throws if any credential-shaped field is present. */
export function assertNoCredentials(value: unknown): void {
  const hits = findCredentialLikeFields(value);
  if (hits.length > 0) throw new CredentialRejectedError(hits);
}
