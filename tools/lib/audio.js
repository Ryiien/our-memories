// -----------------------------------------------------------------------------
// Tiny synthesised placeholder audio, written as 16-bit mono WAV files.
// Both loops are built so the end flows straight back into the start.
// -----------------------------------------------------------------------------
import { rng } from './canvas.js';

const RATE = 22050;

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Soft ocean waves: filtered noise with slow swells. 12 second loop. */
export function waves() {
  const seconds = 12;
  const n = RATE * seconds;
  const r = rng(5);
  const out = new Float32Array(n);
  let lp1 = 0;
  let lp2 = 0;
  // Two passes so the filters are "warmed up" and the loop point is seamless.
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < n; i++) {
      const white = r() * 2 - 1;
      lp1 += (white - lp1) * 0.08;
      lp2 += (lp1 - lp2) * 0.05;
      const t = i / RATE;
      // two overlapping swells per loop, never fully silent
      const swell = 0.35 + 0.65 * Math.pow(Math.sin((Math.PI * t) / 6) ** 2, 1.5);
      const hiss = (white - lp1) * 0.04 * swell * swell;
      if (pass === 1) out[i] = (lp2 * 2.2 + hiss) * swell * 0.9;
    }
  // crossfade the last 0.3s into the first 0.3s
  const fade = Math.floor(RATE * 0.3);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[i] = out[i] * k + out[n - fade + i] * (1 - k);
  }
  return toWav(Array.from(out.subarray(0, n - fade)));
}

/** A gentle music-box lullaby. 16 beats at 80 bpm, ~12 seconds. */
export function musicBox() {
  const bpm = 80;
  const beat = 60 / bpm;
  const beats = 16;
  const n = Math.floor(RATE * beat * beats);
  const out = new Float32Array(n);
  const note = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);
  // C major: C5 E5 G5 A5 G5 E5 D5 ... (semitones from A4)
  const melody = [3, 7, 10, 12, 10, 7, 5, 7, 3, 7, 10, 15, 14, 10, 12, -2];
  const bass = [-21, -21, -21, -21, -16, -16, -16, -16, -14, -14, -14, -14, -19, -19, -16, -16];
  const pluck = (start, freq, vol, decay) => {
    for (let i = 0; i < RATE * 3; i++) {
      const t = i / RATE;
      const env = Math.exp(-t * decay) * Math.min(1, t * 400);
      const s = (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t)) * env * vol;
      out[(start + i) % n] += s; // wrap tails around so the loop is seamless
    }
  };
  melody.forEach((m, i) => pluck(Math.floor(i * beat * RATE), note(m), 0.22, 2.2));
  bass.forEach((b, i) => i % 2 === 0 && pluck(Math.floor(i * beat * RATE), note(b), 0.16, 1.4));
  return toWav(Array.from(out));
}

// ---- Sound effects (short one-shots for data/sounds.json) ---------------------------------

const note = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);

/** A soft bell: a sine with a quieter, slightly inharmonic overtone. */
function bell(out, start, freq, vol, decay) {
  for (let i = 0; start + i < out.length; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * decay) * Math.min(1, t * 600);
    out[start + i] += (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(2 * Math.PI * freq * 2.76 * t)) * env * vol;
  }
}

/** Quick fade at the very end so nothing clicks. */
function finish(out) {
  const tail = Math.floor(RATE * 0.02);
  for (let i = 0; i < tail; i++) out[out.length - 1 - i] *= i / tail;
  return toWav(Array.from(out));
}

/** Collecting a momo: a bubbly little two-note "bloop", upwards. */
export function sfxMomo() {
  const out = new Float32Array(Math.floor(RATE * 0.35));
  for (const [at, semis] of [[0, 19], [0.07, 26]]) {
    const start = Math.floor(at * RATE);
    for (let i = 0; start + i < out.length; i++) {
      const t = i / RATE;
      const f = note(semis) * (1 + 0.25 * Math.exp(-t * 40)); // a tiny pitch drop = "bloop"
      out[start + i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 14) * Math.min(1, t * 800) * 0.35;
    }
  }
  return finish(out);
}

/** "Memory found!": a three-note music-box chime, C E G. */
export function sfxFound() {
  const out = new Float32Array(Math.floor(RATE * 1.4));
  [[0, 15], [0.12, 19], [0.24, 22], [0.36, 27]].forEach(([at, semis], i) =>
    bell(out, Math.floor(at * RATE), note(semis), i === 3 ? 0.22 : 0.26, 4)
  );
  return finish(out);
}

/** Casting: a soft swish of air (noise that rises and falls). */
export function sfxCast() {
  const n = Math.floor(RATE * 0.45);
  const out = new Float32Array(n);
  const r = rng(3);
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const white = r() * 2 - 1;
    const cutoff = 0.04 + 0.25 * Math.sin(Math.PI * t); // brighter in the middle of the swing
    lp += (white - lp) * cutoff;
    lp2 += (lp - lp2) * cutoff;
    out[i] = (lp - lp2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.3)), 2) * 1.6;
  }
  return finish(out);
}

/** The bobber landing: a low "plop" with a little spray of water. */
export function sfxSplash() {
  const n = Math.floor(RATE * 0.5);
  const out = new Float32Array(n);
  const r = rng(9);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = 140 + 360 * Math.exp(-t * 30); // the plop's pitch falls fast
    out[i] += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 18) * 0.45;
    lp += (r() * 2 - 1 - lp) * 0.3;
    out[i] += lp * Math.exp(-t * 9) * Math.min(1, t * 200) * 0.5; // spray
  }
  return finish(out);
}

/** A love letter: a quick sparkly run up the scale, with a shimmer on top. */
export function sfxLetter() {
  const out = new Float32Array(Math.floor(RATE * 1.3));
  [15, 19, 22, 27, 31].forEach((semis, i) => bell(out, Math.floor(i * 0.07 * RATE), note(semis), 0.18, 5));
  for (let i = 0; i < 6; i++) bell(out, Math.floor((0.35 + i * 0.05) * RATE), note(34 + (i % 3) * 3), 0.06, 9); // twinkles
  return finish(out);
}

/** Continue: a soft, short wooden "tock". */
export function sfxContinue() {
  const out = new Float32Array(Math.floor(RATE * 0.18));
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const f = 660 * (1 + 0.5 * Math.exp(-t * 80));
    out[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.5 * t)) * Math.exp(-t * 35) * Math.min(1, t * 1500) * 0.3;
  }
  return finish(out);
}
