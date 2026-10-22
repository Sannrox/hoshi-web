import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { request } from "../api/http";
import { useSession } from "../session";
import { Button, Callout, Dialog, Section } from "../ui";
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
  onClose,
  onQueued,
}: {
  building: Building;
  queued: number;
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
              disabled={build.isPending || build.isSuccess}
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
      </Dialog>
    </div>
  );
};

const row = "flex min-h-11 items-center gap-2 border-b border-faint px-2";

/** Phone check-in: raid warning, resources, queue, what finished, and one-tap queueing of the next build. */
export const CheckIn = () => {
  const token = useSession((s) => s.token);
  const now = useNow();
  const [open, setOpen] = useState<Building>();
  const [toast, setToast] = useState<string>();
  const sending = useIsMutating({ mutationKey: ["build"] }) > 0;
  const state = useQuery({
    queryKey: ["state"],
    queryFn: async () => readCheckIn(await request("v1/state", { token }), Date.now()),
    refetchInterval: 5000,
  });

  if (!state.data) {
    return state.error ? <Callout intent="danger">{state.error.message}</Callout> : <p>Loading</p>;
  }
  const view = state.data;
  const queuedBuilds = view.queue.filter((slot) => slot.kind !== "research").length;

  return (
    <div className="mx-auto flex max-w-md flex-col pb-40">
      <div className="flex min-h-11 items-center gap-2 px-2">
        <span className="font-bold">home</span>
        <span className="text-muted">{view.planet}</span>
        <span className="ml-auto text-muted">{duration(now - state.dataUpdatedAt)} ago</span>
      </div>
      {state.error && <Callout intent="warning">Could not refresh: {state.error.message}</Callout>}
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
          <span className="font-bold">{duration(view.raidAt - now)}</span>
          <span className="ml-auto text-[#fa999c]">lands {clockTime(view.raidAt)}</span>
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
                {slot.endsAt ? duration(slot.endsAt - now) : "next"}
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
      <div className="px-2 pt-2">
        <Section>Build</Section>
      </div>
      {view.buildings.map((building) => (
        <button
          key={building.key}
          type="button"
          disabled={sending}
          className={`${row} w-full text-left`}
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
          onClose={() => setOpen(undefined)}
          onQueued={(queued) => {
            setOpen((current) => (current?.key === queued.key ? undefined : current));
            setToast(`Queued ${queued.label}`);
            setTimeout(() => setToast(undefined), 3000);
          }}
        />
      )}
      {toast && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-dimmed px-2 py-3">
          <Callout intent="success">{toast}</Callout>
        </div>
      )}
    </div>
  );
};
