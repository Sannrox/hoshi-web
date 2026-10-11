# Repository Guidelines

## Project Structure & Module Organization

`hoshi-web` is the web client for [hoshi](https://github.com/Sannrox/hoshi), the
idle space-strategy game: TypeScript (strict), React, Vite, TanStack Query/Router,
Tailwind, Vitest, Oxlint/Oxfmt, pnpm. It mirrors
[mizuchi-console](https://github.com/Sannrox/mizuchi-console).

- `api/`: hoshi's published `/v1` HTTP contract, vendored at the commit in `api/HOSHI_REF`.
- `src/api/`: HTTP client; `hoshi.gen.ts` is generated, never edit it by hand.
- `src/screens/`: one file per screen; keep logic in testable modules next to them.

Decisions: [docs/decisions/](docs/decisions/README.md). `CLAUDE.md` only points here;
this file is canonical.

## Dependencies and Ownership

- **The API is the boundary.** The client only calls `hoshi serve`'s versioned `/v1`
  HTTP and WebSocket API (Sannrox/hoshi#68). It never embeds game rules. If a screen
  needs data or an action the API lacks, the change lands in Sannrox/hoshi first
  (ADR 0002).
- **Fair play.** The client shows only what the API returns; it never computes hidden
  state or retries game actions silently.
- Record cross-repository predecessors in the Issue's `## GitHub dependencies` section
  as full `<owner>/<repo>#<n>` references.

## Build, Test, and Development Commands

```sh
pnpm install
HOSHI_URL=http://127.0.0.1:8080 pnpm dev
pnpm api:check && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
VERSION=v0.0.0-dev pnpm package
```

## Testing Guidelines

Vitest unit tests for API helpers and view models against recorded responses;
`pnpm api:check` for contract drift; `pnpm build` and `scripts/package.sh` for the
release bundle.

## Agent skills

Shared workflow skills come from [Sannrox/agent-kit](https://github.com/Sannrox/agent-kit),
tracking `main` with no lock. `.agents/skills/*/SKILL.md` are stubs that point there;
repository facts for the skills live in `## Agent skill profile` below. Check the stubs
with `bash scripts/validate-workflow-skills.sh`.

## Parallel delivery lanes

A delivery lane is one Issue, one branch, one isolated checkout, one Pull
Request, and one owner. Several agents may deliver several Issues at the same
time, on one machine or on many, only as separate lanes. One Issue is never
split across lanes, and one lane never carries a second Issue.

### Claims live on GitHub

Machines cannot see each other's worktrees, so a claim is only what GitHub
shows. An Issue is claimed, and therefore active, when any of the following
exists:

1. an open Pull Request, draft or ready, that references the Issue;
2. a branch `<type>/<issue>`, or any branch matching `*/<issue>-*`;
3. the authenticated login assigned to the Issue less than six hours ago.

An assignment older than six hours with neither branch nor Pull Request is an
ownership hint, not a veto: report it and ask the maintainer before claiming.
A claim is stale once its Issue is closed or its Pull Request has merged; its
owner or the maintainer removes it. Any other takeover first preserves the
existing branch, Pull Request, and evidence and requires the maintainer's
confirmation, unless the lead of the same parallel run owns the stalled lane.

A lane claims before it implements, under Publish or Land authority or with an
explicit claim authorization under Implement, using
`bash "${AGENT_KIT_HOME:-$HOME/.agents/agent-kit}"/skills/deliver-ready-issue/scripts/issue-lane.sh claim <issue>`:

- the branch `<type>/<issue>` is created on GitHub from the default branch by
  an atomic ref creation, so when two machines race exactly one claim
  succeeds and the other sees `claimed`;
- the authenticated login is assigned to the Issue, which shows the claim in
  the Issue list and timestamps it in the Issue timeline.

`<type>` is derived deterministically so that every machine computes the same
branch: the Conventional Commit type in the Issue title, with `bug` mapped to
`fix`; otherwise the type label (`bug` → `fix`, `enhancement` → `feat`,
`documentation` → `docs`); otherwise `chore`. Lane branches carry no slug
because the name is the claim; the Pull Request title carries the description.
Human topic branches may keep `<type>/<issue>-<slug>` and are detected as
claims by the same rule.

An Implement-only lane cannot claim and is invisible to other machines. Say so
in the report, or ask for claim authority before starting.

### Isolation on each machine

Local isolation protects lanes that share a machine; it is not a claim.

- Each lane checks out its claim branch in `.worktrees/issue-<issue>` inside
  the repository, ignored by Git. A fresh clone dedicated to the lane, as on a
  cloud agent, is equivalent. The base SHA is recorded in the lane report.
- The primary checkout belongs to the maintainer. Agents never switch its
  branch, reset it, stash it, or run long jobs in it while another lane is
  active.
- A worktree serves exactly one Issue. Finished lanes are removed; a worktree is
  never reused for a different Issue or renamed to hide its origin.
- Shared Git state is mutated in short, serialized slots: `git fetch --prune`,
  worktree creation and removal, local branch deletion, and merging belong to
  the lead of a parallel run or happen one lane at a time on a shared machine.
  A lane commits and publishes its own branch from its own worktree; that is
  not a shared mutation. Nobody holds a slot across implementation, test runs,
  or a remote wait.

### Limits, collisions, and landing

The three-lane limit counts claims visible on GitHub per repository: open
implementation Pull Requests plus claim branches without one. Assigned or
planned work with neither is not a running lane.

Parallel lanes must not collide. Collision surfaces in this repository are the
vendored API schema and generated types, the router, and
`package.json`/`pnpm-lock.yaml`. Lanes that would
both change one of these surfaces run in sequence, not in parallel.

A lane publishes its first Verified commit to the claim branch as a draft Pull
Request that closes the Issue. Public GitHub lane fields may list only: claim
branch, repo-relative worktree (for example `.worktrees/issue-N` — never an
absolute path), base SHA, and published SHA. Keep absolute paths and
machine/host names in the private agent session only. It marks the Pull
Request ready when verification and review are complete. Immediately before
publishing, the lane fetches and confirms that the default branch is an
ancestor of its head; it refreshes onto `main` only for a conflict, a failing
gate, an explicit request, or a sibling landing on a shared surface, not
merely because `main` advanced.

Landing is sequential. After each merge, fetch, recompute the frontier, and let
the remaining lanes recheck `mergeable` against the new `main`. A failed or
timed-out merge response may still have merged; reconcile the remote state
before retrying.

The lead of a parallel run keeps a ledger per lane: Issue, branch, base SHA,
owner, state, Pull Request, evidence, blockers, and cleanup. Keep hostnames
and absolute checkout paths in the session with the maintainer, never on
GitHub. Report verified outcomes, not launched work. The executable lead
procedure is `skills/deliver-ready-issue/references/parallel-delivery.md` in
agent-kit.

## Commits and Pull Requests

Conventional commit subjects (`feat:`, `fix:`, `docs:`, `chore:`). One focused change per
Pull Request; CI must be green; `main` is protected and commits are Verified
(`scripts/gh-verified-push.sh`). Do not commit `dist/`, `release/` or `node_modules/`.

## Agent skill profile

Repository facts the shared agent-kit skills read. Only content not already in
the sections above belongs here.

Feature: a new screen or user-visible client behavior.

### Compatibility and failure obligations

The client requires the hoshi `/v1` contract listed by `/healthz` and shows "too old"
otherwise. Failed or cancelled API calls leave the UI usable; game actions are sent once
and never retried silently. WebSocket reconnects resume from the last event cursor.
Tokens stay in memory.

### Verification matrix

Rows beyond `## Testing Guidelines`:

| Surface                     | Required evidence                                         |
| --------------------------- | --------------------------------------------------------- |
| API client, generated types | `pnpm api:check`; tests against recorded responses        |
| screens and view models     | Vitest model tests; typecheck and lint clean              |
| build and release bundle    | `pnpm build`; `scripts/package.sh` rejects external hosts |
| dependency bumps            | `pnpm-lock.yaml` diff reviewed; release notes read        |

### Release audit

- `package.json` version and lockfile consistency;
- vendored contract ref (`api/HOSHI_REF`) and the minimum hoshi version it needs;
- release zip, `SHA256SUMS` and attestation served by `hoshi serve`;
