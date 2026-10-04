// -----------------------------------------------------------------------------
// A tiny pixel-drawing library for the placeholder generator.
// Everything works on whole pixels; colours are '#rrggbb' strings.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

// 4x4 Bayer matrix (values 0..1) for ordered dithering — the classic
// "checkerboard-ish" pixel-art gradient look.
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

export function bayer(x, y) {
  return BAYER4[((y % 4) + 4) % 4][((x % 4) + 4) % 4];
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Small, fast, seeded random number generator so placeholders are repeatable. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (min, max) => min + next() * (max - min);
  next.int = (min, max) => Math.floor(min + next() * (max - min + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4); // fully transparent
  }

  /** Set one pixel, alpha-blending over what's already there. */
  px(x, y, color, alpha = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || alpha <= 0) return;
    const [r, g, b] = typeof color === 'string' ? hexToRgb(color) : color;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    const srcA = Math.min(1, alpha);
    const dstA = d[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;
    d[i] = (r * srcA + d[i] * dstA * (1 - srcA)) / outA;
    d[i + 1] = (g * srcA + d[i + 1] * dstA * (1 - srcA)) / outA;
    d[i + 2] = (b * srcA + d[i + 2] * dstA * (1 - srcA)) / outA;
    d[i + 3] = outA * 255;
  }

  /** Read a pixel as [r, g, b, a]. */
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return [0, 0, 0, 0];
    const i = (y * this.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  /** Make a pixel fully transparent again. */
  clear(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = this.data[i + 1] = this.data[i + 2] = this.data[i + 3] = 0;
  }

  rect(x, y, w, h, color, alpha = 1) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, color, alpha);
  }

  /** Rectangle filled with a 50% checker of two colours (cheap texture). */
  checker(x, y, w, h, colorA, colorB) {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, (xx + yy) % 2 ? colorA : colorB);
  }

  /** Filled circle that looks nice and round at small pixel sizes. */
  circle(cx, cy, r, color, alpha = 1) {
    const rr = r * r + r * 0.6;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= rr) this.px(x, y, color, alpha);
      }
  }

  ellipse(cx, cy, rx, ry, color, alpha = 1) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.3);
        const dy = (y - cy) / (ry + 0.3);
        if (dx * dx + dy * dy <= 1) this.px(x, y, color, alpha);
      }
  }

  /** Soft glow: concentric dithered rings fading out. */
  glow(cx, cy, r, color, maxAlpha = 0.35) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d > 1) continue;
        // Quantise to 3 bands for a pixel-art look rather than a smooth blur.
        const band = Math.ceil((1 - d) * 3) / 3;
        this.px(x, y, color, maxAlpha * band * band);
      }
  }

  line(x0, y0, x1, y1, color, alpha = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, color, alpha);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /**
   * Vertical gradient through a list of colours, using ordered dithering
   * between neighbouring colours (no new colours are invented).
   */
  gradientV(x, y, w, h, colors) {
    const steps = colors.length - 1;
    for (let yy = 0; yy < h; yy++) {
      const t = (yy / Math.max(1, h - 1)) * steps;
      const i = Math.min(steps - 1, Math.floor(t));
      const f = t - i;
      for (let xx = 0; xx < w; xx++) {
        const c = f > bayer(x + xx, y + yy) ? colors[i + 1] : colors[i];
        this.px(x + xx, y + yy, c);
      }
    }
  }

  /**
   * Draw a pixel map: an array of equal-length strings where each character is
   * looked up in `palette` ('.' or ' ' = transparent).
   */
  map(rows, palette, ox = 0, oy = 0, { flipX = false } = {}) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = flipX ? row[row.length - 1 - x] : row[x];
        if (ch === '.' || ch === ' ') continue;
        const color = palette[ch];
        if (!color) throw new Error(`No palette colour for "${ch}"`);
        this.px(ox + x, oy + y, color);
      }
    });
  }

  /** Copy another canvas onto this one (alpha-blended). */
  blit(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.height; y++)
      for (let x = 0; x < src.width; x++) {
        const [r, g, b, a] = src.get(x, y);
        if (a) this.px(ox + x, oy + y, [r, g, b], a / 255);
      }
  }

  /** Add a 1px dark outline around every opaque shape (nice for sprites). */
  outline(color) {
    const copy = new Uint8ClampedArray(this.data);
    const alphaAt = (x, y) =>
      x < 0 || y < 0 || x >= this.width || y >= this.height ? 0 : copy[(y * this.width + x) * 4 + 3];
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        if (alphaAt(x, y)) continue;
        if (alphaAt(x - 1, y) > 128 || alphaAt(x + 1, y) > 128 || alphaAt(x, y - 1) > 128 || alphaAt(x, y + 1) > 128)
          this.px(x, y, color);
      }
  }

  toPNG() {
    const png = new PNG({ width: this.width, height: this.height });
    png.data = Buffer.from(this.data);
    return PNG.sync.write(png);
  }
}

// -----------------------------------------------------------------------------
// Writing files safely: placeholders never overwrite existing files unless
// --force was passed, so your real art can't be clobbered by accident.
// -----------------------------------------------------------------------------
export const writeStats = { written: 0, skipped: 0 };

export function makeWriter({ force }) {
  return function write(file, contents) {
    if (!force && fs.existsSync(file)) {
      writeStats.skipped++;
      return false;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents instanceof Canvas ? contents.toPNG() : contents);
    writeStats.written++;
    return true;
  };
}
