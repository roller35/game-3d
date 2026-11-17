export type GameMode =
  | 'campaign'
  | 'endless'
  | 'time_attack'
  | 'army_survival'
  | 'hardcore'
  | 'boss_rush'
  | 'challenge';

export type WorldId =
  | 'green_hills'
  | 'modern_city'
  | 'desert'
  | 'snow'
  | 'volcanic'
  | 'futuristic';

export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'extreme';

export type GamePhase =
  | 'title'
  | 'playing'
  | 'paused'
  | 'final_battle'
  | 'victory'
  | 'defeat';

export type FormationType =
  | 'compact'
  | 'wide'
  | 'defensive'
  | 'narrow_bridge'
  | 'boss_battle';

export type CharacterAnimState =
  | 'idle'
  | 'running'
  | 'walking'
  | 'jumping'
  | 'dodging'
  | 'falling'
  | 'celebrating'
  | 'attacking'
  | 'victory'
  | 'defeat';

export type SkinId =
  | 'classic_blue'
  | 'crimson_red'
  | 'royal_gold'
  | 'cyber_robot'
  | 'shadow_ninja'
  | 'neon_futuristic'
  | 'heavy_armored';

export type UpgradeId =
  | 'starting_crowd'
  | 'coin_bonus'
  | 'agility'
  | 'recovery_shield'
  | 'starting_multiplier';

export type GateOp = 'add' | 'mul' | 'sub' | 'mystery';

export type GateBehavior =
  | 'static'
  | 'moving'
  | 'timed'
  | 'closing'
  | 'risk_reward';

export interface GateSpec {
  id: string;
  z: number;
  x: number; // center X
  width: number;
  op: GateOp;
  value: number;
  behavior: GateBehavior;
  moveAmplitude?: number;
  moveSpeed?: number;
  cyclePeriod?: number;
  label?: string;
}

export type ObstacleKind =
  | 'concrete_wall'
  | 'barrier'
  | 'pillar'
  | 'roadblock'
  | 'narrow_opening'
  | 'fixed_trap'
  | 'rotating_hammer'
  | 'swinging_pendulum'
  | 'moving_wall'
  | 'sliding_barrier'
  | 'rotating_blade'
  | 'narrow_bridge'
  | 'broken_bridge'
  | 'gap'
  | 'collapsing_platform'
  | 'moving_platform'
  | 'disappearing_platform'
  | 'zigzag_bridge'
  | 'lava_hazard'
  | 'water_zone'
  | 'ice_surface'
  | 'wind_zone';

export interface ObstacleSpec {
  id: string;
  kind: ObstacleKind;
  z: number;
  x: number;
  width: number;
  length: number;
  height?: number;
  damage: number; // base crowd units lost on hit
  speed?: number;
  amplitude?: number;
  phase?: number;
  gapWidth?: number; // for narrow_opening / broken_bridge
  sideOffset?: number;
}

export type EnemyArchetype =
  | 'small_squad'
  | 'large_swarm'
  | 'fast_raiders'
  | 'defensive_phalanx'
  | 'elite_guard'
  | 'armored_unit';

export interface EnemySquadSpec {
  id: string;
  archetype: EnemyArchetype;
  z: number;
  x: number;
  count: number;
  patrolAmplitude?: number;
  patrolSpeed?: number;
  guardingGate?: boolean;
}

export interface CollectibleSpec {
  id: string;
  type: 'recruit' | 'coin';
  z: number;
  x: number;
  value: number;
}

export interface RouteChoiceSpec {
  id: string;
  z: number;
  length: number;
  routes: {
    laneX: number;
    width: number;
    riskLabel: 'SAFE' | 'RISKY' | 'EXTREME';
    gateOp: GateOp;
    gateValue: number;
    obstacles: ObstacleKind[];
  }[];
}

export type BossArchetype =
  | 'giant_formation'
  | 'fortress_defense'
  | 'armored_colossus'
  | 'multi_wave_legion'
  | 'arena_champion'
  | 'giant_robot'
  | 'enemy_commander'
  | 'moving_fortress'
  | 'heavy_armored_crowd'
  | 'multi_stage_overlord';

export interface BossConfig {
  archetype: BossArchetype;
  name: string;
  maxHp: number;
  powerRating: number; // effective enemy count / armor threshold
  waves: number;
  attackInterval: number;
  attackDamage: number;
  rewardMultiplier: number;
}

export interface LevelConfig {
  id: number; // 1..50
  world: WorldId;
  name: string;
  subtitle: string;
  length: number;
  trackWidth: number;
  startCrowd: number;
  baseSpeed: number;
  gates: GateSpec[];
  obstacles: ObstacleSpec[];
  enemies: EnemySquadSpec[];
  collectibles: CollectibleSpec[];
  routeChoices: RouteChoiceSpec[];
  finalArenaEnemyCount: number;
  boss?: BossConfig;
  baseCoinReward: number;
  timeLimitSec?: number; // used in time_attack / challenge
  bonusObjective?: ChallengeObjective;
}

export interface ChallengeObjective {
  id: string;
  title: string;
  description: string;
  type:
    | 'min_finish_crowd'
    | 'max_crowd_lost'
    | 'time_limit'
    | 'defeat_larger_army'
    | 'choose_risky_route';
  targetValue: number;
  levelId: number;
  rewardCoins: number;
}

export interface SkinDefinition {
  id: SkinId;
  name: string;
  description: string;
  cost: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  visorColor: number;
  metalness: number;
  roughness: number;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costScale: number;
  effectPerLevel: string;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  metric:
    | 'levels_completed'
    | 'max_crowd'
    | 'endless_distance'
    | 'bosses_defeated'
    | 'skins_owned';
  target: number;
}

export interface GameSettings {
  difficulty: DifficultyLevel;
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  maxVisibleCrowd: number; // adaptive mobile perf cap (60..240)
  shadowsEnabled: boolean;
}

export interface SaveData {
  version: number;
  unlockedLevel: number;
  completedLevels: number[];
  completedChallenges: string[];
  claimedAchievements: string[];
  coins: number;
  selectedSkin: SkinId;
  ownedSkins: SkinId[];
  upgrades: Record<UpgradeId, number>;
  bestEndlessDistance: number;
  highestCrowdRecord: number;
  bossesDefeated: number;
  unlockedWorlds: WorldId[];
  lastDailyClaimDate: string; // YYYY-MM-DD
  dailyStreak: number;
  settings: GameSettings;
}

export interface DifficultyParams {
  speedMultiplier: number;
  damageMultiplier: number;
  enemyMultiplier: number;
  gateBonusMultiplier: number;
  bossHpMultiplier: number;
}

export interface RunStats {
  mode: GameMode;
  levelId: number;
  world: WorldId;
  crowdCount: number;
  peakCrowd: number;
  crowdLost: number;
  enemyTargetCount: number;
  distance: number;
  totalLength: number;
  progress: number; // 0..1
  elapsedSec: number;
  timeRemainingSec: number | null;
  coinsEarned: number;
  riskyRoutesTaken: number;
  bossHp: number;
  bossMaxHp: number;
  bossName: string;
  bossWarning: string;
  bossWave: number;
  bossTotalWaves: number;
  formation: FormationType;
  objectiveText: string;
  lastGateText: string;
  lastGateColor: 'gold' | 'red' | 'cyan';
  defeatReason: string;
  bonusObjectiveMet: boolean;
  bossDefeated: boolean;
}

export interface WorldTheme {
  id: WorldId;
  name: string;
  levelRange: string;
  skyTop: number;
  skyHorizon: number;
  fogColor: number;
  groundColor: number;
  trackColor: number;
  trackEdgeColor: number;
  accentPropColor: number;
  sunColor: number;
  hemiSky: number;
  hemiGround: number;
  hazardType: 'water' | 'traffic' | 'quicksand' | 'ice' | 'lava' | 'laser';
}
