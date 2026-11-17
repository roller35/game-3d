import * as THREE from 'three';

const gateTextureCache = new Map<string, THREE.CanvasTexture>();
let contactShadowTex: THREE.CanvasTexture | null = null;
let trackConcreteTex: THREE.CanvasTexture | null = null;
let hazardStripeTex: THREE.CanvasTexture | null = null;

export function createTrackTexture(
  baseHex: string,
  lineHex: string,
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  if (trackConcreteTex) {
    trackConcreteTex.dispose();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concrete grain
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const alpha = 0.03 + Math.random() * 0.05;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(15,23,42,${alpha})`;
    ctx.fillRect(x, y, 4, 4);
  }

  // Subtle seam lines across track
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.12)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  // Dashed lane guides
  ctx.fillStyle = lineHex;
  ctx.globalAlpha = 0.45;
  for (let y = 20; y < 512; y += 128) {
    ctx.fillRect(168, y, 10, 68);
    ctx.fillRect(334, y, 10, 68);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  trackConcreteTex = tex;
  return tex;
}

export function getHazardStripeTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  if (hazardStripeTex) return hazardStripeTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#1e293b';
  for (let i = -256; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 32, 0);
    ctx.lineTo(i + 288, 256);
    ctx.lineTo(i + 256, 256);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  hazardStripeTex = tex;
  return tex;
}

export function getGateSignTexture(
  label: string,
  variant: 'yellow' | 'red' | 'mystery' | 'risk',
  maxAnisotropy = 4,
): THREE.CanvasTexture {
  const key = `${variant}:${label}`;
  const existing = gateTextureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  // Vibrant stylized panel backdrop
  const palettes = {
    yellow: { top: '#facc15', bottom: '#d97706', border: '#92400e' },
    red: { top: '#ef4444', bottom: '#b91c1c', border: '#7f1d1d' },
    mystery: { top: '#a855f7', bottom: '#6b21a8', border: '#3b0764' },
    risk: { top: '#0ea5e9', bottom: '#0369a1', border: '#0c4a6e' },
  }[variant];

  const grad = ctx.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, palettes.top);
  grad.addColorStop(1, palettes.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 384);

  // Subtle vertical speed sheen stripes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(28, 0, 44, 384);
  ctx.fillRect(440, 0, 24, 384);

  // Crisp inner frame
  ctx.strokeStyle = palettes.border;
  ctx.lineWidth = 20;
  ctx.strokeRect(10, 10, 492, 364);

  // Large white numerals with thick black outline
  const fontSize = label.length >= 5 ? 112 : label.length >= 4 ? 132 : 168;
  ctx.font = `900 ${fontSize}px Outfit, Impact, Arial Black, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.lineJoin = 'round';
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeText(label, 256, 198);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, 256, 198);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  gateTextureCache.set(key, tex);
  return tex;
}

export function getContactShadowTexture(): THREE.CanvasTexture {
  if (contactShadowTex) return contactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.58)');
  grad.addColorStop(0.6, 'rgba(15, 23, 42, 0.25)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  contactShadowTex = tex;
  return tex;
}

export function disposeAllCachedTextures(): void {
  gateTextureCache.forEach((t) => t.dispose());
  gateTextureCache.clear();
  trackConcreteTex?.dispose();
  trackConcreteTex = null;
  hazardStripeTex?.dispose();
  hazardStripeTex = null;
  contactShadowTex?.dispose();
  contactShadowTex = null;
}
