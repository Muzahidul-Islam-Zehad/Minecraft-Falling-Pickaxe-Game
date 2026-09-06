# Architecture

Authoritative source: `minecraft_endless_fall_ai_agent_master_instruction.md` §1–§5.

## Components

| Component | Tech | Responsibility |
|---|---|---|
| `apps/game` | Phaser + Vite, TypeScript | Rendering, physics, chunks, entities, effects, HUD. Runs on the phone's browser. |
| `apps/server` | Node.js, Express (Socket.IO in Phase 11) | YouTube chat ingestion, command parsing, validation, dedupe, rate limits, priority queue with TTL, admin auth. **Never gameplay physics.** |
| `apps/admin` | React + Vite | Status dashboard, manual controls, emergency controls. Goes through the same event pipeline. |

## Event pipeline (master spec §36)

```
Incoming Event
  → Validate → Deduplicate → Per-user rate limit → Per-command rate limit
  → Global rate limit → Priority queue → TTL check → Event Governor
  → Socket.IO → Phone
```

## Dependency direction (master spec §105)

```
shared-types  ←  protocol / config  ←  server   game
                                       admin ←┘
```

- The game must not depend on server implementation.
- The server must not depend on Phaser.
- `packages/shared-types` defines the canonical `GameEvent` (§34).
- `packages/protocol` defines every Socket.IO message (§53).
- `packages/config` centralizes budgets/cooldowns with startup validation (§81–§82).

## States (master spec §65–§67)

Game, network, and YouTube state are modeled separately (e.g. YouTube = OFFLINE, Game = RUNNING,
Network = CONNECTED is valid) — never one merged boolean soup.

## Error isolation (master spec §68)

A failure in YouTube, sockets, or the admin panel must never stop autonomous gameplay. Malformed
events are dropped; bad physics entities are despawned; chunk generation failures fall back to a
safe stone chunk (§69).
