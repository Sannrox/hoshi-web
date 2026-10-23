import { describe, expect, it } from "vitest";
import { compact, duration, readCheckIn } from "./checkInView";
// `hoshi state` at api/HOSHI_REF with two builds queued; events are written in its `{at, text}` shape.
import state from "./fixtures/state.json";

const fetchedAt = 1_000_000;

describe("readCheckIn", () => {
  const view = readCheckIn(state, fetchedAt);

  it("puts the raid countdown on the client clock", () => {
    expect(view.raidAt).toBe(fetchedAt + state.raid.lands_in_secs * 1000);
  });

  it("times the running build and leaves the waiting one open", () => {
    const completesAt = state.build_queue[0]?.completes_at ?? 0;
    expect(view.queue).toStrictEqual([
      {
        key: "build-0",
        item: "0",
        kind: "build",
        label: "Metal mine 2",
        endsAt: fetchedAt + (completesAt - state.now) * 1000,
      },
      { key: "build-1", item: "1", kind: "build", label: "Solar plant 2", endsAt: undefined },
    ]);
  });

  it("lists recent events newest first", () => {
    expect(view.recent.map((event) => event.text)).toStrictEqual([
      "Crystal mine reached level 2",
      "Pirate raid repelled at 1:1:1",
    ]);
    expect(view.recent[0]?.at).toBe(fetchedAt - 180_000);
  });

  it("labels resources like the TUI", () => {
    expect(view.planet).toBe("1:1:1");
    expect(view.resources[0]).toStrictEqual({ label: "Fe", amount: 323.75, rate: 33 });
  });

  it("rejects a state it cannot read", () => {
    expect(() => readCheckIn({ ...state, raid: "soon" }, fetchedAt)).toThrow(/Unexpected state/);
  });
});

describe("formatting", () => {
  it.each([
    [45_000, "45s"],
    [180_000, "3m 00s"],
    [7_500_000, "2h 05m"],
    [273_600_000, "3d 04h"],
  ])("duration(%i) is %s", (ms, text) => {
    expect(duration(ms)).toBe(text);
  });

  it("compacts large and fractional numbers", () => {
    expect([compact(323.75), compact(12_500), compact(2.6)]).toStrictEqual(["324", "12.5k", "2.6"]);
  });
});
