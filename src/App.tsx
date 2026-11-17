import { useCallback, useEffect, useRef, useState } from 'react';
import { audioManager } from './game/audioManager';
import { CrowdRushEngine } from './game/engine';
import {
  ACHIEVEMENT_CATALOG,
  getLevelConfig,
  SKIN_CATALOG,
  UPGRADE_CATALOG,
} from './game/levels';
import {
  calculateLevelCoinReward,
  canClaimDailyReward,
  computeDailyRewardAmount,
  getUpgradeCost,
  getWorldForLevel,
  WORLD_ORDER,
} from './game/rules';
import { saveManager } from './game/saveManager';
import type {
  GameMode,
  GamePhase,
  RunStats,
  SaveData,
  SkinId,
  UpgradeId,
} from './game/types';
import { GameHUD } from './components/GameHUD';
import { GameModals, type ActiveModal } from './components/GameModals';
import { TitleScreen } from './components/TitleScreen';

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CrowdRushEngine | null>(null);

  const [saveData, setSaveData] = useState<SaveData>(() => saveManager.getData());
  const [phase, setPhase] = useState<GamePhase>('title');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [stats, setStats] = useState<RunStats>(() => {
    const lvl = getLevelConfig(saveManager.getData().unlockedLevel);
    return {
      mode: 'campaign',
      levelId: lvl.id,
      world: lvl.world,
      crowdCount: lvl.startCrowd,
      peakCrowd: lvl.startCrowd,
      crowdLost: 0,
      enemyTargetCount: lvl.finalArenaEnemyCount,
      distance: 0,
      totalLength: lvl.length,
      progress: 0,
      elapsedSec: 0,
      timeRemainingSec: null,
      coinsEarned: 0,
      riskyRoutesTaken: 0,
      bossHp: lvl.boss?.maxHp ?? 0,
      bossMaxHp: lvl.boss?.maxHp ?? 0,
      bossName: lvl.boss?.name ?? '',
      bossWarning: '',
      bossWave: 1,
      bossTotalWaves: lvl.boss?.waves ?? 1,
      formation: 'compact',
      objectiveText: '',
      lastGateText: '',
      lastGateColor: 'gold',
      defeatReason: '',
      bonusObjectiveMet: false,
      bossDefeated: false,
    };
  });

  const phaseRef = useRef<GamePhase>('title');
  phaseRef.current = phase;
  const activeModalRef = useRef<ActiveModal>(null);
  activeModalRef.current = activeModal;

  const handleRunFinished = useCallback(
    (outcome: 'victory' | 'defeat', finalStats: RunStats) => {
      const lvl = getLevelConfig(finalStats.levelId);
      const currentSave = saveManager.getData();

      let totalAwarded = finalStats.coinsEarned;
      if (outcome === 'victory') {
        totalAwarded += calculateLevelCoinReward({
          baseReward: lvl.baseCoinReward,
          survivingCrowd: finalStats.crowdCount,
          coinUpgradeLevel: currentSave.upgrades.coin_bonus ?? 0,
          bossMultiplier: lvl.boss?.rewardMultiplier ?? 1,
          objectiveMet: finalStats.bonusObjectiveMet,
          objectiveBonus: lvl.bonusObjective?.rewardCoins ?? 0,
        });
      } else if (finalStats.mode === 'endless') {
        totalAwarded += Math.floor(finalStats.distance / 15);
      }

      const nextSave = saveManager.update((draft) => {
        draft.coins += totalAwarded;
        draft.highestCrowdRecord = Math.max(
          draft.highestCrowdRecord,
          finalStats.peakCrowd,
        );

        if (finalStats.mode === 'endless') {
          draft.bestEndlessDistance = Math.max(
            draft.bestEndlessDistance,
            Math.round(finalStats.distance),
          );
        }

        if (outcome === 'victory') {
          if (
            finalStats.mode === 'campaign' &&
            !draft.completedLevels.includes(finalStats.levelId)
          ) {
            draft.completedLevels.push(finalStats.levelId);
          }
          if (finalStats.mode === 'campaign' && finalStats.levelId >= draft.unlockedLevel) {
            draft.unlockedLevel = Math.min(50, finalStats.levelId + 1);
            const nextWorld = getWorldForLevel(draft.unlockedLevel);
            const wIdx = WORLD_ORDER.indexOf(nextWorld);
            for (let i = 0; i <= wIdx; i++) {
              if (!draft.unlockedWorlds.includes(WORLD_ORDER[i])) {
                draft.unlockedWorlds.push(WORLD_ORDER[i]);
              }
            }
          }
          if (finalStats.bossDefeated) {
            draft.bossesDefeated += 1;
          }
          if (
            finalStats.bonusObjectiveMet &&
            lvl.bonusObjective &&
            !draft.completedChallenges.includes(lvl.bonusObjective.id)
          ) {
            draft.completedChallenges.push(lvl.bonusObjective.id);
          }
        }
      });

      setSaveData(nextSave);
      setStats({ ...finalStats, coinsEarned: totalAwarded });
    },
    [],
  );

  // Mount Three.js engine once
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const initialSave = saveManager.getData();
    audioManager.setPreferences(
      initialSave.settings.musicVolume,
      initialSave.settings.sfxVolume,
      initialSave.settings.muted,
    );

    const engine = new CrowdRushEngine(host, initialSave, {
      onHudUpdate: (nextPhase, nextStats) => {
        setPhase(nextPhase);
        setStats(nextStats);
      },
      onRunFinished: handleRunFinished,
    });
    engineRef.current = engine;

    // Support ?autostart=1 for instant gameplay entry
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startRun('campaign', initialSave.unlockedLevel);
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
      audioManager.dispose();
    };
  }, [handleRunFinished]);

  const startMode = useCallback((mode: GameMode, levelId?: number) => {
    audioManager.playClick();
    setActiveModal(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    engineRef.current?.startRun(mode, levelId);
  }, []);

  // Keyboard shortcuts: Enter/Space to start on Title, P/Escape to pause/resume, M to mute
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        const next = saveManager.update((d) => {
          d.settings.muted = !d.settings.muted;
        });
        setSaveData(next);
        engineRef.current?.updateSaveData(next);
        return;
      }

      if (phaseRef.current === 'title' && !activeModalRef.current) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startMode('campaign', saveManager.getData().unlockedLevel);
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (phaseRef.current === 'playing' || phaseRef.current === 'final_battle') {
          engineRef.current?.pause();
        } else if (phaseRef.current === 'paused') {
          engineRef.current?.resume();
        } else if (activeModalRef.current) {
          setActiveModal(null);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startMode]);

  const handleBuySkin = (skinId: SkinId) => {
    const skin = SKIN_CATALOG.find((s) => s.id === skinId);
    if (!skin) return;
    audioManager.playClick();
    const next = saveManager.update((d) => {
      if (d.ownedSkins.includes(skinId) || d.coins < skin.cost) return;
      d.coins -= skin.cost;
      d.ownedSkins.push(skinId);
      d.selectedSkin = skinId;
    });
    setSaveData(next);
    engineRef.current?.updateSaveData(next);
  };

  const handleSelectSkin = (skinId: SkinId) => {
    audioManager.playClick();
    const next = saveManager.update((d) => {
      if (d.ownedSkins.includes(skinId)) {
        d.selectedSkin = skinId;
      }
    });
    setSaveData(next);
    engineRef.current?.updateSaveData(next);
  };

  const handleBuyUpgrade = (upgradeId: UpgradeId) => {
    const def = UPGRADE_CATALOG.find((u) => u.id === upgradeId);
    if (!def) return;
    audioManager.playCoin();
    const next = saveManager.update((d) => {
      const lvl = d.upgrades[upgradeId] ?? 0;
      if (lvl >= def.maxLevel) return;
      const cost = getUpgradeCost(def.baseCost, def.costScale, lvl);
      if (d.coins < cost) return;
      d.coins -= cost;
      d.upgrades[upgradeId] = lvl + 1;
    });
    setSaveData(next);
    engineRef.current?.updateSaveData(next);
  };

  const handleClaimDaily = () => {
    const today = getTodayDateString();
    audioManager.playCoin();
    const next = saveManager.update((d) => {
      if (!canClaimDailyReward(d.lastDailyClaimDate, today)) return;
      d.dailyStreak = Math.min(7, d.dailyStreak + 1);
      d.lastDailyClaimDate = today;
      d.coins += computeDailyRewardAmount(d.dailyStreak);
    });
    setSaveData(next);
  };

  const handleClaimAchievement = (achievementId: string) => {
    const ach = ACHIEVEMENT_CATALOG.find((a) => a.id === achievementId);
    if (!ach) return;
    audioManager.playCoin();
    const next = saveManager.update((d) => {
      if (d.claimedAchievements.includes(achievementId)) return;
      d.claimedAchievements.push(achievementId);
      d.coins += ach.rewardCoins;
    });
    setSaveData(next);
  };

  const handleUpdateSettings = (patch: Partial<SaveData['settings']>) => {
    const next = saveManager.update((d) => {
      d.settings = { ...d.settings, ...patch };
    });
    setSaveData(next);
    engineRef.current?.updateSaveData(next);
  };

  const handleResetSave = () => {
    const next = saveManager.resetProgress();
    setSaveData(next);
    engineRef.current?.updateSaveData(next);
    engineRef.current?.loadTitleShowcase();
  };

  const todayStr = getTodayDateString();

  return (
    <main className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Dedicated isolated WebGL canvas host */}
      <div
        ref={canvasHostRef}
        data-testid="webgl-canvas-host"
        className="game-canvas-host absolute inset-0 w-full h-full"
      />

      {phase === 'title' && (
        <TitleScreen
          saveData={saveData}
          todayStr={todayStr}
          onPlayCampaign={(lvlId) => startMode('campaign', lvlId)}
          onStartMode={startMode}
          onOpenModal={(m) => {
            audioManager.playClick();
            setActiveModal(m);
          }}
        />
      )}

      <GameHUD
        phase={phase}
        stats={stats}
        muted={saveData.settings.muted}
        onPause={() => engineRef.current?.pause()}
        onToggleMute={() =>
          handleUpdateSettings({ muted: !saveData.settings.muted })
        }
      />

      <GameModals
        phase={phase}
        stats={stats}
        saveData={saveData}
        todayStr={todayStr}
        activeModal={activeModal}
        onCloseModal={() => setActiveModal(null)}
        onResume={() => engineRef.current?.resume()}
        onRestart={() => engineRef.current?.restartCurrentRun()}
        onReturnTitle={() => {
          setActiveModal(null);
          engineRef.current?.loadTitleShowcase();
        }}
        onStartMode={startMode}
        onNextBossRush={() => engineRef.current?.advanceNextBossRushStage()}
        onBuySkin={handleBuySkin}
        onSelectSkin={handleSelectSkin}
        onBuyUpgrade={handleBuyUpgrade}
        onClaimDaily={handleClaimDaily}
        onClaimAchievement={handleClaimAchievement}
        onUpdateSettings={handleUpdateSettings}
        onResetSave={handleResetSave}
      />
    </main>
  );
}
