import * as THREE from 'three';
import {
  createArticulatedCharacterRig,
  createStylizedCrowdGeometries,
  type ArticulatedCharacterRig,
  type CrowdPartGeometries,
} from './characterBuilder';
import { getContactShadowTexture } from './textures';
import type {
  CharacterAnimState,
  FormationType,
  SkinDefinition,
} from './types';

interface CrowdSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetZ: number;
  vx: number;
  phase: number;
  falling: boolean;
  vy: number;
  jumpTimer: number;
  attackTimer: number;
}

// Pre-allocated scratch math objects (zero-GC inside render loop)
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3(1, 1, 1);
const _mat = new THREE.Matrix4();
const _partMat = new THREE.Matrix4();
const _subPos = new THREE.Vector3();
const _subQuat = new THREE.Quaternion();
const _subEuler = new THREE.Euler();

export class CrowdManager {
  public readonly group = new THREE.Group();
  private readonly maxInstances = 240;
  private visibleCap = 180;
  private crowdCount = 10;
  private formation: FormationType = 'compact';
  private animState: CharacterAnimState = 'running';

  private centerX = 0;
  private centerZ = 0;
  private steerLean = 0;

  private slots: CrowdSlot[] = [];
  private partGeos: CrowdPartGeometries;

  private torsoMesh: THREE.InstancedMesh;
  private visorMesh: THREE.InstancedMesh;
  private leftArmMesh: THREE.InstancedMesh;
  private rightArmMesh: THREE.InstancedMesh;
  private leftLegMesh: THREE.InstancedMesh;
  private rightLegMesh: THREE.InstancedMesh;
  private shadowMesh: THREE.InstancedMesh;

  private primaryMat: THREE.MeshStandardMaterial;
  private limbMat: THREE.MeshStandardMaterial;
  private visorMat: THREE.MeshStandardMaterial;
  private shadowMat: THREE.MeshBasicMaterial;
  private shadowGeo: THREE.PlaneGeometry;

  // Commander hero at front-center driven by Three.js AnimationMixer
  private commanderRig: ArticulatedCharacterRig;

  constructor(skin: SkinDefinition) {
    this.partGeos = createStylizedCrowdGeometries();

    this.primaryMat = new THREE.MeshStandardMaterial({
      color: skin.primaryColor,
      metalness: skin.metalness,
      roughness: skin.roughness,
    });
    this.limbMat = new THREE.MeshStandardMaterial({
      color: skin.secondaryColor,
      metalness: Math.min(0.85, skin.metalness + 0.1),
      roughness: Math.max(0.22, skin.roughness - 0.05),
    });
    this.visorMat = new THREE.MeshStandardMaterial({
      color: skin.visorColor,
      emissive: skin.visorColor,
      emissiveIntensity: 0.25,
      metalness: 0.3,
      roughness: 0.25,
    });

    this.shadowGeo = new THREE.PlaneGeometry(0.7, 0.7);
    this.shadowGeo.rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    });

    const makeInst = (geo: THREE.BufferGeometry, mat: THREE.Material, castShadow: boolean) => {
      const m = new THREE.InstancedMesh(geo, mat, this.maxInstances);
      m.count = 0;
      m.castShadow = castShadow;
      m.receiveShadow = false;
      m.frustumCulled = false;
      return m;
    };

    this.torsoMesh = makeInst(this.partGeos.torsoHeadGeo, this.primaryMat, true);
    this.visorMesh = makeInst(this.partGeos.visorAccentGeo, this.visorMat, false);
    this.leftArmMesh = makeInst(this.partGeos.leftArmGeo, this.limbMat, false);
    this.rightArmMesh = makeInst(this.partGeos.rightArmGeo, this.limbMat, false);
    this.leftLegMesh = makeInst(this.partGeos.leftLegGeo, this.limbMat, false);
    this.rightLegMesh = makeInst(this.partGeos.rightLegGeo, this.limbMat, false);
    this.shadowMesh = makeInst(this.shadowGeo, this.shadowMat, false);

    this.group.add(
      this.shadowMesh,
      this.torsoMesh,
      this.visorMesh,
      this.leftArmMesh,
      this.rightArmMesh,
      this.leftLegMesh,
      this.rightLegMesh,
    );

    this.commanderRig = createArticulatedCharacterRig({
      primaryColor: skin.primaryColor,
      secondaryColor: skin.secondaryColor,
      accentColor: skin.accentColor,
      visorColor: skin.visorColor,
      scale: 1.18,
      metalness: skin.metalness,
      roughness: skin.roughness,
    });
    this.group.add(this.commanderRig.root);

    // Object pool of crowd slots
    for (let i = 0; i < this.maxInstances; i++) {
      this.slots.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        targetX: 0,
        targetZ: 0,
        vx: 0,
        phase: (i * 1.37) % (Math.PI * 2),
        falling: false,
        vy: 0,
        jumpTimer: 0,
        attackTimer: 0,
      });
    }
  }

  applySkin(skin: SkinDefinition): void {
    this.primaryMat.color.setHex(skin.primaryColor);
    this.primaryMat.metalness = skin.metalness;
    this.primaryMat.roughness = skin.roughness;

    this.limbMat.color.setHex(skin.secondaryColor);
    this.visorMat.color.setHex(skin.visorColor);
    this.visorMat.emissive.setHex(skin.visorColor);

    this.group.remove(this.commanderRig.root);
    this.commanderRig.dispose();
    this.commanderRig = createArticulatedCharacterRig({
      primaryColor: skin.primaryColor,
      secondaryColor: skin.secondaryColor,
      accentColor: skin.accentColor,
      visorColor: skin.visorColor,
      scale: 1.18,
      metalness: skin.metalness,
      roughness: skin.roughness,
    });
    this.commanderRig.playState(this.animState, 0.05);
    this.group.add(this.commanderRig.root);
  }

  setVisibleCap(cap: number): void {
    this.visibleCap = Math.max(40, Math.min(this.maxInstances, Math.floor(cap)));
  }

  getCount(): number {
    return this.crowdCount;
  }

  getCenterX(): number {
    return this.centerX;
  }

  getCenterZ(): number {
    return this.centerZ;
  }

  getFormation(): FormationType {
    return this.formation;
  }

  setFormation(formation: FormationType): void {
    if (this.formation === formation) return;
    this.formation = formation;
    this.recomputeFormationTargets();
  }

  setAnimState(state: CharacterAnimState): void {
    this.animState = state;
    this.commanderRig.playState(state, 0.14);
  }

  reset(startCount: number, startX = 0, startZ = 0): void {
    this.centerX = startX;
    this.centerZ = startZ;
    this.steerLean = 0;
    this.crowdCount = Math.max(0, Math.floor(startCount));
    this.formation = 'compact';
    this.animState = 'running';
    this.commanderRig.playState('running', 0.05);

    for (let i = 0; i < this.maxInstances; i++) {
      const s = this.slots[i];
      s.active = false;
      s.y = 0;
      s.vy = 0;
      s.falling = false;
      s.jumpTimer = 0;
      s.attackTimer = 0;
    }

    this.syncPoolToCount(true);
  }

  setCount(nextCount: number, triggerJumpBurst = false): void {
    const clamped = Math.max(0, Math.floor(nextCount));
    const prev = this.crowdCount;
    this.crowdCount = clamped;
    this.syncPoolToCount(false);
    if (triggerJumpBurst && clamped > prev) {
      const activeTarget = this.getVisibleRunnerCount();
      for (let i = 0; i < activeTarget; i++) {
        if (Math.random() < 0.45) {
          this.slots[i].jumpTimer = 0.25 + Math.random() * 0.2;
        }
      }
    }
  }

  addCount(amount: number): void {
    this.setCount(this.crowdCount + amount, true);
  }

  removeCount(amount: number): number {
    const lost = Math.min(this.crowdCount, Math.max(0, Math.floor(amount)));
    this.setCount(this.crowdCount - lost, false);
    return lost;
  }

  private getVisibleRunnerCount(): number {
    if (this.crowdCount <= 1) return 0; // Commander represents #1
    return Math.min(this.visibleCap, this.crowdCount - 1);
  }

  private syncPoolToCount(snapImmediately: boolean): void {
    const targetVisible = this.getVisibleRunnerCount();
    this.recomputeFormationTargets();

    for (let i = 0; i < this.maxInstances; i++) {
      const s = this.slots[i];
      const shouldBeActive = i < targetVisible;
      if (shouldBeActive && !s.active) {
        s.active = true;
        s.x = snapImmediately
          ? this.centerX + s.targetX
          : this.centerX + s.targetX * 0.4;
        s.z = snapImmediately
          ? this.centerZ + s.targetZ
          : this.centerZ + s.targetZ * 0.4;
        s.y = 0;
        s.falling = false;
      } else if (!shouldBeActive && s.active) {
        s.active = false;
      } else if (snapImmediately && shouldBeActive) {
        s.x = this.centerX + s.targetX;
        s.z = this.centerZ + s.targetZ;
      }
    }
  }

  private recomputeFormationTargets(): void {
    const count = this.getVisibleRunnerCount();
    if (count === 0) return;

    const goldenAngle = 2.39996323;

    for (let i = 0; i < count; i++) {
      const s = this.slots[i];
      const idx = i + 1;

      if (this.formation === 'narrow_bridge') {
        const cols = 3;
        const col = i % cols;
        const row = Math.floor(i / cols);
        s.targetX = (col - 1) * 0.62;
        s.targetZ = 0.65 + row * 0.64;
      } else if (this.formation === 'wide') {
        const cols = Math.min(11, Math.max(4, Math.ceil(Math.sqrt(count) * 1.6)));
        const col = i % cols;
        const row = Math.floor(i / cols);
        s.targetX = (col - (cols - 1) / 2) * 0.72;
        s.targetZ = 0.55 + row * 0.65;
      } else if (this.formation === 'defensive') {
        const ring = Math.floor(Math.sqrt(idx) * 1.15);
        const theta = idx * goldenAngle;
        const radius = 0.55 + ring * 0.42;
        s.targetX = Math.cos(theta) * radius;
        s.targetZ = Math.sin(theta) * radius * 0.85 + 0.8;
      } else if (this.formation === 'boss_battle') {
        const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(count) * 1.35)));
        const col = i % cols;
        const row = Math.floor(i / cols);
        s.targetX = (col - (cols - 1) / 2) * 0.78;
        s.targetZ = 0.7 + row * 0.7;
      } else {
        // 'compact' phyllotaxis disk behind commander
        const r = 0.55 * Math.sqrt(idx);
        const theta = idx * goldenAngle;
        s.targetX = Math.cos(theta) * r * 1.05;
        s.targetZ = 0.85 + Math.sin(theta) * r * 0.92;
      }
    }
  }

  /**
   * Returns approximate crowd bounding width for obstacle & gate overlap checks.
   */
  getCrowdSpreadHalfWidth(): number {
    const vis = this.getVisibleRunnerCount();
    if (vis <= 2) return 0.55;
    if (this.formation === 'narrow_bridge') return 0.95;
    if (this.formation === 'wide') return Math.min(4.2, 1.0 + Math.sqrt(vis) * 0.45);
    return Math.min(3.4, 0.75 + Math.sqrt(vis) * 0.34);
  }

  update(
    dt: number,
    elapsed: number,
    nextCenterX: number,
    nextCenterZ: number,
    trackHalfWidth: number,
    strideSpeed: number,
    isMovingForward: boolean,
  ): void {
    const dx = nextCenterX - this.centerX;
    this.steerLean = THREE.MathUtils.damp(
      this.steerLean,
      THREE.MathUtils.clamp(-dx * 3.5, -0.32, 0.32),
      10,
      dt,
    );
    this.centerX = nextCenterX;
    this.centerZ = nextCenterZ;

    // Commander hero rig update
    this.commanderRig.root.visible = this.crowdCount >= 1;
    this.commanderRig.root.position.set(this.centerX, 0, this.centerZ);
    this.commanderRig.root.rotation.z = this.steerLean * 0.6;
    this.commanderRig.mixer.update(dt);

    const activeCount = this.getVisibleRunnerCount();
    const dampAlpha = 1 - Math.exp(-10 * dt);
    const maxOffset = Math.max(0.4, trackHalfWidth - 0.5);

    let drawn = 0;

    for (let i = 0; i < activeCount; i++) {
      const s = this.slots[i];
      if (!s.active) continue;

      const goalX = THREE.MathUtils.clamp(
        this.centerX + s.targetX,
        -maxOffset,
        maxOffset,
      );
      const goalZ = this.centerZ + s.targetZ;

      s.x += (goalX - s.x) * dampAlpha;
      s.z += (goalZ - s.z) * dampAlpha;

      if (s.jumpTimer > 0) {
        s.jumpTimer = Math.max(0, s.jumpTimer - dt);
        s.y = Math.sin((s.jumpTimer / 0.45) * Math.PI) * 0.9;
      } else {
        s.y = 0;
      }

      const phase = elapsed * strideSpeed + s.phase;
      const isIdle = this.animState === 'idle';
      const isCelebrate =
        this.animState === 'celebrating' || this.animState === 'victory';
      const isAttack = this.animState === 'attacking';
      const isDefeat = this.animState === 'defeat';

      let bodyBounce = 0;
      let tiltX = 0;
      let leftArmRotX = 0;
      let rightArmRotX = 0;
      let leftArmRotZ = 0;
      let rightArmRotZ = 0;
      let leftLegRotX = 0;
      let rightLegRotX = 0;

      if (isDefeat) {
        tiltX = -1.25;
        bodyBounce = -0.35;
      } else if (isCelebrate) {
        bodyBounce = Math.abs(Math.sin(phase * 1.1)) * 0.35;
        leftArmRotZ = -2.4;
        rightArmRotZ = 2.4;
      } else if (isAttack) {
        tiltX = -0.22;
        bodyBounce = Math.abs(Math.sin(phase * 1.4)) * 0.1;
        rightArmRotX = Math.sin(phase * 2.2) * 1.25;
        leftArmRotX = -Math.sin(phase * 2.2) * 0.7;
        leftLegRotX = Math.sin(phase) * 0.55;
        rightLegRotX = -Math.sin(phase) * 0.55;
      } else if (isIdle || !isMovingForward) {
        bodyBounce = Math.sin(phase * 0.5) * 0.025;
        leftArmRotX = Math.sin(phase * 0.5) * 0.08;
        rightArmRotX = -leftArmRotX;
      } else {
        // Running cycle
        bodyBounce = Math.abs(Math.sin(phase)) * 0.11;
        tiltX = -0.15;
        const swing = Math.sin(phase) * 0.85;
        leftLegRotX = swing;
        rightLegRotX = -swing;
        leftArmRotX = -swing * 0.85;
        rightArmRotX = swing * 0.85;
      }

      // Root transform for runner i
      _pos.set(s.x, s.y + bodyBounce, s.z);
      _euler.set(tiltX, 0, this.steerLean * 0.45);
      _quat.setFromEuler(_euler);
      _mat.compose(_pos, _quat, _scale);

      this.torsoMesh.setMatrixAt(drawn, _mat);
      this.visorMesh.setMatrixAt(drawn, _mat);

      // Left arm local pivot (-0.27, 1.03, 0)
      _subPos.set(-0.27, 1.03, 0).applyQuaternion(_quat).add(_pos);
      _subEuler.set(leftArmRotX, 0, leftArmRotZ);
      _subQuat.setFromEuler(_subEuler).premultiply(_quat);
      _partMat.compose(_subPos, _subQuat, _scale);
      this.leftArmMesh.setMatrixAt(drawn, _partMat);

      // Right arm local pivot (+0.27, 1.03, 0)
      _subPos.set(0.27, 1.03, 0).applyQuaternion(_quat).add(_pos);
      _subEuler.set(rightArmRotX, 0, rightArmRotZ);
      _subQuat.setFromEuler(_subEuler).premultiply(_quat);
      _partMat.compose(_subPos, _subQuat, _scale);
      this.rightArmMesh.setMatrixAt(drawn, _partMat);

      // Left leg local pivot (-0.11, 0.55, 0)
      _subPos.set(-0.11, 0.55, 0).applyQuaternion(_quat).add(_pos);
      _subEuler.set(leftLegRotX, 0, 0);
      _subQuat.setFromEuler(_subEuler).premultiply(_quat);
      _partMat.compose(_subPos, _subQuat, _scale);
      this.leftLegMesh.setMatrixAt(drawn, _partMat);

      // Right leg local pivot (+0.11, 0.55, 0)
      _subPos.set(0.11, 0.55, 0).applyQuaternion(_quat).add(_pos);
      _subEuler.set(rightLegRotX, 0, 0);
      _subQuat.setFromEuler(_subEuler).premultiply(_quat);
      _partMat.compose(_subPos, _subQuat, _scale);
      this.rightLegMesh.setMatrixAt(drawn, _partMat);

      // Contact shadow disc grounded at y = 0.02
      _subPos.set(s.x, 0.02, s.z);
      _subQuat.identity();
      _partMat.compose(_subPos, _subQuat, _scale);
      this.shadowMesh.setMatrixAt(drawn, _partMat);

      drawn++;
    }

    this.torsoMesh.count = drawn;
    this.visorMesh.count = drawn;
    this.leftArmMesh.count = drawn;
    this.rightArmMesh.count = drawn;
    this.leftLegMesh.count = drawn;
    this.rightLegMesh.count = drawn;
    this.shadowMesh.count = drawn;

    this.torsoMesh.instanceMatrix.needsUpdate = true;
    this.visorMesh.instanceMatrix.needsUpdate = true;
    this.leftArmMesh.instanceMatrix.needsUpdate = true;
    this.rightArmMesh.instanceMatrix.needsUpdate = true;
    this.leftLegMesh.instanceMatrix.needsUpdate = true;
    this.rightLegMesh.instanceMatrix.needsUpdate = true;
    this.shadowMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.commanderRig.dispose();
    this.partGeos.torsoHeadGeo.dispose();
    this.partGeos.visorAccentGeo.dispose();
    this.partGeos.leftArmGeo.dispose();
    this.partGeos.rightArmGeo.dispose();
    this.partGeos.leftLegGeo.dispose();
    this.partGeos.rightLegGeo.dispose();
    this.shadowGeo.dispose();
    this.primaryMat.dispose();
    this.limbMat.dispose();
    this.visorMat.dispose();
    this.shadowMat.dispose();
  }
}
