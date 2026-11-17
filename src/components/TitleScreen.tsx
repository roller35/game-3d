import React from 'react';
import {
  Award,
  Coins,
  Compass,
  Play,
  Settings,
  ShoppingBag,
  Sparkles,
  Swords,
} from 'lucide-react';
import { canClaimDailyReward } from '../game/rules';
import { getLevelConfig, WORLD_THEMES } from '../game/levels';
import type { GameMode, SaveData } from '../game/types';

interface TitleScreenProps {
  saveData: SaveData;
  todayStr: string;
  onPlayCampaign: (levelId?: number) => void;
  onStartMode: (mode: GameMode, levelId?: number) => void;
  onOpenModal: (
    modal: 'levels' | 'modes' | 'shop' | 'rewards' | 'settings',
  ) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  saveData,
  todayStr,
  onPlayCampaign,
  onStartMode,
  onOpenModal,
}) => {
  const currentLvl = getLevelConfig(saveData.unlockedLevel);
  const worldTheme = WORLD_THEMES[currentLvl.world];
  const dailyAvailable = canClaimDailyReward(
    saveData.lastDailyClaimDate,
    todayStr,
  );

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none px-4 py-5 sm:px-8 sm:py-7">
      {/* Top Bar: Coins + Settings & Rewards */}
      <div className="flex items-center justify-between gap-3 w-full max-w-xl mx-auto pointer-events-auto">
        <div
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/88 border border-slate-700/80 shadow-lg"
          aria-label={`Coin balance ${saveData.coins}`}
        >
          <Coins className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="font-mono-nums font-bold text-base text-white">
            {saveData.coins.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenModal('rewards')}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/88 hover:bg-slate-800 border border-slate-700/80 text-white text-sm font-semibold transition-colors cursor-pointer"
            aria-label="Daily Rewards and Achievements"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>Rewards</span>
            {dailyAvailable && (
              <span className="ml-0.5 text-[11px] font-bold text-amber-300">
                !
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('settings')}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900/88 hover:bg-slate-800 border border-slate-700/80 text-white transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Upper Emblem Lockup (leaves center 3D crowd showcase open) */}
      <div className="flex flex-col items-center text-center mt-2 mb-auto pointer-events-none">
        <svg
          viewBox="0 0 360 96"
          className="w-72 sm:w-88 h-auto drop-shadow-[0_6px_14px_rgba(15,23,42,0.7)]"
          role="img"
          aria-label="Crowd Rush 3D"
        >
          <defs>
            <linearGradient id="crestGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="goldBar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <rect
            x="16"
            y="8"
            width="328"
            height="62"
            rx="16"
            fill="#0f172a"
            fillOpacity="0.9"
            stroke="#38bdf8"
            strokeWidth="3"
          />
          <rect x="26" y="15" width="308" height="48" rx="11" fill="url(#crestGrad)" />
          <text
            x="180"
            y="47"
            textAnchor="middle"
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="5"
            paintOrder="stroke fill"
            fontFamily="Outfit, sans-serif"
            fontWeight="900"
            fontSize="31"
            letterSpacing="1.5"
          >
            CROWD RUSH
          </text>
          <rect
            x="128"
            y="60"
            width="104"
            height="26"
            rx="8"
            fill="url(#goldBar)"
            stroke="#0f172a"
            strokeWidth="3"
          />
          <text
            x="180"
            y="78"
            textAnchor="middle"
            fill="#0f172a"
            fontFamily="Outfit, sans-serif"
            fontWeight="900"
            fontSize="16"
            letterSpacing="2"
          >
            3D
          </text>
        </svg>

        <p className="mt-1.5 text-xs sm:text-sm font-bold text-slate-900 bg-white/85 px-3 py-1 rounded-md shadow-sm">
          Level {currentLvl.id} · {currentLvl.name} · {worldTheme.name}
        </p>
      </div>

      {/* Bottom Primary Menu Dock */}
      <div className="w-full max-w-md mx-auto flex flex-col gap-2.5 pointer-events-auto">
        <button
          type="button"
          data-start="true"
          onClick={() => onPlayCampaign(saveData.unlockedLevel)}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 active:translate-y-0.5 border-b-4 border-blue-800 text-white font-display font-extrabold text-xl tracking-wide shadow-xl transition-all cursor-pointer"
        >
          <Play className="w-6 h-6 fill-current" />
          <span>PLAY LEVEL {saveData.unlockedLevel}</span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onStartMode('endless')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 border-b-4 border-amber-700 text-slate-950 font-display font-extrabold text-base shadow-lg transition-all cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            <span>Endless</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('levels')}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900/92 hover:bg-slate-800 border border-slate-700 text-white font-display font-bold text-base shadow-lg transition-colors cursor-pointer"
          >
            <Compass className="w-5 h-5 text-sky-400" />
            <span>Campaign (50)</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onOpenModal('modes')}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900/92 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-sm shadow-lg transition-colors cursor-pointer"
          >
            <Swords className="w-4 h-4 text-rose-400" />
            <span>Game Modes</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('shop')}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900/92 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-sm shadow-lg transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Shop & Upgrades</span>
          </button>
        </div>

        <p className="text-center text-xs font-semibold text-slate-900/90 bg-white/75 rounded-lg py-1 px-2 mt-0.5">
          Swipe or Drag to Steer · A/D or Arrows · P Pause
        </p>
      </div>
    </div>
  );
};
