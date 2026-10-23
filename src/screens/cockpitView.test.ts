import { describe, expect, it } from "vitest";
import { eventLine, readCockpit, shipSpecs } from "./cockpitView";
// `hoshi state` from hoshi serve, trimmed to the fields the cockpit reads; the
// mission is written in its `{id, origin, dest, phase, phase_ends_at}` shape.
import state from "./fixtures/cockpit.json";

const fetchedAt = 1_000_000;

describe("readCockpit", () => {
  const view = readCockpit(state, fetchedAt);

  it("orders alerts threats first and points each at its panel", () => {
    expect(view.alerts.map((alert) => [alert.text, alert.target])).toStrictEqual([
      ["Incoming raid", "fleet"],
      ["Build queue idle", "buildings"],
      ["Research idle", "research"],
    ]);
  });

  it("puts mission phases on the client clock", () => {
    expect(view.missions).toStrictEqual([
      { key: "7", origin: "1:1:1", dest: "1:28:4", phase: "Outbound", endsAt: fetchedAt + 600_000 },
    ]);
  });

  it("lists home, colonies and outposts as known worlds", () => {
    expect(view.worlds.slice(0, 2)).toStrictEqual([
      { coord: "1:1:1", kind: "home", rare: null },
      { coord: "1:75:7", kind: "outpost", rare: null },
    ]);
  });

  it("rejects a state it cannot read", () => {
    expect(() => readCockpit({ ...state, missions: "none" }, fetchedAt)).toThrow(/Unexpected/);
  });
});

describe("shipSpecs", () => {
  it("sends only the ships picked", () => {
    expect(shipSpecs({ light_fighter: 2, small_cargo: 0 })).toStrictEqual(["light_fighter:2"]);
  });
});

describe("eventLine", () => {
  it("reads an event like the TUI log", () => {
    const event = {
      id: 3,
      at: 0,
      type: "build",
      action: "complete",
      objects: ["1:1:1", "metal_mine"],
      outcome: "lv 2",
    };
    expect(eventLine(event)).toBe("Build complete · 1:1:1 Metal mine · lv 2");
  });
});
