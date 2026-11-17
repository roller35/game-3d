import type {
  BossConfig,
  ChallengeObjective,
  DifficultyLevel,
  DifficultyParams,
  GateOp,
  SaveData,
  SkinId,
  UpgradeId,
  WorldId,
} from './types';

export const MAX_CROWD_COUNT = 9999;

export const SAVE_VERSION = 1;

export const WORLD_ORDER: WorldId[] = [
  'green_hills',
  'modern_city',
  'desert',
  'snow',
  'volcanic',
  'futuristic',
];

export const DEFAULT_SAVE_DATA: SaveData = {
  version: SAVE_VERSION,
  unlockedLevel: 1,
  completedLevels: [],
  completedChallenges: [],
  claimedAchievements: [],
  coins: 150,
  selectedSkin: 'classic_blue',
  ownedSkins: ['classic_blue'],
  upgrades: {
    starting_crowd: 0,
    coin_bonus: 0,
    agility: 0,
    recovery_shield: 0,
    starting_multiplier: 0,
  },
  bestEndlessDistance: 0,
  highestCrowdRecord: 10,
  bossesDefeated: 0,
  unlockedWorlds: ['green_hills'],
  lastDailyClaimDate: '',
  dailyStreak: 0,
  settings: {
    difficulty: 'normal',
    musicVolume: 0.45,
    sfxVolume: 0.75,
    muted: false,
    maxVisibleCrowd: 180,
    shadowsEnabled: true,
  },
};

/**
 * Pure gate calculation with overflow cap & floor protection.
 * Example from spec: 10 -> +99 = 109 -> x2 = 218 -> +50 = 268.
 */
export function applyGateOperation(
  currentCrowd: number,
  op: GateOp,
  value: number,
  mysterySeed = 0.5,
  maxCrowd = MAX_CROWD_COUNT,
): { nextCrowd: number; delta: number; resolvedLabel: string } {
  const safeCurrent = Math.max(0, Math.floor(currentCrowd));
  const safeValue = Math.max(0, Math.floor(value));
  let next = safeCurrent;
  let resolvedLabel = '';

  switch (op) {
    case 'add': {
      next = safeCurrent + safeValue;
      resolvedLabel = `+${safeValue}`;
      break;
    }
    case 'mul': {
      const mult = Math.max(1, safeValue);
      next = safeCurrent * mult;
      resolvedLabel = `×${mult}`;
      break;
    }
    case 'sub': {
      next = Math.max(0, safeCurrent - safeValue);
      resolvedLabel = `-${safeValue}`;
      break;
    }
    case 'mystery': {
      // Deterministic given mysterySeed in [0, 1)
      if (mysterySeed < 0.25) {
        const bonus = 25;
        next = safeCurrent + bonus;
        resolvedLabel = `? +${bonus}`;
      } else if (mysterySeed < 0.55) {
        next = safeCurrent * 2;
        resolvedLabel = `? ×2`;
      } else if (mysterySeed < 0.8) {
        const bonus = Math.max(15, safeValue);
        next = safeCurrent + bonus;
        resolvedLabel = `? +${bonus}`;
      } else {
        const penalty = Math.min(12, Math.floor(safeCurrent * 0.2));
        next = Math.max(1, safeCurrent - penalty);
        resolvedLabel = `? -${penalty}`;
      }
      break;
    }
  }

  next = Math.min(maxCrowd, Math.max(0, Math.floor(next)));
  return {
    nextCrowd: next,
    delta: next - safeCurrent,
    resolvedLabel,
  };
}

/**
 * Computes starting crowd after upgrades, difficulty, and game mode.
 */
export function computeStartingCrowd(
  baseLevelStart: number,
  upgrades: Record<UpgradeId, number>,
  mode: string,
  difficulty: DifficultyLevel,
): number {
  const crowdUpgrade = (upgrades.starting_crowd ?? 0) * 3;
  const multUpgrade = 1 + (upgrades.starting_multiplier ?? 0) * 0.1;
  let total = Math.round((baseLevelStart + crowdUpgrade) * multUpgrade);

  if (mode === 'hardcore') {
    total = Math.max(4, Math.floor(baseLevelStart * 0.55));
  } else if (difficulty === 'easy') {
    total = Math.round(total * 1.2);
  } else if (difficulty === 'extreme') {
    total = Math.max(5, Math.round(total * 0.85));
  }

  return Math.min(MAX_CROWD_COUNT, Math.max(1, total));
}

/**
 * Multi-knob DifficultyManager rules.
 */
export function computeDifficultyParams(
  difficulty: DifficultyLevel,
  levelNumber: number,
  endlessDistance = 0,
): DifficultyParams {
  const diffBase: Record<DifficultyLevel, DifficultyParams> = {
    easy: {
      speedMultiplier: 0.9,
      damageMultiplier: 0.72,
      enemyMultiplier: 0.8,
      gateBonusMultiplier: 1.15,
      bossHpMultiplier: 0.8,
    },
    normal: {
      speedMultiplier: 1.0,
      damageMultiplier: 1.0,
      enemyMultiplier: 1.0,
      gateBonusMultiplier: 1.0,
      bossHpMultiplier: 1.0,
    },
    hard: {
      speedMultiplier: 1.08,
      damageMultiplier: 1.25,
      enemyMultiplier: 1.22,
      gateBonusMultiplier: 0.95,
      bossHpMultiplier: 1.25,
    },
    extreme: {
      speedMultiplier: 1.16,
      damageMultiplier: 1.5,
      enemyMultiplier: 1.45,
      gateBonusMultiplier: 0.85,
      bossHpMultiplier: 1.55,
    },
  };

  const base = diffBase[difficulty];
  const levelFactor = Math.min(0.45, Math.max(0, levelNumber - 1) * 0.009);
  const endlessFactor = Math.min(0.6, Math.max(0, endlessDistance) / 1400);
  const combinedRamp = levelFactor + endlessFactor;

  return {
    speedMultiplier: Number(
      (base.speedMultiplier * (1 + Math.min(0.24, combinedRamp * 0.35))).toFixed(3),
    ),
    damageMultiplier: Number(
      (base.damageMultiplier * (1 + combinedRamp * 0.5)).toFixed(3),
    ),
    enemyMultiplier: Number(
      (base.enemyMultiplier * (1 + combinedRamp * 0.65)).toFixed(3),
    ),
    gateBonusMultiplier: base.gateBonusMultiplier,
    bossHpMultiplier: Number(
      (base.bossHpMultiplier * (1 + levelFactor * 0.5)).toFixed(3),
    ),
  };
}

/**
 * Deterministic crowd clash / final battle resolution.
 */
export function resolveFinalBattle(
  playerCrowd: number,
  enemyCount: number,
  boss?: BossConfig,
  shieldLevel = 0,
): {
  victory: boolean;
  survivingPlayer: number;
  survivingEnemy: number;
  effectiveEnemyPower: number;
} {
  const safePlayer = Math.max(0, Math.floor(playerCrowd));
  const shieldMultiplier = 1 + Math.max(0, shieldLevel) * 0.06;
  const effectivePlayerPower = Math.floor(safePlayer * shieldMultiplier);

  const effectiveEnemyPower = boss
    ? Math.max(1, Math.floor(enemyCount + boss.powerRating * 0.6))
    : Math.max(1, Math.floor(enemyCount));

  if (effectivePlayerPower > effectiveEnemyPower) {
    const ratioLost = effectiveEnemyPower / Math.max(1, effectivePlayerPower);
    const casualties = Math.min(
      safePlayer - 1,
      Math.max(1, Math.floor(safePlayer * ratioLost * 0.72)),
    );
    return {
      victory: true,
      survivingPlayer: Math.max(1, safePlayer - casualties),
      survivingEnemy: 0,
      effectiveEnemyPower,
    };
  }

  const remainingEnemy = Math.max(1, effectiveEnemyPower - effectivePlayerPower);
  return {
    victory: false,
    survivingPlayer: 0,
    survivingEnemy: remainingEnemy,
    effectiveEnemyPower,
  };
}

export function getUpgradeCost(
  baseCost: number,
  costScale: number,
  currentLevel: number,
): number {
  return Math.round(baseCost * Math.pow(costScale, currentLevel));
}

export function calculateLevelCoinReward(params: {
  baseReward: number;
  survivingCrowd: number;
  coinUpgradeLevel: number;
  bossMultiplier?: number;
  objectiveMet?: boolean;
  objectiveBonus?: number;
}): number {
  const crowdBonus = Math.min(250, Math.floor(params.survivingCrowd * 0.4));
  const upgradeMult = 1 + Math.max(0, params.coinUpgradeLevel) * 0.15;
  const bossMult = params.bossMultiplier ?? 1;
  const objBonus = params.objectiveMet ? params.objectiveBonus ?? 0 : 0;
  return Math.round((params.baseReward + crowdBonus) * upgradeMult * bossMult + objBonus);
}

export function evaluateChallengeObjective(
  objective: ChallengeObjective,
  stats: {
    victory: boolean;
    crowdCount: number;
    crowdLost: number;
    elapsedSec: number;
    riskyRoutesTaken: number;
    enemyTargetCount: number;
    startCrowd: number;
  },
): boolean {
  if (!stats.victory) return false;
  switch (objective.type) {
    case 'min_finish_crowd':
      return stats.crowdCount >= objective.targetValue;
    case 'max_crowd_lost':
      return stats.crowdLost <= objective.targetValue;
    case 'time_limit':
      return stats.elapsedSec <= objective.targetValue;
    case 'choose_risky_route':
      return stats.riskyRoutesTaken >= objective.targetValue;
    case 'defeat_larger_army':
      return stats.enemyTargetCount > stats.startCrowd;
    default:
      return false;
  }
}

export function getWorldForLevel(levelId: number): WorldId {
  if (levelId <= 8) return 'green_hills';
  if (levelId <= 16) return 'modern_city';
  if (levelId <= 24) return 'desert';
  if (levelId <= 32) return 'snow';
  if (levelId <= 40) return 'volcanic';
  return 'futuristic';
}

export function canClaimDailyReward(
  lastClaimDate: string,
  todayDate: string,
): boolean {
  return lastClaimDate !== todayDate;
}

export function computeDailyRewardAmount(nextStreak: number): number {
  const clamped = Math.max(1, Math.min(7, nextStreak));
  return 75 + (clamped - 1) * 35;
}

export function sanitizeSaveData(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_SAVE_DATA);
  }
  const obj = raw as Record<string, unknown>;
  const validSkins: SkinId[] = [
    'classic_blue',
    'crimson_red',
    'royal_gold',
    'cyber_robot',
    'shadow_ninja',
    'neon_futuristic',
    'heavy_armored',
  ];

  const ownedSkins = Array.isArray(obj.ownedSkins)
    ? obj.ownedSkins.filter((s): s is SkinId =>
        validSkins.includes(s as SkinId),
      )
    : ['classic_blue' as SkinId];
  if (!ownedSkins.includes('classic_blue')) {
    ownedSkins.unshift('classic_blue');
  }

  const selectedSkin =
    typeof obj.selectedSkin === 'string' &&
    ownedSkins.includes(obj.selectedSkin as SkinId)
      ? (obj.selectedSkin as SkinId)
      : 'classic_blue';

  const rawUpgrades =
    obj.upgrades && typeof obj.upgrades === 'object'
      ? (obj.upgrades as Record<string, unknown>)
      : {};

  const clampUpgrade = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.max(0, Math.min(10, Math.floor(v)))
      : 0;

  const rawSettings =
    obj.settings && typeof obj.settings === 'object'
      ? (obj.settings as Record<string, unknown>)
      : {};

  const validDiff: DifficultyLevel[] = ['easy', 'normal', 'hard', 'extreme'];
  const difficulty = validDiff.includes(rawSettings.difficulty as DifficultyLevel)
    ? (rawSettings.difficulty as DifficultyLevel)
    : 'normal';

  const unlockedLevel =
    typeof obj.unlockedLevel === 'number' && Number.isFinite(obj.unlockedLevel)
      ? Math.max(1, Math.min(50, Math.floor(obj.unlockedLevel)))
      : 1;

  const unlockedWorlds = Array.isArray(obj.unlockedWorlds)
    ? obj.unlockedWorlds.filter((w): w is WorldId =>
        WORLD_ORDER.includes(w as WorldId),
      )
    : ['green_hills' as WorldId];
  if (!unlockedWorlds.includes('green_hills')) {
    unlockedWorlds.unshift('green_hills');
  }

  // Ensure worlds matching unlockedLevel are unlocked
  const maxWorld = getWorldForLevel(unlockedLevel);
  const maxWorldIdx = WORLD_ORDER.indexOf(maxWorld);
  for (let i = 0; i <= maxWorldIdx; i++) {
    if (!unlockedWorlds.includes(WORLD_ORDER[i])) {
      unlockedWorlds.push(WORLD_ORDER[i]);
    }
  }

  return {
    version: SAVE_VERSION,
    unlockedLevel,
    completedLevels: Array.isArray(obj.completedLevels)
      ? Array.from(
          new Set(
            obj.completedLevels.filter(
              (n): n is number =>
                typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 50,
            ),
          ),
        )
      : [],
    completedChallenges: Array.isArray(obj.completedChallenges)
      ? Array.from(
          new Set(
            obj.completedChallenges.filter(
              (c): c is string => typeof c === 'string',
            ),
          ),
        )
      : [],
    claimedAchievements: Array.isArray(obj.claimedAchievements)
      ? Array.from(
          new Set(
            obj.claimedAchievements.filter(
              (a): a is string => typeof a === 'string',
            ),
          ),
        )
      : [],
    coins:
      typeof obj.coins === 'number' && Number.isFinite(obj.coins)
        ? Math.max(0, Math.floor(obj.coins))
        : DEFAULT_SAVE_DATA.coins,
    selectedSkin,
    ownedSkins,
    upgrades: {
      starting_crowd: clampUpgrade(rawUpgrades.starting_crowd),
      coin_bonus: clampUpgrade(rawUpgrades.coin_bonus),
      agility: clampUpgrade(rawUpgrades.agility),
      recovery_shield: clampUpgrade(rawUpgrades.recovery_shield),
      starting_multiplier: clampUpgrade(rawUpgrades.starting_multiplier),
    },
    bestEndlessDistance:
      typeof obj.bestEndlessDistance === 'number' &&
      Number.isFinite(obj.bestEndlessDistance)
        ? Math.max(0, Math.floor(obj.bestEndlessDistance))
        : 0,
    highestCrowdRecord:
      typeof obj.highestCrowdRecord === 'number' &&
      Number.isFinite(obj.highestCrowdRecord)
        ? Math.max(10, Math.floor(obj.highestCrowdRecord))
        : 10,
    bossesDefeated:
      typeof obj.bossesDefeated === 'number' &&
      Number.isFinite(obj.bossesDefeated)
        ? Math.max(0, Math.floor(obj.bossesDefeated))
        : 0,
    unlockedWorlds,
    lastDailyClaimDate:
      typeof obj.lastDailyClaimDate === 'string' ? obj.lastDailyClaimDate : '',
    dailyStreak:
      typeof obj.dailyStreak === 'number' && Number.isFinite(obj.dailyStreak)
        ? Math.max(0, Math.floor(obj.dailyStreak))
        : 0,
    settings: {
      difficulty,
      musicVolume:
        typeof rawSettings.musicVolume === 'number'
          ? Math.max(0, Math.min(1, rawSettings.musicVolume))
          : 0.45,
      sfxVolume:
        typeof rawSettings.sfxVolume === 'number'
          ? Math.max(0, Math.min(1, rawSettings.sfxVolume))
          : 0.75,
      muted: Boolean(rawSettings.muted),
      maxVisibleCrowd:
        typeof rawSettings.maxVisibleCrowd === 'number'
          ? Math.max(60, Math.min(240, Math.floor(rawSettings.maxVisibleCrowd)))
          : 180,
      shadowsEnabled:
        typeof rawSettings.shadowsEnabled === 'boolean'
          ? rawSettings.shadowsEnabled
          : true,
    },
  };
}
