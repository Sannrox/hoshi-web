// Generated from Sannrox/hoshi docs/schema/serve-v1.json, docs/schema/cli-v1.json at e767755c68d2f5500097aadac976adeffa901534.
// Do not edit: run `pnpm api:gen`.
/**
 * HTTP /v1 responses use the same JSON as the CLI (schema_version 2). A breaking change bumps that version.
 */
export interface ServeResponse {
/**
 * Same version as docs/schema/cli-v1.json. Bump on a breaking response change.
 */
schema_version: 2
ok: boolean
message?: string
error?: {
code: ("invalid" | "refused" | "internal" | "unauthorized" | "rate_limited")
message: string
[k: string]: unknown
}
[k: string]: unknown
}
export interface CliResponse {
/**
 * CLI JSON schema version. Bump on breaking changes.
 */
schema_version: 2
ok: boolean
message?: string
now?: number
deterministic?: boolean
save_schema?: number
resources?: {
iron: number
silicon: number
rare_earths: number
water_ice: number
helium_3: number
deuterium: number
[k: string]: unknown
}
rates?: {
[k: string]: unknown
}
/**
 * Home energy produced, consumed and the resulting factor, alongside resources.
 */
energy?: {
produced: number
consumed: number
factor: number
[k: string]: unknown
}
/**
 * Home heat load versus radiator sink, alongside resources.
 */
heat?: {
load: number
sink: number
[k: string]: unknown
}
/**
 * Instantaneous heat and pollution load versus sink, plus unrest and the warning flag.
 */
waste?: {
[k: string]: unknown
}
buildings?: {
[k: string]: unknown
}
build_queue?: unknown[]
research?: {
[k: string]: unknown
}
fleet?: {
[k: string]: unknown
}
/**
 * Home planet defence counts and dome/station levels.
 */
defences?: {
[k: string]: unknown
}
missions?: unknown[]
/**
 * Arrived spy reports with source, observed_at, age_secs and confidence. Each outpost also carries its latest arrived report. Pending reports are omitted.
 */
spy_reports?: unknown[]
/**
 * Remote intel facts from `hoshi intel`. Each fact keeps every arrived observation for one object field.
 */
facts?: unknown[]
/**
 * Public outcome snapshot of live state from `hoshi scenario compare` (resources, KPIs, risk, aged intel).
 */
baseline?: {
[k: string]: unknown
}
/**
 * Public outcome snapshot of the sandbox from `hoshi scenario compare`. Hidden simulation is omitted.
 */
scenario?: {
[k: string]: unknown
}
/**
 * Provenance chain from `hoshi intel provenance`. Source, time, age, confidence and the player-visible value; never hidden truth.
 */
observations?: unknown[]
planets?: unknown[]
events?: unknown[]
/**
 * Recorded empire glance for `hoshi log --at`. Null when the time is outside the retained window.
 */
snapshot?: ({
[k: string]: unknown
} | null)
/**
 * Path written by `hoshi log --export` as JSON lines.
 */
exported?: (string | null)
/**
 * Visible raid countdown, matching the TUI overview.
 */
raid?: ({
[k: string]: unknown
} | null)
/**
 * Meta currency, current run and owned bonuses.
 */
prestige?: {
[k: string]: unknown
}
/**
 * Unlocked achievements with unix timestamps. Hidden locked rows are omitted.
 */
achievements?: unknown[]
/**
 * In-game daily goals for the current day: streak, time until reset, and slot progress.
 */
daily?: {
[k: string]: unknown
}
/**
 * Galaxy victory progress: pirate homeworld, the three paths, and the recorded win if any.
 */
victory?: {
[k: string]: unknown
}
/**
 * Industrial goal ladder: current completed tier, next goal progress from sustained rates, and completed ids.
 */
ladder?: {
[k: string]: unknown
}
/**
 * Frontier galaxy unlock: revealed sector count, research/wonder/bridge flags, and visible worlds with bonuses.
 */
frontier?: {
[k: string]: unknown
}
/**
 * Seasonal galaxy overlay when this save is a seasonal run: rule-set id, window, seed and whether prestige is shared.
 */
season?: ({
[k: string]: unknown
} | null)
/**
 * Playable species overlay when this save chose an empire: id, name, brew timer and optional flagship.
 */
species?: ({
[k: string]: unknown
} | null)
/**
 * NPC rival empires for this galaxy: enabled flag and an intel list gated by espionage (id, personality, home, last action, optional stockpile/fleet/buildings).
 */
rivals?: {
[k: string]: unknown
}
/**
 * Treasury cash, debt (negative cash), and the number of held over-budget spends waiting for approval.
 */
finance?: {
[k: string]: unknown
}
/**
 * KPI board: next report time, number of targets, and number of archived period reports.
 */
kpis?: {
[k: string]: unknown
}
/**
 * Classification leak incidents visible to the actor.
 */
incidents?: unknown[]
/**
 * Operational incident board: open count, risk register size, and archived post-incident reviews.
 */
incident_board?: {
[k: string]: unknown
}
/**
 * Asset board: counts of assets, open work orders and retained telemetry readings.
 */
maintenance?: {
[k: string]: unknown
}
/**
 * Onboarding hint progress: whether the tutorial is enabled, skipped, and which hint is pending.
 */
tutorial?: {
[k: string]: unknown
}
/**
 * Orbital moons of owned planets, with phalanx and jump-gate levels.
 */
moons?: unknown[]
/**
 * Home fleet formation, stance, auto-retreat threshold and admiral.
 */
tactics?: {
[k: string]: unknown
}
/**
 * Proposed, enacted and repealed laws with approvals and latest expected vs measured samples.
 */
laws?: unknown[]
/**
 * Leaders with traits, assignment, retirement and delegations.
 */
leaders?: unknown[]
/**
 * Named vehicles for orbital mission planning.
 */
vehicles?: unknown[]
/**
 * In-flight PlanMission rows with transfer, customer, delta-v and arrival.
 */
planned?: unknown[]
/**
 * Synodic launch windows from `mission windows` (`open`, `upcoming`, or `missed`).
 */
windows?: unknown[]
/**
 * Schedule alerts: double-booked vehicles or missed launch windows.
 */
alerts?: unknown[]
/**
 * Transfer delta-v in metres per second, including gravity wells.
 */
delta_v?: number
/**
 * Compressed coast time for the planned transfer.
 */
coast_secs?: number
/**
 * Arena scoring formula version. See docs/arena.md.
 */
scoring_version?: number
/**
 * Arena bot results for one run.
 */
bots?: unknown[]
/**
 * Arena leaderboard table for sharing.
 */
markdown?: string
error?: {
code: ("invalid" | "refused" | "locked" | "internal")
message: string
[k: string]: unknown
}
[k: string]: unknown
}
