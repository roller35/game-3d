export type MusicTrack = 'none' | 'menu' | 'campaign' | 'endless' | 'boss' | 'victory';

class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicVolume = 0.45;
  private sfxVolume = 0.75;
  private muted = false;
  private currentTrack: MusicTrack = 'none';
  private musicTimer: number | null = null;
  private stepIndex = 0;
  private lastFootstepMs = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.syncGains();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock(): void {
    this.ensureContext();
  }

  setPreferences(musicVolume: number, sfxVolume: number, muted: boolean): void {
    this.musicVolume = Math.max(0, Math.min(1, musicVolume));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
    this.muted = muted;
    this.syncGains();
  }

  private syncGains(): void {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(
      this.muted ? 0 : this.musicVolume * 0.28,
      now,
      0.04,
    );
    this.sfxGain.gain.setTargetAtTime(
      this.muted ? 0 : this.sfxVolume * 0.65,
      now,
      0.02,
    );
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    slideToFreq?: number,
    delaySec = 0,
    target: 'sfx' | 'music' = 'sfx',
  ): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.sfxGain || !this.musicGain || this.muted) return;

    const start = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), start);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, slideToFreq),
        start + duration,
      );
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.02, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(target === 'music' ? this.musicGain : this.sfxGain);

    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  playClick(): void {
    this.playTone(620, 0.06, 'triangle', 0.22, 840);
  }

  playFootstep(nowMs: number): void {
    if (nowMs - this.lastFootstepMs < 190) return;
    this.lastFootstepMs = nowMs;
    const pitch = 135 + Math.random() * 30;
    this.playTone(pitch, 0.04, 'sine', 0.06, 75);
  }

  playCollect(): void {
    this.playTone(540, 0.09, 'sine', 0.24, 780);
    this.playTone(810, 0.09, 'triangle', 0.16, 1080, 0.04);
  }

  playCoin(): void {
    this.playTone(987, 0.07, 'sine', 0.22);
    this.playTone(1318, 0.14, 'sine', 0.24, undefined, 0.055);
  }

  playGatePositive(): void {
    this.playTone(440, 0.11, 'triangle', 0.28);
    this.playTone(554, 0.12, 'triangle', 0.28, undefined, 0.06);
    this.playTone(659, 0.18, 'triangle', 0.3, undefined, 0.12);
  }

  playGateMultiplier(): void {
    this.playTone(523, 0.1, 'sawtooth', 0.16);
    this.playTone(659, 0.1, 'triangle', 0.22, undefined, 0.05);
    this.playTone(784, 0.12, 'triangle', 0.24, undefined, 0.1);
    this.playTone(1046, 0.24, 'sine', 0.3, undefined, 0.15);
  }

  playGateNegative(): void {
    this.playTone(280, 0.16, 'sawtooth', 0.22, 140);
    this.playTone(190, 0.2, 'square', 0.15, 95, 0.08);
  }

  playObstacleHit(): void {
    this.playTone(170, 0.14, 'sawtooth', 0.32, 58);
    this.playTone(110, 0.18, 'square', 0.22, 48, 0.02);
  }

  playSwoosh(): void {
    this.playTone(260, 0.09, 'sine', 0.09, 440);
  }

  playEnemyClash(): void {
    this.playTone(210, 0.1, 'square', 0.2, 95);
    this.playTone(340, 0.08, 'triangle', 0.18, 180, 0.03);
  }

  playBossIntro(): void {
    this.playTone(110, 0.45, 'sawtooth', 0.3, 98);
    this.playTone(165, 0.45, 'sawtooth', 0.24, 146, 0.12);
    this.playTone(220, 0.55, 'triangle', 0.28, 196, 0.25);
  }

  playBattleHit(): void {
    const base = 150 + Math.random() * 90;
    this.playTone(base, 0.08, 'triangle', 0.18, base * 0.55);
  }

  playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.24, 'triangle', 0.28, undefined, idx * 0.09);
    });
  }

  playDefeat(): void {
    const notes = [392, 349.23, 311.13, 246.94];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.26, 'sawtooth', 0.18, undefined, idx * 0.12);
    });
  }

  setMusicTrack(track: MusicTrack): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.stepIndex = 0;

    if (track === 'none' || typeof window === 'undefined') return;

    const tempoMs =
      track === 'boss'
        ? 175
        : track === 'endless'
        ? 195
        : track === 'campaign'
        ? 220
        : track === 'victory'
        ? 260
        : 320;

    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      this.playMusicStep(track, this.stepIndex++);
    }, tempoMs);
  }

  private playMusicStep(track: MusicTrack, step: number): void {
    if (track === 'menu') {
      const arp = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
      const note = arp[step % arp.length];
      this.playTone(note, 0.24, 'sine', 0.14, undefined, 0, 'music');
      if (step % 4 === 0) {
        this.playTone(130.81, 0.45, 'triangle', 0.14, undefined, 0, 'music');
      }
      return;
    }

    if (track === 'campaign') {
      const bass = [130.81, 130.81, 164.81, 196.0, 146.83, 146.83, 174.61, 196.0];
      const lead = [523.25, 0, 659.25, 587.33, 523.25, 659.25, 783.99, 659.25];
      this.playTone(bass[step % bass.length], 0.18, 'triangle', 0.18, undefined, 0, 'music');
      const m = lead[step % lead.length];
      if (m > 0 && step % 2 === 0) {
        this.playTone(m, 0.14, 'sine', 0.11, undefined, 0, 'music');
      }
      return;
    }

    if (track === 'endless') {
      const bass = [146.83, 146.83, 174.61, 220.0, 196.0, 196.0, 164.81, 146.83];
      const lead = [587.33, 698.46, 880, 698.46, 783.99, 659.25, 587.33, 523.25];
      this.playTone(bass[step % bass.length], 0.16, 'sawtooth', 0.1, undefined, 0, 'music');
      this.playTone(lead[step % lead.length], 0.14, 'triangle', 0.12, undefined, 0, 'music');
      return;
    }

    if (track === 'boss') {
      const bass = [98.0, 98.0, 116.54, 98.0, 130.81, 116.54, 98.0, 87.31];
      this.playTone(bass[step % bass.length], 0.15, 'sawtooth', 0.16, undefined, 0, 'music');
      if (step % 2 === 1) {
        this.playTone(392.0, 0.11, 'square', 0.08, undefined, 0, 'music');
      }
      return;
    }

    if (track === 'victory') {
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
      this.playTone(fanfare[step % fanfare.length], 0.22, 'triangle', 0.15, undefined, 0, 'music');
    }
  }

  dispose(): void {
    this.setMusicTrack('none');
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const audioManager = new AudioManager();
