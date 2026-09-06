import { describe, expect, it } from "vitest";
import { SocketMessages, type GameEventAck } from "@mef/protocol";
import type { GameEvent } from "@mef/shared-types";

/** Phase 1 protocol sanity tests: message table completeness + canonical event shape. */

describe("socket message table (master spec §53)", () => {
  it("contains every required message name", () => {
    const names = Object.values(SocketMessages);
    for (const required of [
      "client:hello",
      "server:welcome",
      "game:event",
      "game:event:ack",
      "game:state",
      "game:metrics",
      "client:ready",
      "client:paused",
      "client:resumed",
      "ping",
      "pong",
    ]) {
      expect(names).toContain(required);
    }
  });
});

describe("canonical GameEvent (master spec §34)", () => {
  it("supports a fully-populated viewer event", () => {
    const evt: GameEvent = {
      eventId: "evt_10023",
      source: "youtube",
      command: "!tnt",
      type: "TNT",
      username: "Viewer123",
      youtubeMessageId: "yt_abc123",
      createdAt: 1757112345000,
      expiresAt: 1757112360000,
      priority: 2,
    };
    expect(evt.eventId).toBe("evt_10023");
    expect(evt.source).toBe("youtube");
  });

  it("supports admin and system sources without a username", () => {
    const admin: GameEvent = {
      eventId: "evt_a1",
      source: "admin",
      command: "",
      type: "RESET",
      createdAt: 0,
      expiresAt: 0,
      priority: 9,
    };
    const sys: GameEvent = {
      eventId: "evt_s1",
      source: "system",
      command: "",
      type: "TNT",
      createdAt: 0,
      expiresAt: 0,
      priority: 1,
    };
    expect(admin.username).toBeUndefined();
    expect(sys.username).toBeUndefined();
  });
});

describe("event acknowledgement (master spec §54)", () => {
  it("treats DELIVERED and EXECUTED as distinct states", () => {
    const delivered: GameEventAck = { eventId: "evt_1", state: "DELIVERED", at: 1 };
    const executed: GameEventAck = { eventId: "evt_1", state: "EXECUTED", at: 2 };
    expect(delivered.state).not.toBe(executed.state);
  });
});
