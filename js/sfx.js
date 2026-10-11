// Sound effects for the duel, synthesized with Web Audio (no files, no libraries). Visual and audio only:
// no rule reads this file. Browsers block audio until a key or a click, so main.js calls Sfx.unlock() on
// the first input. Each sound is a short transient, a body and a tail; pitch and level vary a little so
// repeats do not tire, and the same sound never stacks twice in one frame.
const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null, enabled = true, volume = 0.7;
  const last = {};
  const rnd = (a, b) => a + Math.random() * (b - a);
  const vary = (f, k) => f * (1 + rnd(-k, k));

  function unlock() {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = volume;
        // A gentle compressor so stacked hits never clip.
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        master.connect(comp); comp.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === "suspended") ac.resume();
    } catch (e) { ac = null; /* no audio: the game still works */ }
  }

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function noise(t, dur, type, f0, f1, q, peak) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, 0.005, peak, dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  function tone(t, dur, type, f0, f1, peak) {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, 0.003, peak, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  // k: strength (0 to 1) for hits, the level for the combo, the beat for the countdown.
  const SOUNDS = {
    // Typing
    key: (t) => { noise(t, 0.025, "highpass", vary(3800, 0.15), 0, 0.7, 0.07); tone(t, 0.03, "triangle", vary(900, 0.1), 600, 0.025); },
    typo: (t) => { tone(t, 0.11, "square", 150, 110, 0.06); noise(t, 0.06, "lowpass", 500, 200, 0.7, 0.08); },
    // Attacks and hits
    whoosh: (t, k) => noise(t, 0.14 + 0.1 * k, "bandpass", vary(500, 0.1), vary(2400, 0.1), 1.4, 0.12 + 0.08 * k),
    punch: (t, k) => { tone(t, 0.16, "sine", vary(140, 0.08), 45, 0.5 + 0.2 * k); noise(t, 0.05, "highpass", 1800, 0, 0.7, 0.3); },
    slash: (t, k) => { noise(t, 0.09, "highpass", 2500, 0, 0.7, 0.35); tone(t, 0.3, "triangle", vary(1180, 0.05), 1100, 0.1); tone(t, 0.12, "sine", 160, 60, 0.3 + 0.2 * k); },
    bat: (t, k) => { tone(t, 0.28, "triangle", vary(1650, 0.04), 1500, 0.18); tone(t, 0.14, "sine", 150, 55, 0.4 + 0.2 * k); noise(t, 0.05, "highpass", 2500, 0, 0.7, 0.28); },
    staff: (t, k) => { tone(t, 0.1, "square", vary(420, 0.06), 180, 0.12); noise(t, 0.08, "bandpass", 900, 400, 1.2, 0.35 + 0.2 * k); },
    axe: (t, k) => { tone(t, 0.3, "sine", 95, 38, 0.6); noise(t, 0.18, "lowpass", 1400, 200, 0.7, 0.4 + 0.2 * k); },
    hammer: (t, k) => { tone(t, 0.42, "sine", 70, 30, 0.75); noise(t, 0.2, "lowpass", 900, 120, 0.7, 0.45 + 0.2 * k); tone(t, 0.45, "triangle", vary(620, 0.04), 600, 0.08); },
    whip: (t, k) => { noise(t, 0.035, "highpass", 4200, 0, 0.8, 0.5 + 0.2 * k); tone(t, 0.06, "square", vary(2400, 0.08), 900, 0.07); noise(t + 0.02, 0.12, "bandpass", 1600, 700, 1.2, 0.18); },
    gun: (t, k) => { noise(t, 0.05, "highpass", 1500, 0, 0.7, 0.6); tone(t, 0.14, "square", vary(180, 0.08), 50, 0.2 + 0.1 * k); noise(t + 0.03, 0.25, "lowpass", 900, 200, 0.7, 0.18); },
    frost: (t) => { noise(t, 0.35, "highpass", 4000, 6000, 0.6, 0.2); tone(t, 0.5, "sine", vary(2600, 0.05), 3100, 0.04); },
    flame: (t) => noise(t, 0.3, "bandpass", 700, 300, 0.8, 0.28),
    parry: (t) => { tone(t, 0.45, "triangle", 1500, 1450, 0.16); tone(t, 0.55, "sine", 2250, 0, 0.08); noise(t, 0.06, "highpass", 3000, 0, 0.7, 0.3); },
    hurt: (t) => tone(t, 0.12, "square", vary(220, 0.1), 140, 0.04),
    land: (t, k) => { tone(t, 0.18, "sine", 110, 40, 0.3 + 0.3 * k); noise(t, 0.12, "lowpass", 700, 150, 0.7, 0.18 + 0.2 * k); },
    thud: (t) => { tone(t, 0.3, "sine", 90, 35, 0.65); noise(t, 0.25, "lowpass", 600, 120, 0.7, 0.3); },
    step: (t) => noise(t, 0.06, "lowpass", vary(500, 0.15), 200, 0.7, 0.06),
    // Fight moments
    combo: (t, k) => { const f = 520 * Math.pow(1.122, Math.min(6, k)); tone(t, 0.12, "triangle", f, 0, 0.14); tone(t + 0.07, 0.18, "triangle", f * 1.5, 0, 0.12); },
    broken: (t) => { tone(t, 0.25, "sawtooth", 330, 110, 0.07); noise(t, 0.2, "bandpass", 2000, 500, 2, 0.12); },
    counter: (t) => { tone(t, 0.09, "square", 880, 0, 0.07); tone(t + 0.06, 0.12, "square", 1320, 0, 0.07); },
    ultReady: (t) => { [660, 880, 1100, 1320].forEach((f, i) => tone(t + i * 0.06, 0.22, "triangle", f, 0, 0.1)); noise(t, 0.4, "highpass", 5000, 8000, 0.5, 0.05); },
    ultimate: (t) => { tone(t, 0.7, "sawtooth", 110, 440, 0.1); noise(t, 0.7, "bandpass", 300, 3000, 0.9, 0.25); tone(t + 0.05, 0.6, "sine", 55, 40, 0.5); },
    ko: (t) => { tone(t, 0.9, "sine", 80, 30, 0.8); noise(t, 0.8, "lowpass", 1200, 100, 0.7, 0.5); tone(t, 0.6, "sawtooth", 220, 55, 0.08); },
    beep: (t) => tone(t, 0.14, "square", 660, 0, 0.07),
    go: (t) => { tone(t, 0.32, "square", 990, 0, 0.08); tone(t, 0.32, "square", 1320, 0, 0.05); },
    ui: (t) => tone(t, 0.05, "triangle", vary(1200, 0.03), 900, 0.05),
    win: (t) => { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.11, 0.3, "triangle", f, 0, 0.12)); },
    lose: (t) => { [392, 330, 262].forEach((f, i) => tone(t + i * 0.16, 0.35, "triangle", f, 0, 0.1)); },
  };

  function play(name, k) {
    if (!enabled || !ac || ac.state !== "running" || !SOUNDS[name]) return;
    const now = ac.currentTime;
    if (last[name] && now - last[name] < 0.03) return;
    last[name] = now;
    try { SOUNDS[name](now, k || 0); } catch (e) { /* audio is best-effort */ }
  }

  function setEnabled(on) { enabled = !!on; }
  function setVolume(v) { volume = v; if (master) master.gain.value = v; }

  return { unlock, play, setEnabled, setVolume, names: Object.keys(SOUNDS), get running() { return !!ac && ac.state === "running"; } };
})();
