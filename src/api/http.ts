import { HOSHI_CONTRACT } from "./hoshi.gen";
import type { Health } from "./hoshi.gen";

/**
 * Where this console and its API live.
 *
 * Production bundles sit at `<base>/ui/assets/*.js`: the console root is one
 * level above the entry module and the API root two. The dev server serves both
 * from its origin.
 */
export const locate = (moduleUrl: string, dev: boolean) =>
  dev
    ? { consoleRoot: new URL("/", moduleUrl), apiRoot: new URL("/", moduleUrl) }
    : { consoleRoot: new URL("../", moduleUrl), apiRoot: new URL("../../", moduleUrl) };

export const { consoleRoot, apiRoot } = locate(import.meta.url, import.meta.env.DEV);

/** A non-2xx response from the hoshi API. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Typed JSON GET against the hoshi API. */
export const request = async <T>(path: string, fetcher: typeof fetch = fetch): Promise<T> => {
  const response = await fetcher(new URL(path, apiRoot), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
};

export type ServerCheck = { kind: "ready"; version: string } | { kind: "too-old"; version: string };

/** Require the server to list the contract this console was built for. */
export const checkServer = async (fetcher: typeof fetch = fetch): Promise<ServerCheck> => {
  const health = await request<Health>("healthz", fetcher);
  return health.contracts.includes(HOSHI_CONTRACT)
    ? { kind: "ready", version: health.version }
    : { kind: "too-old", version: health.version };
};
