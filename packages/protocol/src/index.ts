/**
 * Socket.IO message protocol for Minecraft Endless Fall.
 * Master spec §53 (message names), §52 (auth), §54 (acks), §55 (idempotency).
 *
 * One place defines every message shape so server, game, and admin cannot drift.
 */

/** Socket.IO event names (master spec §53). */
export const SocketMessages = {
  CLIENT_HELLO: "client:hello",
  SERVER_WELCOME: "server:welcome",
  GAME_EVENT: "game:event",
  GAME_EVENT_ACK: "game:event:ack",
  GAME_STATE: "game:state",
  GAME_METRICS: "game:metrics",
  SERVER_STATUS: "server:status",
  EVENT_LOG: "event:log",
  CLIENT_READY: "client:ready",
  CLIENT_PAUSED: "client:paused",
  CLIENT_RESUMED: "client:resumed",
  PING: "ping",
  PONG: "pong",
} as const;

export type SocketMessageName = (typeof SocketMessages)[keyof typeof SocketMessages];

/** Acknowledgement states for an event (master spec §54). DELIVERED ≠ EXECUTED. */
export type AckState = "DELIVERED" | "EXECUTED" | "REJECTED";

export interface GameEventAck {
  eventId: string;
  state: AckState;
  /** Machine-readable reason when state is REJECTED. */
  reason?: string;
  /** Client epoch ms when the ack was produced. */
  at: number;
}

/** First message from any client; carries role + token for auth (master spec §52). */
export interface ClientHello {
  role: import("@mef/shared-types").ClientRole;
  token: string;
  /** Free-form client version/debug string, e.g. "game 0.1.0". */
  clientVersion?: string;
}

/** Server response to a valid CLIENT_HELLO. */
export interface ServerWelcome {
  ok: true;
  serverTime: number;
  /** Interval in ms at which the server expects GAME_METRICS. */
  metricsIntervalMs: number;
}

/** Rejection of an invalid CLIENT_HELLO (bad role/token). */
export interface ServerReject {
  ok: false;
  reason: string;
}

/** Payload of GAME_METRICS (wraps shared metrics). */
export type MetricsMessage = import("@mef/shared-types").GameMetrics;

/** GAME_STATE payload: which game/network/youtube state the reporter is in. */
export interface GameStateMessage {
  game: import("@mef/shared-types").GameState;
  network?: import("@mef/shared-types").NetworkState;
  timestamp: number;
}
