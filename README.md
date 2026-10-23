# hoshi-web

Web client for [hoshi](https://github.com/Sannrox/hoshi), the real-time idle
space-strategy game. It plays through `hoshi serve`'s versioned `/v1` HTTP and
WebSocket API only (see [ADR 0002](docs/decisions/0002-separate-web-client-api-only.md));
the game rules live in hoshi.

Status: early. Sign-in, the phone check-in view, the cockpit and the browser terminal work
against `hoshi serve`; screens are tracked as issues in this repository. The client uses the hoshi
TUI's Slate colours and widgets (`src/ui.tsx`).

## Check-in

The home screen is a phone-sized check-in built from `GET /v1/state` and refreshed every five
seconds: resources and hourly rates, the raid countdown with its landing time, the build and
research queue, recent events, and the building list. Tapping a building opens a sheet that is
the confirm step; **Queue** sends `POST /v1/build` once and shows hoshi's refusal text if it is
refused.

## Cockpit

**Cockpit** is the wide-screen dashboard after hoshi's TUI cockpit: resources, energy, heat and
the raid countdown in one strip; an alerts bar (threats first, then idle queues) whose entries
jump to their panel; buildings and research with one action per row; the build and research
queue with cancel; docked ships, a send form and missions in flight; known worlds; and a
timeline of hoshi's events. It follows `GET /v1/events` (resuming from the last event after a
drop) and refreshes the state on every event and every five seconds. Each action is sent once
and shows hoshi's refusal text; actions are off while the state is not freshly confirmed.

## Terminal

**Terminal** in the top bar runs hoshi's own TUI in the browser, drawn by `hoshi serve` over
`GET /v1/terminal`; it is the game, not a shell. While it is attached hoshi keeps one writer
per save, so game actions from other screens (and a second terminal) are refused. Quitting the
TUI or leaving the screen frees the save at once. A dropped connection reattaches on its own
for 30 seconds, once hoshi's short hold on the dropped session ends; keys typed meanwhile are
not sent. The terminal code loads only when the screen opens.

## Offline and install

The client is an installable web app (`public/manifest.webmanifest`). Its service worker
(`public/sw.js`) caches only the app's own files under `ui/`; hoshi's API sits outside its scope
and is never cached. The last check-in state is kept in browser storage (never the token) and
cleared on sign-out. When hoshi cannot be reached, the client opens on that state, greyed and
marked with its age, shows due times instead of countdowns, and turns every action off.

## Notifications

**Notifications** at the bottom of the check-in opts this device in to hoshi's web push: raid
warnings and finished builds, delivered by the service worker even with hoshi closed. Turning
on asks the browser for permission, subscribes with the key from `GET /v1/push/key` and
registers the subscription with `POST /v1/push/subscription`; turning off removes it from hoshi
(`DELETE`) before unsubscribing. Tapping a raid warning opens the cockpit, a finished build the
check-in. Push needs the release build (the dev server has no service worker), hoshi with push
on, and on iPhone the app added to the home screen. Signing out keeps the subscription; turn
it off first on a shared device.

## Sign-in

Paste a bearer token that `hoshi serve` accepts, or use **Identity login** when the
operator turned on hoshi's identity login. That opens hoshi's login in a window; when the
window ends on this client's origin the token is read back automatically, otherwise paste
the token it shows. The token lives in memory only: a reload signs out. hoshi's tokens do
not expire, so a 401 ends the session instead of refreshing it.

## How it ships

Each tag `vX.Y.Z` publishes `hoshi-web-vX.Y.Z.zip`, `SHA256SUMS`, and a GitHub artifact
attestation (`.github/workflows/release.yml`). hoshi is to pin one release and serve it at
`/ui/` on the API's origin; that server side is tracked in
[Sannrox/hoshi#260](https://github.com/Sannrox/hoshi/issues/260).

The zip holds the built client at its root: `index.html`, `assets/`, `sw.js`,
`manifest.webmanifest` and icons. Serve them at `<base>/ui/` with the API at `<base>/v1` and
`<base>/healthz`; the client finds the API two levels above its own entry module, so the same
zip works at `/ui/` and at `/<prefix>/ui/` behind a reverse proxy. It loads nothing from other
origins. A server serving it should:

- fall back to `index.html` for unknown paths under `ui/` that are not files;
- send `sw.js` as JavaScript and `manifest.webmanifest` as `application/manifest+json`;
- allow a strict policy: `Content-Security-Policy: default-src 'self'` (no inline scripts,
  no `eval`).

### Verify and pin a release

```sh
tag=vX.Y.Z
gh release download "$tag" -R Sannrox/hoshi-web
sha256sum -c SHA256SUMS
gh attestation verify "hoshi-web-$tag.zip" -R Sannrox/hoshi-web
```

The pin is one line, `<tag> <sha256-of-zip>`, taken from `SHA256SUMS`. The download URL
follows from the tag:
`https://github.com/Sannrox/hoshi-web/releases/download/<tag>/hoshi-web-<tag>.zip`. Bumping the
client is a one-line pin change; a mismatched checksum must refuse the bundle.

The zip is built to be reproducible: `scripts/package.sh` sorts entries and fixes timestamps,
so rebuilding a tag with `pnpm build && VERSION=<tag> pnpm package` on the same Node and
lockfile should give the same checksum.

### Compatibility

A release requires a hoshi whose `/healthz` lists `v1` in `contract_versions`; older servers
get a "too old" notice. `api/HOSHI_REF` names the hoshi commit whose `/v1` schemas the release
was built against.

## API types

`api/serve-v1.json` and `api/cli-v1.json` are hoshi's `/v1` response schemas
(`docs/schema/` in hoshi), vendored at the commit in `api/HOSHI_REF`.
`src/api/hoshi.gen.ts` is generated from them. `/healthz` must list `v1` in
`contract_versions`.

```sh
pnpm api:sync <hoshi-commit-sha>   # update the vendored schema and regenerate
pnpm api:check                     # CI: fail when generated types are stale
```

## Develop

```sh
pnpm install
HOSHI_URL=http://127.0.0.1:8080 pnpm dev   # proxies /v1 and /healthz to hoshi serve
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
VERSION=v0.0.0-dev pnpm package            # release/ zip + SHA256SUMS
```

Stack: TypeScript (strict), React, Vite, TanStack Query and Router, Tailwind,
Oxlint (type-aware) and Oxfmt, Vitest, pnpm. License: Apache-2.0.
