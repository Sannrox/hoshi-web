import { type } from "arktype";
import type { GameEvent } from "../api/events";
import { humanize, readCheckIn } from "./checkInView";

/**
 * Cockpit view model: the whole of `GET /v1/state` a wide screen shows at once,
 * on top of the check-in model. Like it, times are client-clock milliseconds.
 * Everything here is read from the state; nothing is predicted.
 */

/** The fields the cockpit reads beyond the check-in. */
const Cockpit = type({
  now: "number",
  energy: { produced: "number", consumed: "number" },
  heat: { load: "number", sink: "number" },
  research: { levels: "Record<string, number>" },
  fleet: "Record<string, number>",
  missions: type({
    id: "number",
    origin: "string",
    dest: "string",
    phase: "string",
    phase_ends_at: "number",
  }).array(),
  planets: type({ coord: "string", home: "boolean", rare: "string | null" }).array(),
  outposts: type({ coord: "string", rare: "string | null" }).array(),
});

/** Panels an alert can jump to; each is the `id` of its panel. */
export type PanelId = "buildings" | "research" | "queues" | "fleet" | "worlds" | "timeline";

export type Alert = {
  key: string;
  intent: "danger" | "warning";
  text: string;
  /** Client-clock ms the alert counts down to. */
  at?: number;
  target: PanelId;
};

export type CockpitView = ReturnType<typeof readCockpit>;

/** Validate `/v1/state` and shape it for the cockpit; throws on an unexpected shape. */
export const readCockpit = (raw: unknown, fetchedAt: number) => {
  const base = readCheckIn(raw, fetchedAt);
  const state = Cockpit(raw);
  if (state instanceof type.errors) {
    throw new Error(`Unexpected state from hoshi: ${state.summary}`);
  }
  const clock = (unix: number) => fetchedAt + (unix - state.now) * 1000;
  // Threats first, then idle queues, as the TUI's alerts bar orders them.
  const alerts: Alert[] = [];
  if (base.raidAt !== undefined) {
    alerts.push({
      key: "raid",
      intent: "danger",
      text: "Incoming raid",
      at: base.raidAt,
      target: "fleet",
    });
  }
  if (!base.queue.some((slot) => slot.kind !== "research")) {
    alerts.push({
      key: "build-idle",
      intent: "warning",
      text: "Build queue idle",
      target: "buildings",
    });
  }
  if (!base.queue.some((slot) => slot.kind === "research")) {
    alerts.push({
      key: "research-idle",
      intent: "warning",
      text: "Research idle",
      target: "research",
    });
  }
  return {
    ...base,
    /** Add to `unix * 1000` to place a server time on the client clock. */
    offsetMs: fetchedAt - state.now * 1000,
    energy: state.energy,
    heat: state.heat,
    alerts,
    techs: Object.entries(state.research.levels).map(([key, level]) => ({
      key,
      label: humanize(key),
      level,
    })),
    ships: Object.entries(state.fleet).map(([key, count]) => ({
      key,
      label: humanize(key),
      count,
    })),
    missions: state.missions.map((mission) => ({
      key: String(mission.id),
      origin: mission.origin,
      dest: mission.dest,
      phase: humanize(mission.phase),
      endsAt: clock(mission.phase_ends_at),
    })),
    worlds: [
      ...state.planets.map((planet) => ({
        coord: planet.coord,
        kind: planet.home ? "home" : "planet",
        rare: planet.rare,
      })),
      ...state.outposts.map((outpost) => ({
        coord: outpost.coord,
        kind: "outpost",
        rare: outpost.rare,
      })),
    ],
  };
};

/** Missions `POST /v1/fleet/send` accepts. */
export const MISSIONS = ["attack", "invade", "colonize", "expedition", "spy"] as const;

/** `{"light_fighter": 2}`-style selections to the `kind:count` specs hoshi takes; empty counts drop. */
export const shipSpecs = (picked: Record<string, number>) =>
  Object.entries(picked)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${kind}:${count}`);

/** A timeline line: `Build complete · 1:1:1 Metal mine · lv 2`. */
export const eventLine = (event: GameEvent) =>
  [
    `${humanize(event.type)} ${event.action}`,
    event.objects.map((object) => (object.includes(":") ? object : humanize(object))).join(" "),
    event.outcome,
  ]
    .filter(Boolean)
    .join(" · ");
