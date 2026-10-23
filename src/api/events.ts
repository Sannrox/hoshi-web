import { type } from "arktype";
import { bearerProtocols, type OpenSocket, openSocket, type Socket } from "./socket";

/**
 * `GET /v1/events` (docs/server.md, "Events"): public game events as JSON text
 * frames. On connect hoshi replays what it retains (the last 256), then sends
 * new ones; `?cursor=<id>` resumes after the last event seen.
 */
export const GameEvent = type({
  id: "number",
  at: "number",
  type: "string",
  action: "string",
  objects: "string[]",
  outcome: "string",
});
export type GameEvent = typeof GameEvent.infer;

export type EventsStatus = "connecting" | "live" | "reconnecting";

/** Reading events is safe to repeat, so a dropped socket retries until stopped. */
export const RECONNECT_MS = 3_000;

type EventsOptions = {
  url: URL;
  token: string;
  onEvent: (event: GameEvent) => void;
  onStatus: (status: EventsStatus) => void;
  open?: OpenSocket;
};

/** Follow hoshi's events, resuming from the last cursor after a drop. Each event is delivered once. */
export const linkEvents = ({ url, token, onEvent, onStatus, open = openSocket }: EventsOptions) => {
  let cursor: number | undefined;
  let stopped = false;
  let socket: Socket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    const target = new URL(url);
    if (cursor !== undefined) {
      target.searchParams.set("cursor", String(cursor));
    }
    const current = open(target, bearerProtocols(token));
    socket = current;
    current.addEventListener("open", () => onStatus("live"));
    current.addEventListener("message", ({ data }) => {
      if (typeof data !== "string") {
        return;
      }
      let event: GameEvent | type.errors;
      try {
        event = GameEvent(JSON.parse(data));
      } catch {
        return;
      }
      if (event instanceof type.errors || (cursor !== undefined && event.id <= cursor)) {
        return;
      }
      cursor = event.id;
      onEvent(event);
    });
    current.addEventListener("close", () => {
      socket = undefined;
      if (!stopped) {
        onStatus("reconnecting");
        retry = setTimeout(connect, RECONNECT_MS);
      }
    });
  };

  onStatus("connecting");
  connect();

  return {
    stop: () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close(1000);
    },
  };
};
