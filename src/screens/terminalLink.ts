/**
 * The socket behind the browser terminal: `GET /v1/terminal` on `hoshi serve`
 * (docs/server.md, "Terminal"). Binary frames carry terminal bytes both ways;
 * the one text frame is a resize. hoshi ends a session with a close frame
 * (quit, idle) and holds the save for a short grace period when a socket drops.
 */

import { bearerProtocols, type OpenSocket, openSocket, type Socket } from "../api/socket";

/**
 * - `connecting`/`reconnecting`: no socket is open; keys are dropped, never queued.
 * - `attached`: keys reach hoshi.
 * - `ended`: hoshi closed the session (quit or idle); the save is free.
 * - `refused`: no socket opened, or reconnecting gave up. A held save or a
 *   refused token look the same from a browser; the screen tells them apart.
 */
export type LinkStatus = "connecting" | "attached" | "reconnecting" | "ended" | "refused";

/** How often a dropped session tries to reattach, and how long attaching may take. hoshi's grace is 10 s. */
export const RETRY_MS = 2_000;
export const GIVE_UP_MS = 30_000;

type LinkOptions = {
  url: URL;
  token: string;
  onOutput: (bytes: Uint8Array) => void;
  onStatus: (status: LinkStatus) => void;
  open?: OpenSocket;
};

/**
 * Attach to a terminal session and reattach after an unclean drop. Every
 * (re)open sends the last size, which makes hoshi repaint the whole screen.
 */
export const linkTerminal = ({
  url,
  token,
  onOutput,
  onStatus,
  open = openSocket,
}: LinkOptions) => {
  let socket: Socket | undefined;
  let attached = false;
  let stopped = false;
  let size = { cols: 80, rows: 24 };
  let reattaching = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  // Armed while not attached; it fires even if a handshake stalls.
  let giveUp: ReturnType<typeof setTimeout> | undefined;

  const sendSize = () => socket?.send(JSON.stringify({ type: "resize", ...size }));

  const halt = () => {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(giveUp);
  };

  const armDeadline = () => {
    giveUp = setTimeout(() => {
      halt();
      socket?.close();
      onStatus("refused");
    }, GIVE_UP_MS);
  };

  const connect = () => {
    const current = open(url, bearerProtocols(token));
    socket = current;
    current.binaryType = "arraybuffer";
    current.addEventListener("open", () => {
      attached = true;
      reattaching = false;
      clearTimeout(giveUp);
      onStatus("attached");
      sendSize();
    });
    current.addEventListener("message", (event) => {
      if (event.data instanceof ArrayBuffer) {
        onOutput(new Uint8Array(event.data));
      }
    });
    current.addEventListener("close", (event) => {
      const wasAttached = attached;
      attached = false;
      socket = undefined;
      if (stopped) {
        return;
      }
      if (wasAttached && event.wasClean) {
        onStatus("ended");
        return;
      }
      if (wasAttached) {
        reattaching = true;
        armDeadline();
      } else if (!reattaching) {
        halt();
        onStatus("refused");
        return;
      }
      onStatus("reconnecting");
      retry = setTimeout(connect, RETRY_MS);
    });
  };

  onStatus("connecting");
  armDeadline();
  connect();

  return {
    /** Key input from xterm; dropped unless attached, so nothing is replayed later. */
    input: (data: string) => {
      if (attached) {
        socket?.send(new TextEncoder().encode(data));
      }
    },
    resize: (cols: number, rows: number) => {
      size = { cols, rows };
      if (attached) {
        sendSize();
      }
    },
    /** Leave with a close frame: hoshi frees the save at once. */
    stop: () => {
      halt();
      socket?.close(1000);
    },
  };
};
