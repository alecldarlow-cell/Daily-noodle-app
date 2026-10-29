#!/usr/bin/env node
/**
 * Renders the website's in-play tones for Tangle, Borders and Reckon (tracker AF-013) to
 * small WAV files the app plays through shared/sound (ADR-009). The notes are copied from
 * the site's engines, where each sound is a few Web Audio oscillators:
 *
 *   tone(f, t, dur, type, g): an oscillator of `type` at `f` Hz from `t` s, its gain from
 *   0.0001 rising exponentially to `g` over 12 ms, falling exponentially to 0.0001 at
 *   t + dur, stopped at t + dur + 0.05 s (Reckon: + 0.03 s).
 *
 * Here each oscillator is the same band-limited wave Web Audio plays (a sum of its
 * harmonics below Nyquist, peak-normalised as the spec does), under the same envelope,
 * mixed and written as 16-bit mono PCM at 22,050 Hz. Pure arithmetic, no randomness and
 * no dependencies, so the files come out the same every time:
 *
 *   node scripts/make-sounds.js          writes assets/sounds/<cue>.wav
 *   node scripts/make-sounds.js --check  fails if a committed file differs from what it renders
 *
 * Where a site sound depends on the play (Tangle's step rises with the path's length, its
 * word chime with the word's; Reckon's result with the answer's zone), there is one file
 * per value the site can play. Reckon's Lock in and its result 120 ms later (the page's
 * setTimeout) are one file per zone, so no timer is needed. Mini, Doku, Sweep, Path and
 * Link have no in-play sounds; their celebration jingle (`jingle`) is engines/finish.js
 * `JINGLE` (website PR #40, AF-013), played on a fresh win only.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets/sounds');
const RATE = 22050;

/** engines/tangle.js and engines/borders.js stop an oscillator 50 ms after its fade; reckon.js 30 ms. */
const tone = (f, t, dur, type, g, tail = 0.05) => ({ f, t, dur, type, g, tail });
const reckonTone = (f, t, dur, type, vol) => tone(f, t, dur, type, vol, 0.03);
const semis = (base, n) => base * Math.pow(2, n / 12);

/** Every cue, by name: its tones, as the site's sfx / SND objects play them. */
const CUES = {};

// engines/tangle.js sfx
for (let k = 1; k <= 12; k++)
  CUES[`tangle-step-${k}`] = [tone(semis(392, k), 0, 0.08, 'sine', 0.05)];
for (let n = 3; n <= 8; n++)
  CUES[`tangle-word-${n}`] = [
    tone(semis(523, n), 0, 0.3, 'triangle', 0.14),
    tone(semis(784, n), 0.08, 0.42, 'triangle', 0.12),
  ];
CUES['tangle-meh'] = [tone(220, 0, 0.14, 'sine', 0.06)];
CUES['tangle-tick'] = [tone(880, 0, 0.05, 'square', 0.03)];
CUES['tangle-star'] = [523, 659, 784, 1047, 1319].map((f, i) =>
  tone(f, i * 0.08, 0.5, 'triangle', 0.11),
);
CUES['tangle-done'] = [784, 659, 523, 392].map((f, i) => tone(f, i * 0.12, 0.5, 'triangle', 0.12));

// engines/borders.js sfx (fail() is never called by the page, so it isn't rendered)
CUES['borders-right'] = [
  tone(659, 0, 0.35, 'triangle', 0.16),
  tone(988, 0.09, 0.5, 'triangle', 0.14),
];
CUES['borders-wrong'] = [tone(196, 0, 0.32, 'sine', 0.22), tone(147, 0.08, 0.4, 'sine', 0.16)];
CUES['borders-hint'] = [tone(523, 0, 0.18, 'sine', 0.08)];
CUES['borders-pass'] = [523, 659, 784, 1047].map((f, i) =>
  tone(f, i * 0.11, 0.6, 'triangle', 0.13),
);

// engines/reckon.js SND: lock() then, 120 ms later, res(z)
const res = (z, at) => {
  if (z === 0)
    return [660, 830, 990, 1320].map((f, i) =>
      reckonTone(f, at + i * 0.07, 0.22, 'triangle', 0.09),
    );
  if (z <= 2)
    return [
      reckonTone(620, at, 0.14, 'triangle', 0.09),
      reckonTone(z === 1 ? 830 : 740, at + 0.09, 0.2, 'triangle', 0.08),
    ];
  if (z === 3) return [reckonTone(520, at, 0.2, 'triangle', 0.07)];
  return [reckonTone(150, at, 0.25, 'sine', 0.14)];
};
CUES['reckon-tick'] = [reckonTone(1500, 0, 0.025, 'triangle', 0.03)];
for (let z = 0; z <= 4; z++)
  CUES[`reckon-lock-${z}`] = [reckonTone(440, 0, 0.08, 'triangle', 0.09), ...res(z, 0.12)];
CUES['reckon-done'] = [523, 659, 784, 1047].map((f, i) =>
  reckonTone(f, i * 0.11, 0.35, 'triangle', 0.09),
);

// engines/finish.js JINGLE (AF-013): [f, t, dur, type, g], each played with the same tone()
// envelope and a 50 ms tail. The celebration jingle for Mini, Doku, Sweep, Path and Link.
const JINGLE = [
  [523.25, 0, 0.16, 'triangle', 0.12],
  [659.25, 0.09, 0.16, 'triangle', 0.12],
  [783.99, 0.18, 0.16, 'triangle', 0.12],
  [1046.5, 0.27, 0.6, 'triangle', 0.13],
  [783.99, 0.27, 0.6, 'triangle', 0.08],
  [1318.51, 0.36, 0.5, 'sine', 0.05],
];
CUES['jingle'] = JINGLE.map(([f, t, dur, type, g]) => tone(f, t, dur, type, g));

/** Web Audio's built-in waves as Fourier sine series (the spec's PeriodicWave coefficients). */
function coeff(type, n) {
  if (type === 'sine') return n === 1 ? 1 : 0;
  if (type === 'square') return n % 2 ? 4 / (n * Math.PI) : 0;
  if (type === 'triangle')
    return n % 2 ? (8 * Math.sin((n * Math.PI) / 2)) / (n * Math.PI) ** 2 : 0;
  throw new Error(`unknown wave ${type}`);
}

/** One oscillator's wave, band-limited below Nyquist and scaled to a peak of 1. */
function wave(type, f) {
  const harmonics = [];
  for (let n = 1; n * f < RATE / 2; n++) {
    const b = coeff(type, n);
    if (b) harmonics.push([n, b]);
  }
  const at = (ph) => harmonics.reduce((s, [n, b]) => s + b * Math.sin(n * ph), 0);
  let peak = 0;
  for (let i = 0; i < 2048; i++) peak = Math.max(peak, Math.abs(at((2 * Math.PI * i) / 2048)));
  return (ph) => at(ph) / peak;
}

/** The gain envelope at time `x` after the tone's start (the engines' two exponential ramps). */
function gain(x, dur, g) {
  const lo = 0.0001;
  if (x <= 0.012) return lo * Math.pow(g / lo, x / 0.012);
  if (x <= dur) return g * Math.pow(lo / g, (x - 0.012) / (dur - 0.012));
  return lo;
}

/** A cue's samples, mixed. */
function render(tones) {
  const end = Math.max(...tones.map((t) => t.t + t.dur + t.tail));
  const len = Math.ceil(end * RATE);
  const out = new Float64Array(len);
  for (const t of tones) {
    const w = wave(t.type, t.f);
    const from = Math.round(t.t * RATE);
    const to = Math.min(len, Math.ceil((t.t + t.dur + t.tail) * RATE));
    for (let i = from; i < to; i++) {
      const x = (i - from) / RATE;
      out[i] += w(2 * Math.PI * t.f * x) * gain(x, t.dur, t.g);
    }
  }
  return out;
}

/** 16-bit mono PCM WAV bytes. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2),
  );
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Every cue's WAV bytes, by file name. */
function renderAll() {
  const files = {};
  for (const [name, tones] of Object.entries(CUES)) files[`${name}.wav`] = wav(render(tones));
  return files;
}

module.exports = { CUES, JINGLE, RATE, renderAll };

if (require.main === module) {
  const files = renderAll();
  if (process.argv.includes('--check')) {
    const bad = Object.keys(files).filter((f) => {
      const p = path.join(OUT, f);
      return !fs.existsSync(p) || !fs.readFileSync(p).equals(files[f]);
    });
    if (bad.length) {
      console.error(`Differ from what make-sounds renders: ${bad.join(', ')}`);
      process.exit(1);
    }
    console.log(`${Object.keys(files).length} sounds match.`);
  } else {
    fs.mkdirSync(OUT, { recursive: true });
    for (const [f, b] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), b);
    const kb = Object.values(files).reduce((s, b) => s + b.length, 0) / 1024;
    console.log(
      `Wrote ${Object.keys(files).length} sounds (${kb.toFixed(0)} KB) to assets/sounds.`,
    );
  }
}
