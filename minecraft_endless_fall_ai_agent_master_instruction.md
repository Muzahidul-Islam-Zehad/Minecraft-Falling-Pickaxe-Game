# Minecraft Endless Fall — AI Agent Development Master Instruction

## 0. Purpose of This Document

You are the implementation agent for **Minecraft Endless Fall**, a mobile-first, portrait, 2D endless falling game designed to run on an Android phone in a browser while the phone screen is being used for YouTube Live Screencast.

Your job is to build the complete project from an empty repository to a stable, tested, long-running live-stream-ready system.

This document is the authoritative engineering plan.

**Do not skip phases. Do not jump directly to YouTube integration. Do not replace the architecture with a simpler architecture without explicit approval.**

The game must remain autonomous when YouTube chat is silent.

---

# 1. NON-NEGOTIABLE ARCHITECTURE

The system has three separate responsibilities:

```text
                    INTERNET
                       |
                       v
                 YouTube Live Chat
                       |
                       v
                 +-------------+
                 | PC SERVER   |
                 | Node.js     |
                 +-------------+
                   |         |
             Admin Panel   Socket.IO
                   |         |
                   +----+----+
                        |
                    Local LAN
                        |
                        v
                +---------------+
                | PHONE CLIENT  |
                | Phaser Game   |
                +---------------+
                        |
                        v
                 YouTube Screencast
```

### The most important rule

**The phone is the game machine.**

The PC is NOT the gameplay renderer and NOT the gameplay physics engine.

The PC only handles:

- YouTube Live Chat
- command parsing
- event validation
- deduplication
- rate limiting
- event queueing
- event prioritization
- Socket.IO communication
- admin controls
- monitoring

The phone handles:

- Phaser rendering
- physics
- chunks
- blocks
- pickaxes
- TNT entities
- explosions
- particles
- camera
- HUD
- game progression
- visual effects

### Never violate this separation.

The server must never become responsible for gameplay physics.

The server sends generic game events.

The Phaser game must never contain YouTube API code.

---

# 2. CORE DESIGN PRINCIPLE

The game must not know where an event came from.

Use this conceptual pipeline:

```text
YouTube ──┐
Admin ────┼──> Event Bus ──> Phone Game
Test Bot ─┘
```

The game receives:

```text
GameEvent
```

It does NOT receive:

```text
"YouTube message"
"!tnt"
"subscriber event"
"Super Chat API object"
```

The game only understands normalized events.

This makes the game independent of YouTube and allows future Twitch/Kick/etc. integrations without rewriting gameplay.

---

# 3. TECHNOLOGY STACK

Use:

## Client / Game

- TypeScript
- Phaser
- Phaser Arcade Physics initially only if it proves sufficient; otherwise use Matter Physics or a dedicated physics library only when required.
- HTML5 Canvas
- Vite
- WebSocket/Socket.IO client
- Texture atlases
- Object pooling

The preferred implementation is:

```text
apps/game
```

This is a browser application.

## Server

- Node.js
- TypeScript
- Socket.IO
- YouTube Data API / Live Chat API
- Environment variables
- Structured logging

```text
apps/server
```

## Admin Panel

Use a separate client application:

```text
apps/admin
```

It may use React + Vite.

Do not mix admin UI code into the Phaser game.

## Shared Packages

Use:

```text
packages/shared-types
packages/protocol
packages/config
```

These packages are shared by client and server.

---

# 4. FINAL PROJECT STRUCTURE

Build toward this structure:

```text
minecraft-endless-fall/
│
├── apps/
│   │
│   ├── game/
│   │   ├── public/
│   │   │   ├── assets/
│   │   │   │   ├── blocks/
│   │   │   │   ├── pickaxes/
│   │   │   │   ├── items/
│   │   │   │   ├── particles/
│   │   │   │   └── ui/
│   │   │   └── audio/
│   │   │
│   │   └── src/
│   │       ├── game/
│   │       │   ├── scenes/
│   │       │   ├── world/
│   │       │   ├── entities/
│   │       │   ├── systems/
│   │       │   ├── effects/
│   │       │   └── data/
│   │       │
│   │       ├── network/
│   │       ├── ui/
│   │       └── main.ts
│   │
│   ├── server/
│   │   └── src/
│   │       ├── youtube/
│   │       ├── commands/
│   │       ├── events/
│   │       ├── socket/
│   │       ├── admin/
│   │       ├── safety/
│   │       ├── config/
│   │       └── index.ts
│   │
│   └── admin/
│       └── src/
│           ├── dashboard/
│           ├── events/
│           ├── controls/
│           ├── components/
│           └── main.tsx
│
├── packages/
│   ├── shared-types/
│   ├── protocol/
│   └── config/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── physics/
│   └── stress/
│
├── docs/
│   ├── architecture.md
│   ├── commands.md
│   ├── protocol.md
│   └── gameplay.md
│
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

Client, server and admin must remain separate.

---

# 5. DEVELOPMENT RULE: BUILD IN PHASES

Never attempt the entire project at once.

Use this order:

```text
Phase 1  Project Foundation
Phase 2  Phaser Foundation
Phase 3  Block World
Phase 4  Pickaxe Physics
Phase 5  Infinite World
Phase 6  Rewards + HUD
Phase 7  TNT + Explosions
Phase 8  Special Events
Phase 9  PC Server
Phase 10 Admin Panel
Phase 11 Phone ↔ PC Networking
Phase 12 YouTube Live Chat
Phase 13 Viewer Attribution
Phase 14 Anti-Spam + Event Governance
Phase 15 Optimization
Phase 16 Stress Testing
Phase 17 Real Device Testing
Phase 18 Long-Run Testing
Phase 19 Live Rehearsal
Phase 20 Final Release
```

At every phase:

1. Implement.
2. Run.
3. Test.
4. Debug.
5. Verify.
6. Only then move forward.

Do not declare a phase complete because the code compiles.

---

# 6. PHASE 1 — PROJECT FOUNDATION

Create the repository and workspace.

Use a package manager that supports workspaces.

Recommended:

```text
pnpm
```

Create:

```text
apps/game
apps/server
apps/admin
packages/shared-types
packages/protocol
packages/config
tests
docs
```

Set up:

- TypeScript
- ESLint
- formatting
- build scripts
- dev scripts
- test runner
- workspace dependencies

The project must have clean development commands.

Example conceptual commands:

```text
pnpm dev:game
pnpm dev:server
pnpm dev:admin
pnpm build
pnpm test
```

Do not proceed until all three applications can start independently.

---

# 7. PHASE 2 — PHASER FOUNDATION

Create the phone game.

Initial target resolution:

```text
360 × 640
```

Aspect ratio:

```text
9:16
```

The actual phone resolution may differ.

Use Phaser scaling such as:

```text
FIT
CENTER_BOTH
```

The logical game resolution must not depend on a specific phone resolution.

Initial goals:

- Phaser starts
- portrait layout
- black/background scene
- FPS counter during development
- debug overlay
- basic camera
- game loop
- resize handling

Do NOT build YouTube yet.

Do NOT build the server yet.

First prove that Phaser runs smoothly on the target phone.

---

# 8. PERFORMANCE PRINCIPLE

The game will run on a phone.

Therefore:

**Mobile performance is a first-class requirement, not a later optimization.**

Avoid:

- unnecessary DOM elements
- huge textures
- per-frame allocations
- thousands of sprites
- unlimited particles
- unlimited physics bodies
- expensive collision checks
- texture generation every frame
- large JSON parsing every frame
- repeated object creation inside update loops

Prefer:

- object pools
- texture atlases
- bounded arrays
- reuse
- simple collision shapes
- deterministic generation
- active entity limits

---

# 9. PHASE 3 — BLOCK WORLD

Implement the world using chunks.

Concept:

```text
World
 |
 +-- Chunk -2
 +-- Chunk -1
 +-- Chunk  0
 +-- Chunk +1
 +-- Chunk +2
```

Only nearby chunks should remain active.

Do not generate an infinite number of blocks.

## Chunk

A chunk should contain:

- chunk ID
- world coordinates
- generated state
- blocks
- collision bodies
- lifecycle state

Lifecycle:

```text
GENERATING
     ↓
VALIDATING
     ↓
ACTIVE
     ↓
RECYCLABLE
     ↓
DISPOSED
```

---

# 10. DETERMINISTIC GENERATION

Use a run seed.

Concept:

```text
chunkSeed = hash(runSeed, chunkId)
```

The same run seed and chunk ID must generate the same chunk.

Do NOT depend on uncontrolled global random state for world generation.

This makes:

- debugging easier
- reproducibility possible
- bug reports easier
- stress testing deterministic

---

# 11. BLOCK TYPES

Create data-driven block definitions.

At minimum:

```text
bedrock
stone
andesite
diorite
granite
coal
iron
copper
redstone
lapis
gold
diamond
emerald
obsidian
mossy_cobblestone
cobblestone
dirt
grass
```

Do not hard-code every block's behavior in a giant if/else chain.

Use configuration/data.

Example conceptual definition:

```ts
type BlockDefinition = {
  id: BlockType;
  hp: number;
  rarity: number;
  reward?: RewardDefinition;
  textureKey: string;
};
```

---

# 12. BLOCK HEALTH

Use block HP.

Reference values:

```text
bedrock       1,000,000,000
stone         10
andesite      10
diorite       10
granite       10

coal          15
iron          15
copper        15
redstone      15
lapis         15

gold          20
diamond       20
emerald       20

obsidian      100
mossy         12
cobblestone   22
```

These are starting values, not sacred values.

Balance may be adjusted after testing.

---

# 13. BLOCK DAMAGE AND CRACKS

Blocks must visually show damage.

Use crack stages:

```text
0 → 1 → 2 → ... → 9
```

Calculate crack stage from remaining HP.

Never generate crack textures every frame.

Use preloaded textures/atlas frames.

When HP reaches zero:

1. mark destroyed
2. remove collision
3. award reward
4. play destruction effect
5. return resources to pools where applicable

---

# 14. BLOCK REGENERATION

Blocks may regenerate health after being hit.

Reference behavior:

- healing starts after first hit
- healing occurs after a delay
- approximately 20% HP per healing interval
- healing interval approximately 5 seconds

Do not implement regeneration with uncontrolled timers for every block if that creates thousands of timer objects.

Prefer lightweight timestamps/state checks.

---

# 15. PHYSICS ARCHITECTURE

Use static physics bodies for blocks.

Dynamic bodies should be limited to:

- pickaxes
- TNT
- special event entities

Never create physics bodies for every visual effect.

Static block bodies are much cheaper.

---

# 16. PHASE 4 — PICKAXE

Create:

```text
Pickaxe
```

Properties:

```text
tier
damage
body
sprite/texture
ownerName
velocity
angle
lifetime
active
```

Pickaxe tiers:

```text
wood
stone
iron
gold
diamond
netherite
```

Damage reference:

```text
wood       2
stone      4
iron       6
gold       8
diamond   10
netherite 12
```

---

# 17. PICKAXE PHYSICS

Pickaxes should:

- fall downward
- rotate
- bounce
- collide with blocks
- damage blocks
- continue falling

Use reasonable:

- elasticity
- friction
- velocity limits
- angular velocity limits

Do not allow velocities to become infinite.

Do not allow NaN/Infinity values to propagate.

---

# 18. PICKAXE COLLISION

Collision flow:

```text
Pickaxe hits Block
       ↓
Calculate damage
       ↓
Reduce HP
       ↓
Update crack stage
       ↓
Rotate/bounce pickaxe
       ↓
If HP <= 0
       ↓
Destroy block
       ↓
Reward player/viewer if applicable
```

Pickaxe-pickaxe collision should be disabled unless there is a strong gameplay reason to enable it.

---

# 19. ENTITY BUDGET

Never allow unlimited pickaxes.

Initial target:

```text
MAX_ACTIVE_PICKAXES ≈ 10
```

This value must be configurable.

If the event queue requests more pickaxes than the game can safely handle:

- queue them
- coalesce where appropriate
- delay them
- or drop low-priority expired events

Never let the phone become overloaded just because chat becomes busy.

---

# 20. OBJECT POOLING

Pool:

- pickaxes
- TNT
- particles
- explosion effects
- username labels
- temporary UI effects

Instead of:

```text
new object
destroy object
new object
destroy object
```

prefer:

```text
acquire()
use()
reset()
release()
```

This reduces garbage collection spikes.

---

# 21. PHASE 5 — INFINITE WORLD

The player does not need to physically see an infinite map.

Instead:

```text
Generate ahead
↓
Keep active area
↓
Camera moves down
↓
Recycle old chunks
↓
Generate new chunks
```

Maintain only a bounded active window.

The world should appear infinite while memory usage remains bounded.

---

# 22. CAMERA

The camera follows the falling gameplay.

Use:

- smoothing
- dead zone
- lookahead

The camera must not constantly shake due to tiny physics movements.

Special events may trigger controlled screen shake:

```text
TNT
MEGA TNT
NUKE
```

Screen shake must have:

- maximum duration
- maximum intensity
- no infinite stacking

---

# 23. SPAWN SAFETY

Never spawn a pickaxe directly inside:

- a block
- TNT
- another dangerous entity

Create a safe spawn zone.

Validate spawn positions before activating dynamic bodies.

If an invalid spawn occurs:

1. retry a bounded number of times
2. use a safe fallback position
3. log the issue in development

---

# 24. PHASE 6 — REWARDS + HUD

Display relevant gameplay information.

Possible HUD:

```text
Distance
Depth
Blocks destroyed
Diamond
Emerald
Gold
Iron
Coal
etc.
```

The HUD must remain lightweight.

Avoid creating DOM nodes every frame.

Use Phaser text/bitmap text or a small fixed UI layer.

---

# 25. PHASE 7 — TNT

Create TNT as a dynamic physics entity.

Lifecycle:

```text
CREATED
   ↓
ARMED
   ↓
FALLING
   ↓
TRIGGERED
   ↓
EXPLODING
   ↓
DONE
```

TNT should support:

```text
ownerName
eventId
position
velocity
damage
radius
```

Every viewer-created TNT must preserve the viewer identity.

---

# 26. VIEWER ATTRIBUTION

Example:

```text
        💣
       TNT
    Zehad123
```

The actual username comes from the normalized event.

Rules:

- sanitize username
- limit length, e.g. 20 characters
- never render arbitrary HTML
- never inject username into DOM as raw HTML
- use text rendering
- fade labels after a short duration

Example lifecycle:

```text
show
↓
hold ~3 sec
↓
fade ~0.5 sec
↓
release
```

Do not allow usernames to create commands or code.

---

# 27. EXPLOSION SYSTEM

Explosion should be bounded.

Use:

- radius
- damage
- falloff
- particles
- screen shake
- sound

Do not make explosions process the entire world.

Only inspect nearby relevant blocks/entities.

Use spatial filtering where possible.

---

# 28. TNT CHAIN REACTION

For MVP:

**Do not allow TNT → TNT chain reactions.**

This is intentional.

Otherwise one event can create exponential workload.

If chain reactions are added later, they must have strict depth/count budgets.

---

# 29. MEGA TNT

MEGA TNT is stronger than TNT.

It may have:

- larger radius
- larger damage
- stronger shake
- more particles

But it must still respect global entity/effect budgets.

---

# 30. NUKE

NUKE is the most expensive event.

Conceptually:

```text
NUKE
 ├── giant pickaxe
 ├── TNT burst
 ├── large explosion
 ├── screen shake
 ├── particles
 └── sound
```

NUKE must be strictly budgeted.

Example controls:

```text
MAX_NUKE_TNT
MAX_NUKE_PARTICLES
NUKE_COOLDOWN
MAX_SHAKE_DURATION
```

Never implement NUKE as:

```text
spawn unlimited TNT
spawn unlimited particles
```

---

# 31. OTHER EVENTS

Initial event set:

```text
!tnt
!mega
!nuke

!wood
!stone
!iron
!gold
!diamond
!netherite

!fast
!slow
!lucky
!bless
!blowup
```

Do not add arbitrary commands before the base system is stable.

---

# 32. COMMAND REGISTRY

Do not write:

```ts
if (command === "!tnt") ...
else if (command === "!mega") ...
else if ...
```

Use a command registry.

Conceptually:

```ts
CommandRegistry.register({
  command: "!tnt",
  type: "TNT",
  priority: 2,
  cooldown: ...
});
```

This makes commands data-driven and maintainable.

---

# 33. COMMAND PARSING

MVP syntax:

```text
!tnt
!nuke
!diamond
```

Do not support arbitrary parameters initially.

Reject:

```text
!tnt 999999
!nuke all
!spawn 100000
```

Unknown commands must never reach the game.

---

# 34. CANONICAL GAME EVENT

Create the shared event type:

```ts
type GameEvent = {
  eventId: string;
  source: "youtube" | "admin" | "system";
  command: string;
  type: GameEventType;
  username?: string;
  youtubeMessageId?: string;
  createdAt: number;
  expiresAt: number;
  priority: number;
};
```

Every event must have a unique ID.

Example:

```json
{
  "eventId": "evt_10023",
  "source": "youtube",
  "command": "!tnt",
  "type": "TNT",
  "username": "Viewer123",
  "youtubeMessageId": "yt_abc123",
  "createdAt": 1757112345000,
  "expiresAt": 1757112360000,
  "priority": 2
}
```

---

# 35. EVENT SOURCES

Allowed:

```text
youtube
admin
system
```

Later:

```text
twitch
kick
test
```

But do not add unnecessary integrations now.

---

# 36. EVENT QUEUE

Server must not immediately forward every event blindly.

Use:

```text
Incoming Event
      ↓
Validate
      ↓
Deduplicate
      ↓
Per-user rate limit
      ↓
Command rate limit
      ↓
Global rate limit
      ↓
Priority queue
      ↓
TTL check
      ↓
Event Governor
      ↓
Socket.IO
      ↓
Phone
```

---

# 37. EVENT PRIORITY

Use priorities.

Example:

```text
System/admin emergency     highest
NUKE                        high
MEGA                        high
special                     medium
normal                      normal
```

Do not allow low-priority events to permanently starve.

Use starvation protection.

---

# 38. EVENT TTL

Queued events should expire.

Example:

```text
createdAt
expiresAt
```

If the event waits too long, discard it.

Do not execute an old `!tnt` five minutes later when the stream has moved on.

---

# 39. DEDUPLICATION

YouTube messages have unique IDs.

Maintain a bounded deduplication cache.

If the same YouTube message is received twice:

```text
first → process
second → ignore
```

The dedupe cache must itself be bounded.

Never store every message forever.

---

# 40. RATE LIMITING

Implement multiple limits:

### Per-user

Prevents:

```text
ViewerA
ViewerA
ViewerA
ViewerA
...
```

from flooding the system.

### Per-command

Prevents:

```text
!nuke
!nuke
!nuke
!nuke
```

from executing continuously.

### Global

Protects the phone from chat floods.

### Entity limits

Protects the game from too many active:

- pickaxes
- TNT
- particles
- explosions

---

# 41. IMPORTANT FAILURE RULE

If chat floods:

**the game must remain playable.**

The correct behavior is:

```text
Chat overload
    ↓
Queue / rate limit / coalesce / drop
    ↓
Game remains stable
```

Never:

```text
Chat overload
    ↓
spawn everything
    ↓
FPS collapse
    ↓
browser crashes
```

---

# 42. PHASE 8 — SPECIAL MODIFIERS

## FAST

Temporarily increases game speed.

## SLOW

Temporarily decreases game speed.

Do not multiply speed indefinitely.

Use bounded modifiers.

If FAST is active and another FAST arrives:

- refresh duration
- or ignore
- or queue according to policy

Do not stack:

```text
2x × 2x × 2x × 2x
```

unless deliberately designed and bounded.

---

# 43. LUCKY

Temporarily increases rare ore probability.

It should modify generation/reward rules through a controlled modifier.

It must not rewrite already generated chunks unpredictably.

---

# 44. BLESS

Temporary damage enhancement.

Again:

- bounded
- duration-limited
- no infinite stacking

---

# 45. BLOWUP

Small explosion event.

Must use the same explosion infrastructure as TNT where possible.

Do not create duplicate explosion implementations.

---

# 46. PHASE 9 — PC SERVER

Only after gameplay works locally should the server be introduced.

Server responsibilities:

```text
Node.js
 ├── HTTP/health
 ├── Socket.IO
 ├── YouTube listener
 ├── command registry
 ├── event bus
 ├── event queue
 ├── rate limiter
 ├── admin commands
 └── metrics
```

The server must be able to run without the phone connected.

The autonomous game must still work on the phone.

---

# 47. SERVER MUST NOT RUN GAME PHYSICS

Do not import:

- Phaser
- game world classes
- block physics
- pickaxe physics

into the server.

Server should never simulate:

```text
gravity
collision
block HP
explosion physics
camera
rendering
```

Those belong to the client.

---

# 48. PHASE 10 — ADMIN PANEL

Build an admin dashboard separately.

It should show:

```text
YouTube status
Phone connection
Game status
Distance
FPS
Active pickaxes
TNT count
Event queue
Live chat feed
```

Also show events:

```text
WAITING
RUNNING
DONE
EXPIRED
DROPPED
```

---

# 49. ADMIN CONTROLS

Manual buttons:

```text
TNT
MEGA TNT
NUKE

Wood
Stone
Iron
Gold
Diamond
Netherite

Fast
Slow
Lucky
Bless
Blowup

Pause
Resume
Reset
```

Emergency controls:

```text
STOP ALL EVENTS
CLEAR QUEUE
PAUSE GAME
RESET GAME
DISCONNECT PHONE
```

Admin actions must go through the same event pipeline.

Do not create a secret second event system.

---

# 50. ADMIN OVERRIDE

Admin is allowed to override normal viewer flow.

Example:

```text
Viewer events → queue
Admin NUKE → higher priority
```

But admin should still use canonical `GameEvent`.

This keeps the system consistent.

---

# 51. PHASE 11 — SOCKET.IO

Phone connects to PC over LAN.

Example:

```text
http://192.168.x.x:PORT
```

The exact IP will depend on the local network.

Server must bind to a LAN-accessible interface, not only localhost.

Windows firewall may need a rule allowing the selected local port.

---

# 52. SOCKET AUTHENTICATION

Use separate tokens:

```text
GAME_TOKEN
ADMIN_TOKEN
```

Do not expose YouTube credentials to the phone.

The phone only receives the minimum required game data.

---

# 53. NETWORK PROTOCOL

Shared protocol should include messages such as:

```text
CLIENT_HELLO
SERVER_WELCOME
GAME_EVENT
GAME_EVENT_ACK
GAME_STATE
GAME_METRICS
PING
PONG
CLIENT_READY
CLIENT_PAUSED
CLIENT_RESUMED
```

---

# 54. EVENT ACKNOWLEDGEMENT

Use:

```text
QUEUED
DELIVERED
EXECUTED
```

Example:

```text
Server:
eventId = evt123

Phone:
DELIVERED evt123

Phone:
EXECUTED evt123
```

This helps debugging.

Do not treat `DELIVERED` as `EXECUTED`.

---

# 55. IDEMPOTENCY

The client should not execute the same event twice.

If:

```text
evt123
evt123
```

arrives twice, execute only once.

Use event IDs.

---

# 56. RECONNECT BEHAVIOR

If phone disconnects:

```text
game continues locally
```

When connection returns:

```text
reconnect
authenticate
send state/metrics
resume event reception
```

Do not crash the game because Socket.IO disconnects.

---

# 57. YOUTUBE INTEGRATION

Only add YouTube after the complete event pipeline works with fake/admin events.

Use YouTube Live Chat APIs from the server only.

Never put API credentials in:

```text
apps/game
```

Never put secrets into browser code.

---

# 58. YOUTUBE LIVE CHAT FLOW

Concept:

```text
YouTube Live Chat
        ↓
Server listener
        ↓
Extract message
        ↓
Extract author username
        ↓
Extract YouTube message ID
        ↓
Command parser
        ↓
CommandRegistry
        ↓
Event pipeline
```

The game never sees raw YouTube objects.

---

# 59. PREFER STREAMING CHAT WHEN AVAILABLE

Use the current low-latency Live Chat streaming mechanism when supported by the API/client library.

A polling fallback may be used if necessary.

Do not assume that old polling architecture is automatically best.

The listener must handle:

- disconnect
- reconnect
- expired stream
- API errors
- no active live stream
- malformed messages

---

# 60. YOUTUBE AUTHENTICATION

All YouTube authentication belongs to the PC server.

Use environment variables / secure local configuration.

Never commit secrets.

`.env` must be ignored.

Provide:

```text
.env.example
```

with placeholders only.

---

# 61. IMPORTANT YOUTUBE EVENT LIMITATION

Do not incorrectly assume every YouTube engagement is a Live Chat message.

For MVP, the reliable interaction mechanism is:

```text
chat commands
```

Do not pretend ordinary likes automatically become chat commands.

Do not pretend ordinary subscriptions are identical to every sponsor event.

If special engagement triggers are needed, expose them through the admin panel or a separately verified integration.

---

# 62. VIEWER USERNAME FLOW

Example:

Viewer:

```text
Zehad123: !tnt
```

Server creates:

```json
{
  "source": "youtube",
  "command": "!tnt",
  "type": "TNT",
  "username": "Zehad123",
  "youtubeMessageId": "..."
}
```

Phone receives the normalized event.

Phone creates TNT with:

```text
ownerName = "Zehad123"
```

The TNT displays the owner.

---

# 63. USERNAME SECURITY

Treat usernames as untrusted input.

Must:

- sanitize
- truncate
- render as plain text
- prevent HTML
- prevent control characters
- prevent absurd Unicode payloads

Never execute or evaluate username content.

---

# 64. PHASE 12–14 INTEGRATION ORDER

Do not connect everything simultaneously.

Use this sequence:

### Step A

Phone game works without server.

### Step B

Server starts without YouTube.

### Step C

Admin → Server → Phone → TNT.

### Step D

Admin → Server → Phone → Pickaxe.

### Step E

Fake test command → Server → Phone.

### Step F

YouTube → Server.

### Step G

YouTube `!tnt` → Phone.

### Step H

Verify username attribution.

### Step I

Add rate limiting.

### Step J

Add all remaining commands.

---

# 65. GAME STATE

Use explicit game states:

```text
BOOT
LOADING
READY
RUNNING
PAUSED
STOPPED
ERROR
```

Do not represent state with dozens of unrelated booleans.

---

# 66. NETWORK STATE

Separate network state:

```text
DISCONNECTED
CONNECTING
CONNECTED
RECONNECTING
```

---

# 67. YOUTUBE STATE

Separate YouTube state:

```text
OFFLINE
CONNECTING
LIVE
RECONNECTING
ENDED
ERROR
```

Do not merge all three systems into one state.

Example:

```text
YouTube = OFFLINE
Game = RUNNING
Network = CONNECTED
```

This is perfectly valid.

---

# 68. ERROR ISOLATION

A failure in one subsystem must not kill another.

## YouTube fails

Game continues.

## Socket fails

Game continues.

## Admin panel fails

Game continues.

## One malformed event

Ignore/drop it.

## One bad physics entity

Despawn/isolate it.

## Chunk generation fails

Retry a bounded number of times, then generate a safe fallback chunk.

---

# 69. FALLBACK CHUNK

Safe fallback chunk:

- mostly stone
- limited ores
- no special obstacles
- guaranteed valid geometry

Never let procedural generation permanently stop the game.

---

# 70. PHYSICS SAFETY

Use:

- fixed or bounded timestep
- delta cap
- maximum substeps
- velocity caps
- angular velocity caps
- finite-number validation

Never allow:

```text
NaN
Infinity
negative impossible state
```

to propagate.

If a body becomes invalid:

```text
log
remove
return to pool
```

Do not keep a corrupt physics object alive.

---

# 71. FPS ADAPTIVE QUALITY

Maintain a rolling performance measurement.

If FPS drops:

```text
reduce particles
reduce cosmetic effects
reduce explosion detail
reduce audio concurrency
```

Never sacrifice core physics first.

Priority:

```text
Gameplay correctness
    >
Physics
    >
Input/network event handling
    >
Core rendering
    >
Particles
    >
Cosmetic effects
```

---

# 72. AUDIO

Use categories:

```text
impact
break
explosion
special
ambient
UI
```

Use a sound concurrency limiter.

Do not play hundreds of identical sounds simultaneously.

If necessary:

- group similar impacts
- throttle repeated sounds
- pool audio objects
- reduce volume during event storms

---

# 73. TEXTURES

Use atlases.

Do not load hundreds of duplicate textures.

Prefer:

```text
blocks.png
pickaxes.png
effects.png
ui.png
```

or equivalent atlases.

Never create a texture every frame.

---

# 74. PARTICLES

Particles must be pooled and bounded.

Every effect must have:

```text
max count
lifetime
cleanup
```

NUKE must not bypass particle limits.

---

# 75. CHUNK MEMORY MANAGEMENT

A common mistake is:

```text
chunks.push(newChunk)
```

forever.

Do not do this.

Use a bounded active chunk collection.

Old chunks should be:

```text
recyclable
disposed
removed from active maps
```

Their entities/collision bodies must also be cleaned up.

---

# 76. DISTANCE / PROGRESSION

Track falling distance/depth.

Use a stable world coordinate or accumulated progression value.

Do not allow precision problems from endlessly increasing raw floating-point coordinates.

If necessary, use world-origin shifting/rebasing later.

---

# 77. GAME LOOP

The game loop must remain deterministic enough for stable gameplay.

Do not put expensive work directly into every frame.

Bad:

```ts
update() {
  generateHugeWorld();
  allocateThousandsOfObjects();
  parseLargeJSON();
}
```

Good:

```text
small bounded work per frame
```

Heavy generation may be spread over multiple frames.

---

# 78. NO DOM GAMEPLAY

Do not create:

```html
<div>TNT</div>
<div>username</div>
```

for every gameplay entity.

Render gameplay inside Phaser.

DOM should be reserved for:

- application shell
- debugging/admin UI if needed

---

# 79. NO CLOUD DEPENDENCY

The core architecture must work with:

```text
PC + Wi-Fi/LAN + Phone
```

No:

```text
Vercel
Render
Firebase
Supabase
AWS
```

is required for the core game.

The PC can still have internet access for YouTube.

---

# 80. DATABASE

Do not add a database to MVP.

Use:

- environment variables
- JSON config
- rotating logs

No need to store every physics frame.

---

# 81. CONFIGURATION

Create centralized configuration.

Important settings include:

```text
MAX_ACTIVE_PICKAXES
MAX_ACTIVE_TNT
MAX_PARTICLES
TNT_COOLDOWN
MEGA_COOLDOWN
NUKE_COOLDOWN
FAST_DURATION
SLOW_DURATION
PICKAXE_REVERT_DURATION
DIFFICULTY
QUALITY
CHUNK_WIDTH
CHUNK_HEIGHT
```

Do not scatter magic numbers throughout the code.

---

# 82. CONFIG RULE

Configuration must be validated at startup.

If:

```text
MAX_ACTIVE_PICKAXES = -100
```

the server/game should reject the configuration.

Use sensible bounds.

---

# 83. TESTING STRATEGY

Testing is mandatory.

Create:

```text
tests/unit
tests/integration
tests/physics
tests/stress
```

---

# 84. UNIT TESTS

Test:

- command parsing
- command registry
- event creation
- event validation
- event IDs
- TTL
- deduplication
- rate limiting
- priority
- block HP
- damage
- pickaxe tier data
- configuration validation

---

# 85. INTEGRATION TESTS

Test:

```text
Admin → Server → Socket → Game
```

Then:

```text
Fake YouTube → Server → Socket → Game
```

Do not require real YouTube for every test.

---

# 86. PHYSICS TESTS

Test:

- pickaxe falls
- collision occurs
- block HP decreases
- block breaks
- TNT explodes
- invalid entities are removed
- no NaN
- no Infinity
- active body counts remain bounded

---

# 87. STRESS TESTS

Simulate:

```text
100 chat commands
500 chat commands
1000 chat commands
```

The server must:

- remain responsive
- enforce limits
- avoid unbounded queue growth

The phone must never receive an unlimited event flood.

---

# 88. LONG-RUN TEST

Before live use, run the game for:

```text
1 hour
3 hours
6 hours
```

Check:

- memory growth
- FPS degradation
- object count
- chunk count
- event queue
- socket reconnects
- audio buildup
- particle buildup
- browser stability

A game that works for 5 minutes is not necessarily stream-ready.

---

# 89. MOBILE TESTING

Test on the actual phone.

Desktop Chrome success is not enough.

Test:

- portrait
- screen brightness
- browser fullscreen
- touch behavior if controls exist
- thermal behavior
- battery behavior
- long-running FPS
- memory
- Wi-Fi stability
- screen recording/Screencast

---

# 90. MOBILE UI

Keep the game visually clear in 9:16.

Avoid tiny text.

Important information should be readable during YouTube Screencast.

Keep UI away from:

- camera edges
- system navigation areas
- dangerous gameplay zones

---

# 91. ADMIN UI IS NOT THE GAME UI

Admin panel is on PC.

Game UI is on phone.

Do not make the phone load the full admin dashboard.

The phone only needs the game.

---

# 92. SECURITY

Even though the system is local LAN, do not assume everything is trusted.

Validate:

- socket messages
- event types
- event IDs
- usernames
- admin commands
- configuration

Never use:

```text
eval()
new Function()
arbitrary code execution
```

Never trust client-provided event permissions.

---

# 93. ADMIN AUTH

Admin controls should require admin authentication/token.

Do not expose unrestricted admin endpoints without protection.

---

# 94. GAME CLIENT AUTH

The phone should authenticate with a game token.

Do not hard-code secrets into public source if avoidable.

For local MVP, a generated token is acceptable.

---

# 95. LOGGING

Use structured logs.

Useful fields:

```text
timestamp
level
subsystem
eventId
command
username
messageId
status
error
```

Example:

```text
[INFO] youtube command received
eventId=evt123
command=!tnt
username=Viewer123
```

Do not log secrets.

---

# 96. DEBUG OVERLAY

Development mode should provide optional:

```text
FPS
frame time
active chunks
active blocks
active pickaxes
active TNT
particle count
queue size
socket status
YouTube status
distance
```

It must be removable/disabled in production.

---

# 97. EVENT OBSERVABILITY

Every event should have a lifecycle:

```text
RECEIVED
VALIDATED
QUEUED
DELIVERED
EXECUTED
DROPPED
EXPIRED
FAILED
```

This makes debugging live streams much easier.

---

# 98. ADMIN EVENT LOG

The admin panel should show recent events.

Example:

```text
12:30:01 ViewerA !tnt QUEUED
12:30:02 ViewerA !tnt EXECUTED
12:30:04 ViewerB !nuke DROPPED cooldown
```

This allows the operator to understand what happened.

---

# 99. DO NOT HIDE FAILURES

If something fails:

- log it
- expose useful status
- continue safely if possible

Never silently swallow everything.

But also do not crash the entire game over recoverable errors.

---

# 100. ASSET RULE

The project is Minecraft-inspired.

Do not assume that publicly visible Minecraft assets are automatically safe for commercial redistribution.

For production, use:

- original assets
- properly licensed assets
- assets you have permission to use

Do not blindly copy copyrighted game assets into the final project.

---

# 101. REFERENCE REPOSITORY

A reference implementation exists:

`https://github.com/EXPOSUREEE/falling-pickaxe-ultimate-edition`

Use it as a **reference for gameplay ideas**, not as permission to copy everything blindly.

Important ideas worth studying:

- pickaxe physics
- block HP
- crack stages
- TNT
- explosion effects
- chunk generation
- command queues
- viewer ownership
- automatic gameplay

But this project is a browser/Phaser architecture and must follow the architecture in this document.

Do not import its Python/Pygame architecture into the new client.

---

# 102. DO NOT REPLICATE THE OLD ARCHITECTURE

The reference project uses Python/Pygame/Pymunk.

Our project uses:

```text
TypeScript
Phaser
Node.js
Socket.IO
```

Do not attempt to make Python the game runtime.

Do not make the PC render the game.

Do not make the server simulate the entire world.

---

# 103. IMPLEMENTATION STYLE

Prefer small classes/modules.

Examples:

```text
ChunkManager
ChunkGenerator
Block
BlockManager
Pickaxe
PickaxeManager
TNT
TNTManager
ExplosionSystem
ParticlePool
AudioManager
CameraController
GameEventController
```

Avoid one giant:

```text
Game.ts
```

with thousands of lines.

---

# 104. DATA-DRIVEN DESIGN

Whenever behavior differs mainly by configuration, use data.

Example:

```text
PickaxeDefinition
BlockDefinition
CommandDefinition
EventDefinition
```

Do not duplicate code for:

```text
wood
stone
iron
gold
diamond
netherite
```

Use one pickaxe system plus tier data.

---

# 105. DEPENDENCY DIRECTION

Keep dependencies clean.

Conceptually:

```text
shared-types
     ↑
protocol/config
     ↑
server     game
     ↑
admin
```

The game must not depend on the server implementation.

The server must not depend on Phaser.

Shared packages may be imported by both.

---

# 106. GAME EVENT EXECUTION

The game should have one central event dispatcher.

Conceptually:

```text
GAME_EVENT
     ↓
EventDispatcher
     ↓
switch/type registry
     ↓
TNT / Pickaxe / Modifier / Explosion
```

Do not spread event handling across unrelated scenes.

---

# 107. GAME EVENT VALIDATION

Even though the server validates events, the client should validate again.

Check:

- eventId exists
- type is known
- source is allowed
- required fields exist
- event is not already executed

Defense in depth.

---

# 108. EVENT EXPIRATION ON CLIENT

If an event is stale when received, the client may reject it.

The client must not blindly execute ancient events after reconnect.

---

# 109. RESET BEHAVIOR

Reset must be deliberate.

A reset should:

- clear active event effects
- reset world/run state as designed
- reset modifiers
- reset counters if configured
- rebuild initial chunks
- restore safe initial conditions

Avoid partial reset bugs.

---

# 110. PAUSE BEHAVIOR

When paused:

- physics stops
- gameplay timers stop or freeze according to design
- visual state remains valid
- network can remain connected

Events may either queue or be rejected according to configured policy.

Choose one policy and document it.

---

# 111. STOP BEHAVIOR

STOP should be different from PAUSE.

Example:

```text
PAUSE = temporary freeze
STOP = stop gameplay session
RESET = create fresh run
```

Do not mix these concepts.

---

# 112. RUN SEED

At run start:

```text
runSeed = generated seed
```

Display it in development logs.

This helps reproduce bugs.

---

# 113. BUG REPRODUCTION

If a bug happens:

record:

```text
runSeed
chunkId
distance
eventId
command
username if needed
frame/time
```

Then reproduce using the same seed.

---

# 114. CHAT SILENCE REQUIREMENT

If nobody chats for 30 minutes:

**the game must continue normally.**

Autonomous systems may:

- spawn pickaxes
- generate chunks
- progress downward
- create normal gameplay

The game cannot depend on chat activity.

---

# 115. AUTONOMOUS SPAWNING

Use bounded random intervals for autonomous events.

Starting concepts may include:

```text
TNT spawn interval: configurable
Random pickaxe interval: configurable
Pickaxe enlargement interval: configurable
```

Do not use hard-coded values everywhere.

---

# 116. AUTONOMOUS VS CHAT EVENTS

Both should eventually enter the same gameplay event mechanism where practical.

Concept:

```text
Autonomous system
       ↓
GameEvent(source="system")

YouTube
       ↓
GameEvent(source="youtube")

Admin
       ↓
GameEvent(source="admin")
```

This prevents duplicated logic.

---

# 117. SUPERCHAT / PREMIUM EVENTS

Do not implement platform-specific monetization triggers until the base event pipeline is stable.

If later implemented:

```text
platform event
↓
normalize
↓
GameEvent
```

Never let platform-specific data leak into game entities.

---

# 118. EVENT COALESCING

Some events may be safely coalesced.

Example:

```text
20 normal pickaxe requests
```

could become a bounded batch.

However, viewer attribution must not be lost.

Do not coalesce events if doing so destroys required ownership information.

---

# 119. OWNER ATTRIBUTION RULE

For viewer-created gameplay entities:

```text
ownerName
```

must be preserved from source to entity.

Never use:

```text
currentChatUser
```

as a global variable.

Each entity owns its own attribution.

---

# 120. TIME

Use consistent timestamps.

Prefer server-generated event timestamps for network events.

Avoid relying on client wall-clock time for security.

---

# 121. NETWORK PAYLOADS

Keep messages small.

Do not send:

```text
entire world
all block states
all physics bodies
```

on every event.

Send only what is required.

The phone already owns gameplay state.

---

# 122. GAME METRICS

Phone may periodically send lightweight metrics:

```text
FPS
frameTime
distance
activePickaxes
activeTNT
chunkCount
```

Do not send metrics every frame.

Use a reasonable interval.

---

# 123. SERVER METRICS

Server tracks:

```text
connected clients
YouTube status
queue size
commands/minute
dropped events
expired events
executed events
```

---

# 124. PERFORMANCE BUDGETS

Define explicit budgets.

Examples:

```text
active pickaxes <= configured maximum
active TNT <= configured maximum
particles <= configured maximum
event queue <= configured maximum
active chunks <= configured window
```

A budget is a safety wall.

---

# 125. WHEN A BUDGET IS EXCEEDED

Do not crash.

Use policy:

```text
reject
queue
delay
coalesce
drop low priority
```

Log the reason.

---

# 126. NO UNBOUNDED COLLECTIONS

Be suspicious of:

```text
Map
Set
Array
queue
cache
history
logs
```

Ask:

**What removes old entries?**

Every runtime collection must have a lifecycle or bounded size.

---

# 127. MEMORY LEAK CHECK

During long-run testing inspect:

- chunk count
- event cache size
- dedupe cache size
- active entity arrays
- listeners
- timers
- audio objects
- particle objects

If counts grow forever, investigate.

---

# 128. EVENT LISTENER CLEANUP

When scenes/entities are destroyed:

remove:

- socket listeners
- physics listeners
- timers
- input handlers
- event emitter handlers

Avoid duplicate listeners after scene restarts.

---

# 129. SOCKET LISTENER RULE

Do not register the same server event listener every time a Phaser scene restarts.

Centralize network connection management.

---

# 130. SCENE ARCHITECTURE

Keep Phaser scenes focused.

Possible:

```text
BootScene
PreloadScene
GameScene
UIScene
```

Avoid putting all systems into one scene lifecycle if it becomes difficult to test.

---

# 131. GAME WORLD SEPARATION

Separate:

```text
World generation
Physics
Rendering
Entity management
Network events
UI
```

These are different responsibilities.

---

# 132. RENDERING VS PHYSICS

Do not make visual sprite dimensions equal to collision complexity.

Use simple collision shapes.

Visual:

```text
detailed pickaxe
```

Physics:

```text
small polygons
```

This is better for mobile.

---

# 133. BLOCK COLLISION SHAPES

Blocks can usually use simple rectangles.

Do not use pixel-perfect collision.

---

# 134. PICKAXE COLLISION SHAPES

Use a small number of polygons or a simple approximation.

Do not use hundreds of vertices.

---

# 135. EXPLOSION COLLISION

Do not check every block in the universe.

Only evaluate blocks within the explosion's relevant region.

---

# 136. WORLD VALIDATION

After generating a chunk, validate:

- expected dimensions
- no impossible nulls
- valid block types
- valid collision bodies
- safe spawn conditions

Then activate.

---

# 137. DEBUG MODE

Create development-only tools:

```text
spawn pickaxe
spawn TNT
spawn nuke
force chunk
set seed
pause
step physics
show collision shapes
show chunk borders
```

These tools dramatically reduce debugging time.

They must not be accidentally available to viewers.

---

# 138. TEST BOT

Create an internal test event source.

Example:

```text
TestBot.emit("!tnt", "TestUser")
```

This allows testing the complete pipeline without YouTube.

Do not depend on real live streams during development.

---

# 139. ACCEPTANCE TEST: GAME

The game phase is complete only when:

- portrait works
- world generates
- pickaxes fall
- collisions work
- blocks break
- chunks recycle
- camera follows
- HUD works
- TNT works
- effects work
- no obvious memory growth
- actual phone runs acceptably

---

# 140. ACCEPTANCE TEST: SERVER

Server phase complete only when:

- starts cleanly
- validates config
- accepts LAN client
- creates events
- rate limits
- deduplicates
- queues
- expires
- logs
- survives disconnects

---

# 141. ACCEPTANCE TEST: ADMIN

Admin phase complete only when:

- connects
- shows status
- manual event works
- emergency controls work
- queue is visible
- event states are visible

---

# 142. ACCEPTANCE TEST: YOUTUBE

YouTube phase complete only when:

```text
Viewer writes !tnt
       ↓
Server receives
       ↓
username extracted
       ↓
message deduplicated
       ↓
event created
       ↓
rate limit passed
       ↓
event queued
       ↓
phone receives
       ↓
TNT spawns
       ↓
username displayed
```

Every step must be verifiable in logs.

---

# 143. PRIVATE LIVE REHEARSAL

Before public streaming:

1. Start PC server.
2. Start admin panel.
3. Start phone game.
4. Verify LAN.
5. Verify YouTube listener.
6. Use private/unlisted rehearsal where appropriate.
7. Test commands.
8. Test disconnect.
9. Test reconnect.
10. Test chat flood.
11. Test NUKE.
12. Test long-running gameplay.

Do not make the first full integration test during a public live stream.

---

# 144. FINAL LIVE TOPOLOGY

Expected production workflow:

```text
PC:
  Node server
  Admin panel
  YouTube internet connection

        │
        │ local Wi-Fi/LAN
        ▼

PHONE:
  Browser
  Phaser game
  Screen cast

        │
        ▼

YouTube Live
```

---

# 145. STARTUP ORDER

Recommended:

```text
1. Connect PC to internet.
2. Connect PC and phone to same LAN/Wi-Fi.
3. Start Node server.
4. Open admin panel.
5. Verify server status.
6. Open game on phone.
7. Verify phone connected.
8. Verify game running autonomously.
9. Start/attach YouTube live session.
10. Verify chat listener.
11. Test one low-risk command.
12. Start stream.
```

---

# 146. SHUTDOWN ORDER

When ending:

```text
1. Stop accepting viewer events.
2. Finish/clear queue.
3. Stop YouTube listener.
4. Stop game session.
5. Stop admin/server.
```

Do not kill the server abruptly if graceful shutdown can be implemented.

---

# 147. GRACEFUL SHUTDOWN

Handle:

```text
SIGINT
SIGTERM
```

Cleanly:

- stop YouTube listener
- stop socket server
- clear timers
- close logs
- release resources

---

# 148. DOCUMENTATION

Maintain:

```text
docs/architecture.md
docs/commands.md
docs/protocol.md
docs/gameplay.md
```

Update docs when behavior changes.

Do not allow implementation and documentation to diverge.

---

# 149. GIT / VERSION CONTROL

Commit in logical milestones.

Examples:

```text
feat: initialize monorepo
feat: add Phaser foundation
feat: add chunk world
feat: add pickaxe physics
feat: add TNT
feat: add LAN socket server
feat: add admin controls
feat: add YouTube listener
fix: prevent duplicate chat events
perf: pool particles
```

Avoid giant commits containing the entire project.

---

# 150. CODE QUALITY RULE

Before considering code complete:

- TypeScript must type-check.
- Lint must pass.
- Tests must pass.
- Build must pass.
- No unused imports.
- No dead experimental code.
- No secrets committed.
- No unexplained magic numbers.
- No unbounded queues.
- No duplicate architecture.

---

# 151. DEBUGGING PROTOCOL

When something breaks:

## Step 1

Reproduce.

## Step 2

Determine subsystem:

```text
Game
Physics
World
Network
Server
YouTube
Admin
```

## Step 3

Inspect logs/state.

## Step 4

Create the smallest reproducible case.

## Step 5

Fix root cause.

## Step 6

Add a regression test if practical.

## Step 7

Re-run the affected tests.

## Step 8

Re-run the full build/test suite.

Do not randomly patch symptoms.

---

# 152. NEVER MAKE THESE MISTAKES

Do NOT:

- put YouTube API keys in the client
- put YouTube code in Phaser
- render the game on the PC
- run physics on the server
- use an unlimited event queue
- allow unlimited TNT
- allow unlimited particles
- allow unlimited pickaxes
- create textures every frame
- create DOM labels for every entity
- store every chat message forever
- trust usernames
- execute arbitrary commands
- use eval
- rely only on desktop testing
- rely only on a 5-minute test
- add a database without need
- add cloud infrastructure without need
- jump to YouTube integration before the core game works
- rewrite the architecture because one component is inconvenient
- ignore TypeScript errors
- ignore FPS drops
- ignore memory growth
- ignore reconnect behavior
- silently swallow important errors

---

# 153. IMPORTANT: DO NOT OVERENGINEER EARLY

The architecture is robust, but implementation should be incremental.

Do not build:

- leaderboard
- accounts
- database
- cloud deployment
- Twitch
- Kick
- payments
- analytics platform
- complicated matchmaking

until the core game is stable.

---

# 154. IMPORTANT: DO NOT UNDERENGINEER SAFETY

Even in MVP, these are mandatory:

```text
event IDs
deduplication
rate limits
queue limits
TTL
entity limits
particle limits
network reconnect
error isolation
```

These are not optional polish.

---

# 155. IMPLEMENTATION PRIORITY

When forced to choose:

```text
1. Correctness
2. Stability
3. Mobile performance
4. Debuggability
5. Maintainability
6. Visual polish
```

Do not sacrifice stability for visual effects.

---

# 156. FINAL COMMAND TABLE

| Chat Command | Event | Result |
|---|---|---|
| !tnt | TNT | Viewer-owned TNT |
| !mega | MEGA_TNT | Larger TNT |
| !nuke | NUKE | Large bounded event |
| !wood | PICKAXE_WOOD | Wood pickaxe |
| !stone | PICKAXE_STONE | Stone pickaxe |
| !iron | PICKAXE_IRON | Iron pickaxe |
| !gold | PICKAXE_GOLD | Gold pickaxe |
| !diamond | PICKAXE_DIAMOND | Diamond pickaxe |
| !netherite | PICKAXE_NETHERITE | Netherite pickaxe |
| !fast | SPEED_FAST | Faster gameplay |
| !slow | SPEED_SLOW | Slower gameplay |
| !lucky | LUCKY | Rare-ore boost |
| !bless | BLESS | Damage boost |
| !blowup | SMALL_EXPLOSION | Small explosion |

---

# 157. FINAL NON-NEGOTIABLE RULES

Remember these permanently while developing:

1. **Phone is the game machine.**
2. **PC is the live-event/control server.**
3. **YouTube Chat is the primary viewer interaction mechanism.**
4. **Every viewer-generated event carries viewer identity.**
5. **Server never runs gameplay physics.**
6. **Blocks are static.**
7. **Dynamic entities are strictly budgeted.**
8. **World is chunked and recycled.**
9. **World generation is deterministic.**
10. **Every network event has a unique ID.**
11. **Every YouTube message is deduplicated.**
12. **Expensive events have cooldowns and budgets.**
13. **Queued events have TTL.**
14. **Unknown commands never reach the game.**
15. **Socket disconnect never crashes the game.**
16. **YouTube disconnect never stops autonomous gameplay.**
17. **Physics uses bounded timestep and velocity.**
18. **Particles/effects are pooled and bounded.**
19. **Admin is an override/control center, not a separate gameplay engine.**
20. **No database/cloud dependency is required for core gameplay.**

---

# 158. THE CORRECT DEVELOPMENT MINDSET

You are not simply writing a game.

You are building a small real-time distributed system:

```text
Browser Game
+
Physics Engine
+
Procedural World
+
LAN Networking
+
Event Queue
+
YouTube Integration
+
Admin Control
+
Live-Stream Reliability
```

Therefore every feature must answer:

### Gameplay

- Does it work?

### Performance

- Can the phone handle it?

### Networking

- What happens if the connection drops?

### Events

- What happens if 1,000 viewers trigger it?

### Memory

- What cleans it up?

### Errors

- What happens if it fails?

### Security

- Can untrusted input break it?

### Recovery

- Can the system continue?

### Debugging

- Can we determine exactly what happened?

If a feature has no answer to these questions, it is not finished.

---

# 159. YOUR EXECUTION RULE

Work strictly in phases.

At the beginning of each phase:

1. Read the relevant architecture above.
2. State what you are implementing.
3. Identify dependencies.
4. Implement the smallest correct version.
5. Run type-check.
6. Run lint.
7. Run tests.
8. Run the application.
9. Verify behavior.
10. Record what was verified.
11. Only then continue.

If you discover a conflict with this document:

**Stop and explain the conflict before changing the architecture.**

Do not silently redesign the system.

---

# 160. FIRST TASK — START HERE

Do NOT implement YouTube first.

Do NOT implement the admin panel first.

Do NOT implement Socket.IO first.

Start with:

## Phase 1 — Project Foundation

Your first implementation task is:

```text
Create the monorepo/workspace
Create apps/game
Create apps/server
Create apps/admin
Create packages/shared-types
Create packages/protocol
Create packages/config
Configure TypeScript
Configure build/dev/test scripts
Create .env.example
Create .gitignore
Create README.md
Verify every package can build
```

Then move to:

```text
Phase 2 — Phaser Foundation
```

Then:

```text
Phase 3 — Block World
```

Then continue sequentially.

**Do not skip ahead.**

The final goal is a stable phone-first Minecraft-inspired endless falling game controlled by YouTube Live Chat through a local PC server, with viewer attribution, admin override, bounded real-time events, autonomous gameplay, and enough reliability to run for hours during a live stream.

# END OF MASTER INSTRUCTION
