/**
 * Procedural arena audio — fully synthesized with the Web Audio API, so there
 * are zero external sound assets. Provides ambient wind + crowd murmur, crowd
 * cheers, and combat SFX (sword swings, impacts, shield blocks).
 *
 * Browsers block audio until a user gesture, so call `init()` from a click/key
 * handler before expecting sound.
 */

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private started = false;

  /** Lazily create the context (must be triggered by a user gesture). */
  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    this.master = master;

    // Shared noise buffer (1s of white noise).
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    this.startAmbient(ctx, master, buf);
  }

  private startAmbient(ctx: AudioContext, master: GainNode, noise: AudioBuffer): void {
    if (this.started) return;
    this.started = true;

    // Wind: noise through a low-pass.
    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const windLp = ctx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 420;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    wind.connect(windLp).connect(windGain).connect(master);
    wind.start();

    // Crowd murmur: band-passed noise, intensity controlled by crowdGain.
    const crowd = ctx.createBufferSource();
    crowd.buffer = noise;
    crowd.loop = true;
    const crowdBp = ctx.createBiquadFilter();
    crowdBp.type = 'bandpass';
    crowdBp.frequency.value = 700;
    crowdBp.Q.value = 0.7;
    const crowdGain = ctx.createGain();
    crowdGain.gain.value = 0.04;
    crowd.connect(crowdBp).connect(crowdGain).connect(master);
    crowd.start();
    this.crowdGain = crowdGain;
  }

  /** Set ambient crowd loudness (0..1). */
  setCrowdIntensity(x: number): void {
    const ctx = this.ctx;
    const crowdGain = this.crowdGain;
    if (!ctx || !crowdGain) return;
    const g = 0.03 + Math.max(0, Math.min(1, x)) * 0.12;
    crowdGain.gain.setTargetAtTime(g, ctx.currentTime, 0.4);
  }

  /** A roaring crowd cheer (volume 0..1). */
  cheer(volume = 0.8): void {
    const ctx = this.ctx;
    const master = this.master;
    const noise = this.noiseBuffer;
    if (!ctx || !master || !noise) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(500, now);
    bp.frequency.linearRampToValueAtTime(1100, now + 0.4);
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.22 * volume, now + 0.25);
    g.gain.linearRampToValueAtTime(0.16 * volume, now + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    src.connect(bp).connect(g).connect(master);
    src.start(now);
    src.stop(now + 1.85);
  }

  /** Whoosh of a melee swing. */
  swing(): void {
    const ctx = this.ctx;
    const master = this.master;
    const noise = this.noiseBuffer;
    if (!ctx || !master || !noise) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, now);
    bp.frequency.exponentialRampToValueAtTime(2600, now + 0.12);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    src.connect(bp).connect(g).connect(master);
    src.start(now);
    src.stop(now + 0.24);
  }

  /** Heavy metal/flesh impact on a hit. */
  impact(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    // Low thud.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 0.24);
    // Metallic click.
    const noise = this.noiseBuffer;
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.18, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      src.connect(hp).connect(ng).connect(master);
      src.start(now);
      src.stop(now + 0.1);
    }
  }

  /** Metallic shield block clang. */
  block(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    [1400, 2100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq + i * 30;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(now + 0.2);
    });
  }
}

export const audio = new AudioManager();
