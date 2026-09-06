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
  /** Camera shake budgets (master spec §22): no unbounded duration/intensity. */
  readonly shakeDurationMaxMs: number;
  readonly shakeIntensityMaxPx: number;
  /** Chunk generation budget: max chunks generated per frame (§77, §21). */
  readonly maxChunkGenerationsPerFrame: number;
  /** Block regen (§14): starts after first hit, after delay, ~20% HP per interval. */
  readonly blockRegenDelayMs: number;
  readonly blockRegenIntervalMs: number;
  readonly blockRegenFraction: number;
  /** Pickaxe physics caps (§17, §70): no infinite velocities/rotation. */
  readonly pickaxeMaxVelocityPxPerSec: number;
  readonly pickaxeMaxAngularVelocityDegPerSec: number;
  /** Pickaxe lifetime (§16): pooled entities must eventually return to the pool (§20). */
  readonly pickaxeLifetimeMs: number;
  /** Spawn safety (§23): spawn above the camera top by this margin. */
  readonly pickaxeSpawnMarginPx: number;
  /** Min ms between collisions for one pickaxe (§18: avoid multi-hits per frame). */
  readonly pickaxeHitCooldownMs: number;
  /** Mining speed (§18): pickaxe deals `damage × hitsPerSecond` per second in contact. */
  readonly pickaxeMiningHitsPerSecond: number;
  /** Camera lookahead below the base pickaxe (§22): show where it is heading. */
  readonly pickaxeCameraLookaheadPx: number;
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

/**
 * Block types (master spec §11). Data-driven definitions below; behavior must never be
 * a hard-coded if/else chain on these ids (§11, §104).
 */
export type BlockType =
  | "bedrock"
  | "stone"
  | "andesite"
  | "diorite"
  | "granite"
  | "coal"
  | "iron"
  | "copper"
  | "redstone"
  | "lapis"
  | "gold"
  | "diamond"
  | "emerald"
  | "obsidian"
  | "mossy_cobblestone"
  | "cobblestone"
  | "dirt"
  | "grass";

/** Reward granted when a block is destroyed (§13). */
export interface RewardDefinition {
  readonly item: string;
  readonly amount: number;
}

/** Data-driven block definition (master spec §11). */
export interface BlockDefinition {
  readonly id: BlockType;
  /** Hit points (master spec §12). Starting values, not sacred. */
  readonly hp: number;
  /** Relative generation weight; 0 = never generates naturally (e.g. bedrock). */
  readonly rarity: number;
  /** Preloaded texture key (§73) — created once in PreloadScene, never per frame. */
  readonly textureKey: string;
  readonly reward?: RewardDefinition;
}

/**
 * Block catalog (master spec §11, §12).
 * HP values: bedrock 1e9, stone/andesite/diorite/granite 10, ores 15, gold/diamond/emerald 20,
 * obsidian 100, mossy 12, cobblestone 22. dirt/grass are soft extras (balance later, §12).
 */
export const BLOCK_DEFINITIONS: readonly BlockDefinition[] = [
  { id: "bedrock", hp: 1_000_000_000, rarity: 0, textureKey: "block-bedrock" },
  { id: "stone", hp: 10, rarity: 100, textureKey: "block-stone" },
  { id: "andesite", hp: 10, rarity: 18, textureKey: "block-andesite" },
  { id: "diorite", hp: 10, rarity: 18, textureKey: "block-diorite" },
  { id: "granite", hp: 10, rarity: 18, textureKey: "block-granite" },
  { id: "coal", hp: 15, rarity: 14, textureKey: "block-coal", reward: { item: "coal", amount: 1 } },
  { id: "iron", hp: 15, rarity: 12, textureKey: "block-iron", reward: { item: "iron", amount: 1 } },
  { id: "copper", hp: 15, rarity: 12, textureKey: "block-copper", reward: { item: "copper", amount: 1 } },
  { id: "redstone", hp: 15, rarity: 8, textureKey: "block-redstone", reward: { item: "redstone", amount: 1 } },
  { id: "lapis", hp: 15, rarity: 8, textureKey: "block-lapis", reward: { item: "lapis", amount: 1 } },
  { id: "gold", hp: 20, rarity: 6, textureKey: "block-gold", reward: { item: "gold", amount: 1 } },
  { id: "diamond", hp: 20, rarity: 4, textureKey: "block-diamond", reward: { item: "diamond", amount: 1 } },
  { id: "emerald", hp: 20, rarity: 2, textureKey: "block-emerald", reward: { item: "emerald", amount: 1 } },
  { id: "obsidian", hp: 100, rarity: 3, textureKey: "block-obsidian" },
  { id: "mossy_cobblestone", hp: 12, rarity: 6, textureKey: "block-mossy" },
  { id: "cobblestone", hp: 22, rarity: 0, textureKey: "block-cobblestone" },
  { id: "dirt", hp: 5, rarity: 10, textureKey: "block-dirt" },
  { id: "grass", hp: 6, rarity: 0, textureKey: "block-grass" },
] as const;

/** Fast id -> definition lookup, built once at module load. */
export const BLOCK_BY_ID: ReadonlyMap<BlockType, BlockDefinition> = new Map(
  BLOCK_DEFINITIONS.map((b) => [b.id, b]),
);

/** Default gameplay configuration. Bounds are enforced by validateGameConfig. */
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
  shakeDurationMaxMs: 1200,
  shakeIntensityMaxPx: 12,
  maxChunkGenerationsPerFrame: 1,
  blockRegenDelayMs: 3000,
  blockRegenIntervalMs: 5000,
  blockRegenFraction: 0.2,
  pickaxeMaxVelocityPxPerSec: 700,
  pickaxeMaxAngularVelocityDegPerSec: 540,
  pickaxeLifetimeMs: 45000,
  pickaxeSpawnMarginPx: 60,
  pickaxeHitCooldownMs: 120,
  pickaxeMiningHitsPerSecond: 4,
  pickaxeCameraLookaheadPx: 140,
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
  if (!isFinitePositive(config.shakeDurationMaxMs)) {
    problems.push("shakeDurationMaxMs must be a finite positive number");
  }
  if (!isFinitePositive(config.shakeIntensityMaxPx)) {
    problems.push("shakeIntensityMaxPx must be a finite positive number");
  }
  if (!isFinitePositive(config.maxChunkGenerationsPerFrame)) {
    problems.push("maxChunkGenerationsPerFrame must be a finite positive number");
  }
  if (!isFinitePositive(config.blockRegenDelayMs)) {
    problems.push("blockRegenDelayMs must be a finite positive number");
  }
  if (!isFinitePositive(config.blockRegenIntervalMs)) {
    problems.push("blockRegenIntervalMs must be a finite positive number");
  }
  if (
    typeof config.blockRegenFraction !== "number" ||
    !Number.isFinite(config.blockRegenFraction) ||
    config.blockRegenFraction <= 0 ||
    config.blockRegenFraction > 1
  ) {
    problems.push("blockRegenFraction must be in (0, 1]");
  }
  const pickaxeChecks: Array<[number, string]> = [
    [config.pickaxeMaxVelocityPxPerSec, "pickaxeMaxVelocityPxPerSec"],
    [config.pickaxeMaxAngularVelocityDegPerSec, "pickaxeMaxAngularVelocityDegPerSec"],
    [config.pickaxeLifetimeMs, "pickaxeLifetimeMs"],
    [config.pickaxeSpawnMarginPx, "pickaxeSpawnMarginPx"],
    [config.pickaxeHitCooldownMs, "pickaxeHitCooldownMs"],
  ];
  for (const [value, name] of pickaxeChecks) {
    if (!isFinitePositive(value)) problems.push(`${name} must be a finite positive number`);
  }
  if (!isFinitePositive(config.pickaxeMiningHitsPerSecond)) {
    problems.push("pickaxeMiningHitsPerSecond must be a finite positive number");
  }
  if (!isFinitePositive(config.pickaxeCameraLookaheadPx)) {
    problems.push("pickaxeCameraLookaheadPx must be a finite positive number");
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

/**
 * Pickaxe tiers (master spec §16). One system, tier data only — no per-tier code (§104).
 */
export type PickaxeTier = "wood" | "stone" | "iron" | "gold" | "diamond" | "netherite";

export interface PickaxeDefinition {
  readonly tier: PickaxeTier;
  /** Damage per hit against blocks (master spec §16 reference values). */
  readonly damage: number;
  /** Preloaded texture key (§73). */
  readonly textureKey: string;
}

export const PICKAXE_DEFINITIONS: readonly PickaxeDefinition[] = [
  { tier: "wood", damage: 2, textureKey: "pickaxe-wood" },
  { tier: "stone", damage: 4, textureKey: "pickaxe-stone" },
  { tier: "iron", damage: 6, textureKey: "pickaxe-iron" },
  { tier: "gold", damage: 8, textureKey: "pickaxe-gold" },
  { tier: "diamond", damage: 10, textureKey: "pickaxe-diamond" },
  { tier: "netherite", damage: 12, textureKey: "pickaxe-netherite" },
] as const;

export const PICKAXE_BY_TIER: ReadonlyMap<PickaxeTier, PickaxeDefinition> = new Map(
  PICKAXE_DEFINITIONS.map((p) => [p.tier, p]),
);

/**
 * Validate the pickaxe catalog (master spec §16, §136).
 * @returns list of human-readable problems; empty means valid.
 */
export function validatePickaxeDefinitions(
  defs: readonly PickaxeDefinition[] = PICKAXE_DEFINITIONS,
): string[] {
  const problems: string[] = [];
  const tiers = new Set<PickaxeTier>();
  let previousDamage = 0;
  for (const d of defs) {
    if (!isFinitePositive(d.damage)) problems.push(`${d.tier}: damage must be finite positive`);
    if (d.damage <= previousDamage) {
      problems.push(`${d.tier}: damage must strictly increase with tier (§16 ordering)`);
    }
    previousDamage = d.damage;
    if (d.textureKey.length === 0) problems.push(`${d.tier}: textureKey must not be empty`);
    if (tiers.has(d.tier)) problems.push(`${d.tier}: duplicate tier`);
    tiers.add(d.tier);
  }
  return problems;
}

/**
 * Validate the block catalog (master spec §11, §136: valid block types before activation).
 * @returns list of human-readable problems; empty means valid.
 */
export function validateBlockDefinitions(
  defs: readonly BlockDefinition[] = BLOCK_DEFINITIONS,
): string[] {
  const problems: string[] = [];
  const seen = new Set<BlockType>();
  for (const d of defs) {
    if (!isFinitePositive(d.hp)) problems.push(`${d.id}: hp must be a finite positive number`);
    if (typeof d.rarity !== "number" || !Number.isFinite(d.rarity) || d.rarity < 0) {
      problems.push(`${d.id}: rarity must be a finite number >= 0`);
    }
    if (d.textureKey.length === 0) problems.push(`${d.id}: textureKey must not be empty`);
    if (seen.has(d.id)) problems.push(`${d.id}: duplicate block id`);
    seen.add(d.id);
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
