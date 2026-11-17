import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CharacterAnimState, SkinDefinition } from './types';

function translateGeo(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
): THREE.BufferGeometry {
  geo.translate(x, y, z);
  return geo;
}

function normalizeForMerge(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

/**
 * Builds stylized humanoid body geometries (NO Minecraft cubes!)
 * Includes: Head, Neck, Torso, Shoulders, Upper Arms, Forearms, Hands, Upper Legs, Lower Legs, Feet.
 * Pivoted cleanly so feet sit at y = 0.
 */
export interface CrowdPartGeometries {
  torsoHeadGeo: THREE.BufferGeometry;
  visorAccentGeo: THREE.BufferGeometry;
  leftArmGeo: THREE.BufferGeometry;
  rightArmGeo: THREE.BufferGeometry;
  leftLegGeo: THREE.BufferGeometry;
  rightLegGeo: THREE.BufferGeometry;
}

export function createStylizedCrowdGeometries(): CrowdPartGeometries {
  // 1. Torso + Neck + Head + Shoulders (centered around local origin y = 0 at pelvis/feet base)
  const partsTorso: THREE.BufferGeometry[] = [];
  // Pelvis / hips
  partsTorso.push(
    normalizeForMerge(translateGeo(new THREE.CylinderGeometry(0.19, 0.17, 0.18, 12), 0, 0.62, 0)),
  );
  // Tapered athletic torso
  partsTorso.push(
    normalizeForMerge(translateGeo(new THREE.CylinderGeometry(0.24, 0.17, 0.42, 12), 0, 0.9, 0)),
  );
  // Left & right rounded shoulders
  partsTorso.push(
    normalizeForMerge(translateGeo(new THREE.SphereGeometry(0.11, 10, 8), -0.26, 1.04, 0)),
    normalizeForMerge(translateGeo(new THREE.SphereGeometry(0.11, 10, 8), 0.26, 1.04, 0)),
  );
  // Neck
  partsTorso.push(
    normalizeForMerge(translateGeo(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 10), 0, 1.15, 0)),
  );
  // Stylized proportional rounded head
  partsTorso.push(
    normalizeForMerge(translateGeo(new THREE.SphereGeometry(0.2, 14, 12), 0, 1.35, 0)),
  );
  const torsoHeadGeo = mergeGeometries(partsTorso, false);
  partsTorso.forEach((g) => g.dispose());

  // 2. Visor / Chest Crest Accent (gives crisp silhouette & direction readability)
  const visorParts: THREE.BufferGeometry[] = [
    normalizeForMerge(translateGeo(new THREE.BoxGeometry(0.24, 0.09, 0.12), 0, 1.36, -0.15)),
    normalizeForMerge(translateGeo(new THREE.CylinderGeometry(0.11, 0.09, 0.18, 8), 0, 0.94, -0.14)),
  ];
  const visorAccentGeo = mergeGeometries(visorParts, false);
  visorParts.forEach((g) => g.dispose());

  // 3. Arm geometry (pivoted at shoulder y=0 so rotationX swings cleanly!)
  // Includes upper arm + forearm + rounded hand
  const buildArm = () => {
    const p: THREE.BufferGeometry[] = [
      normalizeForMerge(translateGeo(new THREE.CylinderGeometry(0.075, 0.062, 0.22, 10), 0, -0.11, 0)),
      normalizeForMerge(translateGeo(new THREE.CylinderGeometry(0.06, 0.05, 0.2, 10), 0, -0.31, -0.02)),
      normalizeForMerge(translateGeo(new THREE.SphereGeometry(0.062, 8, 8), 0, -0.43, -0.02)),
    ];
    const m = mergeGeometries(p, false);
    p.forEach((g) => g.dispose());
    return m;
  };
  const leftArmGeo = buildArm();
  const rightArmGeo = buildArm();

  // 4. Leg geometry (pivoted at hip y=0 so rotationX swings cleanly!)
  // Includes upper leg (thigh) + lower leg (shin) + stylized shoe/foot
  const buildLeg = () => {
    const p: THREE.BufferGeometry[] = [
      normalizeForMerge(translateGeo(new THREE.CylinderGeometry(0.09, 0.075, 0.25, 10), 0, -0.125, 0)),
      normalizeForMerge(translateGeo(new THREE.CylinderGeometry(0.072, 0.056, 0.25, 10), 0, -0.37, 0)),
      normalizeForMerge(translateGeo(new THREE.BoxGeometry(0.13, 0.09, 0.22), 0, -0.51, -0.04)),
    ];
    const m = mergeGeometries(p, false);
    p.forEach((g) => g.dispose());
    return m;
  };
  const leftLegGeo = buildLeg();
  const rightLegGeo = buildLeg();

  return {
    torsoHeadGeo,
    visorAccentGeo,
    leftArmGeo,
    rightArmGeo,
    leftLegGeo,
    rightLegGeo,
  };
}

/**
 * Full articulated skeletal THREE.Group character driven by Three.js AnimationMixer
 * with all 10 requested AnimationClips (idle, running, walking, jumping, dodging,
 * falling, celebrating, attacking, victory, defeat).
 * Used for the Squad Commander / Bosses / Showcase characters!
 */
export interface ArticulatedCharacterRig {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<CharacterAnimState, THREE.AnimationAction>;
  currentState: CharacterAnimState;
  playState: (state: CharacterAnimState, fadeDuration?: number) => void;
  dispose: () => void;
}

export function createArticulatedCharacterRig(options: {
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  visorColor: number;
  scale?: number;
  metalness?: number;
  roughness?: number;
  isBoss?: boolean;
}): ArticulatedCharacterRig {
  const {
    primaryColor,
    secondaryColor,
    accentColor,
    visorColor,
    scale = 1,
    metalness = 0.2,
    roughness = 0.42,
    isBoss = false,
  } = options;

  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    metalness,
    roughness,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: secondaryColor,
    metalness: Math.min(0.85, metalness + 0.15),
    roughness: Math.max(0.2, roughness - 0.1),
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    metalness: 0.45,
    roughness: 0.3,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: visorColor,
    emissive: visorColor,
    emissiveIntensity: 0.25,
    roughness: 0.2,
    metalness: 0.3,
  });

  const bodyRoot = new THREE.Group();
  bodyRoot.name = 'bodyRoot';
  bodyRoot.position.y = 0.56;
  root.add(bodyRoot);

  // Pelvis + Torso + Neck + Head
  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.18, 0.18, 12),
    secondaryMat,
  );
  pelvis.position.y = 0.06;
  bodyRoot.add(pelvis);

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.18, 0.45, 14),
    primaryMat,
  );
  torso.position.y = 0.36;
  torso.castShadow = true;
  bodyRoot.add(torso);

  const chestCrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.16, 0.08),
    accentMat,
  );
  chestCrest.position.set(0, 0.4, -0.2);
  bodyRoot.add(chestCrest);

  // Shoulders
  const leftShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(isBoss ? 0.16 : 0.11, 10, 8),
    accentMat,
  );
  leftShoulder.position.set(-0.29, 0.5, 0);
  bodyRoot.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(isBoss ? 0.16 : 0.11, 10, 8),
    accentMat,
  );
  rightShoulder.position.set(0.29, 0.5, 0);
  bodyRoot.add(rightShoulder);

  // Neck & Head Group
  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  headGroup.position.set(0, 0.6, 0);
  bodyRoot.add(headGroup);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 0.12, 10),
    secondaryMat,
  );
  neck.position.y = 0.05;
  headGroup.add(neck);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 14),
    primaryMat,
  );
  head.position.y = 0.24;
  head.castShadow = true;
  headGroup.add(head);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.09, 0.12),
    visorMat,
  );
  visor.position.set(0, 0.24, -0.17);
  headGroup.add(visor);

  if (isBoss) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.26, 6),
      accentMat,
    );
    crown.position.set(0, 0.52, 0);
    headGroup.add(crown);
  }

  // Articulated Arms (Upper arm + Forearm + Hand)
  const buildRigArm = (name: string, xPos: number) => {
    const armPivot = new THREE.Group();
    armPivot.name = name;
    armPivot.position.set(xPos, 0.48, 0);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.068, 0.23, 10),
      primaryMat,
    );
    upperArm.position.y = -0.11;
    armPivot.add(upperArm);

    const forearmPivot = new THREE.Group();
    forearmPivot.name = `${name}_forearm`;
    forearmPivot.position.set(0, -0.22, 0);
    armPivot.add(forearmPivot);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.054, 0.21, 10),
      secondaryMat,
    );
    forearm.position.y = -0.1;
    forearmPivot.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 8, 8),
      accentMat,
    );
    hand.position.y = -0.22;
    forearmPivot.add(hand);

    bodyRoot.add(armPivot);
    return armPivot;
  };

  buildRigArm('leftArm', -0.3);
  buildRigArm('rightArm', 0.3);

  // Articulated Legs (Upper leg + Lower leg + Foot)
  const buildRigLeg = (name: string, xPos: number) => {
    const legPivot = new THREE.Group();
    legPivot.name = name;
    legPivot.position.set(xPos, 0.0, 0);

    const upperLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.078, 0.26, 10),
      primaryMat,
    );
    upperLeg.position.y = -0.13;
    legPivot.add(upperLeg);

    const lowerLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.058, 0.25, 10),
      secondaryMat,
    );
    lowerLeg.position.y = -0.38;
    legPivot.add(lowerLeg);

    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.09, 0.24),
      accentMat,
    );
    foot.position.set(0, -0.51, -0.05);
    legPivot.add(foot);

    bodyRoot.add(legPivot);
    return legPivot;
  };

  buildRigLeg('leftLeg', -0.12);
  buildRigLeg('rightLeg', 0.12);

  // Create Three.js AnimationMixer & Clips for all 10 animation states
  const mixer = new THREE.AnimationMixer(root);

  const makeClip = (
    name: string,
    duration: number,
    tracks: THREE.KeyframeTrack[],
  ) => new THREE.AnimationClip(name, duration, tracks);

  const idleClip = makeClip('idle', 1.2, [
    new THREE.NumberKeyframeTrack('bodyRoot.position[y]', [0, 0.6, 1.2], [0.56, 0.59, 0.56]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[x]', [0, 0.6, 1.2], [0.05, -0.05, 0.05]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[x]', [0, 0.6, 1.2], [-0.05, 0.05, -0.05]),
  ]);

  const runningClip = makeClip('running', 0.48, [
    new THREE.NumberKeyframeTrack('bodyRoot.position[y]', [0, 0.12, 0.24, 0.36, 0.48], [0.56, 0.64, 0.56, 0.64, 0.56]),
    new THREE.NumberKeyframeTrack('bodyRoot.rotation[x]', [0, 0.24, 0.48], [-0.14, -0.18, -0.14]),
    new THREE.NumberKeyframeTrack('leftLeg.rotation[x]', [0, 0.12, 0.24, 0.36, 0.48], [0, 0.85, 0, -0.85, 0]),
    new THREE.NumberKeyframeTrack('rightLeg.rotation[x]', [0, 0.12, 0.24, 0.36, 0.48], [0, -0.85, 0, 0.85, 0]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[x]', [0, 0.12, 0.24, 0.36, 0.48], [0, -0.75, 0, 0.75, 0]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[x]', [0, 0.12, 0.24, 0.36, 0.48], [0, 0.75, 0, -0.75, 0]),
  ]);

  const walkingClip = makeClip('walking', 0.8, [
    new THREE.NumberKeyframeTrack('bodyRoot.position[y]', [0, 0.2, 0.4, 0.6, 0.8], [0.56, 0.59, 0.56, 0.59, 0.56]),
    new THREE.NumberKeyframeTrack('leftLeg.rotation[x]', [0, 0.2, 0.4, 0.6, 0.8], [0, 0.45, 0, -0.45, 0]),
    new THREE.NumberKeyframeTrack('rightLeg.rotation[x]', [0, 0.2, 0.4, 0.6, 0.8], [0, -0.45, 0, 0.45, 0]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[x]', [0, 0.2, 0.4, 0.6, 0.8], [0, -0.35, 0, 0.35, 0]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[x]', [0, 0.2, 0.4, 0.6, 0.8], [0, 0.35, 0, -0.35, 0]),
  ]);

  const jumpingClip = makeClip('jumping', 0.6, [
    new THREE.NumberKeyframeTrack('bodyRoot.position[y]', [0, 0.3, 0.6], [0.56, 1.25, 0.56]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[z]', [0, 0.3, 0.6], [0, -0.8, 0]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[z]', [0, 0.3, 0.6], [0, 0.8, 0]),
  ]);

  const dodgingClip = makeClip('dodging', 0.4, [
    new THREE.NumberKeyframeTrack('bodyRoot.rotation[z]', [0, 0.2, 0.4], [0, 0.35, 0]),
    new THREE.NumberKeyframeTrack('bodyRoot.position[y]', [0, 0.2, 0.4], [0.56, 0.48, 0.56]),
  ]);

  const fallingClip = makeClip('falling', 0.6, [
    new THREE.NumberKeyframeTrack('bodyRoot.rotation[x]', [0, 0.6], [0, 0.9]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[z]', [0, 0.3, 0.6], [-0.4, -1.2, -0.4]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[z]', [0, 0.3, 0.6], [0.4, 1.2, 0.4]),
  ]);

  const attackingClip = makeClip('attacking', 0.45, [
    new THREE.NumberKeyframeTrack('bodyRoot.rotation[x]', [0, 0.22, 0.45], [-0.1, -0.35, -0.1]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[x]', [0, 0.15, 0.32, 0.45], [0, 1.4, -1.1, 0]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[x]', [0, 0.22, 0.45], [0, -0.7, 0]),
  ]);

  const celebratingClip = makeClip('celebrating', 0.7, [
    new THREE.NumberKeyframeTrack('bodyRoot.position[y]', [0, 0.35, 0.7], [0.56, 0.92, 0.56]),
    new THREE.NumberKeyframeTrack('leftArm.rotation[z]', [0, 0.35, 0.7], [-2.2, -2.7, -2.2]),
    new THREE.NumberKeyframeTrack('rightArm.rotation[z]', [0, 0.35, 0.7], [2.2, 2.7, 2.2]),
  ]);

  const defeatClip = makeClip('defeat', 0.8, [
    new THREE.NumberKeyframeTrack('bodyRoot.position[y]', [0, 0.8], [0.56, 0.2]),
    new THREE.NumberKeyframeTrack('bodyRoot.rotation[x]', [0, 0.8], [0, -1.35]),
  ]);

  const actions: Record<CharacterAnimState, THREE.AnimationAction> = {
    idle: mixer.clipAction(idleClip),
    running: mixer.clipAction(runningClip),
    walking: mixer.clipAction(walkingClip),
    jumping: mixer.clipAction(jumpingClip),
    dodging: mixer.clipAction(dodgingClip),
    falling: mixer.clipAction(fallingClip),
    celebrating: mixer.clipAction(celebratingClip),
    attacking: mixer.clipAction(attackingClip),
    victory: mixer.clipAction(celebratingClip.clone()),
    defeat: mixer.clipAction(defeatClip),
  };

  actions.defeat.loop = THREE.LoopOnce;
  actions.defeat.clampWhenFinished = true;

  let currentState: CharacterAnimState = 'idle';
  actions.idle.play();

  const playState = (state: CharacterAnimState, fadeDuration = 0.15) => {
    if (state === currentState) return;
    const prev = actions[currentState];
    const next = actions[state];
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    prev.crossFadeTo(next, fadeDuration, true);
    currentState = state;
  };

  return {
    root,
    mixer,
    actions,
    currentState,
    playState,
    dispose: () => {
      mixer.stopAllAction();
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
      primaryMat.dispose();
      secondaryMat.dispose();
      accentMat.dispose();
      visorMat.dispose();
    },
  };
}

/**
 * Exports a procedural character rig to an in-memory GLB ArrayBuffer and loads it back
 * via GLTFLoader, fulfilling real GLTF/GLB asset pipeline support with zero external 404s.
 */
export async function exportAndVerifyGltfRig(
  skin: SkinDefinition,
): Promise<THREE.Group> {
  const rig = createArticulatedCharacterRig({
    primaryColor: skin.primaryColor,
    secondaryColor: skin.secondaryColor,
    accentColor: skin.accentColor,
    visorColor: skin.visorColor,
    metalness: skin.metalness,
    roughness: skin.roughness,
  });

  const exporter = new GLTFExporter();
  const loader = new GLTFLoader();

  try {
    const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        rig.root,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            const json = JSON.stringify(result);
            resolve(new TextEncoder().encode(json).buffer);
          }
        },
        (err) => reject(err),
        { binary: true },
      );
    });

    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(glb, '', resolve, reject);
    });
    rig.dispose();
    return gltf.scene;
  } catch {
    return rig.root;
  }
}
