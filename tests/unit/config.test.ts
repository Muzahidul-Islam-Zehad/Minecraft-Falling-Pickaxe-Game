import { describe, expect, it } from "vitest";
import {
  assertValidGameConfig,
  assertValidServerConfig,
  COMMAND_REGISTRY,
  DEFAULT_GAME_CONFIG,
  DEFAULT_SERVER_CONFIG,
  findCommand,
  validateGameConfig,
  validateServerConfig,
} from "@mef/config";

/** Phase 1 unit tests (master spec §84 subset): config validation + command registry. */

describe("game config validation (master spec §82)", () => {
  it("accepts the default config", () => {
    expect(validateGameConfig(DEFAULT_GAME_CONFIG)).toEqual([]);
    expect(() => assertValidGameConfig(DEFAULT_GAME_CONFIG)).not.toThrow();
  });

  it("rejects negative entity budgets", () => {
    const bad = { ...DEFAULT_GAME_CONFIG, maxActivePickaxes: -100 };
    expect(validateGameConfig(bad).length).toBeGreaterThan(0);
    expect(() => assertValidGameConfig(bad)).toThrow(/maxActivePickaxes/);
  });

  it("rejects nuke budget exceeding tnt budget", () => {
    const bad = { ...DEFAULT_GAME_CONFIG, maxNukeTnt: 99 };
    expect(validateGameConfig(bad)).toContain("maxNukeTnt must not exceed maxActiveTnt");
  });

  it("rejects invalid speed multiplier bounds", () => {
    expect(validateGameConfig({ ...DEFAULT_GAME_CONFIG, maxSpeedMultiplier: 0.5 }).length).toBeGreaterThan(0);
    expect(validateGameConfig({ ...DEFAULT_GAME_CONFIG, minSpeedMultiplier: 2 }).length).toBeGreaterThan(0);
  });

  it("rejects tiny resolutions", () => {
    expect(validateGameConfig({ ...DEFAULT_GAME_CONFIG, width: 100 }).length).toBeGreaterThan(0);
  });
});

describe("server config validation (master spec §82)", () => {
  it("accepts the default config", () => {
    expect(validateServerConfig(DEFAULT_SERVER_CONFIG)).toEqual([]);
    expect(() => assertValidServerConfig(DEFAULT_SERVER_CONFIG)).not.toThrow();
  });

  it("rejects out-of-range ports", () => {
    expect(validateServerConfig({ ...DEFAULT_SERVER_CONFIG, port: 99999 }).length).toBeGreaterThan(0);
    expect(validateServerConfig({ ...DEFAULT_SERVER_CONFIG, port: -1 }).length).toBeGreaterThan(0);
  });

  it("rejects empty or identical tokens", () => {
    expect(
      validateServerConfig({ ...DEFAULT_SERVER_CONFIG, gameToken: "" }).length,
    ).toBeGreaterThan(0);
    expect(
      validateServerConfig({
        ...DEFAULT_SERVER_CONFIG,
        adminToken: DEFAULT_SERVER_CONFIG.gameToken,
      }).length,
    ).toBeGreaterThan(0);
  });
});

describe("command registry (master spec §32, §156)", () => {
  it("registers every canonical command", () => {
    const expected = [
      "!tnt", "!mega", "!nuke",
      "!wood", "!stone", "!iron", "!gold", "!diamond", "!netherite",
      "!fast", "!slow", "!lucky", "!bless", "!blowup",
    ];
    expect(COMMAND_REGISTRY.map((c) => c.command)).toEqual(expected);
  });

  it("maps commands to the correct event types", () => {
    expect(findCommand("!tnt")?.type).toBe("TNT");
    expect(findCommand("!mega")?.type).toBe("MEGA_TNT");
    expect(findCommand("!nuke")?.type).toBe("NUKE");
    expect(findCommand("!diamond")?.type).toBe("PICKAXE_DIAMOND");
    expect(findCommand("!blowup")?.type).toBe("SMALL_EXPLOSION");
  });

  it("is case-insensitive and rejects unknown commands", () => {
    expect(findCommand("!TNT")?.type).toBe("TNT");
    expect(findCommand("!tnt 999999")).toBeUndefined();
    expect(findCommand("!spawn")).toBeUndefined();
  });

  it("gives expensive commands higher priority and cooldowns", () => {
    expect(findCommand("!nuke")!.priority).toBeGreaterThan(findCommand("!tnt")!.priority);
    expect(findCommand("!nuke")!.cooldownMs).toBeGreaterThan(findCommand("!tnt")!.cooldownMs);
  });
});
