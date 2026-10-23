import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type GameEvent, linkEvents, RECONNECT_MS } from "./events";
import type { Socket } from "./socket";

class FakeSocket extends EventTarget {
  binaryType: BinaryType = "blob";
  constructor(readonly url: URL) {
    super();
  }
  send() {}
  close() {}
  frame(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
  dropped() {
    this.dispatchEvent(new Event("close"));
  }
}

const event = (id: number) => ({
  schema_version: 2,
  ok: true,
  id,
  cursor: id,
  at: 1_710_000_000 + id,
  type: "build",
  action: "complete",
  objects: ["1:1:1", "metal_mine"],
  outcome: "lv 2",
});

const setup = () => {
  const sockets: FakeSocket[] = [];
  const seen: GameEvent[] = [];
  const link = linkEvents({
    url: new URL("ws://host/p/v1/events"),
    token: "tok",
    onEvent: (e) => seen.push(e),
    onStatus: () => undefined,
    open: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket as unknown as Socket;
    },
  });
  return { link, sockets, seen, latest: () => sockets.at(-1)! };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("linkEvents", () => {
  it("resumes after the last event and delivers a replayed event once", () => {
    const { sockets, seen, latest } = setup();
    latest().frame(event(4));
    latest().frame(event(5));
    latest().dropped();
    vi.advanceTimersByTime(RECONNECT_MS);
    latest().frame(event(5));
    latest().frame(event(6));
    expect(sockets.map((s) => s.url.search)).toStrictEqual(["", "?cursor=5"]);
    expect(seen.map((e) => e.id)).toStrictEqual([4, 5, 6]);
  });

  it("skips frames it cannot read", () => {
    const { seen, latest } = setup();
    latest().frame({ schema_version: 2, ok: true, id: 1 });
    latest().dispatchEvent(new MessageEvent("message", { data: "not json" }));
    expect(seen).toHaveLength(0);
  });

  it("stays closed once stopped", () => {
    const { link, sockets, latest } = setup();
    link.stop();
    latest().dropped();
    vi.advanceTimersByTime(RECONNECT_MS);
    expect(sockets).toHaveLength(1);
  });
});
