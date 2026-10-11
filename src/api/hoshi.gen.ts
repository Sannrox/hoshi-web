// Generated from Sannrox/hoshi api/hoshi-http-v1.schema.json at draft (contract hoshi-http-v1-draft).
// Do not edit: run `pnpm api:gen`.

export interface HoshiHttpV1 {
Health?: Health
}
/**
 * This interface was referenced by `HoshiHttpV1`'s JSON-Schema
 * via the `definition` "Health".
 */
export interface Health {
contracts: string[]
version: string
}

export const HOSHI_CONTRACT = "hoshi-http-v1-draft";
