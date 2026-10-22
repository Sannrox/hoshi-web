import {
  onlineManager,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { request } from "../api/http";
import { loadState, saveState } from "../lastState";
import { useSession } from "../session";
import { Button, Callout, Dialog, Navbar, Section } from "../ui";
import { type CheckIn as Model, compact, duration, readCheckIn } from "./checkInView";

/** Re-render every `everyMs` so countdowns tick between fetches. */
const useNow = (everyMs = 1000) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
};

const clockTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hourCycle: "h23" });

type Building = Model["buildings"][number];

/** Bottom sheet for one building. It is the confirm step: the build is sent only from here, once. */
const BuildSheet = ({
  building,
  queued,
  offline,
  onClose,
  onQueued,
}: {
  building: Building;
  queued: number;
  /** Offline the sheet stays open, so a build's answer stays visible, but cannot send. */
  offline: boolean;
  onClose: () => void;
  onQueued: (queued: Building) => void;
}) => {
  const token = useSession((s) => s.token);
  const client = useQueryClient();
  // The building travels with the mutation, so a late answer names what was actually sent.
  // While it is in flight the sheet cannot close and the list is locked (see `useIsMutating`).
  const build = useMutation({
    mutationKey: ["build"],
    mutationFn: (sent: Building) =>
      request("v1/build", { token, body: { planet: "home", building: sent.key } }),
    onSuccess: (_, sent) => {
      onQueued(sent);
      void client.invalidateQueries({ queryKey: ["state"] });
    },
  });
  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t-2 border-line">
      <Dialog
        title={building.label}
        subtitle="home"
        buttons={
          <>
            <Button className="min-h-11" disabled={build.isPending} onClick={onClose}>
              Close
            </Button>
            <Button
              primary
              className="min-h-11"
              disabled={offline || build.isPending || build.isSuccess}
              onClick={() => build.mutate(building)}
            >
              Queue
            </Button>
          </>
        }
      >
        <p>lv {building.level}</p>
        <p>
          <Section>Queue</Section> {queued ? `${queued} ahead` : "empty"}
        </p>
        {build.error && <Callout intent="danger">{build.error.message}</Callout>}
        {offline && (
          <Callout intent="warning">Offline. Queue resumes when hoshi answers again.</Callout>
        )}
      </Dialog>
    </div>
  );
};

const row = "flex min-h-11 items-center gap-2 border-b border-faint px-2";

/** "due 21:14" when offline, where a ticking countdown would only be a guess. */
const remaining = (at: number, now: number, offline: boolean) =>
  offline ? `due ${clockTime(at)}` : duration(at - now);

/**
 * The check-in screen for one view. Offline it shows the saved view greyed,
 * with clock times instead of countdowns and every action off.
 */
const CheckInBody = ({
  view,
  updatedAt,
  offline,
  now,
  refreshError,
}: {
  view: Model;
  updatedAt: number;
  offline: boolean;
  now: number;
  refreshError?: Error | null;
}) => {
  const [open, setOpen] = useState<Building>();
  const [toast, setToast] = useState<string>();
  const sending = useIsMutating({ mutationKey: ["build"] }) > 0;
  const queuedBuilds = view.queue.filter((slot) => slot.kind !== "research").length;
  const age = duration(now - updatedAt);

  return (
    <div className="mx-auto flex max-w-md flex-col pb-40">
      <div className="flex min-h-11 items-center gap-2 px-2">
        <span className="font-bold">home</span>
        <span className="text-muted">{view.planet}</span>
        {offline ? (
          <span className="ml-auto text-warning">offline · {age} old</span>
        ) : (
          <span className="ml-auto text-muted">{age} ago</span>
        )}
      </div>
      <div className={offline ? "grayscale-[.8]" : ""}>
        <div className="grid grid-cols-3 bg-raised">
          {view.resources.map((resource) => (
            <div
              key={resource.label}
              className="border-r border-b border-line px-2 py-1 [&:nth-child(3n)]:border-r-0"
            >
              <span className="text-label">{resource.label}</span>{" "}
              <span className="font-bold">{compact(resource.amount)}</span>
              <br />
              <span className={resource.rate < 0 ? "text-danger" : "text-success"}>
                {resource.rate < 0 ? "−" : "+"}
                {compact(Math.abs(resource.rate))}/h
              </span>
            </div>
          ))}
        </div>
        {view.raidAt !== undefined && (
          <div className="flex min-h-11 items-center gap-2 bg-[#43282c] px-2 text-danger">
            <span>▌ Raid</span>
            <span className="font-bold">{remaining(view.raidAt, now, offline)}</span>
            {!offline && (
              <span className="ml-auto text-[#fa999c]">lands {clockTime(view.raidAt)}</span>
            )}
          </div>
        )}
        <div className="px-2 pt-2">
          <Section>Queue</Section>
        </div>
        {view.queue.length === 0 ? (
          <p className="px-2 text-muted">Nothing queued.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1 px-2">
            {view.queue.map((slot) => (
              <div key={slot.key} className="min-h-11 bg-raised p-1">
                <span className="text-primary">
                  {slot.kind === "research" ? "⚗ " : slot.endsAt ? "▶ " : ""}
                </span>
                {slot.label}
                <br />
                <span className="text-muted">
                  {slot.endsAt ? remaining(slot.endsAt, now, offline) : "next"}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="px-2 pt-2">
          <Section>Recent</Section>
        </div>
        {view.recent.length === 0 && <p className="px-2 text-muted">Nothing yet.</p>}
        {view.recent.map((event) => (
          <div key={`${event.at}-${event.text}`} className={row}>
            <span className="text-success">✓</span>
            <span>{event.text}</span>
            <span className="ml-auto shrink-0 text-muted">{duration(now - event.at)}</span>
          </div>
        ))}
      </div>
      <div className="px-2 pt-2">
        <Section>Build</Section>
      </div>
      {view.buildings.map((building) => (
        <button
          key={building.key}
          type="button"
          disabled={sending || offline}
          className={`${row} w-full text-left disabled:opacity-50`}
          onClick={() => setOpen(building)}
        >
          <span>{building.label}</span>
          <span className="text-muted">lv {building.level}</span>
          <span className="ml-auto text-muted">›</span>
        </button>
      ))}
      {open && (
        <BuildSheet
          key={open.key}
          building={open}
          queued={queuedBuilds}
          offline={offline}
          onClose={() => setOpen(undefined)}
          onQueued={(queued) => {
            setOpen((current) => (current?.key === queued.key ? undefined : current));
            setToast(`Queued ${queued.label}`);
            setTimeout(() => setToast(undefined), 3000);
          }}
        />
      )}
      {offline && !open && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-[#3b3024] px-2 py-3">
          <Callout intent="warning">
            {refreshError ? `Could not refresh: ${refreshError.message}.` : "Offline."} Actions
            resume when hoshi answers again.
          </Callout>
        </div>
      )}
      {toast && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-dimmed px-2 py-3">
          <Callout intent="success">{toast}</Callout>
        </div>
      )}
    </div>
  );
};

const useOnline = () =>
  useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
  );

/** Actions need a state hoshi confirmed within this window (three refreshes). */
const FRESH_MS = 15_000;

/**
 * Live check-in for the signed-in player; every fetched state is saved for offline use.
 * It counts as offline when the device is, or when hoshi has not answered a refresh lately,
 * so actions never run on a state hoshi did not just confirm.
 */
export const CheckIn = () => {
  const token = useSession((s) => s.token);
  const online = useOnline();
  const now = useNow();
  const state = useQuery({
    queryKey: ["state"],
    queryFn: async () => {
      const raw = await request("v1/state", { token });
      const fetchedAt = Date.now();
      const view = readCheckIn(raw, fetchedAt);
      // A sign-out while this was in flight already cleared the saved copy; keep it cleared.
      if (useSession.getState().token === token) {
        saveState(raw, fetchedAt);
      }
      return view;
    },
    refetchInterval: 5000,
  });
  // A first fetch that failed, or that paused because the device went offline, shows the saved copy.
  if (!state.data) {
    return state.error || state.isPaused ? (
      <SavedCheckIn error={state.error} now={now} />
    ) : (
      <p>Loading</p>
    );
  }
  return (
    <CheckInBody
      view={state.data}
      updatedAt={state.dataUpdatedAt}
      offline={!online || state.isError || now - state.dataUpdatedAt > FRESH_MS}
      now={now}
      refreshError={state.error}
    />
  );
};

const loadSavedView = () => {
  const saved = loadState();
  try {
    return saved && { view: readCheckIn(saved.raw, saved.fetchedAt), fetchedAt: saved.fetchedAt };
  } catch {
    return undefined;
  }
};

/** The saved check-in read-only, or the error when this device has none. */
const SavedCheckIn = ({ error, now }: { error: Error | null; now: number }) => {
  const [saved] = useState(loadSavedView);
  return saved ? (
    <CheckInBody
      view={saved.view}
      updatedAt={saved.fetchedAt}
      offline
      now={now}
      refreshError={error}
    />
  ) : (
    <p className="px-2">{error ? `Could not load: ${error.message}` : "Offline."}</p>
  );
};

/** When hoshi cannot be reached before sign-in: the saved check-in under the navbar. */
export const OfflineCheckIn = ({ error }: { error: Error }) => {
  const now = useNow();
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar crumbs={["Check-in"]} />
      <main className="py-2">
        <SavedCheckIn error={error} now={now} />
      </main>
    </div>
  );
};
