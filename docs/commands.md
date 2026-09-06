# Commands

Single source of truth: `COMMAND_REGISTRY` in `packages/config/src/index.ts` (master spec §32, §156).
Unknown commands never reach the game (§33). MVP syntax: bare commands only — no parameters.

| Chat Command | Event Type | Result | Priority | Cooldown |
|---|---|---|---|---|
| `!tnt` | `TNT` | Viewer-owned TNT | 2 | 3 s |
| `!mega` | `MEGA_TNT` | Larger TNT, stronger shake | 3 | 10 s |
| `!nuke` | `NUKE` | Large strictly-budgeted event | 4 | 30 s |
| `!wood` | `PICKAXE_WOOD` | Wood pickaxe (dmg 2) | 1 | 1 s |
| `!stone` | `PICKAXE_STONE` | Stone pickaxe (dmg 4) | 1 | 1 s |
| `!iron` | `PICKAXE_IRON` | Iron pickaxe (dmg 6) | 1 | 1 s |
| `!gold` | `PICKAXE_GOLD` | Gold pickaxe (dmg 8) | 1 | 1 s |
| `!diamond` | `PICKAXE_DIAMOND` | Diamond pickaxe (dmg 10) | 1 | 1 s |
| `!netherite` | `PICKAXE_NETHERITE` | Netherite pickaxe (dmg 12) | 1 | 1 s |
| `!fast` | `SPEED_FAST` | Bounded speed-up (max ×2) | 2 | 5 s |
| `!slow` | `SPEED_SLOW` | Bounded slow-down (min ×0.5) | 2 | 5 s |
| `!lucky` | `LUCKY` | Temporary rare-ore boost | 2 | 15 s |
| `!bless` | `BLESS` | Temporary damage boost | 2 | 15 s |
| `!blowup` | `SMALL_EXPLOSION` | Small explosion (shared infra with TNT) | 2 | 5 s |

Rules: every executed event carries the viewer's sanitized username for attribution (§26, §62);
coalescing must never destroy ownership (§118); admin uses the same event types at higher priority
(§49–§50).
