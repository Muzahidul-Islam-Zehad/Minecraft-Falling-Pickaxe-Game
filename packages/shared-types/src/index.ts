/**
 * Canonical shared types for Minecraft Endless Fall.
 * Master spec §34 (GameEvent), §65 (game states), §66 (network states), §67 (YouTube states).
 *
 * These types are the contract between server, game, and admin.
 * Neither the server nor the game may invent ad-hoc event shapes.
 */

/** Allowed event sources (master spec §35). Extend later (twitch/kick/test) only when needed. */
export type EventSource = "youtube" | "admin" | "system";

/**
 * Normalized game event types. The game only understands these — never raw
 * platform objects (master spec §2, §34).
 */
export type GameEventType =
  // Entities
  | "TNT"
  | "MEGA_TNT"
  | "NUKE"
  // Pickaxes
  | "PICKAXE_WOOD"
  | "PICKAXE_STONE"
  | "PICKAXE_IRON"
  | "PICKAXE_GOLD"
  | "PICKAXE_DIAMOND"
  | "PICKAXE_NETHERITE"
  // Modifiers
  | "SPEED_FAST"
  | "SPEED_SLOW"
  | "LUCKY"
  | "BLESS"
  // Explosions
  | "SMALL_EXPLOSION"
  // Control
  | "PAUSE"
  | "RESUME"
  | "RESET";

/** Event lifecycle states as observed by the server/admin (master spec §97). */
export type EventStatus =
  | "RECEIVED"
  | "VALIDATED"
  | "QUEUED"
  | "DELIVERED"
  | "EXECUTED"
  | "DROPPED"
  | "EXPIRED"
  | "FAILED";

/**
 * The one canonical event that crosses process boundaries.
 * Every event has a unique ID and a TTL (master spec §34, §38).
 */
export interface GameEvent {
  /** Unique event ID, e.g. "evt_10023". Required for dedupe/ack/idempotency. */
  eventId: string;
  /** Where the event came from. The game must not care (master spec §2). */
  source: EventSource;
  /** Original chat-style command, e.g. "!tnt". Empty for admin/system controls. */
  command: string;
  /** Normalized event type the game dispatches on. */
  type: GameEventType;
  /** Sanitized viewer/operator name for attribution (master spec §26, §63). */
  username?: string;
  /** Platform message ID used for deduplication (master spec §39). */
  youtubeMessageId?: string;
  /** Server-generated creation timestamp (epoch ms). Prefer server time (master spec §120). */
  createdAt: number;
  /** Epoch ms after which the event must not execute (master spec §38). */
  expiresAt: number;
  /** Priority; higher = more important. Used for queue ordering (master spec §37). */
  priority: number;
}

/** Game client states (master spec §65). */
export type GameState = "BOOT" | "LOADING" | "READY" | "RUNNING" | "PAUSED" | "STOPPED" | "ERROR";

/** Phone ↔ PC network states (master spec §66). */
export type NetworkState = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING";

/** YouTube listener states on the server (master spec §67). */
export type YouTubeState =
  | "OFFLINE"
  | "CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "ENDED"
  | "ERROR";

/** Socket roles — phone game and admin panel authenticate differently (master spec §52). */
export type ClientRole = "game" | "admin";

/** Lightweight metrics the phone reports periodically, never every frame (master spec §122). */
export interface GameMetrics {
  fps: number;
  frameTimeMs: number;
  distance: number;
  activePickaxes: number;
  activeTnt: number;
  chunkCount: number;
  timestamp: number;
}

/** Server-side status snapshot shown in the admin panel (master spec §123). */
export interface ServerStatus {
  youtubeState: YouTubeState;
  connectedClients: { game: number; admin: number };
  queueSize: number;
  commandsPerMinute: number;
  droppedEvents: number;
  expiredEvents: number;
  executedEvents: number;
  uptimeMs: number;
}
