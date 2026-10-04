// -----------------------------------------------------------------------------
// Shared bits for the hand-drawn memory scripts in tools/scenes/:
// saving layers (with --keep), drawing helpers, two pixel fonts for signs,
// previews, and adding a building tileset to maps/world.json.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { Canvas, bayer } from './canvas.js';
import { GLYPHS } from './font.js';

const PI = Math.PI;

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Reads `--keep a,b` from the command line and returns save(file, canvas),
 * which writes a PNG unless its name is in the keep list and it already exists.
 */
export function makeSaver() {
  const { values: args } = parseArgs({ options: { keep: { type: 'string', default: '' } } });
  const keep = new Set(args.keep.split(',').map((s) => s.trim().replace(/\.png$/, '')).filter(Boolean));
  return function save(file, canvas) {
    const name = path.basename(file, '.png');
    if (keep.has(name) && fs.existsSync(file)) {
      console.log(`  kept     ${path.relative(ROOT, file)}`);
      return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, canvas.toPNG());
    console.log(`  wrote    ${path.relative(ROOT, file)}`);
  };
}

// ---- Drawing helpers ------------------------------------------------------------

/** 1px ellipse outline. */
export function ring(c, cx, cy, rx, ry, color, alpha = 1) {
  const steps = Math.ceil(Math.max(rx, ry) * 8);
  const done = new Set();
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * PI * 2;
    const x = Math.round(cx + Math.cos(a) * rx);
    const y = Math.round(cy + Math.sin(a) * ry);
    if (done.has(x * 1000 + y)) continue;
    done.add(x * 1000 + y);
    c.px(x, y, color, alpha);
  }
}

/** A line drawn with a square brush `size` pixels wide (arms, poles). */
export function thickLine(c, x0, y0, x1, y1, size, color) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    c.rect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), size, size, color);
  }
}

/** Light from above: brighten every pixel whose top neighbour is empty. */
export function rimLight(c, color, amount) {
  const copy = new Canvas(c.width, c.height);
  copy.data.set(c.data);
  for (let y = 1; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      if (!copy.get(x, y)[3] || copy.get(x, y - 1)[3]) continue;
      c.px(x, y, color, amount);
    }
}

/** Soft light in dithered bands (pixel-art "glow"), clipped to an ellipse. */
export function softEllipse(c, cx, cy, rx, ry, color, alpha) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d > 1) continue;
      const level = (1 - d) * 3;
      const band = Math.floor(level) + (level % 1 > bayer(x, y) ? 1 : 0);
      if (band > 0) c.px(x, y, color, (alpha * band) / 3);
    }
}

/** Text in the game's pixel font (capitals 7px tall). Returns the width drawn. */
export function text(c, str, x, y, color) {
  let cx = x;
  for (const ch of str) {
    const g = GLYPHS[ch] ?? GLYPHS['?'];
    g.forEach((row, ry) => [...row].forEach((p, rx) => p === '#' && c.px(cx + rx, y + ry, color)));
    cx += ch === ' ' ? 3 : g[0].length + 1;
  }
  return cx - x - 1;
}
export const textWidth = (str) => {
  let w = 0;
  for (const ch of str) w += ch === ' ' ? 3 : (GLYPHS[ch] ?? GLYPHS['?'])[0].length + 1;
  return w - 1;
};

// A tiny 3x5 capitals font for signs that have to fit on a building.
const MINI = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
};

/** Text in the tiny 3x5 sign font. Returns the width drawn. */
export function miniText(c, str, x, y, color, alpha = 1) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    if (ch === ' ') {
      cx += 2;
      continue;
    }
    const g = MINI[ch];
    if (!g) throw new Error(`miniText has no glyph for "${ch}"`);
    g.forEach((row, ry) => [...row].forEach((p, rx) => p === '#' && c.px(cx + rx, y + ry, color, alpha)));
    cx += g[0].length + 1;
  }
  return cx - x - 1;
}
export const miniWidth = (str) => {
  let w = 0;
  for (const ch of str.toUpperCase()) w += ch === ' ' ? 2 : MINI[ch][0].length + 1;
  return w - 1;
};

// ---- Previews ---------------------------------------------------------------------

/** Nearest-neighbour upscale (for the preview PNGs). */
export function upscale(src, k) {
  const out = new Canvas(src.width * k, src.height * k);
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const i = (Math.floor(y / k) * src.width + Math.floor(x / k)) * 4;
      out.data.set(src.data.subarray(i, i + 4), (y * out.width + x) * 4);
    }
  return out;
}

/** Writes tools/previews/<name>.png at 3x size. */
export function writePreview(name, canvas) {
  const dir = path.join(ROOT, 'tools', 'previews');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), upscale(canvas, 3).toPNG());
}

// ---- The map ------------------------------------------------------------------------

/**
 * Adds an image as its own embedded tileset (every tile solid) and stamps the
 * whole picture into the Decor layer with its top-left tile at (at.x, at.y).
 * Returns the tileset's first gid.
 */
export function stampBuilding(map, { name, image, cols, rows, at }) {
  const firstgid = Math.max(...map.tilesets.map((t) => t.firstgid + t.tilecount));
  const tilecount = cols * rows;
  map.tilesets.push({
    firstgid,
    name,
    image,
    imagewidth: cols * 16,
    imageheight: rows * 16,
    tilewidth: 16,
    tileheight: 16,
    columns: cols,
    tilecount,
    margin: 0,
    spacing: 0,
    tiles: Array.from({ length: tilecount }, (_, id) => ({ id, properties: [{ name: 'collides', type: 'bool', value: true }] })),
  });
  const decor = map.layers.find((l) => l.name === 'Decor');
  for (let ty = 0; ty < rows; ty++)
    for (let tx = 0; tx < cols; tx++) decor.data[(at.y + ty) * map.width + at.x + tx] = firstgid + ty * cols + tx;
  return firstgid;
}
