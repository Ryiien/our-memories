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
