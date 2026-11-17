// All sound in Emberkeep is synthesised live with WebAudio: no audio files,
// nothing to download. Short effects for every action, plus a quiet ambient
// loop of soft pads and pentatonic plucks that keeps the grove alive.

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

function noteFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicOn = false;
    this.musicTimer = null;
    this.step = 0;
  }

  // Browsers only let sound start after a gesture; call from any click/key.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  ready() {
    return !!this.ctx;
  }

  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol, filterFreq, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    if (slideTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  // --- effects -------------------------------------------------------------
  click() {
    this.tone(660, 0.07, 'sine', 0.25);
    this.tone(990, 0.09, 'sine', 0.12, 0.02);
  }

  flare() {
    this.noise(0.35, 0.5, 2400, 0, 300);
    this.tone(180, 0.28, 'sine', 0.5, 0, 55);
    this.tone(880, 0.18, 'triangle', 0.16, 0, 220);
  }

  ember(combo) {
    const step = Math.min(combo, PENTA.length - 1);
    const base = 72 + PENTA[step];
    this.tone(noteFreq(base), 0.35, 'sine', 0.28);
    this.tone(noteFreq(base + 12), 0.3, 'sine', 0.1, 0.03);
  }

  hit() {
    this.tone(110, 0.22, 'square', 0.28, 0, 55);
    this.noise(0.18, 0.35, 500, 0, 120);
  }

  shadeDown() {
    this.tone(320, 0.16, 'triangle', 0.2, 0, 90);
    this.noise(0.12, 0.14, 900, 0, 200);
  }

  wave() {
    this.tone(196, 0.5, 'sawtooth', 0.14);
    this.tone(294, 0.5, 'sawtooth', 0.12, 0.12);
    this.tone(392, 0.6, 'sawtooth', 0.1, 0.24);
  }

  victory() {
    const seq = [60, 64, 67, 72, 76, 79, 84];
    seq.forEach((m, i) => this.tone(noteFreq(m), 0.5, 'triangle', 0.22, i * 0.13));
  }

  gameover() {
    const seq = [57, 55, 52, 48, 45];
    seq.forEach((m, i) => this.tone(noteFreq(m), 0.7, 'sine', 0.22, i * 0.22));
  }

  // --- ambient music -------------------------------------------------------
  // A slow loop: a warm pad chord every 8 steps, a sparse pentatonic pluck
  // on some steps. Scheduled with a lookahead timer so it never stutters.
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    const chords = [
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
      [50, 53, 57],
    ];
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      const chord = chords[Math.floor(this.step / 8) % chords.length];
      if (this.step % 8 === 0) {
        chord.forEach((m) => {
          const t0 = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = noteFreq(m);
          osc.detune.value = 4;
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.5, t0 + 1.2);
          gain.gain.setTargetAtTime(0, t0 + 3.2, 0.8);
          osc.connect(gain);
          gain.connect(this.musicGain);
          osc.start(t0);
          osc.stop(t0 + 6);
        });
      }
      if (this.step % 2 === 0 && Math.random() < 0.45) {
        const m = 72 + PENTA[Math.floor(Math.random() * PENTA.length)];
        const t0 = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = noteFreq(m);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.35, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(t0);
        osc.stop(t0 + 1.8);
      }
      this.step += 1;
    };
    tick();
    this.musicTimer = window.setInterval(tick, 450);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
