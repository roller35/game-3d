import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGateOperation,
  calculateLevelCoinReward,
  canClaimDailyReward,
  computeDailyRewardAmount,
  computeDifficultyParams,
  computeStartingCrowd,
  evaluateChallengeObjective,
  getUpgradeCost,
  getWorldForLevel,
  MAX_CROWD_COUNT,
  resolveFinalBattle,
  sanitizeSaveData,
} from './rules';
import { CAMPAIGN_LEVELS, CHALLENGE_CATALOG } from './levels';

test('gate arithmetic matches specification: 10 -> +99 -> x2 -> +50 = 268', () => {
  const s1 = applyGateOperation(10, 'add', 99);
  assert.equal(s1.nextCrowd, 109);
  const s2 = applyGateOperation(s1.nextCrowd, 'mul', 2);
  assert.equal(s2.nextCrowd, 218);
  const s3 = applyGateOperation(s2.nextCrowd, 'add', 50);
  assert.equal(s3.nextCrowd, 268);
});

test('gate arithmetic prevents integer overflow and negative counts', () => {
  const capped = applyGateOperation(4000, 'mul', 5);
  assert.equal(capped.nextCrowd, MAX_CROWD_COUNT);

  const floored = applyGateOperation(8, 'sub', 50);
  assert.equal(floored.nextCrowd, 0);

  const mysteryGood = applyGateOperation(20, 'mystery', 15, 0.4);
  assert.equal(mysteryGood.nextCrowd, 40);
});

test('final battle resolves deterministically based on crowd strength and shield', () => {
  const win = resolveFinalBattle(80, 45);
  assert.equal(win.victory, true);
  assert.ok(win.survivingPlayer > 0 && win.survivingPlayer < 80);

  const lose = resolveFinalBattle(20, 60);
  assert.equal(lose.victory, false);
  assert.equal(lose.survivingPlayer, 0);
  assert.equal(lose.survivingEnemy, 40);

  // Shield bonus helps close battles
  const closeWin = resolveFinalBattle(50, 55, undefined, 3); // 50 * 1.18 = 59 > 55
  assert.equal(closeWin.victory, true);
});

test('difficulty scaling increases knobs progressively without unfair jumps', () => {
  const easy = computeDifficultyParams('easy', 1, 0);
  const normal = computeDifficultyParams('normal', 1, 0);
  const hardHigh = computeDifficultyParams('hard', 40, 600);
  assert.ok(easy.damageMultiplier < normal.damageMultiplier);
  assert.ok(hardHigh.enemyMultiplier > normal.enemyMultiplier);
  assert.ok(hardHigh.speedMultiplier <= 1.5);
});

test('upgrades and starting crowd compute cleanly', () => {
  const start = computeStartingCrowd(
    10,
    {
      starting_crowd: 2,
      coin_bonus: 0,
      agility: 0,
      recovery_shield: 0,
      starting_multiplier: 1,
    },
    'campaign',
    'normal',
  );
  // (10 + 6) * 1.1 = 17.6 -> 18
  assert.equal(start, 18);
  assert.ok(getUpgradeCost(80, 1.45, 2) > getUpgradeCost(80, 1.45, 0));
});

test('daily reward and coin payout prevent negative/duplicate errors', () => {
  assert.equal(canClaimDailyReward('2026-11-16', '2026-11-17'), true);
  assert.equal(canClaimDailyReward('2026-11-17', '2026-11-17'), false);
  assert.equal(computeDailyRewardAmount(1), 75);
  assert.equal(computeDailyRewardAmount(7), 285);

  const coins = calculateLevelCoinReward({
    baseReward: 100,
    survivingCrowd: 100,
    coinUpgradeLevel: 2,
    bossMultiplier: 1.5,
    objectiveMet: true,
    objectiveBonus: 200,
  });
  assert.ok(coins > 400);
});

test('corrupted save data recovers cleanly to valid defaults', () => {
  const recovered = sanitizeSaveData({
    unlockedLevel: -50,
    coins: 'not-a-number',
    selectedSkin: 'hacker_skin',
    ownedSkins: [],
    settings: { difficulty: 'invalid', musicVolume: 99 },
  });
  assert.equal(recovered.unlockedLevel, 1);
  assert.equal(recovered.coins, 150);
  assert.equal(recovered.selectedSkin, 'classic_blue');
  assert.deepEqual(recovered.ownedSkins, ['classic_blue']);
  assert.equal(recovered.settings.difficulty, 'normal');
  assert.equal(recovered.settings.musicVolume, 1);
});

test('50 campaign levels across 6 worlds are configured with bosses every 5 levels', () => {
  assert.equal(CAMPAIGN_LEVELS.length, 50);
  assert.equal(getWorldForLevel(1), 'green_hills');
  assert.equal(getWorldForLevel(9), 'modern_city');
  assert.equal(getWorldForLevel(17), 'desert');
  assert.equal(getWorldForLevel(25), 'snow');
  assert.equal(getWorldForLevel(33), 'volcanic');
  assert.equal(getWorldForLevel(41), 'futuristic');

  for (const lvl of CAMPAIGN_LEVELS) {
    assert.ok(lvl.gates.length >= 3, `Level ${lvl.id} should have gates`);
    assert.ok(lvl.obstacles.length >= 2, `Level ${lvl.id} should have obstacles`);
    if (lvl.id % 5 === 0) {
      assert.ok(lvl.boss, `Level ${lvl.id} must have a boss`);
    }
  }

  const ch = CHALLENGE_CATALOG[0];
  assert.equal(
    evaluateChallengeObjective(ch, {
      victory: true,
      crowdCount: 120,
      crowdLost: 5,
      elapsedSec: 18,
      riskyRoutesTaken: 1,
      enemyTargetCount: 40,
      startCrowd: 10,
    }),
    true,
  );
});
