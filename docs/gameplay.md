# Gameplay Rules

Authoritative source: master spec §9–§31, §42–§45, §114–§116.

## World

- Chunked, deterministic generation from a run seed (§9, §10, §112): `chunkSeed = hash(runSeed, chunkId)`.
- Bounded active chunk window; old chunks recycle and dispose bodies (§21, §75).
- Block HP with 0–9 crack stages from preloaded textures (§12, §13); regeneration ≈20% HP / ~5 s
  after first hit, implemented with lightweight timestamps, not per-block timers (§14).
- Generation failure falls back to a safe mostly-stone chunk (§69).

## Entities (all strictly budgeted, master spec §19, §124)

| Entity | Budget default | Notes |
|---|---|---|
| Pickaxes | 10 active | Tiers wood→netherite, dmg 2→12 (§16); fall, rotate, bounce, damage blocks (§17). |
| TNT | 6 active | Lifecycle CREATED→ARMED→FALLING→TRIGGERED→EXPLODING→DONE (§25); owner-labeled. |
| NUKE | 8 TNT / 200 particles | Giant pickaxe + bounded TNT burst + explosion (§30). |
| Particles | 300 active | Pooled, lifetime-bounded (§74). |

TNT → TNT chain reactions are disabled for MVP (§28). Pickaxe–pickaxe collisions are off (§18).
Explosions use radius + falloff and only inspect nearby blocks (§27, §135).

## Modifiers (§42–§45)

`FAST`/`SLOW` clamp to [×0.5, ×2] and refresh rather than stack; `LUCKY` boosts rare-ore rates
without rewriting generated chunks; `BLESS` boosts damage with duration; `BLOWUP` reuses the TNT
explosion infrastructure.

## Attribution (§26, §63, §119)

Viewer-created entities carry `ownerName` sanitized, ≤20 chars, rendered as Phaser text (never
DOM/HTML). Labels hold ~3 s then fade ~0.5 s.

## Autonomy (§114–§116)

The game plays on when chat is silent: bounded-interval autonomous pickaxes/TNT emit canonical
`GameEvent(source="system")` through the same dispatcher as chat/admin events.
