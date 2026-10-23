import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type PushDeps, type PushState, readPush, turnOff, turnOn } from "../push";
import { useSession } from "../session";
import { Button, Callout, Section } from "../ui";
import { worker } from "../worker";

/** The worker that shows notices, once it is active, where this browser can push. */
const findRegistration = async () =>
  "PushManager" in window && "Notification" in window && (await worker)
    ? navigator.serviceWorker.ready
    : undefined;

const notes: Record<PushState["kind"], string> = {
  unsupported: "Not available here. On iPhone, add hoshi to the home screen first.",
  "server-off": "Off on this hoshi server.",
  blocked: "Blocked in this browser's site settings.",
  off: "Raid warnings and finished builds, even with hoshi closed.",
  on: "On for this device.",
};

/** Opt this device in or out of hoshi's raid and build notifications. */
export const PushSettings = () => {
  const token = useSession((s) => s.token);
  const client = useQueryClient();
  const deps = async (): Promise<PushDeps> => ({
    token,
    registration: await findRegistration(),
    fetcher: fetch,
  });
  const push = useQuery({
    queryKey: ["push"],
    queryFn: async () => {
      const found = await deps();
      // `Notification` exists wherever a registration was found.
      return readPush(found, found.registration ? Notification.permission : "default");
    },
    retry: false,
    // Reading re-registers with hoshi; once per visit is enough.
    staleTime: Number.POSITIVE_INFINITY,
  });
  const change = useMutation({
    mutationFn: async (state: PushState) => {
      if (state.kind === "on") {
        return turnOff(await deps());
      }
      if (state.kind === "off" && (await Notification.requestPermission()) === "granted") {
        return turnOn(await deps(), state.key);
      }
      return undefined;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["push"] }),
  });
  const state = push.data;
  const error = change.error ?? push.error;
  return (
    <div className="flex flex-col gap-1 px-2 pt-2">
      <Section>Notifications</Section>
      <div className="flex min-h-11 items-center gap-2">
        <span className="text-muted">{state ? notes[state.kind] : "Checking"}</span>
        {(state?.kind === "on" || state?.kind === "off") && (
          <Button
            className="ml-auto min-h-11 shrink-0"
            disabled={change.isPending}
            onClick={() => change.mutate(state)}
          >
            {state.kind === "on" ? "Turn off" : "Turn on"}
          </Button>
        )}
      </div>
      {state?.kind === "on" && state.unconfirmed && (
        <Callout intent="warning">hoshi did not confirm it: {state.unconfirmed}</Callout>
      )}
      {error && <Callout intent="danger">{error.message}</Callout>}
    </div>
  );
};
