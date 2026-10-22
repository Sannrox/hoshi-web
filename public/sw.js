// App-shell service worker: lets the installed client open offline.
// It only serves files inside its own scope (`<base>/ui/`). hoshi's API lives
// outside that scope, so game data and tokens never enter this cache.
// One cache per scope: other hoshi installs on this origin (other prefixes) keep theirs.
const CACHE = `hoshi-web-shell:${self.registration.scope}`;
// Every navigation in scope loads the same single-page app, so it has one cache key.
const SHELL = "./";

/** Asset paths (`assets/...`) the page names. */
const assetsIn = (html) => [...html.matchAll(/assets\/[^"']+/g)].map((match) => match[0]);

/**
 * Store a page only once every asset it names is cached, then drop assets no
 * page needs any more. Returns false when an asset cannot be downloaded: the
 * page is then unusable and the last complete page stays. When storage refuses
 * a write (full), the cache is left as it was and the working page is still served.
 */
const storePage = async (cache, response) => {
  const html = await response.clone().text();
  try {
    for (const asset of assetsIn(html)) {
      if (await cache.match(asset)) {
        continue;
      }
      const download = await fetch(asset).catch(() => undefined);
      if (!download?.ok) {
        return false;
      }
      await cache.put(asset, download);
    }
    await cache.put(SHELL, response);
  } catch {
    return true;
  }
  await prune(cache, html);
  return true;
};

// Page updates run one at a time, so two deploy versions never prune each other's assets.
let pageUpdates = Promise.resolve(true);
const updatePage = (cache, response) => {
  pageUpdates = pageUpdates.then(() => storePage(cache, response)).catch(() => true);
  return pageUpdates;
};

// Cache the page and its assets on install, so one visit is enough to open offline.
const precache = async () => {
  const response = await fetch(SHELL);
  if (response.ok) {
    await updatePage(await caches.open(CACHE), response);
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const inScope = (url) => url.startsWith(self.registration.scope);

// Hashed assets never change: serve from cache, fetch once.
const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) {
    return hit;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone()).catch(() => undefined);
  }
  return response;
};

// The page and other top-level files: network first, cached copy when the network
// or the server in front of hoshi fails (for example a proxy's 502 page).
const networkFirst = async (request) => {
  const cache = await caches.open(CACHE);
  let response;
  try {
    response = await fetch(request);
  } catch {
    response = Response.error();
  }
  if (response.ok) {
    if (request.mode === "navigate") {
      if (!(await updatePage(cache, response.clone()))) {
        return (await cache.match(SHELL)) ?? response;
      }
    } else {
      // Caching is best effort (storage can be full); the network answer still wins.
      await cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  }
  const hit = await cache.match(request.mode === "navigate" ? SHELL : request);
  return hit ?? response;
};

const prune = async (cache, html) => {
  for (const request of await cache.keys()) {
    const path = request.url.slice(self.registration.scope.length);
    if (inScope(request.url) && path.startsWith("assets/") && !html.includes(path)) {
      await cache.delete(request);
    }
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !inScope(request.url)) {
    return;
  }
  const path = request.url.slice(self.registration.scope.length);
  event.respondWith(path.startsWith("assets/") ? cacheFirst(request) : networkFirst(request));
});
