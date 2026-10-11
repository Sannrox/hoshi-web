# ADR 0002: Separate web client that consumes hoshi's /v1 API only

- Status: Accepted
- Date: 2026-10-11
- Source: [Sannrox/hoshi#68](https://github.com/Sannrox/hoshi/issues/68)

## Context

Players want to check in on hoshi from a browser or phone: see the empire, queue builds,
react to raids. hoshi is a terminal game in Rust; putting a web frontend in it would add
a JavaScript toolchain and couple game releases to UI releases. The same split already
works for mizuchi and mizuchi-console.

## Decision

- The web client lives in this separate repository, `Sannrox/hoshi-web`.
- It talks **only** to `hoshi serve`'s versioned `/v1` HTTP and WebSocket API. It never
  re-implements game rules or reads save files.
- hoshi contains no web UI code; it may serve a pinned release of this client at `/ui/`.
- Same stack and release model as mizuchi-console: TypeScript, React, Vite, types
  generated from a vendored contract, reproducible zip with `SHA256SUMS` and attestation.

## Consequences

- Everything the web client can do, the CLI and TUI can do under the same fair-play rules.
- A screen needing new data starts with an API change in hoshi.
- Client and game release independently; `/healthz` contract versions gate
  compatibility.

## Rejected alternatives

- **Web UI inside the hoshi repository:** couples the game to a frontend toolchain.
- **Client-side game simulation:** duplicates rules and breaks fair play.
