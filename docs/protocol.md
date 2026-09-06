# Network Protocol

Authoritative definitions: `packages/protocol/src/index.ts` (master spec §52–§56).

## Authentication

Clients send `CLIENT_HELLO` with a role + token. Separate tokens for game and admin (`GAME_TOKEN`,
`ADMIN_TOKEN`); YouTube credentials never leave the server. Invalid hellos are rejected.

## Messages

| Message | Direction | Payload | Notes |
|---|---|---|---|
| `client:hello` | client → server | `{ role, token, clientVersion? }` | First message after connect. |
| `server:welcome` | server → client | `{ ok, serverTime, metricsIntervalMs }` | Sent on valid auth. |
| `game:event` | server → game | `GameEvent` | Normalized canonical event. |
| `game:event:ack` | game → server | `{ eventId, state, reason?, at }` | `DELIVERED` ≠ `EXECUTED` (§54). |
| `game:state` | game → server | `{ game, network?, timestamp }` | Phase 11+. |
| `game:metrics` | game → server | `GameMetrics` | Periodic, never per-frame (§122). |
| `server:status` | server → admin | `ServerStatus` | Drives admin dashboard. |
| `event:log` | server → admin | recent event lifecycle entries | WAITING/RUNNING/DONE/EXPIRED/DROPPED (§98). |
| `client:ready` / `client:paused` / `client:resumed` | game → server | — | Lifecycle notifications. |
| `ping` / `pong` | both | — | Liveness. |

## Reliability rules

- **Idempotency (§55):** the phone executes each `eventId` once; duplicates are ignored.
- **Reconnect (§56):** disconnect never crashes the game; on reconnect the phone re-authenticates
  and resumes. Stale events past TTL are rejected by the client too (§108).
- **Payloads stay small (§121):** never send the world, block states, or physics bodies.
