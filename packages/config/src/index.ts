import type { GameEventType } from "@mef/shared-types";

/**
 * Centralized configuration (master spec §81, §82).
 * All gameplay/network budgets live here — no magic numbers scattered in code.
 * Values are validated at startup; out-of-bounds values are rejected (§82).
 */

export interface GameConfig {
  /** Logical render resolution (master spec §7). */
  readonly width: number;
  readonly height: number;
  /** Chunk dimensions in blocks (master spec §81). */
  readonly chunkWidth: number;
  readonly chunkHeight: number;
  /** Block size in pixels. */
  readonly blockSizePx: number;
  /** Number of chunks kept active above/below the camera window. */
  readonly activeChunkWindow: number;
  /** Entity budgets (master spec §19, §124). */
  readonly maxActivePickaxes: number;
  readonly maxActiveTnt: number;
  readonly maxParticles: number;
  readonly maxNukeTnt: number;
  readonly maxNukeParticles: number;
  /** Cooldowns in ms for expensive events (master spec §30, §81). */
  readonly tntCooldownMs: number;
  readonly megaCooldownMs: number;
  readonly nukeCooldownMs: number;
  /** Modifier durations in ms (master spec §42, §44). */
  readonly fastDurationMs: number;
  readonly slowDurationMs: number;
  readonly luckyDurationMs: number;
  readonly blessDurationMs: number;
  /** Speed modifier bounds — never stack beyond these (master spec §42). */
  readonly maxSpeedMultiplier: number;
  readonly minSpeedMultiplier: number;
  /** Autonomous gameplay intervals in ms (master spec §114, §115). */
  readonly autoPickaxeIntervalMs: number;
  readonly autoTntIntervalMs: number;
}

export interface ServerConfig {
  readonly port: number;
  /** Socket.IO ping interval/timeout in ms. */
  readonly pingIntervalMs: number;
  readonly pingTimeoutMs: number;
  /** Event queue budgets (master spec §36, §124). */
  readonly maxQueueSize: number;
  readonly defaultEventTtlMs: number;
  /** Rate limits (master spec §40). */
  readonly perUserLimitPerMinute: number;
  readonly perCommandLimitPerMinute: number;
  readonly globalLimitPerMinute: number;
  /** Bounded dedupe cache size (master spec §39). */
  readonly dedupeCacheSize: number;
  /** Metrics broadcast interval in ms (master spec §122). */
  readonly metricsIntervalMs: number;
  /** Tokens required by phone/admin clients (master spec §52). */
  readonly gameToken: string;
  readonly adminToken: string;
}

/**
 * Command registry entries (master spec §32, §156).
 * Commands are data, not if/else chains. Parsing happens on the server.
 */
export interface CommandDefinition {
  readonly command: string;
  readonly type: GameEventType;
  /** Higher = more important; used for queue ordering (master spec §37). */
  readonly priority: number;
  /** Per-command cooldown in ms (master spec §40). */
  readonly cooldownMs: number;
}

/** Default gameplay configuration. Bounds are enforced by validateConfig. */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  width: 360,
  height: 640,
  chunkWidth: 8,
  chunkHeight: 32,
  blockSizePx: 32,
  activeChunkWindow: 4,
  maxActivePickaxes: 10,
  maxActiveTnt: 6,
  maxParticles: 300,
  maxNukeTnt: 6,
  maxNukeParticles: 200,
  tntCooldownMs: 3000,
  megaCooldownMs: 10000,
  nukeCooldownMs: 30000,
  fastDurationMs: 10000,
  slowDurationMs: 10000,
  luckyDurationMs: 15000,
  blessDurationMs: 15000,
  maxSpeedMultiplier: 2,
  minSpeedMultiplier: 0.5,
  autoPickaxeIntervalMs: 4000,
  autoTntIntervalMs: 30000,
} as const;

/** Default server configuration. Bounds are enforced by validateServerConfig. */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 3000,
  pingIntervalMs: 10000,
  pingTimeoutMs: 5000,
  maxQueueSize: 200,
  defaultEventTtlMs: 15000,
  perUserLimitPerMinute: 10,
  perCommandLimitPerMinute: 20,
  globalLimitPerMinute: 120,
  dedupeCacheSize: 1000,
  metricsIntervalMs: 2000,
  gameToken: "dev-game-token",
  adminToken: "dev-admin-token",
} as const;

/** The canonical chat command table (master spec §156). Single source of truth. */
export const COMMAND_REGISTRY: readonly CommandDefinition[] = [
  { command: "!tnt", type: "TNT", priority: 2, cooldownMs: 3000 },
  { command: "!mega", type: "MEGA_TNT", priority: 3, cooldownMs: 10000 },
  { command: "!nuke", type: "NUKE", priority: 4, cooldownMs: 30000 },
  { command: "!wood", type: "PICKAXE_WOOD", priority: 1, cooldownMs: 1000 },
  { command: "!stone", type: "PICKAXE_STONE", priority: 1, cooldownMs: 1000 },
  { command: "!iron", type: "PICKAXE_IRON", priority: 1, cooldownMs: 1000 },
  { command: "!gold", type: "PICKAXE_GOLD", priority: 1, cooldownMs: 1000 },
  { command: "!diamond", type: "PICKAXE_DIAMOND", priority: 1, cooldownMs: 1000 },
  { command: "!netherite", type: "PICKAXE_NETHERITE", priority: 1, cooldownMs: 1000 },
  { command: "!fast", type: "SPEED_FAST", priority: 2, cooldownMs: 5000 },
  { command: "!slow", type: "SPEED_SLOW", priority: 2, cooldownMs: 5000 },
  { command: "!lucky", type: "LUCKY", priority: 2, cooldownMs: 15000 },
  { command: "!bless", type: "BLESS", priority: 2, cooldownMs: 15000 },
  { command: "!blowup", type: "SMALL_EXPLOSION", priority: 2, cooldownMs: 5000 },
] as const;

/** Look up a command definition by exact chat command string. */
export function findCommand(command: string): CommandDefinition | undefined {
  return COMMAND_REGISTRY.find((c) => c.command === command.toLowerCase());
}

function isFinitePositive(n: unknown, allowZero = false): n is number {
  return typeof n === "number" && Number.isFinite(n) && (allowZero ? n >= 0 : n > 0);
}

/**
 * Validate a GameConfig (master spec §82).
 * @returns list of human-readable problems; empty means valid.
 */
export function validateGameConfig(config: GameConfig): string[] {
  const problems: string[] = [];
  if (!isFinitePositive(config.width) || config.width < 320) {
    problems.push("width must be a finite number >= 320");
  }
  if (!isFinitePositive(config.height) || config.height < 480) {
    problems.push("height must be a finite number >= 480");
  }
  if (!isFinitePositive(config.chunkWidth) || config.chunkWidth > 64) {
    problems.push("chunkWidth must be 1..64");
  }
  if (!isFinitePositive(config.chunkHeight) || config.chunkHeight > 256) {
    problems.push("chunkHeight must be 1..256");
  }
  if (!isFinitePositive(config.blockSizePx)) {
    problems.push("blockSizePx must be a finite positive number");
  }
  if (!isFinitePositive(config.activeChunkWindow) || config.activeChunkWindow > 16) {
    problems.push("activeChunkWindow must be 1..16");
  }
  const budgetChecks: Array<[number, string]> = [
    [config.maxActivePickaxes, "maxActivePickaxes"],
    [config.maxActiveTnt, "maxActiveTnt"],
    [config.maxParticles, "maxParticles"],
    [config.maxNukeTnt, "maxNukeTnt"],
    [config.maxNukeParticles, "maxNukeParticles"],
  ];
  for (const [value, name] of budgetChecks) {
    if (!isFinitePositive(value)) problems.push(`${name} must be a finite positive number`);
  }
  if (config.maxNukeTnt > config.maxActiveTnt) {
    problems.push("maxNukeTnt must not exceed maxActiveTnt");
  }
  const cooldownChecks: Array<[number, string]> = [
    [config.tntCooldownMs, "tntCooldownMs"],
    [config.megaCooldownMs, "megaCooldownMs"],
    [config.nukeCooldownMs, "nukeCooldownMs"],
  ];
  for (const [value, name] of cooldownChecks) {
    if (!isFinitePositive(value)) problems.push(`${name} must be a finite positive number`);
  }
  if (!isFinitePositive(config.maxSpeedMultiplier) || config.maxSpeedMultiplier < 1) {
    problems.push("maxSpeedMultiplier must be >= 1");
  }
  if (!isFinitePositive(config.minSpeedMultiplier) || config.minSpeedMultiplier > 1) {
    problems.push("minSpeedMultiplier must be <= 1 and > 0");
  }
  return problems;
}

/**
 * Validate a ServerConfig (master spec §82).
 * @returns list of human-readable problems; empty means valid.
 */
export function validateServerConfig(config: ServerConfig): string[] {
  const problems: string[] = [];
  if (!isFinitePositive(config.port) || config.port > 65535) {
    problems.push("port must be 1..65535");
  }
  if (!isFinitePositive(config.maxQueueSize)) problems.push("maxQueueSize must be positive");
  if (!isFinitePositive(config.defaultEventTtlMs)) {
    problems.push("defaultEventTtlMs must be positive");
  }
  const limitChecks: Array<[number, string]> = [
    [config.perUserLimitPerMinute, "perUserLimitPerMinute"],
    [config.perCommandLimitPerMinute, "perCommandLimitPerMinute"],
    [config.globalLimitPerMinute, "globalLimitPerMinute"],
  ];
  for (const [value, name] of limitChecks) {
    if (!isFinitePositive(value)) problems.push(`${name} must be a finite positive number`);
  }
  if (!isFinitePositive(config.dedupeCacheSize)) problems.push("dedupeCacheSize must be positive");
  if (config.gameToken.length === 0) problems.push("gameToken must not be empty");
  if (config.adminToken.length === 0) problems.push("adminToken must not be empty");
  if (config.gameToken === config.adminToken) {
    problems.push("gameToken and adminToken must differ");
  }
  return problems;
}

/** Throw if the given config is invalid; returns the config unchanged otherwise. */
export function assertValidGameConfig(config: GameConfig = DEFAULT_GAME_CONFIG): GameConfig {
  const problems = validateGameConfig(config);
  if (problems.length > 0) {
    throw new Error(`Invalid game config:\n  - ${problems.join("\n  - ")}`);
  }
  return config;
}

/** Throw if the given server config is invalid; returns the config unchanged otherwise. */
export function assertValidServerConfig(config: ServerConfig = DEFAULT_SERVER_CONFIG): ServerConfig {
  const problems = validateServerConfig(config);
  if (problems.length > 0) {
    throw new Error(`Invalid server config:\n  - ${problems.join("\n  - ")}`);
  }
  return config;
}
