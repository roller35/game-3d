import React from 'react';
import { Coins, Pause, Users, Volume2, VolumeX } from 'lucide-react';
import type { GamePhase, RunStats } from '../game/types';

interface GameHUDProps {
  phase: GamePhase;
  stats: RunStats;
  muted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  phase,
  stats,
  muted,
  onPause,
  onToggleMute,
}) => {
  if (phase !== 'playing' && phase !== 'final_battle') {
    return null;
  }

  const modeLabel =
    stats.mode === 'endless'
      ? 'ENDLESS'
      : stats.mode === 'time_attack'
      ? 'TIME ATTACK'
      : stats.mode === 'boss_rush'
      ? 'BOSS RUSH'
      : stats.mode === 'hardcore'
      ? 'HARDCORE'
      : stats.mode === 'army_survival'
      ? 'SURVIVAL'
      : stats.mode === 'challenge'
      ? 'CHALLENGE'
      : `LEVEL ${stats.levelId}`;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
      {/* Top Perimeter HUD Bar (<= 12% viewport height) */}
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Level & Progress */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/88 border border-slate-700/80 shadow-md shrink-0">
            <span className="font-display font-extrabold text-xs sm:text-sm tracking-wide text-sky-300 whitespace-nowrap shrink-0">
              {modeLabel}
            </span>
            {stats.mode === 'endless' ? (
              <span className="font-mono-nums font-bold text-sm text-white whitespace-nowrap shrink-0">
                {Math.round(stats.distance)}m
              </span>
            ) : (
              <div className="w-12 sm:w-28 h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-600 shrink-0">
                <div
                  className="h-full bg-amber-400 transition-all duration-150"
                  style={{ width: `${Math.round(stats.progress * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Center: Prominent Crowd Count */}
          <div
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 border-2 border-slate-900 shadow-lg"
            aria-label={`Army size ${stats.crowdCount}`}
          >
            <Users className="w-4 h-4 text-white shrink-0" />
            <span className="font-mono-nums font-extrabold text-lg sm:text-xl text-white leading-none">
              {stats.crowdCount}
            </span>
          </div>

          {/* Right: Coins + Utility Buttons */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/88 border border-slate-700/80 text-amber-300">
              <Coins className="w-4 h-4 shrink-0" />
              <span className="font-mono-nums font-bold text-sm text-white">
                {stats.coinsEarned}
              </span>
            </div>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900/88 hover:bg-slate-800 border border-slate-700 text-white cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-sky-300" />
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Pause game"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900/88 hover:bg-slate-800 border border-slate-700 text-white cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-row: Objective / Timer / Last Gate Feedback */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 text-slate-200 font-medium truncate max-w-[70%]">
            {stats.objectiveText}
          </span>

          {stats.timeRemainingSec !== null && (
            <span
              className={`font-mono-nums font-extrabold px-2.5 py-1 rounded-lg ${
                stats.timeRemainingSec <= 6
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900/85 text-amber-300'
              }`}
            >
              {stats.timeRemainingSec.toFixed(1)}s
            </span>
          )}
        </div>

        {/* Final Battle / Boss HP Banner */}
        {phase === 'final_battle' && (
          <div className="mt-1 mx-auto w-full max-w-md rounded-2xl bg-slate-900/92 border border-slate-700 p-3 shadow-xl">
            <div className="flex items-center justify-between text-sm font-display font-extrabold">
              <span className="text-sky-400">YOUR ARMY: {stats.crowdCount}</span>
              <span className="text-slate-400">VS</span>
              <span className="text-rose-400">
                {stats.bossName ? stats.bossName : `ENEMIES: ${stats.enemyTargetCount}`}
              </span>
            </div>
            {stats.bossMaxHp > 0 && (
              <div className="mt-2">
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-rose-500 transition-all duration-150"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.round((stats.bossHp / stats.bossMaxHp) * 100),
                      )}%`,
                    }}
                  />
                </div>
                {stats.bossWarning && (
                  <p className="mt-1 text-center text-xs font-bold text-amber-300">
                    {stats.bossWarning}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom minimal gate callout */}
      {stats.lastGateText && phase === 'playing' && (
        <div className="flex justify-center mb-2">
          <span
            className={`font-display font-black text-2xl text-stroke-dark ${
              stats.lastGateColor === 'gold'
                ? 'text-amber-300'
                : stats.lastGateColor === 'red'
                ? 'text-rose-400'
                : 'text-sky-300'
            }`}
          >
            {stats.lastGateText}
          </span>
        </div>
      )}
    </div>
  );
};
