# Gameplay Rules

Authoritative source: master spec §9–§31, §42–§45, §114–§116.

## World

- Chunked, deterministic generation from a run seed (§9, §10, §112): `chunkSeed = hash(runSeed, chunkId)`.
  The run seed is logged at startup in dev builds for bug reproduction (§113).
- Bounded active window (1 chunk above, 4 below the pickaxe focus); chunks generate and activate
  at most 1 per frame (§77); chunks outside a 2-chunk margin go RECYCLABLE → DISPOSED with full
  body and texture cleanup (§21, §75). Chunks are fully solid — the base pickaxe mines its own
  path downward; no artificial shafts.
- Each chunk renders as a single pooled RenderTexture with invisible static rectangle bodies
  (§8, §15, §133) — no per-block sprites.
- Block HP per the §12 catalog (`BLOCK_DEFINITIONS` in packages/config); 0–9 crack stages drawn
  as pre-baked overlay textures and applied through a pool (§13, §20); regeneration ≈20% HP per
  5 s after the damage delay via timestamp checks in the per-frame pass — no per-block timers (§14).
- Generation failure falls back to a deterministic mostly-stone chunk (§69) and logs a warning (§99).
- Dev builds only (§137): tap any block to deal 10 damage — verifies HP/cracks/destroy/regen live.

## Entities (all strictly budgeted, master spec §19, §124)

| Entity | Budget default | Notes |
|---|---|---|
| Pickaxes | 1 base + extras ≤10 | ONE base pickaxe (iron, §16): falls forever, camera follows it (§22, smoothing + lookahead), lands on blocks and continuously mines beneath it (§18) at damage × 4 hits/s. Extras: viewer tiers wood→netherite (§16, `PICKAXE_DEFINITIONS`); pooled (§20); velocity ≤700 px/s, angular ≤540°/s, lifetime 45 s (§17/§70); spawn above camera never inside blocks (§23). |
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
