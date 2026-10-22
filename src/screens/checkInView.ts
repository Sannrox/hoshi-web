import { type } from "arktype";

/**
 * Check-in view model: the slice of `GET /v1/state` a quick phone visit needs.
 * Times become client-clock milliseconds at fetch time, so countdowns tick
 * locally and never depend on the server and browser clocks agreeing.
 */

/** The `/v1/state` fields this screen reads; other fields pass through unchecked. */
const State = type({
  now: "number",
  resources: {
    iron: "number",
    silicon: "number",
    rare_earths: "number",
    water_ice: "number",
    helium_3: "number",
    deuterium: "number",
  },
  rates: "Record<string, number>",
  buildings: "Record<string, number>",
  build_queue: type({
    index: "number",
    building: "string",
    kind: "string",
    from_level: "number",
    completes_at: "number | null",
  }).array(),
  research: {
    current: type({ tech: "string", from_level: "number", completes_at: "number | null" }).or(
      "null",
    ),
  },
  raid: type({ lands_in_secs: "number" }).or("null"),
  events: type({ at: "number", text: "string" }).array(),
  planets: type({ coord: "string", home: "boolean" }).array(),
});

type Resource = keyof typeof State.infer.resources;

/** Labels as the TUI prints them. */
const RESOURCE_LABELS: Record<Resource, string> = {
  iron: "Fe",
  silicon: "Si",
  rare_earths: "REE",
  water_ice: "H2O",
  helium_3: "He3",
  deuterium: "D",
};

/** `metal_mine` -> `Metal mine`. */
export const humanize = (key: string) => {
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export type QueueSlot = {
  key: string;
  kind: "build" | "dismantle" | "research";
  label: string;
  /** Client-clock ms; undefined while the slot waits behind another. */
  endsAt: number | undefined;
};

export type CheckIn = ReturnType<typeof readCheckIn>;

/** Validate `/v1/state` and shape it for the check-in screen; throws on an unexpected shape. */
export const readCheckIn = (raw: unknown, fetchedAt: number) => {
  const state = State(raw);
  if (state instanceof type.errors) {
    throw new Error(`Unexpected state from hoshi: ${state.summary}`);
  }
  const clock = (unix: number) => fetchedAt + (unix - state.now) * 1000;
  const at = (unix: number | null) => (unix === null ? undefined : clock(unix));
  const builds = state.build_queue.map((job): QueueSlot => ({
    key: `build-${job.index}`,
    kind: job.kind === "dismantle" ? "dismantle" : "build",
    label:
      job.kind === "dismantle"
        ? `${humanize(job.building)} ↓${job.from_level - 1}`
        : `${humanize(job.building)} ${job.from_level + 1}`,
    endsAt: at(job.completes_at),
  }));
  const research = state.research.current;
  return {
    planet: state.planets.find((planet) => planet.home)?.coord,
    resources: (Object.keys(RESOURCE_LABELS) as Resource[]).map((key) => ({
      label: RESOURCE_LABELS[key],
      amount: state.resources[key],
      rate: state.rates[key] ?? 0,
    })),
    raidAt: state.raid ? fetchedAt + state.raid.lands_in_secs * 1000 : undefined,
    queue: research
      ? [
          ...builds,
          {
            key: "research",
            kind: "research" as const,
            label: `${humanize(research.tech)} ${research.from_level + 1}`,
            endsAt: at(research.completes_at),
          },
        ]
      : builds,
    recent: state.events
      .map((event) => ({ at: clock(event.at), text: event.text }))
      .toSorted((a, b) => b.at - a.at)
      .slice(0, 10),
    buildings: Object.entries(state.buildings).map(([key, level]) => ({
      key,
      label: humanize(key),
      level,
    })),
  };
};

/** Compact duration like the TUI: `45s`, `3m 00s`, `2h 05m`, `3d 04h`. */
export const duration = (ms: number) => {
  const secs = Math.max(0, Math.round(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  if (secs < 60) {
    return `${secs}s`;
  }
  if (secs < 3600) {
    return `${Math.floor(secs / 60)}m ${pad(secs % 60)}s`;
  }
  if (secs < 86_400) {
    return `${Math.floor(secs / 3600)}h ${pad(Math.floor(secs / 60) % 60)}m`;
  }
  return `${Math.floor(secs / 86_400)}d ${pad(Math.floor(secs / 3600) % 24)}h`;
};

/** `324`, `12.5k`, `3.2M` for tight cells. */
export const compact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (abs >= 1e4) {
    return `${(value / 1e3).toFixed(1)}k`;
  }
  return abs < 10 && value % 1 !== 0 ? value.toFixed(1) : String(Math.round(value));
};
