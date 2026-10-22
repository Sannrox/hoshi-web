import type { ServeResponse } from "./hoshi.gen";

/** The `/healthz` contract version this client speaks. */
export const HOSHI_CONTRACT = "v1";

/**
 * Where this client and its API live.
 *
 * Production bundles sit at `<base>/ui/assets/*.js`: the client root is one
 * level above the entry module and the API root two. The dev server serves both
 * from its origin.
 */
export const locate = (moduleUrl: string, dev: boolean) =>
  dev
    ? { consoleRoot: new URL("/", moduleUrl), apiRoot: new URL("/", moduleUrl) }
    : { consoleRoot: new URL("../", moduleUrl), apiRoot: new URL("../../", moduleUrl) };

export const { consoleRoot, apiRoot } = locate(import.meta.url, import.meta.env.DEV);

type ErrorCode = NonNullable<ServeResponse["error"]>["code"];

/** A non-2xx response from the hoshi API, with hoshi's error code when it sent one. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | undefined,
    message: string,
  ) {
    super(message);
  }
}

type RequestOptions = { token?: string; fetcher?: typeof fetch };

/** Typed JSON GET against the hoshi API, with the bearer token when there is one. */
export const request = async <T>(
  path: string,
  { token, fetcher = fetch }: RequestOptions = {},
): Promise<T> => {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetcher(new URL(path, apiRoot), { headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as ServeResponse | undefined;
    throw new ApiError(
      response.status,
      body?.error?.code,
      body?.error?.message ?? `${path}: HTTP ${response.status}`,
    );
  }
  return (await response.json()) as T;
};

/** `GET /healthz`; open, and not part of the vendored `/v1` schemas. */
type Health = { ok: boolean; version: string; contract_versions: string[] };

export type ServerCheck = { kind: "ready"; version: string } | { kind: "too-old"; version: string };

/** Require the server to list the contract this client was built for. */
export const checkServer = async (fetcher: typeof fetch = fetch): Promise<ServerCheck> => {
  const health = await request<Health>("healthz", { fetcher });
  return health.contract_versions.includes(HOSHI_CONTRACT)
    ? { kind: "ready", version: health.version }
    : { kind: "too-old", version: health.version };
};
