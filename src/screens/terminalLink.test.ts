import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "../api/socket";
import { GIVE_UP_MS, type LinkStatus, linkTerminal, RETRY_MS } from "./terminalLink";

/** A socket the test opens, feeds and closes by hand. */
class FakeSocket extends EventTarget {
  binaryType: BinaryType = "blob";
  sent: unknown[] = [];
  closes: (number | undefined)[] = [];
  send(data: unknown) {
    this.sent.push(data);
  }
  close(code?: number) {
    this.closes.push(code);
  }
  opened() {
    this.dispatchEvent(new Event("open"));
  }
  closed(wasClean: boolean) {
    this.dispatchEvent(Object.assign(new Event("close"), { wasClean }));
  }
}

const setup = () => {
  const sockets: FakeSocket[] = [];
  const statuses: LinkStatus[] = [];
  const link = linkTerminal({
    url: new URL("ws://host/v1/terminal"),
    token: "tok",
    onOutput: () => undefined,
    onStatus: (status) => statuses.push(status),
    open: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as Socket;
    },
  });
  return { link, sockets, statuses, latest: () => sockets.at(-1)! };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("linkTerminal", () => {
  it("drops keys until attached, then sends them as bytes after the size", () => {
    const { link, latest } = setup();
    link.input("x");
    link.resize(120, 40);
    latest().opened();
    link.input("q");
    expect(latest().sent).toStrictEqual([
      JSON.stringify({ type: "resize", cols: 120, rows: 40 }),
      new TextEncoder().encode("q"),
    ]);
  });

  it("ends without reattaching when hoshi closes the session", () => {
    const { sockets, statuses, latest } = setup();
    latest().opened();
    latest().closed(true);
    vi.advanceTimersByTime(GIVE_UP_MS);
    expect(statuses.at(-1)).toBe("ended");
    expect(sockets).toHaveLength(1);
  });

  it("reattaches after a drop while hoshi still holds the save", () => {
    const { sockets, statuses, latest } = setup();
    latest().opened();
    latest().closed(false);
    vi.advanceTimersByTime(RETRY_MS);
    latest().closed(false); // refused during the grace period
    vi.advanceTimersByTime(RETRY_MS);
    latest().opened();
    expect(sockets).toHaveLength(3);
    expect(statuses.at(-1)).toBe("attached");
    expect(latest().sent).toHaveLength(1); // the size, which repaints the screen
  });

  it("gives up reattaching after a while, even when a handshake stalls", () => {
    const { sockets, statuses, latest } = setup();
    latest().opened();
    latest().closed(false);
    vi.advanceTimersByTime(RETRY_MS); // this socket never answers
    vi.advanceTimersByTime(GIVE_UP_MS);
    expect(statuses.at(-1)).toBe("refused");
    expect(latest().closes).toHaveLength(1); // the stalled handshake is abandoned
    expect(sockets).toHaveLength(2);
  });

  it("reports a first socket that never opens as refused", () => {
    const { sockets, statuses, latest } = setup();
    latest().closed(false);
    vi.advanceTimersByTime(GIVE_UP_MS);
    expect(statuses.at(-1)).toBe("refused");
    expect(sockets).toHaveLength(1);
  });

  it("gives up on a first handshake that stalls", () => {
    const { statuses, latest } = setup();
    vi.advanceTimersByTime(GIVE_UP_MS);
    expect(statuses.at(-1)).toBe("refused");
    expect(latest().closes).toHaveLength(1);
  });

  it("leaves with a close frame and does not come back", () => {
    const { link, sockets, latest } = setup();
    latest().opened();
    link.stop();
    latest().closed(false);
    vi.advanceTimersByTime(GIVE_UP_MS);
    expect(latest().closes).toStrictEqual([1000]);
    expect(sockets).toHaveLength(1);
  });
});
