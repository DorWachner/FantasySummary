// A snare drum roll that speeds up and swells, ending in a bass hit and a cymbal crash.
// Synthesized with the Web Audio API, so there is no sound file to load.

const SOUND_KEY = "nightWinnerSound";
let audio;
let noise;
let master;

export function isSoundOn() {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}

export function setSoundOn(on) {
  try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* storage blocked: the choice lasts this visit */ }
  if (!on) stopDrumroll();
}

function noiseBuffer() {
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function burst(output, start, length, volume, filterType, frequency, q = 1) {
  const source = audio.createBufferSource();
  source.buffer = noise;
  const filter = audio.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(gain).connect(output);
  source.start(start, Math.random(), length + 0.05);
}

function boom(output, start) {
  const osc = audio.createOscillator();
  osc.frequency.setValueAtTime(110, start);
  osc.frequency.exponentialRampToValueAtTime(38, start + 0.6);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.9, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
  osc.connect(gain).connect(output);
  osc.start(start);
  osc.stop(start + 1);
}

function schedule(rollSeconds) {
  stopDrumroll();
  master = audio.createGain();
  master.gain.value = 0.7;
  master.connect(audio.destination);
  const begin = audio.currentTime + 0.03;
  // Strokes start slow and quiet, then tighten into a fast, loud roll.
  for (let t = 0; t < rollSeconds;) {
    const progress = t / rollSeconds;
    const volume = 0.08 + 0.5 * progress ** 1.6;
    burst(master, begin + t, 0.07, volume * (0.85 + Math.random() * 0.3), "bandpass", 1900, 0.7);
    t += 0.075 - 0.045 * progress;
  }
  const hit = begin + rollSeconds;
  boom(master, hit);
  burst(master, hit, 0.25, 0.6, "bandpass", 1600, 0.6);
  burst(master, hit, 2.2, 0.45, "highpass", 6000);
}

// Starts the roll so the final hit lands after rollSeconds. Browsers keep audio silent
// until the person has interacted with the page; then the roll is skipped, not delayed.
export function playDrumroll(rollSeconds) {
  if (!isSoundOn()) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    noise ??= noiseBuffer();
  } catch {
    return;
  }
  if (audio.state === "running") {
    schedule(rollSeconds);
    return;
  }
  const asked = performance.now();
  audio.resume().then(() => {
    const late = (performance.now() - asked) / 1000;
    if (late < 0.3) schedule(rollSeconds - late);
  }).catch(() => { /* no sound allowed */ });
}

export function stopDrumroll() {
  if (!master) return;
  const old = master;
  master = undefined;
  try {
    old.gain.setTargetAtTime(0, audio.currentTime, 0.05);
    setTimeout(() => old.disconnect(), 400);
  } catch { /* already gone */ }
}
