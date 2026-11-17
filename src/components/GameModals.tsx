import React, { useState } from 'react';
import {
  Award,
  Check,
  Coins,
  Crown,
  Flame,
  Lock,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Timer,
  Trophy,
  X,
} from 'lucide-react';
import {
  ACHIEVEMENT_CATALOG,
  CAMPAIGN_LEVELS,
  CHALLENGE_CATALOG,
  SKIN_CATALOG,
  UPGRADE_CATALOG,
  WORLD_THEMES,
} from '../game/levels';
import {
  canClaimDailyReward,
  computeDailyRewardAmount,
  getUpgradeCost,
  WORLD_ORDER,
} from '../game/rules';
import type {
  DifficultyLevel,
  GameMode,
  GamePhase,
  RunStats,
  SaveData,
  SkinId,
  UpgradeId,
  WorldId,
} from '../game/types';

export type ActiveModal =
  | null
  | 'levels'
  | 'modes'
  | 'shop'
  | 'rewards'
  | 'settings';

interface GameModalsProps {
  phase: GamePhase;
  stats: RunStats;
  saveData: SaveData;
  todayStr: string;
  activeModal: ActiveModal;
  onCloseModal: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onStartMode: (mode: GameMode, levelId?: number) => void;
  onNextBossRush: () => void;
  onBuySkin: (skinId: SkinId) => void;
  onSelectSkin: (skinId: SkinId) => void;
  onBuyUpgrade: (upgradeId: UpgradeId) => void;
  onClaimDaily: () => void;
  onClaimAchievement: (achievementId: string) => void;
  onUpdateSettings: (patch: Partial<SaveData['settings']>) => void;
  onResetSave: () => void;
}

export const GameModals: React.FC<GameModalsProps> = ({
  phase,
  stats,
  saveData,
  todayStr,
  activeModal,
  onCloseModal,
  onResume,
  onRestart,
  onReturnTitle,
  onStartMode,
  onNextBossRush,
  onBuySkin,
  onSelectSkin,
  onBuyUpgrade,
  onClaimDaily,
  onClaimAchievement,
  onUpdateSettings,
  onResetSave,
}) => {
  const [selectedWorld, setSelectedWorld] = useState<WorldId>(
    saveData.unlockedWorlds[saveData.unlockedWorlds.length - 1] ?? 'green_hills',
  );
  const [shopTab, setShopTab] = useState<'skins' | 'upgrades'>('skins');
  const [confirmReset, setConfirmReset] = useState(false);

  // 1. PAUSE MODAL
  if (phase === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
        <div
          role="dialog"
          aria-label="Game Paused"
          className="w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-slate-700 p-6 shadow-2xl text-white"
        >
          <h2 className="font-display font-extrabold text-2xl text-center">
            Game Paused
          </h2>
          <p className="text-center text-sm text-slate-400 mt-1">
            Army Size: <span className="font-mono-nums text-white font-bold">{stats.crowdCount}</span>
          </p>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 border-b-4 border-blue-800 font-display font-extrabold text-lg cursor-pointer"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ muted: !saveData.settings.muted })
              }
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 font-semibold cursor-pointer"
            >
              Sound: {saveData.settings.muted ? 'Muted' : 'On'}
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. VICTORY MODAL
  if (phase === 'victory') {
    const nextLevelId = Math.min(50, stats.levelId + 1);
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/78 p-4">
        <div
          role="dialog"
          aria-label="Victory"
          className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-amber-400/70 p-6 shadow-2xl text-white"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400 mb-3">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="font-display font-black text-3xl text-amber-300">
              VICTORY!
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              {stats.bossDefeated
                ? `Defeated ${stats.bossName}!`
                : `Level ${stats.levelId} Cleared`}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl bg-slate-800/90 p-3 border border-slate-700">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Survivors
              </div>
              <div className="font-mono-nums font-extrabold text-xl text-sky-300 mt-0.5">
                {stats.crowdCount}
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/90 p-3 border border-slate-700">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Coins
              </div>
              <div className="font-mono-nums font-extrabold text-xl text-amber-300 mt-0.5">
                +{stats.coinsEarned}
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/90 p-3 border border-slate-700">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Time
              </div>
              <div className="font-mono-nums font-extrabold text-xl text-white mt-0.5">
                {stats.elapsedSec.toFixed(1)}s
              </div>
            </div>
          </div>

          {stats.bonusObjectiveMet && (
            <div className="mt-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-2 text-center text-xs font-bold text-emerald-300">
              Bonus Challenge Objective Completed!
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2.5">
            {stats.mode === 'boss_rush' ? (
              <button
                type="button"
                data-start="true"
                onClick={onNextBossRush}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 border-b-4 border-amber-700 text-slate-950 font-display font-extrabold text-lg cursor-pointer"
              >
                Next Boss Challenge
              </button>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={() => onStartMode('campaign', nextLevelId)}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 border-b-4 border-blue-800 text-white font-display font-extrabold text-lg cursor-pointer"
              >
                {stats.levelId < 50 ? `Continue · Level ${nextLevelId}` : 'Play Level 50 Again'}
              </button>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onRestart}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 font-semibold text-sm cursor-pointer"
              >
                Replay
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-sm cursor-pointer"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. DEFEAT / ENDLESS GAME OVER MODAL
  if (phase === 'defeat') {
    const isEndless = stats.mode === 'endless';
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
        <div
          role="dialog"
          aria-label={isEndless ? 'Endless Run Complete' : 'Defeat'}
          className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-rose-500/70 p-6 shadow-2xl text-white"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-3">
              <Skull className="w-8 h-8" />
            </div>
            <h2 className="font-display font-black text-3xl text-rose-400">
              {isEndless ? 'RUN ENDED' : 'DEFEAT'}
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              {stats.defeatReason || 'Your army fell on the battlefield.'}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl bg-slate-800/90 p-3 border border-slate-700">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                {isEndless ? 'Distance' : 'Progress'}
              </div>
              <div className="font-mono-nums font-extrabold text-xl text-white mt-0.5">
                {isEndless
                  ? `${Math.round(stats.distance)}m`
                  : `${Math.round(stats.progress * 100)}%`}
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/90 p-3 border border-slate-700">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Peak Crowd
              </div>
              <div className="font-mono-nums font-extrabold text-xl text-sky-300 mt-0.5">
                {stats.peakCrowd}
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/90 p-3 border border-slate-700">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                {isEndless ? 'Best' : 'Coins'}
              </div>
              <div className="font-mono-nums font-extrabold text-xl text-amber-300 mt-0.5">
                {isEndless
                  ? `${Math.max(saveData.bestEndlessDistance, Math.round(stats.distance))}m`
                  : `+${stats.coinsEarned}`}
              </div>
            </div>
          </div>

          {isEndless && (
            <p className="mt-3 text-center text-xs text-amber-300 font-bold">
              Coins Earned: +{stats.coinsEarned}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 border-b-4 border-blue-800 font-display font-extrabold text-lg cursor-pointer"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!activeModal) return null;

  // 4. CAMPAIGN LEVEL & WORLD SELECTOR (50 Levels / 6 Worlds)
  if (activeModal === 'levels') {
    const worldLevels = CAMPAIGN_LEVELS.filter(
      (l) => l.world === selectedWorld,
    );
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-3 sm:p-5">
        <div
          role="dialog"
          aria-label="Campaign Level Selection"
          className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border-2 border-slate-700 p-5 shadow-2xl text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-extrabold text-2xl">
                Campaign Worlds
              </h2>
              <p className="text-xs text-slate-400">
                50 Levels across 6 Environments · Boss every 5 levels
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseModal}
              aria-label="Close level selection"
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* World Tabs */}
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {WORLD_ORDER.map((wId) => {
              const theme = WORLD_THEMES[wId];
              const unlocked = saveData.unlockedWorlds.includes(wId);
              const active = selectedWorld === wId;
              return (
                <button
                  key={wId}
                  type="button"
                  onClick={() => setSelectedWorld(wId)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-600 border-sky-400 text-white'
                      : unlocked
                      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  {theme.name}
                </button>
              );
            })}
          </div>

          {/* Levels Grid */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 overflow-y-auto custom-scroll pr-1">
            {worldLevels.map((lvl) => {
              const unlocked = lvl.id <= saveData.unlockedLevel;
              const completed = saveData.completedLevels.includes(lvl.id);
              const isCurrent = lvl.id === saveData.unlockedLevel;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    onCloseModal();
                    onStartMode('campaign', lvl.id);
                  }}
                  className={`relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                    unlocked
                      ? isCurrent
                        ? 'bg-blue-600/25 border-sky-400 hover:bg-blue-600/35 cursor-pointer'
                        : 'bg-slate-800 border-slate-700 hover:bg-slate-700 cursor-pointer'
                      : 'bg-slate-950/80 border-slate-800 text-slate-500 opacity-65 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono-nums font-extrabold text-base">
                      {lvl.id}
                    </span>
                    {!unlocked ? (
                      <Lock className="w-4 h-4 text-slate-500" />
                    ) : completed ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : lvl.boss ? (
                      <Crown className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-sky-400" />
                    )}
                  </div>
                  <div className="mt-1 text-xs font-bold truncate w-full">
                    {lvl.name}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate w-full">
                    {lvl.boss ? 'Boss Stage' : `Goal: ${lvl.finalArenaEnemyCount}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 5. ADDITIONAL GAME MODES & CHALLENGES MODAL
  if (activeModal === 'modes') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-3 sm:p-5">
        <div
          role="dialog"
          aria-label="Game Modes"
          className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border-2 border-slate-700 p-5 shadow-2xl text-white"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-2xl">Game Modes</h2>
            <button
              type="button"
              onClick={onCloseModal}
              aria-label="Close game modes"
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 overflow-y-auto custom-scroll space-y-3 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onStartMode('endless');
                }}
                className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 font-display font-bold text-amber-300">
                  <Sparkles className="w-4 h-4" />
                  <span>Endless Survival</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Procedural tracks & scaling threats. Best: {saveData.bestEndlessDistance}m
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onStartMode('time_attack', Math.max(3, saveData.unlockedLevel));
                }}
                className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 font-display font-bold text-sky-300">
                  <Timer className="w-4 h-4" />
                  <span>Time Attack</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Reach the arena before the countdown hits zero.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onStartMode('army_survival', Math.max(6, saveData.unlockedLevel));
                }}
                className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 font-display font-bold text-emerald-300">
                  <Shield className="w-4 h-4" />
                  <span>Army Survival</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Battle multiple patrolling enemy formations back to back.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onStartMode('hardcore', saveData.unlockedLevel);
                }}
                className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 font-display font-bold text-rose-400">
                  <Flame className="w-4 h-4" />
                  <span>Hardcore Mode</span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Reduced starting squad with brutal obstacle stakes.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  onCloseModal();
                  onStartMode('boss_rush');
                }}
                className="sm:col-span-2 p-3.5 rounded-2xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 font-display font-bold text-amber-300">
                  <Crown className="w-4 h-4" />
                  <span>Boss Rush Gauntlet</span>
                </div>
                <p className="text-xs text-slate-200 mt-1">
                  Fight consecutive campaign bosses for multiplied coin rewards.
                </p>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <h3 className="font-display font-bold text-sm text-slate-300 mb-2">
                Challenge Missions
              </h3>
              <div className="space-y-2">
                {CHALLENGE_CATALOG.map((ch) => {
                  const done = saveData.completedChallenges.includes(ch.id);
                  return (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold flex items-center gap-2">
                          <span>{ch.title}</span>
                          {done && (
                            <span className="text-xs text-emerald-400 font-bold">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{ch.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onCloseModal();
                          onStartMode('challenge', ch.levelId);
                        }}
                        className="shrink-0 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold cursor-pointer"
                      >
                        Play (+{ch.rewardCoins})
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 6. SHOP & UPGRADES MODAL
  if (activeModal === 'shop') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-3 sm:p-5">
        <div
          role="dialog"
          aria-label="Shop and Upgrades"
          className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border-2 border-slate-700 p-5 shadow-2xl text-white"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-extrabold text-2xl">Armory</h2>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-amber-300 font-mono-nums text-sm font-bold">
                <Coins className="w-4 h-4" />
                <span>{saveData.coins.toLocaleString()}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseModal}
              aria-label="Close shop"
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 flex gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setShopTab('skins')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold cursor-pointer ${
                shopTab === 'skins'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Character Skins (7)
            </button>
            <button
              type="button"
              onClick={() => setShopTab('upgrades')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold cursor-pointer ${
                shopTab === 'upgrades'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Army Upgrades (5)
            </button>
          </div>

          <div className="mt-4 overflow-y-auto custom-scroll space-y-2.5 pr-1">
            {shopTab === 'skins'
              ? SKIN_CATALOG.map((skin) => {
                  const owned = saveData.ownedSkins.includes(skin.id);
                  const equipped = saveData.selectedSkin === skin.id;
                  const canAfford = saveData.coins >= skin.cost;
                  const swatchHex =
                    '#' + skin.primaryColor.toString(16).padStart(6, '0');

                  return (
                    <div
                      key={skin.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/85 border border-slate-700"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl border-2 border-white/25 shrink-0"
                          style={{ backgroundColor: swatchHex }}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-sm">{skin.name}</div>
                          <p className="text-xs text-slate-400 truncate">
                            {skin.description}
                          </p>
                        </div>
                      </div>

                      {equipped ? (
                        <span className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600/25 border border-emerald-500/50 text-emerald-300 text-xs font-bold">
                          Equipped
                        </span>
                      ) : owned ? (
                        <button
                          type="button"
                          onClick={() => onSelectSkin(skin.id)}
                          className="shrink-0 px-3.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold cursor-pointer"
                        >
                          Equip
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuySkin(skin.id)}
                          className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1 ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                              : 'bg-slate-950 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>{skin.cost}</span>
                        </button>
                      )}
                    </div>
                  );
                })
              : UPGRADE_CATALOG.map((u) => {
                  const lvl = saveData.upgrades[u.id] ?? 0;
                  const maxed = lvl >= u.maxLevel;
                  const cost = getUpgradeCost(u.baseCost, u.costScale, lvl);
                  const canAfford = !maxed && saveData.coins >= cost;

                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/85 border border-slate-700"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm">
                          {u.name}{' '}
                          <span className="font-mono-nums text-sky-300 text-xs">
                            Lv {lvl}/{u.maxLevel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {u.description} · {u.effectPerLevel}
                        </p>
                      </div>

                      {maxed ? (
                        <span className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600/25 text-emerald-300 text-xs font-bold">
                          MAX
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuyUpgrade(u.id)}
                          className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1 ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                              : 'bg-slate-950 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>{cost}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
          </div>
        </div>
      </div>
    );
  }

  // 7. REWARDS & ACHIEVEMENTS MODAL
  if (activeModal === 'rewards') {
    const dailyReady = canClaimDailyReward(
      saveData.lastDailyClaimDate,
      todayStr,
    );
    const nextDailyCoins = computeDailyRewardAmount(saveData.dailyStreak + 1);

    const getMetricValue = (
      metric: (typeof ACHIEVEMENT_CATALOG)[number]['metric'],
    ) => {
      switch (metric) {
        case 'levels_completed':
          return saveData.completedLevels.length;
        case 'max_crowd':
          return saveData.highestCrowdRecord;
        case 'endless_distance':
          return saveData.bestEndlessDistance;
        case 'bosses_defeated':
          return saveData.bossesDefeated;
        case 'skins_owned':
          return saveData.ownedSkins.length;
      }
    };

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-3 sm:p-5">
        <div
          role="dialog"
          aria-label="Rewards and Achievements"
          className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border-2 border-slate-700 p-5 shadow-2xl text-white"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-2xl">
              Rewards & Achievements
            </h2>
            <button
              type="button"
              onClick={onCloseModal}
              aria-label="Close rewards"
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Daily Reward Banner */}
          <div className="mt-4 p-4 rounded-2xl bg-amber-500/12 border border-amber-400/40 flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-bold text-amber-300 flex items-center gap-2">
                <Award className="w-5 h-5" />
                <span>Daily Supply Crate (Day {saveData.dailyStreak + (dailyReady ? 1 : 0)})</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {dailyReady
                  ? `Claim +${nextDailyCoins} coins today!`
                  : 'Already claimed today. Come back tomorrow!'}
              </p>
            </div>
            <button
              type="button"
              disabled={!dailyReady}
              onClick={onClaimDaily}
              className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm ${
                dailyReady
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {dailyReady ? 'Claim' : 'Claimed'}
            </button>
          </div>

          {/* Achievements List */}
          <div className="mt-4 overflow-y-auto custom-scroll space-y-2.5 pr-1">
            {ACHIEVEMENT_CATALOG.map((ach) => {
              const current = getMetricValue(ach.metric);
              const unlocked = current >= ach.target;
              const claimed = saveData.claimedAchievements.includes(ach.id);
              return (
                <div
                  key={ach.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/85 border border-slate-700"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{ach.title}</div>
                    <p className="text-xs text-slate-400">
                      {ach.description} ({Math.min(current, ach.target)}/{ach.target})
                    </p>
                  </div>
                  {claimed ? (
                    <span className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 text-xs font-bold">
                      Claimed
                    </span>
                  ) : unlocked ? (
                    <button
                      type="button"
                      onClick={() => onClaimAchievement(ach.id)}
                      className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                    >
                      Claim +{ach.rewardCoins}
                    </button>
                  ) : (
                    <span className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-950 text-slate-400 font-mono-nums text-xs">
                      +{ach.rewardCoins}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 8. SETTINGS MODAL
  if (activeModal === 'settings') {
    const difficulties: DifficultyLevel[] = ['easy', 'normal', 'hard', 'extreme'];
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/82 p-4">
        <div
          role="dialog"
          aria-label="Settings"
          className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-slate-700 p-5 shadow-2xl text-white"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display font-extrabold text-2xl">Settings</h2>
            <button
              type="button"
              onClick={onCloseModal}
              aria-label="Close settings"
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Difficulty
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {difficulties.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onUpdateSettings({ difficulty: d })}
                    className={`py-2 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                      saveData.settings.difficulty === d
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="music-vol"
                className="flex justify-between text-xs font-bold text-slate-300 mb-1"
              >
                <span>Music Volume</span>
                <span className="font-mono-nums">
                  {Math.round(saveData.settings.musicVolume * 100)}%
                </span>
              </label>
              <input
                id="music-vol"
                type="range"
                min={0}
                max={100}
                value={Math.round(saveData.settings.musicVolume * 100)}
                onChange={(e) =>
                  onUpdateSettings({
                    musicVolume: Number(e.target.value) / 100,
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="sfx-vol"
                className="flex justify-between text-xs font-bold text-slate-300 mb-1"
              >
                <span>Sound Effects Volume</span>
                <span className="font-mono-nums">
                  {Math.round(saveData.settings.sfxVolume * 100)}%
                </span>
              </label>
              <input
                id="sfx-vol"
                type="range"
                min={0}
                max={100}
                value={Math.round(saveData.settings.sfxVolume * 100)}
                onChange={(e) =>
                  onUpdateSettings({
                    sfxVolume: Number(e.target.value) / 100,
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="crowd-cap"
                className="flex justify-between text-xs font-bold text-slate-300 mb-1"
              >
                <span>Max Rendered Runners (Mobile Performance)</span>
                <span className="font-mono-nums">
                  {saveData.settings.maxVisibleCrowd}
                </span>
              </label>
              <input
                id="crowd-cap"
                type="range"
                min={60}
                max={240}
                step={20}
                value={saveData.settings.maxVisibleCrowd}
                onChange={(e) =>
                  onUpdateSettings({
                    maxVisibleCrowd: Number(e.target.value),
                  })
                }
                className="w-full accent-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Mute All Audio</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ muted: !saveData.settings.muted })
                }
                className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  saveData.settings.muted
                    ? 'bg-rose-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {saveData.settings.muted ? 'Muted' : 'Active'}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  Reset Save Progress
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResetSave();
                      setConfirmReset(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-xs font-bold cursor-pointer"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <span className="text-xs text-slate-500 font-mono-nums">
                Record: {saveData.highestCrowdRecord}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
