# Minecraft Endless Fall

A mobile-first, portrait, 2D endless falling game (Phaser) controlled by YouTube Live Chat commands
via a local PC server, with viewer attribution and strict event budgets. Designed to run on an
Android phone in a browser while the screen is being live-streamed.

## Architecture (non-negotiable, master spec §1)

- **Phone = the game machine.** Phaser rendering, physics, chunks, TNT, effects, HUD — all on the phone.
- **PC = the live-event/control server.** YouTube chat, parsing, validation, dedupe, rate limits, queue, admin — never gameplay physics.
- **The game never sees YouTube.** It only receives normalized `GameEvent`s over the shared protocol.

```
YouTube Live Chat → PC Server (Node) → Socket.IO (LAN) → Phone (Phaser) → Screencast
                          └── Admin Panel (PC browser) ─┘
```

## Monorepo layout

```
apps/game      Phaser game client (phone browser)          apps/game
apps/server    Node.js event/control server                apps/server
apps/admin     React admin dashboard (PC browser)          apps/admin
packages/*     shared-types | protocol | config            packages/
tests/         unit | integration | physics | stress       tests/
docs/          architecture | commands | protocol | gameplay
```

## Getting started

```bash
corepack enable                 # use pnpm via Corepack
pnpm install

pnpm dev:game                   # Phaser app → http://localhost:5173
pnpm dev:server                 # Node server → http://localhost:3000/health
pnpm dev:admin                  # Admin panel → http://localhost:5174

pnpm verify                     # typecheck + lint + tests + build (the phase gate)
```

Copy `.env.example` to `.env` before Phase 11/12. Never commit `.env`.

## Development workflow (master spec §5, §159)

Work strictly in phases. At each phase: implement → run → test → debug → verify → only then
move forward. A phase is not complete because the code compiles. Run `pnpm verify` as the gate
before starting the next phase.

| Phase | Scope | Status |
|---|---|---|
| 1 | Project foundation (this workspace) | ✅ verified |
| 2 | Phaser foundation (scenes, scaling, state machine, FPS/metrics, debug overlay, bounded camera shake) | ✅ verified |
| 3 | Block world (chunks, generation, block HP, cracks, regen, recycling) | ✅ verified |
| 4 | Pickaxe physics (tiers, pooling, budgets, collision damage, omnidirectional mining, Newton rebound) | ✅ verified |
| 5 | Infinite world (streaming hardening, camera dead zone, recycle-settle regen) | ✅ verified |
| 6 | Rewards + HUD | ⬜ |
| 7 | TNT + explosions | ⬜ |
| 8 | Special modifiers (fast/slow/lucky/bless/blowup) | ⬜ |
| 9 | PC server (event pipeline) | ⬜ |
| 10 | Admin panel | ⬜ |
| 11 | Phone ↔ PC networking | ⬜ |
| 12 | YouTube live chat | ⬜ |
| 13–14 | Attribution, anti-spam, governance | ⬜ |
| 15–20 | Optimization, stress, device, long-run, rehearsal, release | ⬜ |

## Hard rules

See `minecraft_endless_fall_ai_agent_master_instruction.md` for the authoritative 160-section spec.
Key invariants: bounded queues/entities/particles, deterministic generation, dedupe + TTL on every
event, no YouTube code in the game, no physics on the server, no secrets in the browser, and the
game stays playable when chat is silent (§114).
