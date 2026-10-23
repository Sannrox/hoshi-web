import { consoleRoot } from "./api/http";

/**
 * The app-shell worker (`public/sw.js`): it makes the installed client open
 * offline and shows web push notices. Registered once at startup, not in dev;
 * undefined where the browser has no service worker or registration failed.
 */
export const worker: Promise<ServiceWorkerRegistration | undefined> =
  !import.meta.env.DEV && "serviceWorker" in navigator
    ? navigator.serviceWorker.register(new URL("sw.js", consoleRoot)).catch((error: unknown) => {
        console.warn("hoshi-web: offline support unavailable", error);
        return undefined;
      })
    : Promise.resolve(undefined);
