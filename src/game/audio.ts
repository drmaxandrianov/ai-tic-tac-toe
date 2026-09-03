/* Синтезированный звук: без внешних ассетов, WebAudio API. */

type OscType = OscillatorType;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  setMuted(m: boolean): void {
    this._muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.02);
    }
  }

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : 0.32;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscType = 'sine',
    vol = 1,
    slideTo?: number,
    delay = 0,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    try {
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      /* noop */
    }
  }

  private noise(dur: number, vol = 0.4, delay = 0, freq = 1800): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    try {
      const t0 = ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch {
      /* noop */
    }
  }

  unlock(): void {
    this.ensure();
  }

  click(): void {
    this.tone(940, 0.05, 'square', 0.35);
    this.tone(1400, 0.04, 'sine', 0.25, undefined, 0.02);
  }

  hover(): void {
    this.tone(1200, 0.03, 'sine', 0.12);
  }

  place(): void {
    this.tone(520, 0.09, 'sine', 0.7, 840);
    this.tone(1040, 0.06, 'triangle', 0.3, 1560, 0.01);
    this.noise(0.05, 0.15, 0, 3200);
  }

  aiPlace(): void {
    this.tone(340, 0.1, 'sawtooth', 0.4, 190);
    this.tone(680, 0.07, 'square', 0.18, 420, 0.015);
    this.noise(0.06, 0.12, 0, 900);
  }

  invalid(): void {
    this.tone(150, 0.12, 'square', 0.4, 110);
  }

  think(): void {
    this.noise(0.09, 0.16, 0, 2400);
    this.tone(1500, 0.05, 'sine', 0.18, 1900, 0.06);
    this.tone(1900, 0.05, 'sine', 0.14, 2400, 0.14);
  }

  undo(): void {
    this.tone(620, 0.08, 'triangle', 0.4, 380);
  }

  start(): void {
    this.tone(240, 0.16, 'sawtooth', 0.4, 720);
    this.tone(480, 0.2, 'triangle', 0.35, 960, 0.1);
    this.noise(0.25, 0.2, 0.02, 1400);
  }

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.5, undefined, i * 0.11));
    this.tone(2093, 0.5, 'sine', 0.25, undefined, notes.length * 0.11);
    this.noise(0.5, 0.1, 0.1, 5200);
  }

  lose(): void {
    const notes = [392, 311.13, 246.94, 174.61];
    notes.forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.35, f * 0.92, i * 0.16));
    this.noise(0.4, 0.16, 0.1, 500);
  }

  draw(): void {
    this.tone(440, 0.18, 'triangle', 0.4);
    this.tone(440, 0.24, 'triangle', 0.4, undefined, 0.22);
  }
}

export const sfx = new Sfx();
