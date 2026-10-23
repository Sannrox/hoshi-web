/** WebSockets on hoshi's API: `/v1/events` and `/v1/terminal` (docs/server.md). */

/** `<api>/<path>` as a WebSocket URL, so a proxy prefix carries over. */
export const socketUrl = (path: string, apiRoot: URL) => {
  const url = new URL(path, apiRoot);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
};

/** Browsers cannot set `Authorization` on a socket: hoshi reads the token from a subprotocol. */
export const bearerProtocols = (token: string) => {
  const bytes = new TextEncoder().encode(token);
  const base64 = btoa(String.fromCharCode(...bytes));
  const base64url = base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return ["hoshi.v1", `hoshi.bearer.${base64url}`];
};

/** The part of `WebSocket` the links use, so tests can drive them. */
export type Socket = Pick<WebSocket, "send" | "close" | "binaryType" | "addEventListener">;

export type OpenSocket = (url: URL, protocols: string[]) => Socket;

export const openSocket: OpenSocket = (url, protocols) => new WebSocket(url, protocols);
