import type {
  AchievementDefinition,
  BossArchetype,
  BossConfig,
  ChallengeObjective,
  CollectibleSpec,
  EnemyArchetype,
  EnemySquadSpec,
  GateBehavior,
  GateOp,
  GateSpec,
  LevelConfig,
  ObstacleKind,
  ObstacleSpec,
  RouteChoiceSpec,
  SkinDefinition,
  UpgradeDefinition,
  WorldId,
  WorldTheme,
} from './types';
import { getWorldForLevel } from './rules';

export const WORLD_THEMES: Record<WorldId, WorldTheme> = {
  green_hills: {
    id: 'green_hills',
    name: 'Green Hills',
    levelRange: 'Levels 1–8',
    skyTop: 0x38bdf8,
    skyHorizon: 0xbae6fd,
    fogColor: 0xcbeafe,
    groundColor: 0x4ade80,
    trackColor: 0x94a3b8,
    trackEdgeColor: 0xf8fafc,
    accentPropColor: 0x16a34a,
    sunColor: 0xfff7ed,
    hemiSky: 0x7dd3fc,
    hemiGround: 0x15803d,
    hazardType: 'water',
  },
  modern_city: {
    id: 'modern_city',
    name: 'Modern City',
    levelRange: 'Levels 9–16',
    skyTop: 0x2563eb,
    skyHorizon: 0x93c5fd,
    fogColor: 0xbfdbfe,
    groundColor: 0x334155,
    trackColor: 0x64748b,
    trackEdgeColor: 0xfacc15,
    accentPropColor: 0x475569,
    sunColor: 0xfef3c7,
    hemiSky: 0x93c5fd,
    hemiGround: 0x1e293b,
    hazardType: 'traffic',
  },
  desert: {
    id: 'desert',
    name: 'Sunlit Desert',
    levelRange: 'Levels 17–24',
    skyTop: 0x0284c7,
    skyHorizon: 0xfde68a,
    fogColor: 0xfef3c7,
    groundColor: 0xeab308,
    trackColor: 0xd6b88d,
    trackEdgeColor: 0xfffbeb,
    accentPropColor: 0xb45309,
    sunColor: 0xffedd5,
    hemiSky: 0xfde68a,
    hemiGround: 0x92400e,
    hazardType: 'quicksand',
  },
  snow: {
    id: 'snow',
    name: 'Frost Peaks',
    levelRange: 'Levels 25–32',
    skyTop: 0x38bdf8,
    skyHorizon: 0xe0f2fe,
    fogColor: 0xe0f2fe,
    groundColor: 0xf1f5f9,
    trackColor: 0xcbd5e1,
    trackEdgeColor: 0x38bdf8,
    accentPropColor: 0x0284c7,
    sunColor: 0xffffff,
    hemiSky: 0xe0f2fe,
    hemiGround: 0x64748b,
    hazardType: 'ice',
  },
  volcanic: {
    id: 'volcanic',
    name: 'Volcanic Forge',
    levelRange: 'Levels 33–40',
    skyTop: 0x451a03,
    skyHorizon: 0xf97316,
    fogColor: 0x7c2d12,
    groundColor: 0x292524,
    trackColor: 0x57534e,
    trackEdgeColor: 0xf97316,
    accentPropColor: 0xef4444,
    sunColor: 0xfdba74,
    hemiSky: 0xfb923c,
    hemiGround: 0x1c1917,
    hazardType: 'lava',
  },
  futuristic: {
    id: 'futuristic',
    name: 'Cyber Skyline',
    levelRange: 'Levels 41–50',
    skyTop: 0x0f172a,
    skyHorizon: 0x312e81,
    fogColor: 0x1e1b4b,
    groundColor: 0x0f172a,
    trackColor: 0x334155,
    trackEdgeColor: 0x22d3ee,
    accentPropColor: 0x06b6d4,
    sunColor: 0xe0f2fe,
    hemiSky: 0x38bdf8,
    hemiGround: 0x1e1b4b,
    hazardType: 'laser',
  },
};

export const SKIN_CATALOG: SkinDefinition[] = [
  {
    id: 'classic_blue',
    name: 'Classic Blue',
    description: 'Standard blue vanguard regiment.',
    cost: 0,
    primaryColor: 0x2563eb,
    secondaryColor: 0x1d4ed8,
    accentColor: 0x60a5fa,
    visorColor: 0xf8fafc,
    metalness: 0.15,
    roughness: 0.45,
  },
  {
    id: 'crimson_red',
    name: 'Crimson Vanguard',
    description: 'High-visibility crimson strike squad.',
    cost: 200,
    primaryColor: 0xdc2626,
    secondaryColor: 0x991b1b,
    accentColor: 0xfca5a5,
    visorColor: 0xfef08a,
    metalness: 0.2,
    roughness: 0.4,
  },
  {
    id: 'royal_gold',
    name: 'Royal Gold',
    description: 'Polished gilded champions.',
    cost: 450,
    primaryColor: 0xeab308,
    secondaryColor: 0xa16207,
    accentColor: 0xfef08a,
    visorColor: 0x0f172a,
    metalness: 0.78,
    roughness: 0.24,
  },
  {
    id: 'cyber_robot',
    name: 'Mecha Unit',
    description: 'Brushed titanium android runners.',
    cost: 600,
    primaryColor: 0x64748b,
    secondaryColor: 0x334155,
    accentColor: 0x22d3ee,
    visorColor: 0x22d3ee,
    metalness: 0.85,
    roughness: 0.25,
  },
  {
    id: 'shadow_ninja',
    name: 'Shadow Shinobi',
    description: 'Stealth indigo runners with crimson wraps.',
    cost: 750,
    primaryColor: 0x1e1b4b,
    secondaryColor: 0x0f172a,
    accentColor: 0xef4444,
    visorColor: 0xfef08a,
    metalness: 0.1,
    roughness: 0.65,
  },
  {
    id: 'neon_futuristic',
    name: 'Cyber Volt',
    description: 'Electric cyan & cobalt exo-suit.',
    cost: 950,
    primaryColor: 0x0891b2,
    secondaryColor: 0x164e63,
    accentColor: 0x38bdf8,
    visorColor: 0xfef08a,
    metalness: 0.55,
    roughness: 0.28,
  },
  {
    id: 'heavy_armored',
    name: 'Aegis Heavy',
    description: 'Reinforced steel plate legion.',
    cost: 1200,
    primaryColor: 0x3b82f6,
    secondaryColor: 0x475569,
    accentColor: 0xfbbf24,
    visorColor: 0xf8fafc,
    metalness: 0.75,
    roughness: 0.32,
  },
];

export const UPGRADE_CATALOG: UpgradeDefinition[] = [
  {
    id: 'starting_crowd',
    name: 'Reinforced Squad',
    description: 'Begin every run with additional runners.',
    maxLevel: 8,
    baseCost: 80,
    costScale: 1.45,
    effectPerLevel: '+3 starting runners',
  },
  {
    id: 'coin_bonus',
    name: 'Treasure Bounty',
    description: 'Increases coin payouts from levels, bosses, and pickups.',
    maxLevel: 8,
    baseCost: 90,
    costScale: 1.5,
    effectPerLevel: '+15% coins earned',
  },
  {
    id: 'agility',
    name: 'Formation Agility',
    description: 'Faster horizontal swipe & steering response.',
    maxLevel: 6,
    baseCost: 100,
    costScale: 1.55,
    effectPerLevel: '+8% steer speed',
  },
  {
    id: 'recovery_shield',
    name: 'Aegis Discipline',
    description: 'Reduces obstacle casualties and boosts final clash power.',
    maxLevel: 6,
    baseCost: 120,
    costScale: 1.6,
    effectPerLevel: '+6% combat power & -5% trap loss',
  },
  {
    id: 'starting_multiplier',
    name: 'Command Rally',
    description: 'Multiplies your initial squad size at launch.',
    maxLevel: 5,
    baseCost: 160,
    costScale: 1.75,
    effectPerLevel: '+10% initial army',
  },
];

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    id: 'first_victory',
    title: 'First Conquest',
    description: 'Complete Level 1.',
    rewardCoins: 100,
    metric: 'levels_completed',
    target: 1,
  },
  {
    id: 'world_traveler',
    title: 'City Bound',
    description: 'Complete 8 Campaign Levels.',
    rewardCoins: 250,
    metric: 'levels_completed',
    target: 8,
  },
  {
    id: 'campaign_veteran',
    title: 'Army Commander',
    description: 'Complete 25 Campaign Levels.',
    rewardCoins: 500,
    metric: 'levels_completed',
    target: 25,
  },
  {
    id: 'campaign_master',
    title: 'Grand Conqueror',
    description: 'Complete all 50 Campaign Levels.',
    rewardCoins: 1500,
    metric: 'levels_completed',
    target: 50,
  },
  {
    id: 'crowd_100',
    title: 'Century Swarm',
    description: 'Command 100+ runners at once.',
    rewardCoins: 150,
    metric: 'max_crowd',
    target: 100,
  },
  {
    id: 'crowd_300',
    title: 'Unstoppable Tide',
    description: 'Command 300+ runners at once.',
    rewardCoins: 400,
    metric: 'max_crowd',
    target: 300,
  },
  {
    id: 'endless_500',
    title: 'Marathon Runner',
    description: 'Reach 500m in Endless Survival.',
    rewardCoins: 250,
    metric: 'endless_distance',
    target: 500,
  },
  {
    id: 'boss_slayer',
    title: 'Boss Slayer',
    description: 'Defeat 3 Campaign Bosses.',
    rewardCoins: 350,
    metric: 'bosses_defeated',
    target: 3,
  },
  {
    id: 'collector',
    title: 'Armory Collector',
    description: 'Unlock 3 character skins.',
    rewardCoins: 300,
    metric: 'skins_owned',
    target: 3,
  },
];

export const CHALLENGE_CATALOG: ChallengeObjective[] = [
  {
    id: 'ch_100_army',
    title: 'Century March',
    description: 'Finish Level 4 with at least 100 characters.',
    type: 'min_finish_crowd',
    targetValue: 100,
    levelId: 4,
    rewardCoins: 250,
  },
  {
    id: 'ch_no_losses',
    title: 'Flawless Vanguard',
    description: 'Complete Level 7 losing 10 or fewer characters.',
    type: 'max_crowd_lost',
    targetValue: 10,
    levelId: 7,
    rewardCoins: 300,
  },
  {
    id: 'ch_risky_route',
    title: 'Daredevil Commander',
    description: 'Take the high-risk route and clear Level 12.',
    type: 'choose_risky_route',
    targetValue: 1,
    levelId: 12,
    rewardCoins: 350,
  },
  {
    id: 'ch_speed_blitz',
    title: 'Lightning Blitz',
    description: 'Complete Level 18 within 22 seconds.',
    type: 'time_limit',
    targetValue: 22,
    levelId: 18,
    rewardCoins: 400,
  },
  {
    id: 'ch_giant_slayer',
    title: 'Outnumbered Victory',
    description: 'Defeat the Level 23 arena army that starts bigger than yours.',
    type: 'defeat_larger_army',
    targetValue: 1,
    levelId: 23,
    rewardCoins: 500,
  },
];

// Deterministic PRNG for building 50 unique, fair, hand-tuned campaign levels
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOSS_SCHEDULE: Record<number, { archetype: BossArchetype; name: string }> = {
  5: { archetype: 'giant_formation', name: 'Crimson Phalanx Titan' },
  10: { archetype: 'fortress_defense', name: 'Iron Gate Fortress' },
  15: { archetype: 'armored_colossus', name: 'Dune Juggernaut' },
  20: { archetype: 'multi_wave_legion', name: 'Sandstorm Warlord' },
  25: { archetype: 'arena_champion', name: 'Glacier Gladiator' },
  30: { archetype: 'giant_robot', name: 'Frostbite Mech MK-II' },
  35: { archetype: 'enemy_commander', name: 'Magma Marshal' },
  40: { archetype: 'moving_fortress', name: 'Obsidian Citadel' },
  45: { archetype: 'heavy_armored_crowd', name: 'Cyber Bastion Guard' },
  50: { archetype: 'multi_stage_overlord', name: 'Omega Core Overlord' },
};

const LEVEL_NAMES: string[] = [
  'First Rally', 'Twin Gates', 'Meadow Sprint', 'Bridge Crossing', 'Hilltop Titan',
  'Pendulum Valley', 'Blade Gauntlet', 'Green Finale',
  'Metro Avenue', 'Iron Blockade', 'Skybridge Dash', 'Traffic Jam', 'Overpass Gambit',
  'Rooftop Rush', 'Armored Convoy', 'City Showdown',
  'Sandstone Run', 'Canyon Split', 'Mirage Gates', 'Scorpion Pass', 'Dune Gauntlet',
  'Oasis Gamble', 'Pyramid Siege', 'Desert Finale',
  'Snowdrift Lane', 'Glacier Bridge', 'Frozen Blades', 'Avalanche Split', 'Frostbite Wall',
  'Iceberg Fortress', 'Blizzard March', 'Polar Summit',
  'Cinder Road', 'Lava Channel', 'Magma Marshal', 'Basalt Pillars', 'Forge Hammer',
  'Caldera Split', 'Inferno Crossing', 'Volcanic Core',
  'Neon Causeway', 'Laser Grid', 'Holo Split', 'Quantum Bridge', 'Cyber Bastion',
  'Hyperloop Dash', 'Matrix Gauntlet', 'Orbital Lift', 'Singularity Gate', 'Omega Crown',
];

function buildBossForLevel(levelId: number): BossConfig | undefined {
  const entry = BOSS_SCHEDULE[levelId];
  if (!entry) return undefined;
  const tier = levelId / 5;
  return {
    archetype: entry.archetype,
    name: entry.name,
    maxHp: Math.round(140 + tier * 95),
    powerRating: Math.round(28 + tier * 24),
    waves: tier >= 4 ? 3 : tier >= 2 ? 2 : 1,
    attackInterval: Math.max(1.5, 3.2 - tier * 0.14),
    attackDamage: Math.round(3 + tier * 1.4),
    rewardMultiplier: Number((1.4 + tier * 0.15).toFixed(2)),
  };
}

function generateCampaignLevel(levelId: number): LevelConfig {
  const rng = mulberry32(levelId * 7919 + 104729);
  const world = getWorldForLevel(levelId);
  const trackWidth = levelId >= 11 && levelId % 4 === 1 ? 11.2 : 12.6;
  const length = 155 + Math.min(115, Math.floor((levelId - 1) * 2.4));
  const startCrowd = levelId <= 3 ? 10 : Math.min(22, 10 + Math.floor(levelId / 5) * 2);
  const baseSpeed = 12.5 + Math.min(4.2, levelId * 0.08);

  const gates: GateSpec[] = [];
  const obstacles: ObstacleSpec[] = [];
  const enemies: EnemySquadSpec[] = [];
  const collectibles: CollectibleSpec[] = [];
  const routeChoices: RouteChoiceSpec[] = [];

  // Note: Player runs along -Z (from z = 0 toward z = -length).
  // Let's keep positive distance coordinate d = 22 .. length - 28 and store z = -d!
  let cursorD = 22;
  let stepIdx = 0;

  // Tutorial Level 1 guaranteed classic feel: +10 / +20 pair, gentle wall, x2 / +50 pair, recruits, small enemy
  if (levelId === 1) {
    gates.push(
      { id: 'l1_g1_l', z: -26, x: -3.0, width: 5.2, op: 'add', value: 10, behavior: 'static' },
      { id: 'l1_g1_r', z: -26, x: 3.0, width: 5.2, op: 'add', value: 20, behavior: 'static' },
      { id: 'l1_g2_l', z: -68, x: -3.0, width: 5.2, op: 'mul', value: 2, behavior: 'static' },
      { id: 'l1_g2_r', z: -68, x: 3.0, width: 5.2, op: 'add', value: 25, behavior: 'static' },
      { id: 'l1_g3_l', z: -112, x: -3.0, width: 5.2, op: 'add', value: 50, behavior: 'static' },
      { id: 'l1_g3_r', z: -112, x: 3.0, width: 5.2, op: 'sub', value: 10, behavior: 'static' },
    );
    obstacles.push(
      { id: 'l1_o1', kind: 'barrier', z: -48, x: 2.6, width: 4.2, length: 1.4, height: 1.6, damage: 4 },
      { id: 'l1_o2', kind: 'rotating_hammer', z: -90, x: -1.5, width: 4.0, length: 2.0, damage: 5, speed: 1.8 },
    );
    collectibles.push(
      { id: 'l1_c1', type: 'recruit', z: -38, x: -3.2, value: 4 },
      { id: 'l1_c2', type: 'coin', z: -56, x: 0, value: 10 },
      { id: 'l1_c3', type: 'recruit', z: -124, x: 2.2, value: 5 },
    );
    enemies.push({
      id: 'l1_e1',
      archetype: 'small_squad',
      z: -100,
      x: 1.8,
      count: 8,
    });
  } else {
    while (cursorD < length - 28) {
      stepIdx++;
      const sectionRoll = rng();

      // Add a pair of multiplier / addition / special gates every ~38m
      if (stepIdx % 2 === 1) {
        const leftIsGood = rng() > 0.45;
        const behaviors: GateBehavior[] =
          levelId < 6
            ? ['static']
            : levelId < 12
            ? ['static', 'moving']
            : ['static', 'moving', 'timed', 'closing', 'risk_reward'];
        const behavior = behaviors[Math.floor(rng() * behaviors.length)];

        const goodChoices: { op: GateOp; val: number }[] =
          levelId < 5
            ? [
                { op: 'add', val: 10 },
                { op: 'add', val: 20 },
                { op: 'add', val: 25 },
                { op: 'mul', val: 2 },
              ]
            : [
                { op: 'add', val: 20 },
                { op: 'add', val: 50 },
                { op: 'add', val: 99 },
                { op: 'mul', val: 2 },
                { op: 'mul', val: 3 },
                ...(levelId >= 12 ? [{ op: 'mul' as GateOp, val: 4 }] : []),
                ...(levelId >= 22 ? [{ op: 'mul' as GateOp, val: 5 }] : []),
                { op: 'mystery', val: 30 },
              ];

        const altChoices: { op: GateOp; val: number }[] = [
          { op: 'add', val: 5 },
          { op: 'add', val: 10 },
          { op: 'sub', val: Math.min(25, 8 + Math.floor(levelId * 0.4)) },
          { op: 'mystery', val: 20 },
        ];

        const pickA = goodChoices[Math.floor(rng() * goodChoices.length)];
        const pickB = altChoices[Math.floor(rng() * altChoices.length)];
        const leftSpec = leftIsGood ? pickA : pickB;
        const rightSpec = leftIsGood ? pickB : pickA;

        gates.push(
          {
            id: `l${levelId}_g${stepIdx}_l`,
            z: -cursorD,
            x: -trackWidth * 0.24,
            width: trackWidth * 0.43,
            op: leftSpec.op,
            value: leftSpec.val,
            behavior: behavior === 'moving' ? 'moving' : 'static',
            moveAmplitude: behavior === 'moving' ? 1.4 : 0,
            moveSpeed: 1.5 + rng() * 0.8,
          },
          {
            id: `l${levelId}_g${stepIdx}_r`,
            z: -cursorD,
            x: trackWidth * 0.24,
            width: trackWidth * 0.43,
            op: rightSpec.op,
            value: rightSpec.val,
            behavior,
            moveAmplitude: behavior === 'moving' ? 1.4 : 0,
            moveSpeed: 1.5 + rng() * 0.8,
            cyclePeriod: 3.2,
          },
        );
      } else {
        const forceRouteChoice = levelId === 12 && stepIdx === 2;
        if ((levelId >= 6 && sectionRoll < 0.32 && cursorD < length - 55 && obstacles.length >= 2) || forceRouteChoice) {
        // Advanced Route Decision Section (Safe vs Risky vs Extreme)
        const routeLen = 22;
        routeChoices.push({
          id: `l${levelId}_rc${stepIdx}`,
          z: -cursorD,
          length: routeLen,
          routes: [
            {
              laneX: -trackWidth * 0.33,
              width: 3.6,
              riskLabel: 'SAFE',
              gateOp: 'add',
              gateValue: 10 + Math.floor(levelId / 4) * 5,
              obstacles: ['barrier'],
            },
            {
              laneX: 0,
              width: 3.4,
              riskLabel: 'RISKY',
              gateOp: 'mul',
              gateValue: 3,
              obstacles: ['rotating_hammer', 'pillar'],
            },
            {
              laneX: trackWidth * 0.33,
              width: 2.8,
              riskLabel: 'EXTREME',
              gateOp: 'mul',
              gateValue: levelId >= 18 ? 5 : 4,
              obstacles: ['rotating_blade', 'narrow_bridge'],
            },
          ],
        });
        cursorD += routeLen * 0.75;
      } else {
        // Rich Obstacle + Enemy + Collectible section
        const obsPool: ObstacleKind[] =
          levelId <= 5
            ? ['concrete_wall', 'barrier', 'pillar', 'rotating_hammer']
            : levelId <= 10
            ? [
                'concrete_wall',
                'roadblock',
                'rotating_hammer',
                'swinging_pendulum',
                'sliding_barrier',
                'narrow_opening',
              ]
            : levelId <= 16
            ? [
                'narrow_bridge',
                'broken_bridge',
                'rotating_blade',
                'moving_wall',
                'collapsing_platform',
                'moving_platform',
                'fixed_trap',
              ]
            : [
                'rotating_blade',
                'swinging_pendulum',
                'zigzag_bridge',
                'disappearing_platform',
                'collapsing_platform',
                'lava_hazard',
                'water_zone',
                'ice_surface',
                'wind_zone',
                'gap',
                'narrow_opening',
              ];

        const kind = obsPool[Math.floor(rng() * obsPool.length)];
        const isTrackFeature =
          kind === 'narrow_bridge' ||
          kind === 'broken_bridge' ||
          kind === 'zigzag_bridge' ||
          kind === 'gap' ||
          kind === 'collapsing_platform' ||
          kind === 'moving_platform' ||
          kind === 'disappearing_platform' ||
          kind === 'lava_hazard' ||
          kind === 'water_zone' ||
          kind === 'ice_surface' ||
          kind === 'wind_zone';

        const laneX = isTrackFeature
          ? (rng() - 0.5) * 3.0
          : (rng() - 0.5) * (trackWidth * 0.56);

        obstacles.push({
          id: `l${levelId}_o${stepIdx}`,
          kind,
          z: -cursorD,
          x: laneX,
          width:
            kind === 'narrow_bridge' || kind === 'zigzag_bridge'
              ? 3.4
              : kind === 'narrow_opening'
              ? trackWidth * 0.92
              : kind === 'lava_hazard' || kind === 'water_zone' || kind === 'ice_surface' || kind === 'wind_zone'
              ? trackWidth * 0.55
              : 3.4 + rng() * 1.4,
          length: isTrackFeature ? 10 : 2.2,
          height: 2.0,
          damage: Math.min(18, 4 + Math.floor(levelId * 0.25)),
          speed: 1.6 + rng() * 1.6,
          amplitude: 2.8,
          phase: rng() * Math.PI * 2,
          gapWidth: 3.4,
        });

        // Occasionally spawn a patrolling enemy squad on the opposite side
        if (levelId >= 3 && rng() < 0.62) {
          const archetypes: EnemyArchetype[] =
            levelId < 10
              ? ['small_squad', 'fast_raiders']
              : levelId < 22
              ? ['small_squad', 'large_swarm', 'fast_raiders', 'defensive_phalanx']
              : ['large_swarm', 'defensive_phalanx', 'elite_guard', 'armored_unit'];
          const archetype = archetypes[Math.floor(rng() * archetypes.length)];
          const count = Math.round(6 + levelId * 0.75 + rng() * 6);
          enemies.push({
            id: `l${levelId}_e${stepIdx}`,
            archetype,
            z: -(cursorD + 7),
            x: laneX > 0 ? -trackWidth * 0.24 : trackWidth * 0.24,
            count,
            patrolAmplitude: archetype === 'fast_raiders' ? 2.4 : 0.8,
            patrolSpeed: archetype === 'fast_raiders' ? 2.2 : 1.0,
          });
        }
      }
      }

      // Add recruits & coins between encounters
      if (rng() < 0.75) {
        collectibles.push({
          id: `l${levelId}_c${stepIdx}`,
          type: rng() < 0.55 ? 'recruit' : 'coin',
          z: -(cursorD + 9),
          x: (rng() - 0.5) * (trackWidth * 0.68),
          value: rng() < 0.55 ? 3 + Math.floor(levelId * 0.12) : 10 + Math.floor(levelId * 0.5),
        });
      }

      cursorD += 18 + Math.floor(rng() * 6);
    }

    // Guarantee at least 2 obstacles even on unusual RNG sequences
    while (obstacles.length < 2) {
      const idx = obstacles.length + 1;
      obstacles.push({
        id: `l${levelId}_fallback_o${idx}`,
        kind: 'rotating_hammer',
        z: -(45 + idx * 36),
        x: idx % 2 === 0 ? -2.2 : 2.2,
        width: 3.8,
        length: 2.2,
        damage: 6,
        speed: 1.9,
      });
    }
  }

  const boss = buildBossForLevel(levelId);
  const finalArenaEnemyCount = Math.round(18 + levelId * 3.8);
  const matchingChallenge = CHALLENGE_CATALOG.find((c) => c.levelId === levelId);

  return {
    id: levelId,
    world,
    name: LEVEL_NAMES[levelId - 1] ?? `Sector ${levelId}`,
    subtitle: boss ? `Boss Battle · ${boss.name}` : WORLD_THEMES[world].name,
    length,
    trackWidth,
    startCrowd,
    baseSpeed,
    gates,
    obstacles,
    enemies,
    collectibles,
    routeChoices,
    finalArenaEnemyCount,
    boss,
    baseCoinReward: 60 + levelId * 12 + (boss ? 120 : 0),
    timeLimitSec: levelId >= 10 ? Math.round(length / baseSpeed + 14) : undefined,
    bonusObjective: matchingChallenge,
  };
}

export const CAMPAIGN_LEVELS: LevelConfig[] = Array.from({ length: 50 }, (_, i) =>
  generateCampaignLevel(i + 1),
);

export function getLevelConfig(levelId: number): LevelConfig {
  const clamped = Math.max(1, Math.min(50, Math.floor(levelId)));
  return CAMPAIGN_LEVELS[clamped - 1];
}
