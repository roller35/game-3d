import * as THREE from 'three';
import { WORLD_THEMES } from './levels';
import { createTrackTexture } from './textures';
import type { WorldId, WorldTheme } from './types';

export interface BuiltWorld {
  root: THREE.Group;
  theme: WorldTheme;
  arenaCenterZ: number;
  dispose: () => void;
}

const _dummy = new THREE.Object3D();

export function buildWorldEnvironment(options: {
  worldId: WorldId;
  trackLength: number;
  trackWidth: number;
  isEndless: boolean;
  maxAnisotropy: number;
}): BuiltWorld {
  const { worldId, trackLength, trackWidth, isEndless, maxAnisotropy } = options;
  const theme = WORLD_THEMES[worldId];
  const root = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];

  const trackMatColor = '#' + new THREE.Color(theme.trackColor).getHexString();
  const lineColor = '#' + new THREE.Color(theme.trackEdgeColor).getHexString();
  const trackTex = createTrackTexture(trackMatColor, lineColor, maxAnisotropy);
  const segLen = isEndless ? 460 : trackLength + 60;
  trackTex.repeat.set(1, Math.max(8, Math.round(segLen / 12)));
  disposables.push(trackTex);

  // Main raised concrete track platform (sits at y = 0 top surface)
  const trackGeo = new THREE.BoxGeometry(trackWidth, 1.4, segLen);
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: trackTex,
    roughness: 0.8,
    metalness: 0.08,
  });
  const trackMesh = new THREE.Mesh(trackGeo, trackMat);
  trackMesh.position.set(0, -0.7, -segLen / 2 + 12);
  trackMesh.receiveShadow = true;
  root.add(trackMesh);
  disposables.push(trackGeo, trackMat);

  // Clean 3D track side curbs (left and right raised borders)
  const curbGeo = new THREE.BoxGeometry(0.45, 0.35, segLen);
  const curbMat = new THREE.MeshStandardMaterial({
    color: theme.trackEdgeColor,
    roughness: 0.45,
    metalness: 0.2,
  });
  const leftCurb = new THREE.Mesh(curbGeo, curbMat);
  leftCurb.position.set(-trackWidth / 2 - 0.22, 0.17, -segLen / 2 + 12);
  leftCurb.receiveShadow = true;
  const rightCurb = new THREE.Mesh(curbGeo, curbMat);
  rightCurb.position.set(trackWidth / 2 + 0.22, 0.17, -segLen / 2 + 12);
  rightCurb.receiveShadow = true;
  root.add(leftCurb, rightCurb);
  disposables.push(curbGeo, curbMat);

  // Broad surrounding world ground / landscape (never floating in black void!)
  const landscapeGeo = new THREE.PlaneGeometry(420, segLen + 180);
  landscapeGeo.rotateX(-Math.PI / 2);
  const landscapeMat = new THREE.MeshStandardMaterial({
    color: theme.groundColor,
    roughness: worldId === 'snow' ? 0.55 : 0.92,
    metalness: worldId === 'futuristic' ? 0.35 : 0.02,
  });
  const landscape = new THREE.Mesh(landscapeGeo, landscapeMat);
  landscape.position.set(0, -1.65, -segLen / 2 + 10);
  landscape.receiveShadow = true;
  root.add(landscape);
  disposables.push(landscapeGeo, landscapeMat);

  // World-specific flanking scenery props using InstancedMesh (trees, buildings, dunes, crystals, lava rocks, neon pylons)
  const propCount = 64;
  const sideDistMin = trackWidth / 2 + 4.5;
  const sideDistMax = trackWidth / 2 + 36;

  if (worldId === 'green_hills') {
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.45, 2.2, 8);
    trunkGeo.translate(0, 1.1, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const crownGeo = new THREE.ConeGeometry(1.75, 4.2, 9);
    crownGeo.translate(0, 3.8, 0);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.78 });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, propCount);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, propCount);
    crowns.castShadow = true;

    for (let i = 0; i < propCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (sideDistMin + ((i * 7) % 24));
      const z = 8 - (i / propCount) * segLen;
      const sc = 0.85 + ((i * 13) % 10) * 0.05;
      _dummy.position.set(x, -1.65, z);
      _dummy.rotation.y = i * 0.7;
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      trunks.setMatrixAt(i, _dummy.matrix);
      crowns.setMatrixAt(i, _dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    root.add(trunks, crowns);
    disposables.push(trunkGeo, trunkMat, crownGeo, crownMat);
  } else if (worldId === 'modern_city') {
    const bGeo = new THREE.BoxGeometry(6, 16, 6);
    bGeo.translate(0, 8, 0);
    const bMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.45 });
    const roofGeo = new THREE.BoxGeometry(6.3, 0.7, 6.3);
    roofGeo.translate(0, 16.35, 0);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.6 });

    const buildings = new THREE.InstancedMesh(bGeo, bMat, propCount);
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, propCount);
    for (let i = 0; i < propCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (sideDistMin + 4 + ((i * 9) % 26));
      const z = 6 - (i / propCount) * segLen;
      const hScale = 0.65 + ((i * 11) % 12) * 0.12;
      _dummy.position.set(x, -1.65, z);
      _dummy.rotation.y = 0;
      _dummy.scale.set(1, hScale, 1);
      _dummy.updateMatrix();
      buildings.setMatrixAt(i, _dummy.matrix);
      roofs.setMatrixAt(i, _dummy.matrix);
    }
    buildings.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    root.add(buildings, roofs);
    disposables.push(bGeo, bMat, roofGeo, roofMat);
  } else if (worldId === 'desert') {
    const pyrGeo = new THREE.ConeGeometry(5.5, 9, 4);
    pyrGeo.translate(0, 4.5, 0);
    const pyrMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.88 });
    const pyrs = new THREE.InstancedMesh(pyrGeo, pyrMat, propCount);
    for (let i = 0; i < propCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (sideDistMin + 3 + ((i * 11) % 28));
      const z = 8 - (i / propCount) * segLen;
      const sc = 0.7 + ((i * 5) % 9) * 0.14;
      _dummy.position.set(x, -1.65, z);
      _dummy.rotation.y = Math.PI / 4;
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      pyrs.setMatrixAt(i, _dummy.matrix);
    }
    pyrs.instanceMatrix.needsUpdate = true;
    root.add(pyrs);
    disposables.push(pyrGeo, pyrMat);
  } else if (worldId === 'snow') {
    const peakGeo = new THREE.ConeGeometry(4.2, 11, 6);
    peakGeo.translate(0, 5.5, 0);
    const peakMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.35, metalness: 0.15 });
    const peaks = new THREE.InstancedMesh(peakGeo, peakMat, propCount);
    for (let i = 0; i < propCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (sideDistMin + 2 + ((i * 7) % 26));
      const z = 8 - (i / propCount) * segLen;
      const sc = 0.75 + ((i * 7) % 10) * 0.12;
      _dummy.position.set(x, -1.65, z);
      _dummy.rotation.y = i * 0.4;
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      peaks.setMatrixAt(i, _dummy.matrix);
    }
    peaks.instanceMatrix.needsUpdate = true;
    root.add(peaks);
    disposables.push(peakGeo, peakMat);
  } else if (worldId === 'volcanic') {
    const spireGeo = new THREE.ConeGeometry(3.2, 9.5, 5);
    spireGeo.translate(0, 4.75, 0);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.85 });
    const lavaGeo = new THREE.SphereGeometry(1.4, 8, 6);
    lavaGeo.translate(0, 0.5, 0);
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    });
    const spires = new THREE.InstancedMesh(spireGeo, spireMat, propCount);
    const pools = new THREE.InstancedMesh(lavaGeo, lavaMat, propCount);
    for (let i = 0; i < propCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (sideDistMin + ((i * 9) % 28));
      const z = 8 - (i / propCount) * segLen;
      const sc = 0.8 + ((i * 3) % 8) * 0.14;
      _dummy.position.set(x, -1.65, z);
      _dummy.rotation.y = i * 0.5;
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      spires.setMatrixAt(i, _dummy.matrix);
      _dummy.scale.set(1.5, 0.25, 1.5);
      _dummy.updateMatrix();
      pools.setMatrixAt(i, _dummy.matrix);
    }
    spires.instanceMatrix.needsUpdate = true;
    pools.instanceMatrix.needsUpdate = true;
    root.add(spires, pools);
    disposables.push(spireGeo, spireMat, lavaGeo, lavaMat);
  } else {
    // futuristic
    const pylonGeo = new THREE.BoxGeometry(1.6, 14, 1.6);
    pylonGeo.translate(0, 7, 0);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.25 });
    const ringGeo = new THREE.BoxGeometry(1.9, 0.45, 1.9);
    ringGeo.translate(0, 12.8, 0);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    const pylons = new THREE.InstancedMesh(pylonGeo, pylonMat, propCount);
    const rings = new THREE.InstancedMesh(ringGeo, ringMat, propCount);
    for (let i = 0; i < propCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (sideDistMin + 1 + ((i * 8) % (sideDistMax - sideDistMin)));
      const z = 8 - (i / propCount) * segLen;
      const sc = 0.7 + ((i * 5) % 8) * 0.12;
      _dummy.position.set(x, -1.65, z);
      _dummy.rotation.y = 0;
      _dummy.scale.set(1, sc, 1);
      _dummy.updateMatrix();
      pylons.setMatrixAt(i, _dummy.matrix);
      rings.setMatrixAt(i, _dummy.matrix);
    }
    pylons.instanceMatrix.needsUpdate = true;
    rings.instanceMatrix.needsUpdate = true;
    root.add(pylons, rings);
    disposables.push(pylonGeo, pylonMat, ringGeo, ringMat);
  }

  // Distant horizon mountain ridge ring for depth
  const ridgeGeo = new THREE.ConeGeometry(28, 38, 5);
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: theme.accentPropColor,
    roughness: 0.9,
  });
  const ridgeCount = 24;
  const ridges = new THREE.InstancedMesh(ridgeGeo, ridgeMat, ridgeCount);
  for (let i = 0; i < ridgeCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (68 + (i % 3) * 18);
    const z = 20 - (i / ridgeCount) * (segLen + 60);
    _dummy.position.set(x, -2, z);
    _dummy.rotation.y = i * 0.6;
    _dummy.scale.set(1.2, 0.8 + (i % 4) * 0.3, 1.2);
    _dummy.updateMatrix();
    ridges.setMatrixAt(i, _dummy.matrix);
  }
  ridges.instanceMatrix.needsUpdate = true;
  root.add(ridges);
  disposables.push(ridgeGeo, ridgeMat);

  // Campaign Finish Line + Final Battle Arena
  const arenaCenterZ = -trackLength - 14;
  if (!isEndless) {
    // Checkered finish strip at z = -trackLength
    const finishGeo = new THREE.BoxGeometry(trackWidth, 0.06, 2.2);
    const finishMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.2,
    });
    const finishStrip = new THREE.Mesh(finishGeo, finishMat);
    finishStrip.position.set(0, 0.03, -trackLength);
    root.add(finishStrip);
    disposables.push(finishGeo, finishMat);

    // Arena circular battle floor
    const arenaGeo = new THREE.CylinderGeometry(13.5, 14.5, 1.5, 28);
    const arenaMat = new THREE.MeshStandardMaterial({
      color: theme.trackColor,
      roughness: 0.7,
      metalness: 0.12,
    });
    const arenaPlatform = new THREE.Mesh(arenaGeo, arenaMat);
    arenaPlatform.position.set(0, -0.75, arenaCenterZ);
    arenaPlatform.receiveShadow = true;
    root.add(arenaPlatform);

    const ringBorderGeo = new THREE.TorusGeometry(13.3, 0.42, 10, 36);
    ringBorderGeo.rotateX(Math.PI / 2);
    const ringBorderMat = new THREE.MeshStandardMaterial({
      color: theme.trackEdgeColor,
      roughness: 0.35,
      metalness: 0.3,
    });
    const ringBorder = new THREE.Mesh(ringBorderGeo, ringBorderMat);
    ringBorder.position.set(0, 0.2, arenaCenterZ);
    root.add(ringBorder);

    disposables.push(arenaGeo, arenaMat, ringBorderGeo, ringBorderMat);
  }

  return {
    root,
    theme,
    arenaCenterZ,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
