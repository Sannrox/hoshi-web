import { describe, expect, it } from "vitest";
import { base64urlBytes, type PushDeps, readPush, turnOff, turnOn } from "./push";

const KEY = "BAEC_w"; // bytes 04 01 02 ff
const OLD_KEY = "BAEC";

/** A browser push manager holding at most one subscription. */
const browser = (subscribedKey?: string) => {
  const state = {
    subscription: undefined as PushSubscription | undefined,
    unsubscribed: 0,
  };
  const make = (key: string) => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      options: { applicationServerKey: base64urlBytes(key).buffer, userVisibleOnly: true },
      toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { auth: "a" } }),
      unsubscribe: async () => {
        state.unsubscribed += 1;
        state.subscription = undefined;
        return true;
      },
    } as unknown as PushSubscription;
    state.subscription = subscription;
    return subscription;
  };
  if (subscribedKey) {
    make(subscribedKey);
  }
  const pushManager = {
    getSubscription: async () => state.subscription ?? null,
    subscribe: async (options: PushSubscriptionOptionsInit) => {
      const bytes = new Uint8Array(options.applicationServerKey as Uint8Array);
      return make(
        btoa(String.fromCharCode(...bytes))
          .replaceAll("/", "_")
          .replace(/=+$/, ""),
      );
    },
  } as unknown as PushManager;
  return { state, registration: { pushManager } };
};

/** hoshi's push routes; `refuse` answers that route with 409. */
const hoshi = (opts: { off?: boolean; refuse?: string } = {}) => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push(`${init?.method} ${path} ${body}`.trim());
    if (opts.off) {
      return Response.json(
        { ok: false, error: { code: "invalid", message: "off" } },
        { status: 404 },
      );
    }
    if (opts.refuse === path) {
      return Response.json(
        { ok: false, error: { code: "refused", message: "full" } },
        { status: 409 },
      );
    }
    return Response.json(path.endsWith("key") ? { ok: true, key: KEY } : { ok: true });
  };
  return { calls, fetcher };
};

const deps = (registration: PushDeps["registration"], fetcher: typeof fetch): PushDeps => ({
  token: "tok",
  registration,
  fetcher,
});

describe("readPush", () => {
  it("is off when hoshi has push off", async () => {
    const { registration } = browser();
    const state = await readPush(deps(registration, hoshi({ off: true }).fetcher), "default");
    expect(state).toStrictEqual({ kind: "server-off" });
  });

  it("counts a subscription made with an older key as off", async () => {
    const { registration } = browser(OLD_KEY);
    const state = await readPush(deps(registration, hoshi().fetcher), "granted");
    expect(state).toStrictEqual({ kind: "off", key: KEY });
  });

  it("is on once hoshi holds the subscription, registering it again", async () => {
    const { registration } = browser(KEY);
    const server = hoshi();
    const state = await readPush(deps(registration, server.fetcher), "granted");
    expect(state).toStrictEqual({ kind: "on", key: KEY });
    expect(server.calls.at(-1)).toMatch(/^POST \/v1\/push\/subscription /);
  });

  it("stays on, and says so, when hoshi will not take the subscription again", async () => {
    const { registration } = browser(KEY);
    const server = hoshi({ refuse: "/v1/push/subscription" });
    const state = await readPush(deps(registration, server.fetcher), "granted");
    expect(state).toStrictEqual({ kind: "on", key: KEY, unconfirmed: "full" });
  });
});

describe("turnOn", () => {
  it("replaces an old-key subscription and registers the new one with hoshi", async () => {
    const { state, registration } = browser(OLD_KEY);
    const server = hoshi();
    await turnOn(deps(registration, server.fetcher), KEY);
    expect(state.unsubscribed).toBe(1);
    expect(state.subscription).toBeDefined();
    expect(server.calls).toStrictEqual([
      'POST /v1/push/subscription {"endpoint":"https://fcm.googleapis.com/fcm/send/abc","keys":{"auth":"a"}}',
    ]);
  });

  it("drops the browser subscription when hoshi refuses it", async () => {
    const { state, registration } = browser();
    const server = hoshi({ refuse: "/v1/push/subscription" });
    await expect(turnOn(deps(registration, server.fetcher), KEY)).rejects.toThrow("full");
    expect(state.subscription).toBeUndefined();
  });
});

describe("turnOff", () => {
  it("keeps the subscription when hoshi could not remove it", async () => {
    const { state, registration } = browser(KEY);
    const server = hoshi({ refuse: "/v1/push/subscription" });
    await expect(turnOff(deps(registration, server.fetcher))).rejects.toThrow();
    expect(state.subscription).toBeDefined();
    expect(server.calls[0]).toMatch(/^DELETE \/v1\/push\/subscription .*fcm/);
  });
});
