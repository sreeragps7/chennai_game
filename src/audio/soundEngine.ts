// Procedural Web Audio API Synthesizer for GTA Chennai ("Madras Syndicate")
// Zero external MP3 dependencies — 100% real-time Web Audio synthesis

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenPhase: number = 0;
  private isInitialized: boolean = false;

  public init() {
    if (this.isInitialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Continuous Vehicle Engine Oscillator
      this.engineOsc = this.ctx.createOscillator();
      this.engineSubOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineSubOsc.type = 'triangle';
      this.engineOsc.frequency.value = 58;
      this.engineSubOsc.frequency.value = 29;
      this.engineGain.gain.value = 0.0;

      // Low-pass filter so engine sounds warm and mechanical, not harsh
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;

      this.engineOsc.connect(filter);
      this.engineSubOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.engineSubOsc.start();

      // Police Siren Oscillator
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 650;
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();

      this.isInitialized = true;
    } catch {
      // AudioContext blocked or unsupported
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.isMuted && this.engineGain && this.sirenGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public updateLoop(
    isPlaying: boolean,
    speedRatio: number,
    isAutoRickshaw: boolean,
    isDrifting: boolean,
    wantedStars: number,
    dt: number
  ) {
    if (!this.ctx || !this.isInitialized || !this.engineOsc || !this.engineSubOsc || !this.engineGain || !this.sirenOsc || !this.sirenGain) {
      return;
    }
    const now = this.ctx.currentTime;

    if (!isPlaying || this.isMuted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.sirenGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }

    // Engine pitch & timbre based on vehicle type (2-stroke Auto-Rickshaw vs heavy vehicle)
    const baseFreq = isAutoRickshaw ? 74 : 46;
    const maxFreq = isAutoRickshaw ? 235 : 155;
    const flutter = isAutoRickshaw ? Math.sin(now * 42) * 4.5 : Math.sin(now * 20) * 1.5;
    const targetFreq = baseFreq + Math.min(1, Math.abs(speedRatio)) * (maxFreq - baseFreq) + (isDrifting ? 25 : 0) + flutter;

    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);
    this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.04);
    const targetVol = 0.025 + Math.min(1, Math.abs(speedRatio)) * 0.045;
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.05);

    // Police Siren modulation when Wanted >= 1
    if (wantedStars > 0) {
      this.sirenPhase += dt * (2.2 + wantedStars * 0.45);
      const sirenFreq = 660 + Math.sin(this.sirenPhase * Math.PI * 2) * 240;
      this.sirenOsc.frequency.setTargetAtTime(sirenFreq, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(0.018 + wantedStars * 0.005, now, 0.08);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.08);
    }
  }

  // Iconic Chennai Auto-Rickshaw Squeeze Bulb Double Horn ("Pom-Pom!")
  public playAutoHorn(isHeavyBus: boolean = false) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = isHeavyBus ? [185, 233] : [440, 554];
    const pulseOffsets = [0, 0.14];

    pulseOffsets.forEach((offset) => {
      freqs.forEach((f) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = isHeavyBus ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(f, now + offset);
        osc.frequency.exponentialRampToValueAtTime(f * 0.94, now + offset + 0.1);

        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.06, now + offset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.11);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
    });
  }

  // Heavy collision impact crunch
  public playImpact(intensity: number = 1.0) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const startFreq = 130 + Math.min(1, intensity) * 70;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.18);

    const vol = Math.min(0.18, 0.06 + intensity * 0.09);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // EMP / Thalaivar Shockwave Pulse
  public playEmpBlast() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.42);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // Checkpoint / Cash Pickup Chime
  public playPickup(isMajor: boolean = false) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = isMajor ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.075);

      gain.gain.setValueAtTime(0.08, now + idx * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.24);
    });
  }

  // Wasted / Busted Low Brass Drop
  public playBusted() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [220, 196, 164.81, 130.81].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.09, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.36);
    });
  }

  public playMissionComplete(success: boolean = true) {
    if (success) {
      this.playPickup(true);
    } else {
      this.playBusted();
    }
  }

  public stopAll() {
    if (this.engineGain && this.sirenGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
    }
  }
}

export const soundEngine = new SoundEngine();

