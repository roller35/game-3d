import * as THREE from 'three';
import { getGateSignTexture, getHazardStripeTexture } from './textures';
import type {
  CollectibleSpec,
  EnemySquadSpec,
  GateSpec,
  ObstacleSpec,
  RouteChoiceSpec,
} from './types';

export interface GateInstance {
  spec: GateSpec;
  group: THREE.Group;
  panelMesh: THREE.Mesh;
  currentX: number;
  triggered: boolean;
  isOpen: boolean;
  triggerAnim: number;
}

export interface ObstacleInstance {
  spec: ObstacleSpec;
  group: THREE.Group;
  animatedPart?: THREE.Object3D;
  currentX: number;
  active: boolean;
  hitCooldown: number;
  collapseProgress: number;
}

export interface CollectibleInstance {
  spec: CollectibleSpec;
  group: THREE.Group;
  collected: boolean;
}

export interface EnemySquadInstance {
  spec: EnemySquadSpec;
  group: THREE.Group;
  remaining: number;
  currentX: number;
  defeated: boolean;
  badgeEl?: THREE.Sprite;
}

export interface RouteChoiceInstance {
  spec: RouteChoiceSpec;
  group: THREE.Group;
  triggeredRouteIdx: number | null;
}

function makeTextSprite(text: string, bgColor: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(8, 12, 176, 72, 20);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  ctx.font = '900 44px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 96, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.3, 1.15, 1);
  return sprite;
}

export class LevelEntitiesBuilder {
  private sharedDisposables: { dispose: () => void }[] = [];

  private pillarGeo = new THREE.CylinderGeometry(0.24, 0.28, 3.8, 10);
  private capGeo = new THREE.SphereGeometry(0.32, 10, 8);
  private frameMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.3,
    metalness: 0.4,
  });
  private hazardMat: THREE.MeshStandardMaterial;

  constructor(maxAnisotropy: number) {
    const hazardTex = getHazardStripeTexture(maxAnisotropy);
    this.hazardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: hazardTex,
      roughness: 0.55,
      metalness: 0.2,
    });
    this.sharedDisposables.push(this.pillarGeo, this.capGeo, this.frameMat, this.hazardMat);
  }

  buildGate(spec: GateSpec, maxAnisotropy: number): GateInstance {
    const group = new THREE.Group();
    group.position.set(spec.x, 0, spec.z);

    const label =
      spec.label ??
      (spec.op === 'add'
        ? `+${spec.value}`
        : spec.op === 'mul'
        ? `×${spec.value}`
        : spec.op === 'sub'
        ? `-${spec.value}`
        : '?');

    const variant =
      spec.op === 'sub'
        ? 'red'
        : spec.op === 'mystery'
        ? 'mystery'
        : spec.behavior === 'risk_reward'
        ? 'risk'
        : 'yellow';

    const tex = getGateSignTexture(label, variant, maxAnisotropy);

    const panelGeo = new THREE.BoxGeometry(spec.width - 0.35, 3.1, 0.22);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex,
      transparent: true,
      opacity: 0.92,
      roughness: 0.28,
      metalness: 0.1,
    });
    const panelMesh = new THREE.Mesh(panelGeo, panelMat);
    panelMesh.position.y = 1.9;
    group.add(panelMesh);

    const leftPost = new THREE.Mesh(this.pillarGeo, this.frameMat);
    leftPost.position.set(-spec.width / 2 + 0.12, 1.9, 0);
    leftPost.castShadow = true;

    const rightPost = new THREE.Mesh(this.pillarGeo, this.frameMat);
    rightPost.position.set(spec.width / 2 - 0.12, 1.9, 0);
    rightPost.castShadow = true;

    const leftCap = new THREE.Mesh(this.capGeo, this.frameMat);
    leftCap.position.set(-spec.width / 2 + 0.12, 3.85, 0);
    const rightCap = new THREE.Mesh(this.capGeo, this.frameMat);
    rightCap.position.set(spec.width / 2 - 0.12, 3.85, 0);

    const topBarGeo = new THREE.BoxGeometry(spec.width + 0.2, 0.35, 0.38);
    const topBar = new THREE.Mesh(topBarGeo, this.frameMat);
    topBar.position.y = 3.65;

    group.add(leftPost, rightPost, leftCap, rightCap, topBar);
    this.sharedDisposables.push(panelGeo, panelMat, topBarGeo);

    return {
      spec,
      group,
      panelMesh,
      currentX: spec.x,
      triggered: false,
      isOpen: true,
      triggerAnim: 0,
    };
  }

  buildObstacle(spec: ObstacleSpec): ObstacleInstance {
    const group = new THREE.Group();
    group.position.set(spec.x, 0, spec.z);
    let animatedPart: THREE.Object3D | undefined;

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.78,
      metalness: 0.12,
    });
    const crimsonMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.4,
      metalness: 0.25,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.28,
      metalness: 0.75,
    });
    this.sharedDisposables.push(stoneMat, crimsonMat, steelMat);

    switch (spec.kind) {
      case 'concrete_wall':
      case 'moving_wall':
      case 'roadblock':
      case 'barrier':
      case 'sliding_barrier': {
        const h = spec.kind === 'barrier' ? 1.35 : 2.1;
        const wallGeo = new THREE.BoxGeometry(spec.width, h, spec.length);
        const wall = new THREE.Mesh(
          wallGeo,
          spec.kind === 'roadblock' || spec.kind === 'barrier'
            ? this.hazardMat
            : stoneMat,
        );
        wall.position.y = h / 2;
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        const capGeo = new THREE.BoxGeometry(spec.width + 0.16, 0.28, spec.length + 0.16);
        const cap = new THREE.Mesh(capGeo, crimsonMat);
        cap.position.y = h + 0.14;
        group.add(cap);
        this.sharedDisposables.push(wallGeo, capGeo);
        break;
      }

      case 'narrow_opening': {
        const gapW = spec.gapWidth ?? 3.4;
        const sideW = Math.max(1.2, (spec.width - gapW) / 2);
        const sideGeo = new THREE.BoxGeometry(sideW, 2.5, 1.5);
        const leftWall = new THREE.Mesh(sideGeo, stoneMat);
        leftWall.position.set(-(gapW / 2 + sideW / 2), 1.25, 0);
        leftWall.castShadow = true;
        const rightWall = new THREE.Mesh(sideGeo, stoneMat);
        rightWall.position.set(gapW / 2 + sideW / 2, 1.25, 0);
        rightWall.castShadow = true;
        group.add(leftWall, rightWall);
        this.sharedDisposables.push(sideGeo);
        break;
      }

      case 'pillar':
      case 'fixed_trap': {
        const cylGeo = new THREE.CylinderGeometry(0.85, 1.0, 2.8, 12);
        const cyl = new THREE.Mesh(cylGeo, spec.kind === 'fixed_trap' ? crimsonMat : stoneMat);
        cyl.position.y = 1.4;
        cyl.castShadow = true;
        group.add(cyl);

        const ringGeo = new THREE.TorusGeometry(0.95, 0.14, 8, 18);
        ringGeo.rotateX(Math.PI / 2);
        const ring = new THREE.Mesh(ringGeo, this.hazardMat);
        ring.position.y = 0.2;
        group.add(ring);
        this.sharedDisposables.push(cylGeo, ringGeo);
        break;
      }

      case 'rotating_hammer': {
        const postGeo = new THREE.CylinderGeometry(0.4, 0.55, 2.5, 10);
        const post = new THREE.Mesh(postGeo, stoneMat);
        post.position.y = 1.25;
        group.add(post);

        const armPivot = new THREE.Group();
        armPivot.position.y = 1.1;
        const armGeo = new THREE.BoxGeometry(spec.width * 1.15, 0.45, 0.45);
        const arm = new THREE.Mesh(armGeo, steelMat);
        const headGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.4, 12);
        headGeo.rotateZ(Math.PI / 2);
        const headL = new THREE.Mesh(headGeo, crimsonMat);
        headL.position.x = -spec.width * 0.55;
        const headR = new THREE.Mesh(headGeo, crimsonMat);
        headR.position.x = spec.width * 0.55;
        armPivot.add(arm, headL, headR);
        group.add(armPivot);
        animatedPart = armPivot;
        this.sharedDisposables.push(postGeo, armGeo, headGeo);
        break;
      }

      case 'swinging_pendulum': {
        const archGeo = new THREE.BoxGeometry(0.45, 5.5, 0.45);
        const leftA = new THREE.Mesh(archGeo, stoneMat);
        leftA.position.set(-2.6, 2.75, 0);
        const rightA = new THREE.Mesh(archGeo, stoneMat);
        rightA.position.set(2.6, 2.75, 0);
        const barGeo = new THREE.BoxGeometry(5.8, 0.45, 0.45);
        const bar = new THREE.Mesh(barGeo, stoneMat);
        bar.position.y = 5.4;
        group.add(leftA, rightA, bar);

        const pivot = new THREE.Group();
        pivot.position.y = 5.3;
        const rodGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.9, 8);
        const rod = new THREE.Mesh(rodGeo, steelMat);
        rod.position.y = -1.95;
        const ballGeo = new THREE.SphereGeometry(0.95, 14, 12);
        const ball = new THREE.Mesh(ballGeo, crimsonMat);
        ball.position.y = -4.1;
        ball.castShadow = true;
        pivot.add(rod, ball);
        group.add(pivot);
        animatedPart = pivot;
        this.sharedDisposables.push(archGeo, barGeo, rodGeo, ballGeo);
        break;
      }

      case 'rotating_blade': {
        const hubGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.6, 12);
        const hub = new THREE.Mesh(hubGeo, stoneMat);
        hub.position.y = 0.3;
        group.add(hub);

        const spinner = new THREE.Group();
        spinner.position.y = 0.75;
        const bladeGeo = new THREE.BoxGeometry(spec.width * 1.1, 0.22, 0.65);
        const b1 = new THREE.Mesh(bladeGeo, crimsonMat);
        const b2 = new THREE.Mesh(bladeGeo, steelMat);
        b2.rotation.y = Math.PI / 2;
        spinner.add(b1, b2);
        group.add(spinner);
        animatedPart = spinner;
        this.sharedDisposables.push(hubGeo, bladeGeo);
        break;
      }

      case 'narrow_bridge':
      case 'broken_bridge':
      case 'zigzag_bridge':
      case 'moving_platform':
      case 'collapsing_platform':
      case 'disappearing_platform': {
        const platColor =
          spec.kind === 'collapsing_platform'
            ? 0xf59e0b
            : spec.kind === 'disappearing_platform'
            ? 0xa855f7
            : 0x38bdf8;
        const platMat = new THREE.MeshStandardMaterial({
          color: platColor,
          roughness: 0.45,
          metalness: 0.2,
        });
        const deckGeo = new THREE.BoxGeometry(spec.width, 0.42, spec.length);
        const deck = new THREE.Mesh(deckGeo, platMat);
        deck.position.y = 0.16;
        deck.receiveShadow = true;
        group.add(deck);
        animatedPart = deck;
        this.sharedDisposables.push(platMat, deckGeo);
        break;
      }

      case 'gap':
      case 'lava_hazard':
      case 'water_zone':
      case 'ice_surface':
      case 'wind_zone': {
        const zoneColor =
          spec.kind === 'lava_hazard'
            ? 0xf97316
            : spec.kind === 'water_zone'
            ? 0x0ea5e9
            : spec.kind === 'ice_surface'
            ? 0xbae6fd
            : spec.kind === 'wind_zone'
            ? 0x2dd4bf
            : 0x0f172a;
        const zoneMat = new THREE.MeshStandardMaterial({
          color: zoneColor,
          emissive: spec.kind === 'lava_hazard' ? 0xea580c : 0x000000,
          emissiveIntensity: spec.kind === 'lava_hazard' ? 0.65 : 0,
          roughness: spec.kind === 'ice_surface' ? 0.1 : 0.45,
          transparent: spec.kind === 'wind_zone',
          opacity: spec.kind === 'wind_zone' ? 0.5 : 1,
        });
        const zoneGeo = new THREE.BoxGeometry(spec.width, 0.16, spec.length);
        const zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
        zoneMesh.position.y = 0.04;
        group.add(zoneMesh);
        this.sharedDisposables.push(zoneMat, zoneGeo);
        break;
      }
    }

    return {
      spec,
      group,
      animatedPart,
      currentX: spec.x,
      active: true,
      hitCooldown: 0,
      collapseProgress: 0,
    };
  }

  buildCollectible(spec: CollectibleSpec): CollectibleInstance {
    const group = new THREE.Group();
    group.position.set(spec.x, 0, spec.z);

    if (spec.type === 'coin') {
      const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 16);
      coinGeo.rotateX(Math.PI / 2);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.25,
        metalness: 0.85,
        roughness: 0.2,
      });
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coin.position.y = 1.05;
      coin.castShadow = true;
      group.add(coin);
      this.sharedDisposables.push(coinGeo, coinMat);
    } else {
      // Recruit mini-cluster (3 stylized cyan/blue recruits + floating +N badge)
      const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.5, 6, 10);
      const headGeo = new THREE.SphereGeometry(0.18, 10, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.2,
        roughness: 0.35,
      });

      const offsets = [
        [0, 0],
        [-0.48, 0.42],
        [0.48, 0.42],
      ];
      for (const [ox, oz] of offsets) {
        const b = new THREE.Mesh(bodyGeo, mat);
        b.position.set(ox, 0.55, oz);
        const h = new THREE.Mesh(headGeo, mat);
        h.position.set(ox, 1.08, oz);
        group.add(b, h);
      }

      const sprite = makeTextSprite(`+${spec.value}`, '#0284c7');
      sprite.position.set(0, 1.95, 0);
      group.add(sprite);
      this.sharedDisposables.push(bodyGeo, headGeo, mat);
    }

    return {
      spec,
      group,
      collected: false,
    };
  }

  buildEnemySquad(spec: EnemySquadSpec): EnemySquadInstance {
    const group = new THREE.Group();
    group.position.set(spec.x, 0, spec.z);

    const isArmored =
      spec.archetype === 'armored_unit' || spec.archetype === 'defensive_phalanx';
    const isElite = spec.archetype === 'elite_guard';
    const bodyColor = isElite ? 0x991b1b : isArmored ? 0x7f1d1d : 0xdc2626;
    const accentColor = isArmored ? 0x94a3b8 : 0xfca5a5;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: isArmored ? 0.32 : 0.5,
      metalness: isArmored ? 0.65 : 0.15,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.35,
      metalness: 0.4,
    });

    const torsoGeo = new THREE.CylinderGeometry(0.22, 0.17, 0.55, 10);
    const headGeo = new THREE.SphereGeometry(0.19, 10, 8);
    const shieldGeo = new THREE.BoxGeometry(0.45, 0.65, 0.1);

    const visualCount = Math.min(18, Math.max(3, spec.count));
    const cols = Math.min(5, Math.ceil(Math.sqrt(visualCount)));

    for (let i = 0; i < visualCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ox = (col - (cols - 1) / 2) * 0.68;
      const oz = row * 0.65;

      const t = new THREE.Mesh(torsoGeo, bodyMat);
      t.position.set(ox, 0.58, oz);
      t.castShadow = true;
      const h = new THREE.Mesh(headGeo, bodyMat);
      h.position.set(ox, 1.08, oz);
      group.add(t, h);

      if (isArmored && row === 0) {
        const s = new THREE.Mesh(shieldGeo, accentMat);
        s.position.set(ox, 0.62, oz + 0.28);
        group.add(s);
      }
    }

    const badge = makeTextSprite(`${spec.count}`, '#dc2626');
    badge.position.set(0, 2.25, 0);
    group.add(badge);

    this.sharedDisposables.push(bodyMat, accentMat, torsoGeo, headGeo, shieldGeo);

    return {
      spec,
      group,
      remaining: spec.count,
      currentX: spec.x,
      defeated: false,
      badgeEl: badge,
    };
  }

  buildRouteChoice(spec: RouteChoiceSpec, maxAnisotropy: number): RouteChoiceInstance {
    const group = new THREE.Group();
    group.position.set(0, 0, spec.z);

    for (const r of spec.routes) {
      const color =
        r.riskLabel === 'SAFE'
          ? 0x22c55e
          : r.riskLabel === 'RISKY'
          ? 0xf59e0b
          : 0xef4444;
      const laneGeo = new THREE.BoxGeometry(r.width, 0.12, spec.length);
      const laneMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.15,
      });
      const lane = new THREE.Mesh(laneGeo, laneMat);
      lane.position.set(r.laneX, 0.06, -spec.length / 2);
      group.add(lane);

      const label = r.gateOp === 'mul' ? `×${r.gateValue}` : `+${r.gateValue}`;
      const tex = getGateSignTexture(
        label,
        r.riskLabel === 'EXTREME' ? 'risk' : 'yellow',
        maxAnisotropy,
      );
      const signGeo = new THREE.BoxGeometry(r.width * 0.85, 2.2, 0.2);
      const signMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex,
        roughness: 0.3,
      });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(r.laneX, 1.5, -spec.length * 0.85);
      group.add(sign);

      const tag = makeTextSprite(
        r.riskLabel,
        r.riskLabel === 'SAFE'
          ? '#16a34a'
          : r.riskLabel === 'RISKY'
          ? '#d97706'
          : '#dc2626',
      );
      tag.position.set(r.laneX, 3.2, -1.5);
      group.add(tag);

      this.sharedDisposables.push(laneGeo, laneMat, signGeo, signMat);
    }

    return {
      spec,
      group,
      triggeredRouteIdx: null,
    };
  }

  dispose(): void {
    this.sharedDisposables.forEach((d) => d.dispose());
    this.sharedDisposables = [];
  }
}
