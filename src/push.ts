import { ApiError, request } from "./api/http";

/**
 * Web push opt-in (hoshi docs/server.md, "Web push"). The browser subscribes
 * with hoshi's VAPID key and hoshi keeps the subscription for this save; the
 * service worker (`public/sw.js`) shows each notice, so they arrive with the
 * app closed.
 */
export type PushState =
  /** No service worker or push here: a dev build, or iOS outside the installed app. */
  | { kind: "unsupported" }
  /** hoshi answers 404: the operator has push off. */
  | { kind: "server-off" }
  | { kind: "blocked" }
  | { kind: "off"; key: string }
  /** `unconfirmed`: hoshi did not take the subscription again; it may or may not still deliver. */
  | { kind: "on"; key: string; unconfirmed?: string };

export type PushDeps = {
  token: string | undefined;
  registration: Pick<ServiceWorkerRegistration, "pushManager"> | undefined;
  fetcher: typeof fetch;
};

/** base64url (hoshi's key) to the bytes `applicationServerKey` takes. */
export const base64urlBytes = (text: string) =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

const subscribedWith = (subscription: PushSubscription, key: string) => {
  const current = subscription.options.applicationServerKey;
  const wanted = base64urlBytes(key);
  return (
    current !== null &&
    current.byteLength === wanted.length &&
    new Uint8Array(current).every((byte, i) => byte === wanted[i])
  );
};

const serverKey = async ({ token, fetcher }: PushDeps) => {
  try {
    return (await request<{ key: string }>("v1/push/key", { token, fetcher })).key;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
};

const register = ({ token, fetcher }: PushDeps, subscription: PushSubscription) =>
  request("v1/push/subscription", { token, body: subscription.toJSON(), fetcher });

/**
 * Where push stands for this device, re-registering a current subscription
 * with hoshi on the way. One made with an older hoshi key counts as off.
 */
export const readPush = async (
  deps: PushDeps,
  permission: NotificationPermission,
): Promise<PushState> => {
  if (!deps.registration) {
    return { kind: "unsupported" };
  }
  const key = await serverKey(deps);
  if (key === undefined) {
    return { kind: "server-off" };
  }
  if (permission === "denied") {
    return { kind: "blocked" };
  }
  const subscription = await deps.registration.pushManager.getSubscription();
  if (!subscription || !subscribedWith(subscription, key)) {
    return { kind: "off", key };
  }
  // Posting the same endpoint again only replaces it, so this repairs a
  // registration lost to a crash before it reached hoshi, or on hoshi's side.
  try {
    await register(deps, subscription);
    return { kind: "on", key };
  } catch (error) {
    return { kind: "on", key, unconfirmed: error instanceof Error ? error.message : String(error) };
  }
};

/** Subscribe with hoshi's key and register it; a subscription hoshi refuses is dropped again. */
export const turnOn = async ({ token, registration, fetcher }: PushDeps, key: string) => {
  if (!registration) {
    return;
  }
  const stale = await registration.pushManager.getSubscription();
  if (stale && !subscribedWith(stale, key)) {
    await stale.unsubscribe();
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64urlBytes(key),
  });
  try {
    await register({ token, registration, fetcher }, subscription);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
};

/** Remove the subscription from hoshi first, so a failure leaves both sides on. */
export const turnOff = async ({ token, registration, fetcher }: PushDeps) => {
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    return;
  }
  await request("v1/push/subscription", {
    token,
    method: "DELETE",
    body: { endpoint: subscription.endpoint },
    fetcher,
  });
  await subscription.unsubscribe();
};
