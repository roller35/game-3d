import * as THREE from 'three';

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat = new THREE.Matrix4();

export class ParticleSystem {
  public readonly mesh: THREE.InstancedMesh;
  private readonly capacity = 220;
  private pool: ParticleSlot[] = [];
  private cursor = 0;
  private geo: THREE.IcosahedronGeometry;
  private mat: THREE.MeshBasicMaterial;

  constructor() {
    this.geo = new THREE.IcosahedronGeometry(0.18, 0);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    for (let i = 0; i < this.capacity; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(0xffffff),
      });
      this.mesh.setColorAt(i, new THREE.Color(0xffffff));
    }
  }

  emitBurst(
    x: number,
    y: number,
    z: number,
    hexColor: number,
    count = 14,
    speed = 6,
    size = 1,
  ): void {
    for (let n = 0; n < count; n++) {
      const slot = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.capacity;

      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.8;
      slot.y = y + Math.random() * 0.6;
      slot.z = z + (Math.random() - 0.5) * 0.8;
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.75) * speed;
      slot.vx = Math.cos(angle) * spd;
      slot.vy = 2.5 + Math.random() * speed * 0.75;
      slot.vz = Math.sin(angle) * spd;
      slot.maxLife = 0.35 + Math.random() * 0.35;
      slot.life = slot.maxLife;
      slot.size = size * (0.7 + Math.random() * 0.7);
      slot.color.setHex(hexColor);
    }
  }

  update(dt: number): void {
    let drawn = 0;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;

      const ratio = p.life / p.maxLife;
      _pos.set(p.x, p.y, p.z);
      _quat.identity();
      _scale.setScalar(p.size * ratio);
      _mat.compose(_pos, _quat, _scale);

      this.mesh.setMatrixAt(drawn, _mat);
      this.mesh.setColorAt(drawn, p.color);
      drawn++;
    }

    this.mesh.count = drawn;
    if (drawn > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) {
        this.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
