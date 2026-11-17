import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { audioManager } from './audioManager';
import {
  createArticulatedCharacterRig,
  type ArticulatedCharacterRig,
} from './characterBuilder';
import { CrowdManager } from './crowdManager';
import { getLevelConfig, SKIN_CATALOG, WORLD_THEMES } from './levels';
import {
  LevelEntitiesBuilder,
  type CollectibleInstance,
  type EnemySquadInstance,
  type GateInstance,
  type ObstacleInstance,
  type RouteChoiceInstance,
} from './obstacleSystem';
import { ParticleSystem } from './particles';
import {
  applyGateOperation,
  computeDifficultyParams,
  computeStartingCrowd,
  evaluateChallengeObjective,
  resolveFinalBattle,
  WORLD_ORDER,
} from './rules';
import { disposeAllCachedTextures } from './textures';
import type {
  BossConfig,
  GameMode,
  GamePhase,
  LevelConfig,
  RunStats,
  SaveData,
  WorldId,
} from './types';
import { buildWorldEnvironment, type BuiltWorld } from './worldBuilder';

export interface EngineCallbacks {
  onHudUpdate: (phase: GamePhase, stats: RunStats) => void;
  onRunFinished: (
    outcome: 'victory' | 'defeat',
    stats: RunStats,
  ) => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class CrowdRushEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmremEnv: THREE.Texture;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private lastTimeMs = 0;
  private elapsed = 0;

  private crowdManager: CrowdManager;
  private particles: ParticleSystem;
  private entitiesBuilder: LevelEntitiesBuilder;
  private builtWorld: BuiltWorld | null = null;
  private levelGroup = new THREE.Group();

  // Active level / endless entities
  private gates: GateInstance[] = [];
  private obstacles: ObstacleInstance[] = [];
  private collectibles: CollectibleInstance[] = [];
  private enemySquads: EnemySquadInstance[] = [];
  private routeChoices: RouteChoiceInstance[] = [];

  // Final arena / Boss actors
  private arenaGroup = new THREE.Group();
  private bossRig: ArticulatedCharacterRig | null = null;
  private arenaEnemyMeshes: THREE.Mesh[] = [];
  private battleTimer = 0;
  private battleClashStepTimer = 0;
  private bossAttackTimer = 0;
  private bossWarningTimer = 0;

  // Endless mode dynamic chunk tracking
  private endlessCursorZ = -26;
  private endlessTrackOffset = 0;
  private endlessWorldIdx = 0;

  // Game State
  private phase: GamePhase = 'title';
  private saveData: SaveData;
  private activeLevel: LevelConfig;
  private stats: RunStats;
  private startCrowdCount = 10;

  // Player Movement & Input
  private playerX = 0;
  private targetX = 0;
  private playerZ = 0;
  private keysHeld = new Set<string>();
  private pointerDown = false;
  private lastPointerX = 0;
  private iceSlideTimer = 0;
  private windPushDir = 0;
  private windTimer = 0;

  // Camera Trauma & Effects
  private cameraTrauma = 0;
  private hitstopTimer = 0;
  private camPos = new THREE.Vector3(0, 12.5, 13.5);
  private camTarget = new THREE.Vector3(0, 1.2, -10);
  private hudEmitAccum = 0;

  // Boss Rush chain index
  private bossRushStage = 0;
  private readonly bossRushLevels = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

  constructor(
    container: HTMLElement,
    initialSave: SaveData,
    callbacks: EngineCallbacks,
  ) {
    this.container = container;
    this.saveData = initialSave;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled =
      !this.isSoftwareGl && initialSave.settings.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmremEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.pmremEnv;
    pmrem.dispose();

    const aspect = width / Math.max(1, height);
    const fov = aspect < 0.75 ? 58 : 48;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.2, 340);

    // Three-point + Hemisphere lighting rig
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x15803d, 0.78);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.45);
    this.sunLight.position.set(18, 32, 18);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 95;
    const d = 22;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0xbae6fd, 0.55);
    this.rimLight.position.set(-14, 16, -24);
    this.scene.add(this.rimLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.entitiesBuilder = new LevelEntitiesBuilder(maxAniso);
    this.particles = new ParticleSystem();
    this.scene.add(this.particles.mesh);
    this.scene.add(this.levelGroup);
    this.scene.add(this.arenaGroup);

    const skin =
      SKIN_CATALOG.find((s) => s.id === initialSave.selectedSkin) ??
      SKIN_CATALOG[0];
    this.crowdManager = new CrowdManager(skin);
    this.crowdManager.setVisibleCap(initialSave.settings.maxVisibleCrowd);
    this.scene.add(this.crowdManager.group);

    this.activeLevel = getLevelConfig(initialSave.unlockedLevel);
    this.stats = this.createInitialStats('campaign', this.activeLevel);

    this.loadTitleShowcase();
    this.attachEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.crowdManager.update(0.016, 0, 0, -5.5, 5.5, 10, true);
    this.camera.position.set(0, 9.2, 10.5);
    this.camera.lookAt(0, 0.8, -11);
    this.renderer.render(this.scene, this.camera);

    this.lastTimeMs = performance.now();
    this.scheduleNextTick();
  }

  private createInitialStats(mode: GameMode, level: LevelConfig): RunStats {
    return {
      mode,
      levelId: level.id,
      world: level.world,
      crowdCount: level.startCrowd,
      peakCrowd: level.startCrowd,
      crowdLost: 0,
      enemyTargetCount: level.finalArenaEnemyCount,
      distance: 0,
      totalLength: mode === 'endless' ? 0 : level.length,
      progress: 0,
      elapsedSec: 0,
      timeRemainingSec:
        mode === 'time_attack'
          ? level.timeLimitSec ?? Math.round(level.length / level.baseSpeed + 12)
          : level.bonusObjective?.type === 'time_limit'
          ? level.bonusObjective.targetValue
          : null,
      coinsEarned: 0,
      riskyRoutesTaken: 0,
      bossHp: level.boss?.maxHp ?? 0,
      bossMaxHp: level.boss?.maxHp ?? 0,
      bossName: level.boss?.name ?? '',
      bossWarning: '',
      bossWave: 1,
      bossTotalWaves: level.boss?.waves ?? 1,
      formation: 'compact',
      objectiveText: this.getObjectiveLabel(mode, level),
      lastGateText: '',
      lastGateColor: 'gold',
      defeatReason: '',
      bonusObjectiveMet: false,
      bossDefeated: false,
    };
  }

  private getObjectiveLabel(mode: GameMode, level: LevelConfig): string {
    if (mode === 'endless') return 'Survive & Grow Your Army';
    if (mode === 'time_attack') return 'Beat the Clock to the Arena';
    if (mode === 'army_survival') return 'Crush Every Enemy Wave';
    if (mode === 'hardcore') return 'Hardcore · High Stakes';
    if (mode === 'boss_rush') return `Boss Rush · ${level.boss?.name ?? 'Boss'}`;
    if (mode === 'challenge' && level.bonusObjective) {
      return level.bonusObjective.description;
    }
    if (level.boss) return `Boss: ${level.boss.name}`;
    return `Defeat ${level.finalArenaEnemyCount} Guards at the Arena`;
  }

  updateSaveData(nextSave: SaveData): void {
    this.saveData = nextSave;
    const skin =
      SKIN_CATALOG.find((s) => s.id === nextSave.selectedSkin) ??
      SKIN_CATALOG[0];
    this.crowdManager.applySkin(skin);
    this.crowdManager.setVisibleCap(nextSave.settings.maxVisibleCrowd);
    this.renderer.shadowMap.enabled =
      !this.isSoftwareGl && nextSave.settings.shadowsEnabled;
    audioManager.setPreferences(
      nextSave.settings.musicVolume,
      nextSave.settings.sfxVolume,
      nextSave.settings.muted,
    );
  }

  private clearStage(): void {
    this.gates = [];
    this.obstacles = [];
    this.collectibles = [];
    this.enemySquads = [];
    this.routeChoices = [];
    this.arenaEnemyMeshes = [];

    while (this.levelGroup.children.length > 0) {
      this.levelGroup.remove(this.levelGroup.children[0]);
    }
    while (this.arenaGroup.children.length > 0) {
      this.arenaGroup.remove(this.arenaGroup.children[0]);
    }
    if (this.bossRig) {
      this.bossRig.dispose();
      this.bossRig = null;
    }
    if (this.builtWorld) {
      this.scene.remove(this.builtWorld.root);
      this.builtWorld.dispose();
      this.builtWorld = null;
    }
  }

  private applyWorldAtmosphere(worldId: WorldId): void {
    const theme = WORLD_THEMES[worldId];
    this.scene.background = new THREE.Color(theme.skyHorizon);
    this.scene.fog = new THREE.Fog(theme.fogColor, 65, 220);
    this.hemiLight.color.setHex(theme.hemiSky);
    this.hemiLight.groundColor.setHex(theme.hemiGround);
    this.sunLight.color.setHex(theme.sunColor);
  }

  loadTitleShowcase(): void {
    this.clearStage();
    this.phase = 'title';
    document.body.dataset.state = 'title';
    audioManager.setMusicTrack('menu');

    const previewLevel = getLevelConfig(this.saveData.unlockedLevel);
    this.activeLevel = previewLevel;
    this.applyWorldAtmosphere(previewLevel.world);

    this.builtWorld = buildWorldEnvironment({
      worldId: previewLevel.world,
      trackLength: previewLevel.length,
      trackWidth: previewLevel.trackWidth,
      isEndless: false,
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
    });
    this.scene.add(this.builtWorld.root);

    // Showcase first couple gates & obstacles cleanly in view
    const maxAno = this.renderer.capabilities.getMaxAnisotropy();
    previewLevel.gates.slice(0, 4).forEach((g) => {
      const inst = this.entitiesBuilder.buildGate(g, maxAno);
      this.gates.push(inst);
      this.levelGroup.add(inst.group);
    });

    this.playerX = 0;
    this.targetX = 0;
    this.playerZ = 0;
    this.crowdManager.reset(18, 0, 0);
    this.crowdManager.setAnimState('running');
    this.stats = this.createInitialStats('campaign', previewLevel);
    this.emitHud();
  }

  startRun(mode: GameMode, levelId?: number): void {
    audioManager.unlock();
    this.clearStage();
    this.keysHeld.clear();
    this.pointerDown = false;
    this.iceSlideTimer = 0;
    this.windTimer = 0;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;

    if (mode === 'boss_rush' && levelId === undefined) {
      this.bossRushStage = 0;
    }

    const chosenLevelId =
      mode === 'boss_rush'
        ? this.bossRushLevels[this.bossRushStage % this.bossRushLevels.length]
        : levelId ?? this.saveData.unlockedLevel;

    const level = getLevelConfig(chosenLevelId);
    this.activeLevel = level;
    const isEndless = mode === 'endless';

    const worldId: WorldId = isEndless
      ? WORLD_ORDER[this.endlessWorldIdx % WORLD_ORDER.length]
      : level.world;
    this.applyWorldAtmosphere(worldId);

    this.builtWorld = buildWorldEnvironment({
      worldId,
      trackLength: level.length,
      trackWidth: level.trackWidth,
      isEndless,
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
    });
    this.scene.add(this.builtWorld.root);

    const diffParams = computeDifficultyParams(
      this.saveData.settings.difficulty,
      level.id,
      0,
    );

    const startCount = computeStartingCrowd(
      level.startCrowd,
      this.saveData.upgrades,
      mode,
      this.saveData.settings.difficulty,
    );
    this.startCrowdCount = startCount;

    this.stats = this.createInitialStats(mode, level);
    this.stats.crowdCount = startCount;
    this.stats.peakCrowd = startCount;
    this.stats.world = worldId;
    this.stats.enemyTargetCount = Math.round(
      level.finalArenaEnemyCount * diffParams.enemyMultiplier,
    );
    if (level.boss) {
      const scaledHp = Math.round(level.boss.maxHp * diffParams.bossHpMultiplier);
      this.stats.bossHp = scaledHp;
      this.stats.bossMaxHp = scaledHp;
    }

    const maxAno = this.renderer.capabilities.getMaxAnisotropy();

    if (isEndless) {
      this.endlessCursorZ = -26;
      this.endlessTrackOffset = 0;
      for (let i = 0; i < 6; i++) {
        this.spawnEndlessChunk();
      }
      audioManager.setMusicTrack('endless');
    } else {
      level.gates.forEach((g) => {
        const inst = this.entitiesBuilder.buildGate(g, maxAno);
        this.gates.push(inst);
        this.levelGroup.add(inst.group);
      });
      level.obstacles.forEach((o) => {
        const inst = this.entitiesBuilder.buildObstacle(o);
        this.obstacles.push(inst);
        this.levelGroup.add(inst.group);
      });
      level.collectibles.forEach((c) => {
        const inst = this.entitiesBuilder.buildCollectible(c);
        this.collectibles.push(inst);
        this.levelGroup.add(inst.group);
      });
      level.enemies.forEach((e) => {
        const scaledCount = Math.max(
          2,
          Math.round(e.count * diffParams.enemyMultiplier),
        );
        const inst = this.entitiesBuilder.buildEnemySquad({
          ...e,
          count: scaledCount,
        });
        this.enemySquads.push(inst);
        this.levelGroup.add(inst.group);
      });
      level.routeChoices.forEach((rc) => {
        const inst = this.entitiesBuilder.buildRouteChoice(rc, maxAno);
        this.routeChoices.push(inst);
        this.levelGroup.add(inst.group);
      });

      audioManager.setMusicTrack(level.boss ? 'boss' : 'campaign');
    }

    this.playerX = 0;
    this.targetX = 0;
    this.playerZ = 0;
    this.crowdManager.reset(startCount, 0, 0);
    this.crowdManager.setAnimState('running');

    this.camPos.set(0, 12.2, 13.5);
    this.camTarget.set(0, 1.2, -12);

    this.phase = 'playing';
    document.body.dataset.state = 'playing';
    this.emitHud();
  }

  private spawnEndlessChunk(): void {
    const dist = Math.abs(this.endlessCursorZ);
    const diff = computeDifficultyParams(this.saveData.settings.difficulty, 10, dist);
    const maxAno = this.renderer.capabilities.getMaxAnisotropy();
    const tw = 12.6;
    const z = this.endlessCursorZ;

    // Pair of gates
    const addOptions = [10, 20, 25, 50];
    const mulOptions = [2, 3, ...(dist > 350 ? [4] : [])];
    const useMul = Math.random() < 0.45;
    const goodVal = useMul
      ? mulOptions[Math.floor(Math.random() * mulOptions.length)]
      : addOptions[Math.floor(Math.random() * addOptions.length)];

    const leftGood = Math.random() > 0.5;
    const badOp = Math.random() < 0.45 ? 'sub' : 'add';
    const badVal = badOp === 'sub' ? Math.min(25, 6 + Math.floor(dist / 60)) : 5;

    const gL = this.entitiesBuilder.buildGate(
      {
        id: `end_g_${z}_l`,
        z,
        x: -tw * 0.24,
        width: tw * 0.43,
        op: leftGood ? (useMul ? 'mul' : 'add') : badOp,
        value: leftGood ? goodVal : badVal,
        behavior: dist > 160 && Math.random() < 0.35 ? 'moving' : 'static',
        moveAmplitude: 1.2,
        moveSpeed: 1.5,
      },
      maxAno,
    );
    const gR = this.entitiesBuilder.buildGate(
      {
        id: `end_g_${z}_r`,
        z,
        x: tw * 0.24,
        width: tw * 0.43,
        op: !leftGood ? (useMul ? 'mul' : 'add') : badOp,
        value: !leftGood ? goodVal : badVal,
        behavior: 'static',
      },
      maxAno,
    );
    this.gates.push(gL, gR);
    this.levelGroup.add(gL.group, gR.group);

    // Fair obstacle 14m ahead
    const obsKinds = [
      'concrete_wall',
      'rotating_hammer',
      'swinging_pendulum',
      'rotating_blade',
      'narrow_opening',
      'pillar',
    ] as const;
    const kind = obsKinds[Math.floor(Math.random() * obsKinds.length)];
    const obsX = (Math.random() - 0.5) * (tw * 0.52);
    const obs = this.entitiesBuilder.buildObstacle({
      id: `end_o_${z}`,
      kind,
      z: z - 14,
      x: obsX,
      width: kind === 'narrow_opening' ? tw * 0.92 : 3.6,
      length: 2.2,
      damage: Math.round((5 + Math.min(14, dist / 65)) * diff.damageMultiplier),
      speed: 1.8 + Math.min(1.6, dist / 400),
      gapWidth: 3.6,
    });
    this.obstacles.push(obs);
    this.levelGroup.add(obs.group);

    // Collectible & Enemy squad 24m ahead
    const col = this.entitiesBuilder.buildCollectible({
      id: `end_c_${z}`,
      type: Math.random() < 0.6 ? 'recruit' : 'coin',
      z: z - 22,
      x: (Math.random() - 0.5) * (tw * 0.65),
      value: 5 + Math.floor(dist / 120),
    });
    this.collectibles.push(col);
    this.levelGroup.add(col.group);

    if (Math.random() < 0.65) {
      const sq = this.entitiesBuilder.buildEnemySquad({
        id: `end_e_${z}`,
        archetype: dist > 260 ? 'elite_guard' : 'small_squad',
        z: z - 27,
        x: obsX > 0 ? -tw * 0.23 : tw * 0.23,
        count: Math.round((7 + dist / 35) * diff.enemyMultiplier),
        patrolAmplitude: 1.4,
        patrolSpeed: 1.4,
      });
      this.enemySquads.push(sq);
      this.levelGroup.add(sq.group);
    }

    this.endlessCursorZ -= 38;
  }

  private recycleEndlessSegments(): void {
    const pruneZ = this.playerZ + 22;
    const prune = <T extends { group: THREE.Group; spec: { z: number } }>(arr: T[]) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].spec.z > pruneZ) {
          this.levelGroup.remove(arr[i].group);
          arr.splice(i, 1);
        }
      }
    };
    prune(this.gates);
    prune(this.obstacles);
    prune(this.collectibles);
    prune(this.enemySquads);

    // Keep track floor endless by shifting world root forward cleanly
    if (this.builtWorld && this.playerZ < this.endlessTrackOffset - 180) {
      this.endlessTrackOffset -= 180;
      this.builtWorld.root.position.z = this.endlessTrackOffset;
    }

    while (this.endlessCursorZ > this.playerZ - 175) {
      this.spawnEndlessChunk();
    }
  }

  pause(): void {
    if (this.phase !== 'playing' && this.phase !== 'final_battle') return;
    this.phase = 'paused';
    document.body.dataset.state = 'paused';
    this.keysHeld.clear();
    this.pointerDown = false;
    this.emitHud();
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = this.stats.progress >= 1 && this.stats.mode !== 'endless' ? 'final_battle' : 'playing';
    document.body.dataset.state = 'playing';
    this.lastTimeMs = performance.now();
    this.emitHud();
  }

  restartCurrentRun(): void {
    this.startRun(this.stats.mode, this.stats.levelId);
  }

  advanceNextBossRushStage(): void {
    this.bossRushStage++;
    this.startRun('boss_rush');
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;

    const nowMs = performance.now();
    const rawDt = Math.max(0.001, (nowMs - this.lastTimeMs) / 1000);
    this.lastTimeMs = nowMs;
    const dt = Math.min(rawDt, 0.05);

    this.updateFrame(dt, nowMs);
    this.renderer.render(this.scene, this.camera);

    this.scheduleNextTick();
  }

  private updateFrame(dt: number, nowMs: number): void {
    if (this.phase === 'paused') {
      return;
    }

    this.elapsed += dt;
    this.particles.update(dt);

    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.2);
    }

    if (this.phase === 'title') {
      // Live 3D Title Showcase Orbit (crowd centered in open middle third above Play button)
      this.crowdManager.update(dt, this.elapsed, 0, -5.5, 5.5, 10, true);
      const orbitAngle = Math.sin(this.elapsed * 0.35) * 0.32;
      this.camera.position.set(
        Math.sin(orbitAngle) * 7.5,
        9.2 + Math.sin(this.elapsed * 0.5) * 0.45,
        10.5,
      );
      this.camera.lookAt(0, 0.8, -11);
      return;
    }

    if (this.phase === 'victory' || this.phase === 'defeat') {
      this.crowdManager.update(
        dt,
        this.elapsed,
        this.playerX,
        this.playerZ,
        this.activeLevel.trackWidth / 2,
        6,
        false,
      );
      if (this.bossRig) {
        this.bossRig.mixer.update(dt);
      }
      this.updateCamera(dt);
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateCamera(dt);
      return;
    }

    if (this.phase === 'final_battle') {
      this.updateFinalBattle(dt);
      this.updateCamera(dt);
      return;
    }

    // Active Playing Run
    this.stats.elapsedSec += dt;

    // Time Attack / Timed Challenge countdown
    if (this.stats.timeRemainingSec !== null) {
      this.stats.timeRemainingSec = Math.max(
        0,
        this.stats.timeRemainingSec - dt,
      );
      if (this.stats.timeRemainingSec <= 0) {
        this.triggerDefeat('Time expired before reaching the arena!');
        return;
      }
    }

    const diff = computeDifficultyParams(
      this.saveData.settings.difficulty,
      this.activeLevel.id,
      this.stats.distance,
    );
    const forwardSpeed = this.activeLevel.baseSpeed * diff.speedMultiplier;
    const agilityMult = 1 + (this.saveData.upgrades.agility ?? 0) * 0.08;
    const halfTrack = this.activeLevel.trackWidth / 2 - 0.65;

    // Keyboard steering
    let keyAxis = 0;
    if (this.keysHeld.has('ArrowLeft') || this.keysHeld.has('KeyA')) keyAxis -= 1;
    if (this.keysHeld.has('ArrowRight') || this.keysHeld.has('KeyD')) keyAxis += 1;
    if (keyAxis !== 0) {
      this.targetX += keyAxis * 11.5 * agilityMult * dt;
    }
    if (this.windTimer > 0) {
      this.windTimer -= dt;
      this.targetX += this.windPushDir * 5.2 * dt;
    }
    this.targetX = THREE.MathUtils.clamp(this.targetX, -halfTrack, halfTrack);

    const steerDamp = this.iceSlideTimer > 0 ? 4.2 : 14 * agilityMult;
    if (this.iceSlideTimer > 0) this.iceSlideTimer -= dt;
    this.playerX = THREE.MathUtils.damp(this.playerX, this.targetX, steerDamp, dt);
    this.playerZ -= forwardSpeed * dt;
    this.stats.distance = Math.max(0, -this.playerZ);

    if (this.stats.mode !== 'endless') {
      this.stats.progress = Math.min(1, this.stats.distance / this.activeLevel.length);
    } else {
      this.recycleEndlessSegments();
    }

    audioManager.playFootstep(nowMs);

    // Update dynamic gates, obstacles, and route choices
    this.updateGates(dt);
    this.updateObstacles(dt, diff.damageMultiplier);
    this.updateCollectibles();
    this.updateEnemySquads(dt);
    this.updateRouteChoices();

    this.crowdManager.update(
      dt,
      this.elapsed,
      this.playerX,
      this.playerZ,
      this.activeLevel.trackWidth / 2,
      forwardSpeed * 0.95,
      true,
    );

    // Update shadow sun position to stay locked on player crowd
    this.sunLight.position.set(this.playerX + 16, 30, this.playerZ + 14);
    this.sunLight.target.position.set(this.playerX, 0, this.playerZ - 10);

    // Check defeat if crowd wiped out
    if (this.crowdManager.getCount() <= 0) {
      this.triggerDefeat('Your army was wiped out by hazards!');
      return;
    }

    // Check campaign finish line -> transition to Final Battle Arena!
    if (
      this.stats.mode !== 'endless' &&
      this.playerZ <= -this.activeLevel.length
    ) {
      this.enterFinalBattle();
      return;
    }

    this.updateCamera(dt);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateGates(dt: number): void {
    const spread = this.crowdManager.getCrowdSpreadHalfWidth();

    for (const g of this.gates) {
      if (g.spec.behavior === 'moving' && g.spec.moveAmplitude) {
        g.currentX =
          g.spec.x +
          Math.sin(this.elapsed * (g.spec.moveSpeed ?? 1.5)) *
            g.spec.moveAmplitude;
        g.group.position.x = g.currentX;
      } else if (g.spec.behavior === 'timed' || g.spec.behavior === 'closing') {
        const period = g.spec.cyclePeriod ?? 3.2;
        const cycle = (this.elapsed % period) / period;
        g.isOpen = cycle < 0.65;
        g.panelMesh.visible = g.isOpen;
        g.group.scale.y = g.isOpen ? 1 : 0.25;
      }

      if (g.triggered) {
        if (g.triggerAnim < 1) {
          g.triggerAnim = Math.min(1, g.triggerAnim + dt * 5);
          g.panelMesh.scale.setScalar(1 + g.triggerAnim * 0.25);
          (g.panelMesh.material as THREE.MeshStandardMaterial).opacity =
            Math.max(0, 0.92 * (1 - g.triggerAnim));
        }
        continue;
      }

      // Check crossing gate Z
      if (Math.abs(this.playerZ - g.spec.z) < 1.15) {
        const overlapX =
          Math.abs(this.playerX - g.currentX) < g.spec.width / 2 + spread * 0.45;
        if (overlapX && g.isOpen) {
          g.triggered = true;
          // Also mark sibling paired gate on same Z as consumed so player doesn't double-trigger wide crowds unfairly
          for (const sibling of this.gates) {
            if (sibling !== g && Math.abs(sibling.spec.z - g.spec.z) < 0.5) {
              sibling.triggered = true;
            }
          }

          const seed = (Math.abs(this.playerZ) * 0.13 + this.elapsed) % 1;
          const res = applyGateOperation(
            this.crowdManager.getCount(),
            g.spec.op,
            g.spec.value,
            seed,
          );
          this.crowdManager.setCount(res.nextCrowd, res.delta > 0);
          this.stats.crowdCount = res.nextCrowd;
          this.stats.peakCrowd = Math.max(this.stats.peakCrowd, res.nextCrowd);
          if (res.delta < 0) {
            this.stats.crowdLost += Math.abs(res.delta);
          }
          this.stats.lastGateText = res.resolvedLabel;
          this.stats.lastGateColor =
            res.delta >= 0
              ? g.spec.op === 'mul'
                ? 'gold'
                : 'cyan'
              : 'red';

          if (g.spec.op === 'mul' && res.delta > 0) {
            audioManager.playGateMultiplier();
            this.particles.emitBurst(this.playerX, 1.4, this.playerZ, 0xfacc15, 18, 7, 1.1);
          } else if (res.delta >= 0) {
            audioManager.playGatePositive();
            this.particles.emitBurst(this.playerX, 1.4, this.playerZ, 0x38bdf8, 12, 5.5, 0.9);
          } else {
            audioManager.playGateNegative();
            this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
            this.particles.emitBurst(this.playerX, 1.4, this.playerZ, 0xef4444, 14, 6, 1.0);
          }
          this.emitHud();
        }
      }
    }
  }

  private updateObstacles(dt: number, damageMultiplier: number): void {
    const shieldLevel = this.saveData.upgrades.recovery_shield ?? 0;
    const shieldMitigation = Math.max(0.55, 1 - shieldLevel * 0.05);
    const spread = this.crowdManager.getCrowdSpreadHalfWidth();
    let onNarrowBridge = false;

    for (const o of this.obstacles) {
      if (o.hitCooldown > 0) o.hitCooldown -= dt;

      // Animate moving obstacles
      const spd = o.spec.speed ?? 1.8;
      const phase = o.spec.phase ?? 0;
      if (o.spec.kind === 'rotating_hammer' && o.animatedPart) {
        o.animatedPart.rotation.y += dt * spd * 1.8;
      } else if (o.spec.kind === 'rotating_blade' && o.animatedPart) {
        o.animatedPart.rotation.y += dt * spd * 2.5;
      } else if (o.spec.kind === 'swinging_pendulum' && o.animatedPart) {
        const angle = Math.sin(this.elapsed * spd + phase) * 0.95;
        o.animatedPart.rotation.z = angle;
        o.currentX = o.spec.x + Math.sin(angle) * 4.0;
      } else if (
        o.spec.kind === 'moving_wall' ||
        o.spec.kind === 'sliding_barrier' ||
        o.spec.kind === 'moving_platform'
      ) {
        o.currentX =
          o.spec.x + Math.sin(this.elapsed * spd + phase) * (o.spec.amplitude ?? 2.6);
        o.group.position.x = o.currentX;
      } else if (o.spec.kind === 'disappearing_platform') {
        const visible = Math.sin(this.elapsed * 1.8 + phase) > -0.35;
        o.active = visible;
        o.group.visible = visible;
      }

      // Check Z proximity
      const dz = Math.abs(this.playerZ - o.spec.z);
      const halfLen = o.spec.length / 2 + 0.7;
      if (dz > halfLen) continue;

      if (
        o.spec.kind === 'narrow_bridge' ||
        o.spec.kind === 'broken_bridge' ||
        o.spec.kind === 'zigzag_bridge' ||
        o.spec.kind === 'moving_platform' ||
        o.spec.kind === 'collapsing_platform'
      ) {
        onNarrowBridge = true;
        if (o.spec.kind === 'collapsing_platform' && o.animatedPart) {
          o.collapseProgress = Math.min(1, o.collapseProgress + dt * 0.45);
          o.animatedPart.position.y = 0.16 - o.collapseProgress * 0.5;
        }
        // If player is way off the bridge width, trim outer runners
        if (
          Math.abs(this.playerX - o.currentX) > o.spec.width / 2 + 0.5 &&
          o.hitCooldown <= 0
        ) {
          o.hitCooldown = 0.5;
          this.applyCrowdDamage(Math.max(2, Math.round(o.spec.damage * 0.6)));
        }
        continue;
      }

      if (o.spec.kind === 'ice_surface') {
        if (Math.abs(this.playerX - o.currentX) < o.spec.width / 2 + spread * 0.5) {
          this.iceSlideTimer = 0.35;
        }
        continue;
      }

      if (o.spec.kind === 'wind_zone') {
        if (Math.abs(this.playerX - o.currentX) < o.spec.width / 2 + spread * 0.5) {
          this.windPushDir = o.currentX > 0 ? -1 : 1;
          this.windTimer = 0.35;
        }
        continue;
      }

      if (o.hitCooldown > 0 || !o.active) continue;

      if (o.spec.kind === 'narrow_opening') {
        const gapW = o.spec.gapWidth ?? 3.4;
        if (Math.abs(this.playerX - o.currentX) > gapW / 2 - 0.35) {
          o.hitCooldown = 0.75;
          const dmg = Math.max(
            2,
            Math.round(o.spec.damage * damageMultiplier * shieldMitigation),
          );
          this.applyCrowdDamage(dmg);
        }
        continue;
      }

      // Standard collision check
      const hitWidth = o.spec.width / 2 + spread * 0.45;
      if (Math.abs(this.playerX - o.currentX) < hitWidth) {
        o.hitCooldown = 0.85;
        const dmg = Math.max(
          2,
          Math.round(o.spec.damage * damageMultiplier * shieldMitigation),
        );
        this.applyCrowdDamage(dmg);
      }
    }

    // Dynamic formation adaptation!
    const desiredFormation = onNarrowBridge
      ? 'narrow_bridge'
      : this.crowdManager.getCount() > 75
      ? 'wide'
      : 'compact';
    this.crowdManager.setFormation(desiredFormation);
    this.stats.formation = desiredFormation;
  }

  private applyCrowdDamage(rawLoss: number): void {
    const lost = this.crowdManager.removeCount(rawLoss);
    if (lost <= 0) return;
    this.stats.crowdCount = this.crowdManager.getCount();
    this.stats.crowdLost += lost;
    this.hitstopTimer = 0.035;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.48);
    audioManager.playObstacleHit();
    this.particles.emitBurst(this.playerX, 1.0, this.playerZ, 0xef4444, 16, 6.5, 1);
    this.emitHud();
  }

  private updateCollectibles(): void {
    const spread = this.crowdManager.getCrowdSpreadHalfWidth();
    for (const c of this.collectibles) {
      if (c.collected) continue;
      c.group.rotation.y += 0.04;
      if (
        Math.abs(this.playerZ - c.spec.z) < 1.35 &&
        Math.abs(this.playerX - c.spec.x) < 1.35 + spread * 0.5
      ) {
        c.collected = true;
        c.group.visible = false;
        if (c.spec.type === 'coin') {
          const coinMult = 1 + (this.saveData.upgrades.coin_bonus ?? 0) * 0.15;
          this.stats.coinsEarned += Math.round(c.spec.value * coinMult);
          audioManager.playCoin();
          this.particles.emitBurst(c.spec.x, 1.2, c.spec.z, 0xfacc15, 10, 5, 0.8);
        } else {
          this.crowdManager.addCount(c.spec.value);
          this.stats.crowdCount = this.crowdManager.getCount();
          this.stats.peakCrowd = Math.max(
            this.stats.peakCrowd,
            this.stats.crowdCount,
          );
          audioManager.playCollect();
          this.particles.emitBurst(c.spec.x, 1.0, c.spec.z, 0x38bdf8, 12, 5, 0.9);
        }
        this.emitHud();
      }
    }
  }

  private updateEnemySquads(dt: number): void {
    const spread = this.crowdManager.getCrowdSpreadHalfWidth();
    for (const sq of this.enemySquads) {
      if (sq.defeated) continue;
      if (sq.spec.patrolAmplitude) {
        sq.currentX =
          sq.spec.x +
          Math.sin(this.elapsed * (sq.spec.patrolSpeed ?? 1.2)) *
            sq.spec.patrolAmplitude;
        sq.group.position.x = sq.currentX;
      }

      if (
        Math.abs(this.playerZ - sq.spec.z) < 2.1 &&
        Math.abs(this.playerX - sq.currentX) < 1.8 + spread * 0.65
      ) {
        sq.defeated = true;
        sq.group.visible = false;
        const playerNow = this.crowdManager.getCount();
        const clash = resolveFinalBattle(
          playerNow,
          sq.remaining,
          undefined,
          this.saveData.upgrades.recovery_shield ?? 0,
        );
        if (clash.victory) {
          const lost = playerNow - clash.survivingPlayer;
          this.crowdManager.setCount(clash.survivingPlayer, false);
          this.stats.crowdCount = clash.survivingPlayer;
          this.stats.crowdLost += lost;
          this.stats.coinsEarned += 15;
          audioManager.playEnemyClash();
          this.hitstopTimer = 0.04;
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);
          this.particles.emitBurst(sq.currentX, 1.2, sq.spec.z, 0xef4444, 20, 7, 1.1);
        } else {
          this.crowdManager.setCount(0, false);
          this.stats.crowdCount = 0;
          this.triggerDefeat('Overwhelmed by enemy squad!');
          return;
        }
        this.emitHud();
      }
    }
  }

  private updateRouteChoices(): void {
    for (const rc of this.routeChoices) {
      if (rc.triggeredRouteIdx !== null) continue;
      const triggerZ = rc.spec.z - rc.spec.length * 0.85;
      if (Math.abs(this.playerZ - triggerZ) < 1.4) {
        // Pick closest route lane
        let bestIdx = 0;
        let bestDist = Infinity;
        rc.spec.routes.forEach((r, idx) => {
          const d = Math.abs(this.playerX - r.laneX);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        });
        rc.triggeredRouteIdx = bestIdx;
        const chosen = rc.spec.routes[bestIdx];
        if (chosen.riskLabel !== 'SAFE') {
          this.stats.riskyRoutesTaken++;
        }
        const res = applyGateOperation(
          this.crowdManager.getCount(),
          chosen.gateOp,
          chosen.gateValue,
        );
        this.crowdManager.setCount(res.nextCrowd, true);
        this.stats.crowdCount = res.nextCrowd;
        this.stats.peakCrowd = Math.max(this.stats.peakCrowd, res.nextCrowd);
        this.stats.lastGateText = `${chosen.riskLabel} ${res.resolvedLabel}`;
        this.stats.lastGateColor = chosen.riskLabel === 'EXTREME' ? 'gold' : 'cyan';
        audioManager.playGateMultiplier();
        this.particles.emitBurst(this.playerX, 1.5, this.playerZ, 0xfacc15, 20, 7, 1.1);
        this.emitHud();
      }
    }
  }

  private enterFinalBattle(): void {
    this.phase = 'final_battle';
    this.battleTimer = 0;
    this.battleClashStepTimer = 0;
    this.bossAttackTimer = 1.4;
    this.bossWarningTimer = 0;
    this.crowdManager.setFormation('boss_battle');
    this.crowdManager.setAnimState('attacking');
    this.stats.formation = 'boss_battle';

    const arenaZ = this.builtWorld?.arenaCenterZ ?? -this.activeLevel.length - 14;
    this.playerX = 0;
    this.targetX = 0;
    this.playerZ = arenaZ + 5.5;

    // Spawn Arena Enemy Formation
    const enemyCount = this.stats.enemyTargetCount;
    const visualEnemies = Math.min(36, Math.max(6, Math.round(enemyCount / 2)));
    const eGeo = new THREE.CapsuleGeometry(0.24, 0.65, 6, 10);
    const eMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.45,
      metalness: 0.2,
    });
    const cols = 6;
    for (let i = 0; i < visualEnemies; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const m = new THREE.Mesh(eGeo, eMat);
      m.position.set(
        (col - (cols - 1) / 2) * 1.15,
        0.75,
        arenaZ - 3.5 - row * 1.1,
      );
      m.castShadow = true;
      this.arenaGroup.add(m);
      this.arenaEnemyMeshes.push(m);
    }

    // Spawn Boss if level has a Boss
    if (this.activeLevel.boss) {
      audioManager.playBossIntro();
      this.bossRig = createArticulatedCharacterRig({
        primaryColor: 0x991b1b,
        secondaryColor: 0x334155,
        accentColor: 0xfacc15,
        visorColor: 0xef4444,
        scale: 2.8,
        metalness: 0.65,
        roughness: 0.3,
        isBoss: true,
      });
      this.bossRig.root.position.set(0, 0, arenaZ - 5.5);
      this.bossRig.playState('attacking', 0.1);
      this.arenaGroup.add(this.bossRig.root);
    }

    this.emitHud();
  }

  private updateFinalBattle(dt: number): void {
    this.battleTimer += dt;
    this.battleClashStepTimer += dt;

    const arenaZ = this.builtWorld?.arenaCenterZ ?? -this.activeLevel.length - 14;
    this.crowdManager.update(
      dt,
      this.elapsed,
      0,
      THREE.MathUtils.damp(this.playerZ, arenaZ + 1.5, 3.2, dt),
      8,
      12,
      true,
    );
    this.playerZ = this.crowdManager.getCenterZ();

    if (this.bossRig) {
      this.bossRig.mixer.update(dt);
      const boss: BossConfig = this.activeLevel.boss!;
      this.bossAttackTimer -= dt;
      if (this.bossAttackTimer <= 0.65 && this.bossAttackTimer > 0) {
        this.stats.bossWarning = `${boss.name} charging strike!`;
      } else {
        this.stats.bossWarning = '';
      }

      if (this.bossAttackTimer <= 0) {
        this.bossAttackTimer = boss.attackInterval;
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.45);
        audioManager.playBattleHit();
        this.particles.emitBurst(0, 1.5, arenaZ, 0xf97316, 18, 7.5, 1.1);

        // Player army damages Boss proportional to surviving crowd
        const playerPower = this.crowdManager.getCount();
        const playerDps = Math.max(12, Math.round(playerPower * 0.95));
        this.stats.bossHp = Math.max(0, this.stats.bossHp - playerDps);

        // Boss knocks out a few front-line runners
        if (this.stats.bossHp > 0) {
          const loss = Math.min(
            playerPower,
            Math.max(1, Math.round(boss.attackDamage)),
          );
          this.crowdManager.removeCount(loss);
          this.stats.crowdCount = this.crowdManager.getCount();
          this.stats.crowdLost += loss;
        }
        this.emitHud();
      }
    }

    // Periodic clash visual bursts
    if (this.battleClashStepTimer >= 0.35) {
      this.battleClashStepTimer = 0;
      audioManager.playBattleHit();
      this.particles.emitBurst(
        (Math.random() - 0.5) * 3.5,
        1.2,
        arenaZ - 1,
        0x38bdf8,
        10,
        5,
        0.9,
      );
      if (this.arenaEnemyMeshes.length > 0 && this.battleTimer > 0.6) {
        const pop = this.arenaEnemyMeshes.pop();
        if (pop) pop.visible = false;
      }
    }

    // Resolve final deterministic outcome after stylized clash beat (~2.2s, or boss HP 0)
    const bossDefeated = !this.activeLevel.boss || this.stats.bossHp <= 0;
    if (this.crowdManager.getCount() <= 0) {
      this.triggerDefeat(
        this.activeLevel.boss
          ? `Defeated by ${this.activeLevel.boss.name}`
          : 'Your army fell in the Final Arena!',
      );
      return;
    }

    if (this.battleTimer >= 2.2 && (!this.activeLevel.boss || bossDefeated || this.battleTimer >= 4.0)) {
      const outcome = resolveFinalBattle(
        this.crowdManager.getCount(),
        this.stats.enemyTargetCount,
        this.activeLevel.boss,
        this.saveData.upgrades.recovery_shield ?? 0,
      );

      if (outcome.victory) {
        this.crowdManager.setCount(outcome.survivingPlayer, true);
        this.stats.crowdCount = outcome.survivingPlayer;
        this.stats.bossHp = 0;
        this.stats.bossDefeated = Boolean(this.activeLevel.boss);
        this.triggerVictory();
      } else {
        this.crowdManager.setCount(0, false);
        this.stats.crowdCount = 0;
        this.triggerDefeat(
          `Needed ${outcome.effectiveEnemyPower} power to break the guard!`,
        );
      }
    }
  }

  private triggerVictory(): void {
    this.phase = 'victory';
    document.body.dataset.state = 'gameover';
    this.crowdManager.setAnimState('victory');
    if (this.bossRig) {
      this.bossRig.playState('defeat', 0.12);
    }
    this.arenaEnemyMeshes.forEach((m) => (m.visible = false));
    audioManager.playVictory();
    audioManager.setMusicTrack('victory');
    this.particles.emitBurst(this.playerX, 2.2, this.playerZ, 0xfacc15, 36, 9, 1.3);

    if (this.activeLevel.bonusObjective) {
      this.stats.bonusObjectiveMet = evaluateChallengeObjective(
        this.activeLevel.bonusObjective,
        {
          victory: true,
          crowdCount: this.stats.crowdCount,
          crowdLost: this.stats.crowdLost,
          elapsedSec: this.stats.elapsedSec,
          riskyRoutesTaken: this.stats.riskyRoutesTaken,
          enemyTargetCount: this.stats.enemyTargetCount,
          startCrowd: this.startCrowdCount,
        },
      );
    }

    this.emitHud();
    this.callbacks.onRunFinished('victory', { ...this.stats });
  }

  private triggerDefeat(reason: string): void {
    this.phase = 'defeat';
    document.body.dataset.state = 'gameover';
    this.stats.defeatReason = reason;
    this.crowdManager.setAnimState('defeat');
    audioManager.playDefeat();
    audioManager.setMusicTrack('none');
    this.emitHud();
    this.callbacks.onRunFinished('defeat', { ...this.stats });
  }

  private updateCamera(dt: number): void {
    const isBattle =
      this.phase === 'final_battle' ||
      this.phase === 'victory' ||
      this.phase === 'defeat';

    const desiredX = isBattle ? 0 : this.playerX * 0.42;
    const desiredY = isBattle ? 13.5 : 11.8;
    const desiredZ = isBattle ? this.playerZ + 16.5 : this.playerZ + 13.5;

    const k = 7.5;
    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, desiredX, k, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, desiredY, k, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, desiredZ, k, dt);

    const lookZ = isBattle ? this.playerZ - 5 : this.playerZ - 11;
    this.camTarget.x = THREE.MathUtils.damp(this.camTarget.x, this.playerX * 0.35, k, dt);
    this.camTarget.y = THREE.MathUtils.damp(this.camTarget.y, 1.2, k, dt);
    this.camTarget.z = THREE.MathUtils.damp(this.camTarget.z, lookZ, k, dt);

    const shake = this.cameraTrauma * this.cameraTrauma * 0.55;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * shake,
      this.camPos.y + (Math.random() - 0.5) * shake,
      this.camPos.z,
    );
    this.camera.lookAt(this.camTarget);
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate(this.phase, { ...this.stats });
  }

  // Input & Window Events
  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    this.camera.fov = aspect < 0.75 ? 58 : 48;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keysHeld.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private onBlur = (): void => {
    this.keysHeld.clear();
    this.pointerDown = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.phase !== 'playing') return;
    audioManager.unlock();
    this.pointerDown = true;
    this.lastPointerX = e.clientX;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown || this.phase !== 'playing') return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const agilityMult = 1 + (this.saveData.upgrades.agility ?? 0) * 0.08;
    const halfTrack = this.activeLevel.trackWidth / 2 - 0.65;
    const worldScale = (this.activeLevel.trackWidth * 1.45 * agilityMult) / w;
    this.targetX = THREE.MathUtils.clamp(
      this.targetX + dx * worldScale,
      -halfTrack,
      halfTrack,
    );
  };

  private onPointerUp = (): void => {
    this.pointerDown = false;
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private attachEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('webglcontextlost', this.onContextLost);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('webglcontextlost', this.onContextLost);

    this.clearStage();
    this.crowdManager.dispose();
    this.particles.dispose();
    this.entitiesBuilder.dispose();
    this.pmremEnv.dispose();
    disposeAllCachedTextures();
    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
