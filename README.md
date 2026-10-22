# hoshi-web

Web client for [hoshi](https://github.com/Sannrox/hoshi), the real-time idle
space-strategy game. It plays through `hoshi serve`'s versioned `/v1` HTTP and
WebSocket API only (see [ADR 0002](docs/decisions/0002-separate-web-client-api-only.md));
the game rules live in hoshi.

Status: early. Sign-in and the phone check-in view work against `hoshi serve`; screens are
tracked as issues in this repository. The client uses the hoshi TUI's Slate colours and widgets
(`src/ui.tsx`).

## Check-in

The home screen is a phone-sized check-in built from `GET /v1/state` and refreshed every five
seconds: resources and hourly rates, the raid countdown with its landing time, the build and
research queue, recent events, and the building list. Tapping a building opens a sheet that is
the confirm step; **Queue** sends `POST /v1/build` once and shows hoshi's refusal text if it is
refused.

## Offline and install

The client is an installable web app (`public/manifest.webmanifest`). Its service worker
(`public/sw.js`) caches only the app's own files under `ui/`; hoshi's API sits outside its scope
and is never cached. The last check-in state is kept in browser storage (never the token) and
cleared on sign-out. When hoshi cannot be reached, the client opens on that state, greyed and
marked with its age, shows due times instead of countdowns, and turns every action off.

## Sign-in

Paste a bearer token that `hoshi serve` accepts, or use **Identity login** when the
operator turned on hoshi's identity login. That opens hoshi's login in a window; when the
window ends on this client's origin the token is read back automatically, otherwise paste
the token it shows. The token lives in memory only: a reload signs out. hoshi's tokens do
not expire, so a 401 ends the session instead of refreshing it.

## How it ships

Each tag `vX.Y.Z` publishes `hoshi-web-vX.Y.Z.zip`, `SHA256SUMS`, and a GitHub artifact
attestation. `hoshi serve` can pin one release by URL and SHA-256 and serve it at `/ui/`.
The build uses only relative URLs and loads no assets from other origins.

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
