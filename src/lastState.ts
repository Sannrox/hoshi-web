import { apiRoot } from "./api/http";

/**
 * The last `/v1/state` this device saw, kept so the client can show it offline.
 * Game state only: the token never leaves memory. Sign-out clears it. Storage
 * can be missing or full (private windows); the client then just has no
 * offline copy.
 */
// Per API root: other hoshi installs on this origin (other prefixes) keep their own copy.
const KEY = `hoshi-web:last-state:${apiRoot.href}`;

export type Saved = { raw: unknown; fetchedAt: number };

export const saveState = (raw: unknown, fetchedAt: number) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ raw, fetchedAt } satisfies Saved));
  } catch {
    // No offline copy this time.
  }
};

export const loadState = (): Saved | undefined => {
  try {
    const text = localStorage.getItem(KEY);
    return text ? (JSON.parse(text) as Saved) : undefined;
  } catch {
    return undefined;
  }
};

export const clearState = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
};
