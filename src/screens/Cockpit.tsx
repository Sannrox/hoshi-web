import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type EventsStatus, type GameEvent, linkEvents } from "../api/events";
import { apiRoot, request } from "../api/http";
import { socketUrl } from "../api/socket";
import { useSession } from "../session";
import { Button, Callout, Panel } from "../ui";
import { compact, duration } from "./checkInView";
import {
  type CockpitView,
  eventLine,
  MISSIONS,
  type PanelId,
  readCockpit,
  shipSpecs,
} from "./cockpitView";
import { FRESH_MS, useNow, useOnline } from "./live";

const row = "flex min-h-8 items-center gap-2 border-b border-faint";

/** The events hoshi retains; the timeline keeps no more. */
const TIMELINE_SIZE = 256;

const eventColours: Record<string, string> = {
  build: "text-primary",
  research: "text-success",
  fleet: "text-warning",
  raid: "text-danger",
};

/** One game action: sent once on click, never retried; hoshi's refusal is kept to show. */
const useAction = (path: string) => {
  const token = useSession((s) => s.token);
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: object) => request(path, { token, body }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["state"] }),
  });
};

const jumpTo = (target: PanelId) => {
  const panel = document.getElementById(target);
  panel?.scrollIntoView({ block: "nearest" });
  panel?.focus();
};

const StatusStrip = ({ view, now }: { view: CockpitView; now: number }) => (
  <div className="grid grid-cols-3 bg-raised sm:grid-cols-9">
    {view.resources.map((resource) => (
      <div key={resource.label} className="border-r border-line px-2 py-1">
        <span className="text-label">{resource.label}</span>{" "}
        <span className="font-bold">{compact(resource.amount)}</span>
        <br />
        <span className={resource.rate < 0 ? "text-danger" : "text-success"}>
          {resource.rate < 0 ? "−" : "+"}
          {compact(Math.abs(resource.rate))}/h
        </span>
      </div>
    ))}
    <div className="border-r border-line px-2 py-1">
      <span className="text-label">Energy</span>{" "}
      <span className="font-bold">{compact(view.energy.produced - view.energy.consumed)}</span>
      <br />
      <span className="text-muted">
        {compact(view.energy.consumed)}/{compact(view.energy.produced)}
      </span>
    </div>
    <div className="border-r border-line px-2 py-1">
      <span className="text-label">Heat</span>
      <br />
      <span className={view.heat.load > view.heat.sink ? "text-danger" : "text-muted"}>
        {compact(view.heat.load)}/{compact(view.heat.sink)}
      </span>
    </div>
    <div className="px-2 py-1">
      <span className="text-label">{view.planet}</span>
      <br />
      {view.raidAt === undefined ? (
        <span className="text-muted">no raid</span>
      ) : (
        <span className="font-bold text-danger">RAID {duration(view.raidAt - now)}</span>
      )}
    </div>
  </div>
);

const AlertsBar = ({ view, now }: { view: CockpitView; now: number }) =>
  view.alerts.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {view.alerts.map((alert) => (
        <button
          key={alert.key}
          type="button"
          className={`min-h-8 bg-raised px-2 ${alert.intent === "danger" ? "text-danger" : "text-warning"}`}
          onClick={() => jumpTo(alert.target)}
        >
          ▌{alert.text}
          {alert.at !== undefined && ` T-${duration(alert.at - now)}`}
        </button>
      ))}
    </div>
  );

/** A level list with one action per row; the pending row says so. */
const LevelPanel = ({
  id,
  title,
  rows,
  path,
  body,
  verb,
  disabled,
}: {
  id: PanelId;
  title: string;
  rows: { key: string; label: string; level: number }[];
  path: string;
  body: (key: string) => object;
  verb: string;
  disabled: boolean;
}) => {
  const action = useAction(path);
  const [sent, setSent] = useState<string>();
  return (
    <Panel id={id} title={title}>
      {action.error && <Callout intent="danger">{action.error.message}</Callout>}
      <div className="max-h-96 overflow-y-auto">
        {rows.map((item) => (
          <div key={item.key} className={row}>
            <span>{item.label}</span>
            <span className="text-muted">lv {item.level}</span>
            <Button
              className="ml-auto"
              disabled={disabled || action.isPending}
              onClick={() => {
                setSent(item.key);
                action.mutate(body(item.key));
              }}
            >
              {action.isPending && sent === item.key ? "…" : verb}
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
};

const QueuesPanel = ({
  view,
  now,
  disabled,
}: {
  view: CockpitView;
  now: number;
  disabled: boolean;
}) => {
  const cancel = useAction("v1/cancel");
  return (
    <Panel id="queues" title="Queues">
      {cancel.error && <Callout intent="danger">{cancel.error.message}</Callout>}
      {view.queue.length === 0 && <p className="text-muted">Nothing queued.</p>}
      {view.queue.map((slot) => (
        <div key={slot.key} className={row}>
          <span className="text-primary">{slot.kind === "research" ? "⚗" : "▶"}</span>
          <span>{slot.label}</span>
          <span className="text-muted">
            {slot.endsAt === undefined ? "next" : duration(slot.endsAt - now)}
          </span>
          <Button
            className="ml-auto"
            disabled={disabled || cancel.isPending}
            onClick={() => cancel.mutate({ item: slot.item })}
          >
            Cancel
          </Button>
        </div>
      ))}
    </Panel>
  );
};

const FleetPanel = ({
  view,
  now,
  disabled,
}: {
  view: CockpitView;
  now: number;
  disabled: boolean;
}) => {
  const send = useAction("v1/fleet/send");
  const [to, setTo] = useState("");
  const [mission, setMission] = useState<(typeof MISSIONS)[number]>("expedition");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const ships = shipSpecs(picked);
  const docked = view.ships.filter((ship) => ship.count > 0);
  return (
    <Panel id="fleet" title="Fleet" subtitle="home">
      {docked.length === 0 && <p className="text-muted">No ships docked.</p>}
      {docked.map((ship) => (
        <label key={ship.key} className={row}>
          <span>{ship.label}</span>
          <span className="text-muted">{ship.count}</span>
          <input
            type="number"
            min={0}
            max={ship.count}
            value={picked[ship.key] ?? 0}
            onChange={(event) =>
              setPicked({ ...picked, [ship.key]: Math.max(0, event.target.valueAsNumber || 0) })
            }
            className="ml-auto w-16 bg-dimmed px-1 text-right"
          />
        </label>
      ))}
      <form
        className="flex flex-wrap items-center gap-2 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate(
            { from: "home", to: to.trim(), mission, ships },
            { onSuccess: () => setPicked({}) },
          );
        }}
      >
        <input
          aria-label="Target"
          list="cockpit-worlds"
          placeholder="1:1:2"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="w-24 bg-dimmed px-1"
        />
        <datalist id="cockpit-worlds">
          {view.worlds.map((world) => (
            <option key={world.coord} value={world.coord} />
          ))}
        </datalist>
        <select
          aria-label="Mission"
          value={mission}
          onChange={(event) => setMission(event.target.value as (typeof MISSIONS)[number])}
          className="bg-dimmed px-1"
        >
          {MISSIONS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <Button
          primary
          type="submit"
          className="ml-auto"
          disabled={disabled || send.isPending || ships.length === 0 || !to.trim()}
        >
          Send
        </Button>
      </form>
      {send.error && <Callout intent="danger">{send.error.message}</Callout>}
      <div className="pt-2 text-label uppercase">In flight</div>
      {view.missions.length === 0 && <p className="text-muted">None.</p>}
      {view.missions.map((flight) => (
        <div key={flight.key} className={row}>
          <span>
            {flight.origin} → {flight.dest}
          </span>
          <span className="text-muted">{flight.phase}</span>
          <span className="ml-auto">{duration(flight.endsAt - now)}</span>
        </div>
      ))}
    </Panel>
  );
};

const WorldsPanel = ({ view }: { view: CockpitView }) => (
  <Panel id="worlds" title="Worlds" subtitle={`${view.worlds.length} known`}>
    {view.worlds.map((world) => (
      <div key={world.coord} className={row}>
        <span className={world.kind === "home" ? "font-bold text-primary" : ""}>{world.coord}</span>
        <span className="text-muted">{world.kind}</span>
        {world.rare && <span className="ml-auto text-warning">{world.rare}</span>}
      </div>
    ))}
  </Panel>
);

const TimelinePanel = ({
  events,
  status,
  offsetMs,
  now,
}: {
  events: GameEvent[];
  status: EventsStatus;
  offsetMs: number;
  now: number;
}) => (
  <Panel
    id="timeline"
    title="Timeline"
    subtitle={status === "live" ? "live" : <span className="text-warning">{status}</span>}
  >
    {events.length === 0 && <p className="text-muted">Nothing yet.</p>}
    <div className="max-h-96 overflow-y-auto">
      {events.map((event) => (
        <div key={event.id} className={row}>
          <span className={eventColours[event.type] ?? "text-muted"}>▌</span>
          <span>{eventLine(event)}</span>
          <span className="ml-auto shrink-0 text-muted">
            {duration(now - (event.at * 1000 + offsetMs))}
          </span>
        </div>
      ))}
    </div>
  </Panel>
);

/** hoshi's events, newest first; each one also refreshes the state. */
const useTimeline = (token: string | undefined) => {
  const client = useQueryClient();
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [status, setStatus] = useState<EventsStatus>("connecting");
  useEffect(() => {
    if (!token) {
      return undefined;
    }
    const link = linkEvents({
      url: socketUrl("v1/events", apiRoot),
      token,
      onStatus: setStatus,
      onEvent: (event) => {
        setEvents((current) => [event, ...current].slice(0, TIMELINE_SIZE));
        // A replay delivers many events at once; one refresh covers them.
        void client.invalidateQueries({ queryKey: ["state"] }, { cancelRefetch: false });
      },
    });
    return link.stop;
  }, [token, client]);
  return { events, status };
};

/**
 * The cockpit: hoshi's whole state on one dense screen for a wide window,
 * after the TUI's cockpit dashboard. It refreshes on every hoshi event and
 * every five seconds; actions need a state hoshi confirmed just now.
 */
export const Cockpit = () => {
  const token = useSession((s) => s.token);
  const online = useOnline();
  const now = useNow();
  const timeline = useTimeline(token);
  const state = useQuery({
    queryKey: ["state", "cockpit"],
    queryFn: async () => readCockpit(await request("v1/state", { token }), Date.now()),
    refetchInterval: 5000,
  });
  if (!state.data) {
    return state.error ? (
      <p className="px-2">Could not load: {state.error.message}</p>
    ) : (
      <p className="px-2">Loading</p>
    );
  }
  const view = state.data;
  const stale = !online || state.isError || now - state.dataUpdatedAt > FRESH_MS;
  return (
    <div className="flex flex-col gap-2 px-2">
      <StatusStrip view={view} now={now} />
      <AlertsBar view={view} now={now} />
      {stale && (
        <Callout intent="warning">
          {state.error ? `Could not refresh: ${state.error.message}.` : "Offline."} Actions resume
          when hoshi answers again.
        </Callout>
      )}
      <div className="grid items-start gap-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <LevelPanel
            id="buildings"
            title="Buildings"
            rows={view.buildings}
            path="v1/build"
            body={(building) => ({ planet: "home", building })}
            verb="Build"
            disabled={stale}
          />
          <LevelPanel
            id="research"
            title="Research"
            rows={view.techs}
            path="v1/research"
            body={(tech) => ({ tech })}
            verb="Research"
            disabled={stale}
          />
        </div>
        <div className="flex flex-col gap-2">
          <QueuesPanel view={view} now={now} disabled={stale} />
          <FleetPanel view={view} now={now} disabled={stale} />
        </div>
        <div className="flex flex-col gap-2">
          <WorldsPanel view={view} />
          <TimelinePanel
            events={timeline.events}
            status={timeline.status}
            offsetMs={view.offsetMs}
            now={now}
          />
        </div>
      </div>
    </div>
  );
};
