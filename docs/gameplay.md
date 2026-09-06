# Gameplay Rules

Authoritative source: master spec §9–§31, §42–§45, §114–§116.

## World

- Chunked, deterministic generation from a run seed (§9, §10, §112): `chunkSeed = hash(runSeed, chunkId)`.
  The run seed is logged at startup in dev builds for bug reproduction (§113).
- Bounded active window (1 chunk above, 4 below the pickaxe focus); chunks generate and activate
  at most 1 per frame (§77); chunks outside a 2-chunk margin go RECYCLABLE → DISPOSED with full
  body and texture cleanup (§21, §75). Chunks are fully solid — the base pickaxe mines its own
  path downward; no artificial shafts.
- Phase 5 hardening (§21/§77 loophole guards): the window scan always refills the lowest missing
  chunk first, so a fast focus jump (fastfall, tab-switch delta spike) recovers instead of
  starving generation permanently; a chunk leaving the window receives a final regen settle
  before disposal, so recycled textures never freeze a mid-crack state.
- Camera follow routes through `CameraController` (§22) as a DOWNWARD RATCHET (user spec):
  the camera holds still while the pickaxe is above the screen middle, engages once it digs
  past middle + dead zone (`cameraDeadZonePx`, 6), then eases (`cameraFollowLerpPerSec`, 5)
  to keep the pickaxe at the middle — and never scrolls up. Upward motion (strike hops,
  rebounds, respawns above the view) is structurally dead: zero vertical jitter. The
  lookahead feeds chunk streaming ahead of the descent (§21), not the camera. Shake stays
  budgeted and non-stacking for later event phases. World keeps only ~6–8 chunk
  RenderTextures alive (visible as `rt` in the debug overlay) — memory stays bounded while
  depth is unbounded.
- Each chunk renders as a single pooled RenderTexture with invisible static rectangle bodies
  (§8, §15, §133) — no per-block sprites.
- Block HP per the §12 catalog (`BLOCK_DEFINITIONS` in packages/config); 0–9 crack stages drawn
  as pre-baked overlay textures and applied through a pool (§13, §20); regeneration ≈20% HP per
  5 s after the damage delay via timestamp checks in the per-frame pass — no per-block timers (§14).
- Generation failure falls back to a deterministic mostly-stone chunk (§69) and logs a warning (§99).
- Dev builds only (§137): tap any block to deal 10 damage — verifies HP/cracks/destroy/regen live.

## Rewards + HUD (§24)

- Destroyed-block stats flow world → `StatsTracker` → registry snapshot → HUD, throttled to the
  shared 250 ms UI refresh (§77). The tracker refuses unknown block ids — counters are bounded by
  the §11 catalog (§19 hygiene); snapshots are copies the HUD cannot mutate.
- The destroyed block's TYPE is captured before the cell is nulled (§24 loophole guard), so
  rewards always attribute to the right ore.
- HUD rows are created ONCE and `setText` fires only on value change (no GPU churn); rows are
  data-driven from `BLOCK_DEFINITIONS` (§104) — any block with a `reward` definition gets a row.
  Shows DEPTH (true pickaxe position, not the streaming lookahead), BLOCKS destroyed, and one
  row per reward ore. Phaser text only — never DOM (§78).

## Entities (all strictly budgeted, master spec §19, §124)

| Entity | Budget default | Notes |
|---|---|---|
| Pickaxes | 1 base + extras ≤10 | ONE base pickaxe (iron, §16): falls forever, camera follows it (§22 downward ratchet, hold-until-middle), lands on blocks and continuously mines beneath it (§18) at damage × 4 hits/s. Omnidirectional mining (§18): every pressed face — floor, both walls, ceiling — mines the block behind it, each face with its own fractional accumulator. Newton's 3rd law rebound (§17): impact speed × `pickaxeReboundFactor` (0.5) pushes it off the surface, gated by `pickaxeReboundMinImpactPxPerSec` (40) so resting contact never kicks; wall grinding pulses away from the wall on the strike cadence. Extras: viewer tiers wood→netherite (§16, `PICKAXE_DEFINITIONS`); pooled (§20); velocity ≤700 px/s, angular ≤540°/s, lifetime 45 s (§17/§70); spawn above camera never inside blocks (§23). |
| TNT | 6 active | Placement semantics (user spec): TNT does NOT fall — it is created AT the base pickaxe's position (open air by construction, §23) and explodes right there. Lifecycle CREATED→ARMED→FALLING→TRIGGERED→EXPLODING→DONE enforced by a strict state machine (§25); explodes EXACTLY once. Minecraft-style fuse: the sprite BLINKS white, accelerating as the fuse (`fuseMs` per kind) burns down, then detonates. Kinds are DATA (`TNT_DEFINITIONS` in packages/config, §104): tnt 30 dmg/80px, mega 60/120, nuke 110/176 with escalating shake/particles. Pending placements defer while no base exists and drop after `tntSpawnMaxDelayMs` (5 s) — never accumulate. |
| NUKE | 8 TNT / 200 particles | Giant pickaxe + bounded TNT burst + explosion (§30). |
| Particles | 300 active | Pooled, lifetime-bounded (§74). |

TNT → TNT chain reactions are disabled for MVP (§28) — explosions damage BLOCKS only; the manager never iterates other TNT entities (structurally guaranteed, not a flag). Pickaxe–pickaxe collisions are off (§18). Explosions use the pure `explosionCells` selector (§27): circle radius semantics, linear falloff (center full → rim ≥1), spatial filter — only the bounding box inside the world column is inspected, never the whole world. NUKE (§30): one burst at a time — (maxNukeTnt−1) staggered tnt/mega alternates + the nuke entity last; particle shares sum exactly ≤ maxNukeParticles regardless of timing. Attribution labels (§26): pooled ≤10, sanitized name (control/HTML chars stripped, ≤20 chars), hold 3 s → fade 0.5 s → recycle; Phaser text only, never DOM (§78). Dev keys: T = TNT, M = MEGA, N = NUKE (§137).

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
