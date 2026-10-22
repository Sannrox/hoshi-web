import { create } from "zustand";
import { request } from "./api/http";

/**
 * The signed-in session. The bearer token lives only in memory: a reload signs
 * out. hoshi's tokens do not expire, so there is nothing to refresh; any 401
 * ends the session instead (see `main.tsx`).
 */
type Session = {
  token: string | undefined;
  /** Why the last session ended, shown on the sign-in screen. */
  ended: "signed-out" | "refused" | undefined;
  signIn: (token: string) => void;
  signOut: (reason?: "refused") => void;
};

export const useSession = create<Session>()((set) => ({
  token: undefined,
  ended: undefined,
  signIn: (token) => set({ token, ended: undefined }),
  signOut: (reason) => set({ token: undefined, ended: reason ?? "signed-out" }),
}));

/** Check a token against hoshi before keeping it; throws `ApiError` when refused. */
export const verifyToken = async (token: string, fetcher: typeof fetch = fetch) => {
  await request("v1/version", { token, fetcher });
};
