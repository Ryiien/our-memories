#!/usr/bin/env node
// -----------------------------------------------------------------------------
// pixelate-photo.js — turn a real photo into a 320x180 pixel-art PNG.
//
//   npm run pixelate -- <photo> [output.png] [options]
//
// Steps: auto-rotate (phone EXIF) -> crop to 16:9 -> shrink to 320x180 with
// nearest-neighbour -> reduce to a small palette (median cut, default 24
// colours) or snap to a fixed palette file.
//
// Options:
//   --colors N        number of colours to keep (default 24)
//   --palette FILE    use a fixed palette instead: .hex (one RRGGBB per line,
//                     like tools/palettes/cosy.hex or Lospec downloads), .gpl
//                     (GIMP), .json (["#rrggbb", ...]) or .png (its colours)
//   --crop WHERE      which part of the photo to keep when cropping to 16:9:
//                     centre (default), top, bottom, left, right,
//                     attention (auto: busiest/most interesting area)
//   --resample HOW    nearest (default, crunchy) or smooth (averages pixels
//                     first: softer and less noisy — try it on busy photos)
//   --dither HOW      none (default), ordered (classic pixel-art checker
//                     pattern) or floyd (error diffusion, more photographic)
//   --width W --height H   output size (default 320x180)
//
// Examples:
//   npm run pixelate -- ~/Photos/beach.jpg public/assets/memories/apollo-bay/sky.png
//   npm run pixelate -- cafe.jpg out.png --colors 16 --dither ordered
//   npm run pixelate -- park.jpg out.png --palette tools/palettes/cosy.hex --crop top
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

// ---- arguments -----------------------------------------------------------------
const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    colors: { type: 'string', default: '24' },
    palette: { type: 'string' },
    crop: { type: 'string', default: 'centre' },
    resample: { type: 'string', default: 'nearest' },
    dither: { type: 'string', default: 'none' },
    width: { type: 'string', default: '320' },
    height: { type: 'string', default: '180' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (opt.help || positionals.length === 0) {
  const header = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 32);
  console.log(header.map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(positionals.length === 0 && !opt.help ? 1 : 0);
}

const input = positionals[0];
const output = positionals[1] ?? input.replace(/\.[^.]+$/, '') + '-pixel.png';
const W = parseInt(opt.width, 10);
const H = parseInt(opt.height, 10);
const COLORS = Math.max(2, Math.min(256, parseInt(opt.colors, 10) || 24));

if (!fs.existsSync(input)) fail(`Can't find "${input}".`);
if (/\.(heic|heif)$/i.test(input)) {
  fail('HEIC photos (iPhone) aren\'t supported. Export the photo as JPEG first ' +
    '(e.g. share it to yourself, or on iPhone: Settings > Camera > Formats > Most Compatible).');
}

function fail(message) {
  console.error(`pixelate-photo: ${message}`);
  process.exit(1);
}

// ---- colour helpers ----------------------------------------------------------------
// Distances are measured in CIE Lab, which matches how different colours look
// to our eyes much better than raw RGB does.
function toLab([r, g, b]) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function nearest(lab, paletteLab) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < paletteLab.length; i++) {
    const p = paletteLab[i];
    const d = (lab[0] - p[0]) ** 2 + (lab[1] - p[1]) ** 2 + (lab[2] - p[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

// ---- palettes --------------------------------------------------------------------------
async function loadPalette(file) {
  if (!fs.existsSync(file)) fail(`Can't find palette "${file}".`);
  const ext = path.extname(file).toLowerCase();
  const parseHex = (s) => {
    const m = s.trim().replace(/^#/, '').match(/^([0-9a-f]{6})/i);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  let colors = [];
  if (ext === '.png') {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const seen = new Set();
    for (let i = 0; i < info.width * info.height; i++) {
      if (data[i * 4 + 3] < 128) continue;
      const key = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
      if (!seen.has(key)) {
        seen.add(key);
        colors.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
      }
    }
  } else if (ext === '.json') {
    colors = JSON.parse(fs.readFileSync(file, 'utf8')).map(parseHex);
  } else if (ext === '.gpl') {
    colors = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)/))
      .filter(Boolean)
      .map((m) => [+m[1], +m[2], +m[3]]);
  } else {
    colors = fs.readFileSync(file, 'utf8').split('\n').map(parseHex);
  }
  colors = colors.filter(Boolean);
  if (colors.length < 2) fail(`Palette "${file}" needs at least 2 colours.`);
  return colors;
}

/** Median cut, then a few k-means passes to settle the colours. */
function buildPalette(pixels, count) {
  let boxes = [pixels];
  while (boxes.length < count) {
    // split the box with the widest colour range
    let bestIndex = -1;
    let bestRange = 0;
    let bestChannel = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let min = 255;
        let max = 0;
        for (const p of box) {
          if (p[c] < min) min = p[c];
          if (p[c] > max) max = p[c];
        }
        const score = (max - min) * Math.sqrt(box.length);
        if (score > bestRange) {
          bestRange = score;
          bestIndex = i;
          bestChannel = c;
        }
      }
    });
    if (bestIndex < 0) break;
    const box = boxes[bestIndex].sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = box.length >> 1;
    boxes.splice(bestIndex, 1, box.slice(0, mid), box.slice(mid));
  }
  let palette = boxes.map((box) => {
    const sum = [0, 0, 0];
    for (const p of box) for (let c = 0; c < 3; c++) sum[c] += p[c];
    return sum.map((s) => Math.round(s / box.length));
  });

  // k-means refinement
  const labs = pixels.map(toLab);
  for (let iter = 0; iter < 4; iter++) {
    const paletteLab = palette.map(toLab);
    const sums = palette.map(() => [0, 0, 0, 0]);
    labs.forEach((lab, i) => {
      const k = nearest(lab, paletteLab);
      const s = sums[k];
      s[0] += pixels[i][0];
      s[1] += pixels[i][1];
      s[2] += pixels[i][2];
      s[3]++;
    });
    palette = sums.map((s, k) => (s[3] ? [s[0], s[1], s[2]].map((v) => Math.round(v / s[3])) : palette[k]));
  }
  return palette;
}

// ---- main ----------------------------------------------------------------------------
const POSITIONS = {
  centre: 'centre', center: 'centre', top: 'top', bottom: 'bottom', left: 'left', right: 'right',
  attention: sharp.strategy.attention, entropy: sharp.strategy.entropy,
};
const position = POSITIONS[opt.crop];
if (!position) fail(`--crop must be one of: ${Object.keys(POSITIONS).join(', ')}`);
if (!['nearest', 'smooth'].includes(opt.resample)) fail('--resample must be "nearest" or "smooth"');
if (!['none', 'ordered', 'floyd'].includes(opt.dither)) fail('--dither must be "none", "ordered" or "floyd"');

let image;
try {
  image = sharp(input).rotate(); // .rotate() with no angle = obey the phone's EXIF orientation
  await image.metadata();
} catch (err) {
  fail(`Couldn't read "${input}" as an image (${err.message}).`);
}

// 1+2. Crop to the target aspect ratio, then shrink.
const { data, info } = await image
  .resize(W, H, {
    fit: 'cover',
    position,
    kernel: opt.resample === 'nearest' ? sharp.kernel.nearest : sharp.kernel.lanczos3,
  })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixels = [];
for (let i = 0; i < info.width * info.height; i++) pixels.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]);

// 3. Pick the palette.
const palette = opt.palette ? await loadPalette(opt.palette) : buildPalette(pixels.slice(), COLORS);
const paletteLab = palette.map(toLab);

// 4. Map every pixel to the palette (optionally dithered).
const out = Buffer.alloc(info.width * info.height * 3);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const work = pixels.map((p) => p.slice()); // for Floyd–Steinberg error diffusion
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++) {
    const i = y * info.width + x;
    let src = work[i];
    if (opt.dither === 'ordered') {
      const t = BAYER[(y % 4) * 4 + (x % 4)] * 40;
      src = src.map((v) => Math.max(0, Math.min(255, v + t)));
    }
    const k = nearest(toLab(src), paletteLab);
    const c = palette[k];
    out[i * 3] = c[0];
    out[i * 3 + 1] = c[1];
    out[i * 3 + 2] = c[2];
    if (opt.dither === 'floyd') {
      const err = [0, 1, 2].map((ch) => work[i][ch] - c[ch]);
      const push = (dx, dy, f) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= info.width || ny >= info.height) return;
        const n = work[ny * info.width + nx];
        for (let ch = 0; ch < 3; ch++) n[ch] = Math.max(0, Math.min(255, n[ch] + err[ch] * f));
      };
      push(1, 0, 7 / 16);
      push(-1, 1, 3 / 16);
      push(0, 1, 5 / 16);
      push(1, 1, 1 / 16);
    }
  }

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toFile(output);

const used = new Set();
for (let i = 0; i < out.length; i += 3) used.add(hex([out[i], out[i + 1], out[i + 2]]));
console.log(`Saved ${output} (${info.width}x${info.height}, ${used.size} colours).`);
