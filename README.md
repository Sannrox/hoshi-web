# hoshi-web

Web client for [hoshi](https://github.com/Sannrox/hoshi), the real-time idle
space-strategy game. It plays through `hoshi serve`'s versioned `/v1` HTTP and
WebSocket API only (see [ADR 0002](docs/decisions/0002-separate-web-client-api-only.md));
the game rules live in hoshi.

Status: skeleton. The server it needs is tracked in
[Sannrox/hoshi#68](https://github.com/Sannrox/hoshi/issues/68); screens are tracked as
issues in this repository.

## How it ships

Each tag `vX.Y.Z` publishes `hoshi-web-vX.Y.Z.zip`, `SHA256SUMS`, and a GitHub artifact
attestation. `hoshi serve` can pin one release by URL and SHA-256 and serve it at `/ui/`.
The build uses only relative URLs and loads no assets from other origins.

## API types

`api/hoshi-http-v1.schema.json` is hoshi's HTTP contract, vendored at the commit in
`api/HOSHI_REF`. Until hoshi publishes one, it holds a draft with only `/healthz`.
`src/api/hoshi.gen.ts` is generated from it.

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
