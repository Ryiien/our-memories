#!/usr/bin/env node
// -----------------------------------------------------------------------------
// secret-grove.js — turns the top-right corner of the map into a little secret
// garden for the hidden first-date bench (replacing the old solid block of
// trees). A winding trail of stepping stones leaves the main path, curls up
// through blossom trees and bushes, and slips between
// two trees into a hedged nook: a round flagstone patio with a heart set into
// it, a bench, a lamp and a pot of flowers. Just below the nook a branch of
// stones splits off west to the All Nations hilltop bench. Down where the stones meet the main
// path stands the bus stop from the first-date scene (simplified: no route
// numbers), and the main path is carried on to the map's east edge.
//
//   npm run scene:grove         # redraws the ground + bus stop and puts it all on the map (first time only)
//
// The trees, bushes, bench, lamp and flower pot are the usual cosy tiles; only
// the ground (grass + stepping stones + patio) is drawn here, as its own tileset that
// replaces the Ground tiles in REGION. Everything on it is walkable — the trees
// and bushes are what steer her along the trail.
//
// Tweak colours in PAL / the layout below and re-run (after restoring the map,
// or on a fresh `npm run placeholders -- --force`). Outputs:
//   public/assets/tiles/grove.png          the ground (16 x 20 tiles, x 44–59)
//   public/assets/tiles/bus-stop.png       the bus stop (4 x 3 tiles)
//   tools/previews/secret-grove-map.png    the whole corner as it looks in game (3x size)
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { Canvas, rng } from '../lib/canvas.js';
import { ROOT, makeSaver, writePreview, addTileset } from '../lib/scene-kit.js';
import { T as COSY } from '../lib/tileset.js';
import { P } from '../lib/palette.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // stepping stones and the patio
  stone: P.stone,
  stoneHi: P.cream,
  stoneWarm: P.creamShade, // some patio stones are a warmer cream
  stoneShade: P.stoneShade,
  stoneDark: P.stoneDark,
  grout: '#5f8a52', // moss between the flagstones
  heart: P.rose,
  heartShade: P.roseDark,
  heartHi: P.herDressHi,
  // grass bits
  tuft: P.grassDark,
  tuftHi: P.grassMid,
  petals: [P.rose, P.herDressHi, P.cream],
  flowers: [P.rose, P.cream, P.butter, P.lavender],
  // the bus stop from the first-date scene, in daytime colours: silver frame,
  // glass with a yellow strip, orange roof edge, a bench inside, and the PT sign
  frame: '#b8bccb',
  frameHi: '#e2e5ee',
  frameDark: '#6b7084',
  roof: '#7d8296',
  roofHi: '#a3a8ba',
  roofEdge: '#e07a3e',
  roofEdgeShade: '#b85a2a',
  glass: '#bfe3f2',
  glassGlint: '#ffffff',
  stripe: '#e8c84c',
  seat: '#a9aebd',
  seatShade: '#7d8296',
  pad: '#d9d2c4', // the concrete pad she stands on to wait
  padShade: '#b9b0a0',
  padSeam: '#c6bdae',
  shadow: '#4f8a50',
  signFace: '#d5d9e3',
  ptRed: '#d9452b',
  signOrange: '#e07a3e',
  signNavy: '#2c3656',
  signPanel: '#46506a', // the route panel, left blank
  pole: '#a3a9b8',
  poleShade: '#6b7084',
};

// ---- Layout (map tiles) ------------------------------------------------------------
const REGION = { x: 44, y: 0, w: 16, h: 20 }; // the ground this script repaints (grass + stones + patio)
const CLEAR = { x: 50, y: 0, w: 10, h: 20 }; // the old grove, cleared of its trees and blockers first

// The trail of stepping stones from the main path (bottom) up to the nook: a
// smooth curve through these points, with a stone every STONE_GAP (0..1 of
// the way along), nudged left and right of the line in turn.
const TRAIL = [
  [55.8, 21.5], [55.9, 18.2], [52.4, 15.3], [52.9, 12.6], [56.6, 10.6],
  [56.6, 8.4], [54.1, 6.9], [54.6, 4.9], [56.8, 3.6],
];
const STONE_GAP = 0.034;
// A branch of stones off the trail, just below the nook, west to the All Nations
// hilltop bench (its gravel pad is at x 45–48, y 1–2). Its first stones are
// skipped so it doesn't double up where it leaves the trail.
const BRANCH = [[54.3, 7.0], [52.3, 6.9], [50.2, 6.3], [48.7, 5.0], [47.0, 3.2]];
const BRANCH_GAP = 0.085;
const BRANCH_FROM = 0.1;

const PATIO = { cx: 56.9, cy: 3.0, rx: 2.3, ry: 1.65 }; // the round flagstone patio (centre + radii in tiles)
const HEART = { cx: 56.95, cy: 3.15 }; // the little heart set into it

// Cosy trees: top-left tile of each 2x3 tree (canopy 2x2 in Above, trunk row in Decor).
const TREES = [
  [50, 0], // the corner behind the nook
  [52, 3], // left of the nook's mouth
  [58, 5], // right of the nook's mouth — the two of them frame the way in
  [51, 8], // inside the upper bend
  [55, 12], // inside the lower bend
  [58, 14], // the far edge
];
// Cosy bushes (the round HEDGE tile), one per tile.
const BUSHES = [
  // the hedge wrapped around the nook
  [52, 0], [53, 0], [54, 0], [55, 0], [56, 0], [57, 0], [59, 0],
  [53, 1], [53, 2], [53, 3], [53, 4], [59, 1], [59, 2], [59, 3],
  [56, 5], [57, 5],
  // clumps along the outside of the bends
  [58, 9], [59, 9], [59, 10], [53, 10],
  [50, 13], [50, 14],
  [57, 17], [58, 18],
];
const BENCH = { x: 56, y: 1 }; // two tiles wide, facing down the map
const LAMP = { x: 55, y: 1 }; // post here, lantern on the tile above
const POT = { x: 58, y: 1 }; // a pot of flowers the other side of the bench
const TRIGGER = { name: 'secret bench', memoryId: 'first-date', x: 56, y: 2, w: 2, h: 2 };

// The bus stop (like the one in the first-date scene, without the route numbers),
// on the main path just left of where the stepping stones start: the PT sign in
// the first column, the shelter in the other three. Its own tileset: the top
// ABOVE_ROWS rows (roof, glass, bench, sign) go in the Above layer and are
// walkable, so she can walk behind the shelter — they're marked noFade, so
// instead of the whole thing fading she shows through the glass and the roof
// still hides her. The bottom row (pad, posts, the base of the glass) is solid, in Decor.
const BUS_STOP = { x: 50, y: 17, cols: 4, rows: 3, aboveRows: 2 };
// The main path stopped two tiles short of the map's east edge; run it all the way.
const MAIN_PATH = { fromX: 58, toX: 59, y: 20, rows: 2 };

// ---- Setup ------------------------------------------------------------------------
const TS = 16;
const W = REGION.w * TS;
const H = REGION.h * TS;
const save = makeSaver();
const MAP_FILE = path.join(ROOT, 'maps', 'world.json');
const TILES_DIR = path.join(ROOT, 'public', 'assets', 'tiles');

// region-local pixel coordinates of a map tile position
const px = (tx) => (tx - REGION.x) * TS;
const py = (ty) => (ty - REGION.y) * TS;

/** Deterministic 0..1 noise per pixel (so re-runs draw the same picture). */
function hash(x, y, seed = 0) {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 1442695041, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function loadPNG(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const c = new Canvas(png.width, png.height);
  c.data.set(png.data);
  return c;
}

/** Copies one 16x16 tile of a tileset canvas onto c at (x, y). */
function drawTile(c, sheet, cols, id, x, y) {
  const sx = (id % cols) * TS;
  const sy = Math.floor(id / cols) * TS;
  for (let yy = 0; yy < TS; yy++)
    for (let xx = 0; xx < TS; xx++) {
      const [r, g, b, a] = sheet.get(sx + xx, sy + yy);
      if (a) c.px(x + xx, y + yy, [r, g, b], a / 255);
    }
}

/** Points along a smooth (Catmull-Rom) curve through `pts`, each with t = 0..1 along it. */
function smoothCurve(pts, perSegment = 40) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < perSegment; s++) {
      const u = s / perSegment;
      const u2 = u * u;
      const u3 = u2 * u;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  out.push({ x: pts.at(-1)[0], y: pts.at(-1)[1] });
  // measure along the curve so t is even in distance, not in points
  let len = 0;
  out[0].d = 0;
  for (let i = 1; i < out.length; i++) out[i].d = len += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
  for (const p of out) p.t = p.d / len;
  return out;
}

// ---- The ground: grass + stepping stones + patio ------------------------------------------------
function drawGround(map) {
  const c = new Canvas(W, H);
  const r = rng(1910);

  // 1. Start from the grass already on the map, so the edges join up seamlessly.
  const cosy = loadPNG(path.join(TILES_DIR, 'tileset.png'));
  const cosyCols = cosy.width / TS;
  const ground = map.layers.find((l) => l.name === 'Ground').data;
  for (let ty = 0; ty < REGION.h; ty++)
    for (let tx = 0; tx < REGION.w; tx++) {
      const gid = ground[(REGION.y + ty) * map.width + REGION.x + tx];
      drawTile(c, cosy, cosyCols, gid > 0 && gid <= cosyCols * (cosy.height / TS) ? gid - 1 : COSY.GRASS, tx * TS, ty * TS);
    }

  // 2. Stepping stones along the trail (from the main path up to the patio),
  // and along the branch to the hilltop bench.
  const toPixels = (pts) => smoothCurve(pts.map(([x, y]) => [px(x) + TS / 2, py(y) + TS / 2]));
  const line = toPixels(TRAIL);
  const branch = toPixels(BRANCH);
  const distToLine = (x, y) => Math.min(...[...line, ...branch].map((p) => Math.hypot(p.x - x, p.y - y)));
  placeStones(c, line, 0, STONE_GAP);
  placeStones(c, branch, BRANCH_FROM, BRANCH_GAP);

  // 3. The patio and the heart.
  drawPatio(c);

  // 4. Flowers either side of the stones and petals fallen from the blossom trees.
  const flowerAround = (pts, count) => {
    for (let i = 0; i < count; i++) {
      const p = pts[r.int(0, pts.length - 1)];
      const a = r() * Math.PI * 2;
      const dist = r.range(13, 24);
      const x = Math.round(p.x + Math.cos(a) * dist);
      const y = Math.round(p.y + Math.sin(a) * dist);
      if (x < 2 || y < 2 || x > W - 3 || y > H - 6 || distToLine(x, y) < 12) continue;
      if (insidePatio(x, y, 0.3) || underBusStop(x, y) || onHilltop(x, y)) continue;
      flower(c, x, y, r.pick(PAL.flowers));
    }
  };
  flowerAround(line, 70);
  flowerAround(branch, 22);
  for (const [tx, ty] of TREES)
    for (let i = 0; i < 14; i++) {
      const x = Math.round(px(tx) + 16 + r.range(-22, 22));
      const y = Math.round(py(ty) + 40 + r.range(-10, 14));
      if (insidePatio(x, y, -0.1) || underBusStop(x, y)) continue;
      c.px(x, y, r.pick(PAL.petals));
    }
  return c;
}

/**
 * Stepping stones along a curve, one every `gap` (0..1 of the way along) from
 * `from` on, each nudged a little to one side of the line, alternating. Stops
 * at the patio, and skips the bit of the curve that's off the bottom (the main path).
 */
function placeStones(c, pts, from, gap) {
  let next = from;
  let side = 1;
  pts.forEach((p, i) => {
    if (p.t < next || p.y > H - 8 || insidePatio(p.x, p.y, 0.15)) return;
    const q = pts[Math.min(pts.length - 1, i + 1)];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    steppingStone(c, Math.round(p.x - (dy / len) * 3 * side), Math.round(p.y + (dx / len) * 3 * side), side > 0 ? 6 : 5, 4);
    side = -side;
    next = p.t + gap;
  });
}

/** Is local pixel (x, y) on the All Nations hilltop (its gravel pad and the bushes behind)? */
function onHilltop(x, y) {
  return x < px(50) && y < py(3) + 2;
}

/** Is local pixel (x, y) under the bus stop (with a pixel or two to spare)? */
function underBusStop(x, y) {
  return x >= px(BUS_STOP.x) - 2 && x < px(BUS_STOP.x + BUS_STOP.cols) + 2 && y >= py(BUS_STOP.y) - 2;
}

// ---- The bus stop: bus-stop.png (4 x 3 tiles) --------------------------------------------
// Seen from the front, like the map's buildings: the PT sign on its pole (route
// panel left blank), then the shelter — flat roof with its orange edge, glass
// back wall with the yellow strip, end posts, a bench — on a concrete pad.
function drawBusStop() {
  const s = PAL;
  const c = new Canvas(BUS_STOP.cols * TS, BUS_STOP.rows * TS);
  const left = 17; // the shelter's end posts
  const right = 56; // (the roof overhangs this by 5px, so it still fits inside the 64px picture)
  const roofTop = 4;
  const ground = 41; // where the posts meet the pad

  // the pad, with a soft shadow under the roof
  c.rect(left - 2, 35, right - left + 6, 12, s.pad);
  c.rect(left - 2, 46, right - left + 6, 1, s.padShade);
  c.rect(left - 2, 35, 1, 12, s.padShade);
  c.rect(right + 3, 35, 1, 12, s.padShade);
  for (const sx of [30, 46]) c.rect(sx, 36, 1, 10, s.padSeam);
  c.rect(left + 3, 35, right - left - 3, 3, s.padShade, 0.6);

  // the glass back wall: see-through, a couple of glints, the yellow strip
  c.rect(left + 3, roofTop + 8, right - left - 3, ground - roofTop - 9, s.glass, 0.4);
  for (const gx of [left + 6, left + 26]) c.line(gx, 30, gx + 7, 16, s.glassGlint, 0.7);
  c.rect(left + 3, 22, right - left - 3, 2, s.stripe);
  c.rect(left + 3, ground - 2, right - left - 3, 1, s.frame); // bottom rail
  c.rect(Math.round((left + right) / 2), roofTop + 8, 1, ground - roofTop - 10, s.frame); // middle mullion

  // the bench: a slatted seat on two little legs
  c.rect(left + 8, 29, right - left - 13, 3, s.seat);
  c.rect(left + 8, 30, right - left - 13, 1, s.seatShade);
  c.rect(left + 8, 32, right - left - 13, 1, s.frameDark);
  for (const lx of [left + 10, right - 8]) c.rect(lx, 33, 2, ground - 33, s.frameDark);

  // the two end posts
  for (const x of [left, right]) {
    c.rect(x, roofTop + 6, 3, ground - roofTop - 5, s.frame);
    c.rect(x, roofTop + 6, 1, ground - roofTop - 5, s.frameHi);
    c.rect(x + 2, roofTop + 6, 1, ground - roofTop - 5, s.frameDark);
  }

  // the flat roof, seen a little from above, with the orange edge along its front
  c.rect(left - 2, roofTop, right - left + 7, 5, s.roof);
  c.rect(left - 2, roofTop, right - left + 7, 1, s.roofHi);
  c.rect(left - 2, roofTop + 5, right - left + 7, 2, s.roofEdge);
  c.rect(left - 2, roofTop + 7, right - left + 7, 1, s.roofEdgeShade);
  c.rect(left - 3, roofTop, 1, 8, s.frameDark);
  c.rect(right + 5, roofTop, 1, 8, s.frameDark);
  c.rect(left - 2, roofTop - 1, right - left + 7, 1, s.frameDark);

  // the PT sign: header with the red PT mark, orange band, a blank navy panel, on its pole
  const sx = 2;
  const sw = 10;
  c.rect(sx + 3, 18, 2, 27, s.pole);
  c.rect(sx + 4, 18, 1, 27, s.poleShade);
  c.rect(sx + 2, 45, 4, 1, s.poleShade);
  c.rect(sx - 1, 1, sw + 2, 19, s.frameDark); // the sign's edge
  c.rect(sx, 2, sw, 4, s.signFace);
  c.rect(sx + sw - 5, 3, 2, 2, s.ptRed); // the PT mark, too small for letters
  c.rect(sx + sw - 3, 3, 1, 2, s.ptRed);
  c.rect(sx, 6, sw, 3, s.signOrange);
  c.rect(sx, 9, sw, 1, s.signNavy);
  c.rect(sx, 10, sw, 7, s.signPanel);
  c.rect(sx, 17, sw, 2, s.signFace);
  return c;
}

/** Is local pixel (x, y) inside the patio's ellipse (grown by `pad`, in tiles)? */
function insidePatio(x, y, pad = 0) {
  const dx = (x - (px(PATIO.cx) + TS / 2)) / ((PATIO.rx + pad) * TS);
  const dy = (y - (py(PATIO.cy) + TS / 2)) / ((PATIO.ry + pad) * TS);
  return dx * dx + dy * dy <= 1;
}

function tuft(c, x, y) {
  c.px(x, y, PAL.tuft);
  c.px(x - 1, y - 1, PAL.tuftHi);
  c.px(x + 1, y - 1, PAL.tuftHi);
}

function flower(c, x, y, petal) {
  c.px(x, y - 1, petal);
  c.px(x - 1, y, petal);
  c.px(x + 1, y, petal);
  c.px(x, y + 1, petal);
  c.px(x, y, P.butter);
  c.px(x + 1, y + 2, P.grassDark); // a leaf
}

/** A flat pale stone set into the grass: shadow below, light along the top. */
function steppingStone(c, cx, cy, rx, ry) {
  c.ellipse(cx, cy + 1, rx, ry, PAL.stoneDark);
  c.ellipse(cx, cy, rx, ry, PAL.stoneShade);
  c.ellipse(cx - 1, cy - 1, rx - 1, ry - 1, PAL.stone);
  c.px(cx - rx + 2, cy - 1, PAL.stoneHi);
  c.px(cx - rx + 3, cy - 2, PAL.stoneHi);
  tuft(c, cx + rx, cy + ry); // grass growing round the edge
}

/**
 * Irregular flagstones (Voronoi cells around scattered seeds) inside the
 * patio's ellipse, with moss in the cracks, and a heart of rose-pink stones
 * set into the middle.
 */
function drawPatio(c) {
  const r = rng(1019);
  const cx = px(PATIO.cx) + TS / 2;
  const cy = py(PATIO.cy) + TS / 2;
  const rx = PATIO.rx * TS;
  const ry = PATIO.ry * TS;
  // seeds on a jittered grid, so the stones come out roughly the same size
  const seeds = [];
  for (let gy = cy - ry; gy <= cy + ry + 7; gy += 7)
    for (let gx = cx - rx + ((gy / 7) % 2) * 4; gx <= cx + rx + 8; gx += 8)
      seeds.push({ x: gx + r.range(-2, 2), y: gy + r.range(-1.5, 1.5), light: r() < 0.7 });
  // which stone each pixel belongs to (-1 = moss in the cracks / outside)
  const x0 = Math.floor(cx - rx - 1);
  const y0 = Math.floor(cy - ry - 1);
  const pw = Math.ceil(rx * 2) + 3;
  const ph = Math.ceil(ry * 2) + 3;
  const cell = new Int16Array(pw * ph).fill(-1);
  for (let y = 0; y < ph; y++)
    for (let x = 0; x < pw; x++) {
      const e = ((x0 + x - cx) / rx) ** 2 + ((y0 + y - cy) / ry) ** 2;
      if (e > 1 + (hash(x, y, 3) - 0.5) * 0.1) continue;
      // nearest and second-nearest seed: nearly equal = a crack between two stones
      let a = Infinity;
      let b = Infinity;
      let best = 0;
      seeds.forEach((s, i) => {
        const d = Math.hypot(x0 + x - s.x, y0 + y - s.y);
        if (d < a) {
          b = a;
          a = d;
          best = i;
        } else if (d < b) b = d;
      });
      cell[y * pw + x] = b - a < 1 ? -2 : best;
    }
  const at = (x, y) => (x < 0 || y < 0 || x >= pw || y >= ph ? -1 : cell[y * pw + x]);
  for (let y = 0; y < ph; y++)
    for (let x = 0; x < pw; x++) {
      const id = at(x, y);
      if (id === -1) continue;
      if (id === -2) {
        c.px(x0 + x, y0 + y, PAL.grout);
        continue;
      }
      let col = seeds[id].light ? PAL.stone : PAL.stoneWarm;
      if (at(x, y - 1) !== id) col = PAL.stoneHi; // light along each stone's top edge
      else if (at(x, y + 1) !== id) col = PAL.stoneShade; // shade along its bottom
      c.px(x0 + x, y0 + y, col);
    }
  // the heart (9 x 8), stones of its own, outlined in the darker rose
  const heart = [
    '.##...##.',
    '#hh#.#hh#',
    '#h#######',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
  ];
  const hx = Math.round(px(HEART.cx) + TS / 2 - 4);
  const hy = Math.round(py(HEART.cy) + TS / 2 - 4);
  heart.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '.') c.px(hx + x, hy + y, ch === 'h' ? PAL.heartHi : PAL.heart);
    }),
  );
  // shade along its bottom, and a mossy crack round it so it reads as set into the stone
  const inHeart = (x, y) => heart[y]?.[x] && heart[y][x] !== '.';
  for (let y = -1; y <= heart.length; y++)
    for (let x = -1; x <= 9; x++) {
      if (inHeart(x, y)) {
        if (!inHeart(x, y + 1)) c.px(hx + x, hy + y, PAL.heartShade); // shade along the bottom
        continue;
      }
      if (inHeart(x - 1, y) || inHeart(x + 1, y) || inHeart(x, y - 1) || inHeart(x, y + 1)) c.px(hx + x, hy + y, PAL.grout);
    }
}

// ---- Putting it on the map -------------------------------------------------------------
function addToMap(map) {
  const layer = (name) => map.layers.find((l) => l.name === name);
  const at = (tx, ty) => ty * map.width + tx;
  const decor = layer('Decor').data;
  const above = layer('Above').data;
  const collision = layer('Collision').data;

  // Clear the old grove (the solid block of trees, its blockers and its bench).
  // Only there: the ground reaches further west, under the All Nations hilltop, which is kept.
  for (let ty = CLEAR.y; ty < CLEAR.y + CLEAR.h; ty++)
    for (let tx = CLEAR.x; tx < CLEAR.x + CLEAR.w; tx++) decor[at(tx, ty)] = above[at(tx, ty)] = collision[at(tx, ty)] = 0;
  const triggers = layer('Triggers').objects;
  for (let i = triggers.length - 1; i >= 0; i--)
    if (triggers[i].properties?.some((p) => p.name === 'memoryId' && p.value === TRIGGER.memoryId)) triggers.splice(i, 1);

  // The new ground, as its own tileset (every tile walkable).
  const firstgid = addTileset(map, {
    name: 'grove', image: '../public/assets/tiles/grove.png', cols: REGION.w, rows: REGION.h,
    walkable: Array.from({ length: REGION.w * REGION.h }, (_, i) => i),
  });
  const ground = layer('Ground').data;
  for (let ty = 0; ty < REGION.h; ty++)
    for (let tx = 0; tx < REGION.w; tx++) ground[at(REGION.x + tx, REGION.y + ty)] = firstgid + ty * REGION.w + tx;

  // Cosy tiles: gid = tile id + 1.
  for (const [x, y] of TREES) {
    above[at(x, y)] = COSY.CANOPY_TL + 1;
    above[at(x + 1, y)] = COSY.CANOPY_TR + 1;
    above[at(x, y + 1)] = COSY.CANOPY_BL + 1;
    above[at(x + 1, y + 1)] = COSY.CANOPY_BR + 1;
    decor[at(x, y + 2)] = COSY.TRUNK_L + 1;
    decor[at(x + 1, y + 2)] = COSY.TRUNK_R + 1;
  }
  for (const [x, y] of BUSHES) decor[at(x, y)] = COSY.HEDGE + 1;
  decor[at(BENCH.x, BENCH.y)] = COSY.BENCH_L + 1;
  decor[at(BENCH.x + 1, BENCH.y)] = COSY.BENCH_R + 1;
  decor[at(LAMP.x, LAMP.y)] = COSY.LAMP_BASE + 1;
  above[at(LAMP.x, LAMP.y - 1)] = COSY.LAMP_TOP + 1;
  decor[at(POT.x, POT.y)] = COSY.FLOWER_POT + 1;

  // The bus stop, and the main path on to the east edge.
  const upper = Array.from({ length: BUS_STOP.aboveRows * BUS_STOP.cols }, (_, i) => i); // tile ids in the Above rows
  const busGid = addTileset(map, {
    name: 'bus-stop', image: '../public/assets/tiles/bus-stop.png', cols: BUS_STOP.cols, rows: BUS_STOP.rows,
    walkable: upper, noFade: upper,
  });
  for (let ty = 0; ty < BUS_STOP.rows; ty++)
    for (let tx = 0; tx < BUS_STOP.cols; tx++) {
      const target = ty < BUS_STOP.aboveRows ? above : decor;
      target[at(BUS_STOP.x + tx, BUS_STOP.y + ty)] = busGid + ty * BUS_STOP.cols + tx;
    }
  for (let ty = MAIN_PATH.y; ty < MAIN_PATH.y + MAIN_PATH.rows; ty++)
    for (let tx = MAIN_PATH.fromX; tx <= MAIN_PATH.toX; tx++) ground[at(tx, ty)] = COSY.PATH + 1;

  triggers.push({
    id: map.nextobjectid++, name: TRIGGER.name, type: '', visible: true, rotation: 0,
    x: TRIGGER.x * TS, y: TRIGGER.y * TS, width: TRIGGER.w * TS, height: TRIGGER.h * TS,
    properties: [{ name: 'memoryId', type: 'string', value: TRIGGER.memoryId }],
  });
}

/** The corner as it looks in game (plus the main path below it): ground, then Decor, then Above. */
function drawPreview(map, groundCanvas) {
  const rows = REGION.h + MAIN_PATH.rows;
  const c = new Canvas(W, rows * TS);
  c.blit(groundCanvas, 0, 0);
  // every tileset's image (the grove's own ground is already drawn)
  const sheets = map.tilesets
    .filter((t) => t.name !== 'grove')
    .map((t) => ({ ...t, sheet: loadPNG(path.join(TILES_DIR, path.basename(t.image))) }));
  for (const name of ['Ground', 'Decor', 'Above']) {
    const data = map.layers.find((l) => l.name === name).data;
    for (let ty = 0; ty < rows; ty++)
      for (let tx = 0; tx < REGION.w; tx++) {
        const gid = data[(REGION.y + ty) * map.width + REGION.x + tx];
        const ts = sheets.filter((t) => t.firstgid <= gid).at(-1);
        if (gid > 0 && ts && gid < ts.firstgid + ts.tilecount) drawTile(c, ts.sheet, ts.columns, gid - ts.firstgid, tx * TS, ty * TS);
      }
  }
  return c;
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Planting the secret grove…');
const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const already = map.tilesets.some((t) => t.name === 'grove');
if (already) {
  console.log('  map      already has the secret grove — left untouched (the ground needs fresh grass to draw on)');
} else {
  const groundCanvas = drawGround(map);
  const busStop = drawBusStop();
  save(path.join(TILES_DIR, 'grove.png'), groundCanvas);
  save(path.join(TILES_DIR, 'bus-stop.png'), busStop);
  addToMap(map);
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1));
  console.log(`  map      replaced the old grove at tiles x ${CLEAR.x}–${CLEAR.x + CLEAR.w - 1}, y ${CLEAR.y}–${CLEAR.y + CLEAR.h - 1} (new ground x ${REGION.x}–${REGION.x + REGION.w - 1}, with stones on to the hilltop bench)`);
  console.log(`           (trail, ${TREES.length} trees, ${BUSHES.length} bushes, bench + "${TRIGGER.name}" trigger at x ${TRIGGER.x}–${TRIGGER.x + TRIGGER.w - 1}, y ${TRIGGER.y}–${TRIGGER.y + TRIGGER.h - 1})`);
  console.log(`           bus stop at x ${BUS_STOP.x}–${BUS_STOP.x + BUS_STOP.cols - 1}, y ${BUS_STOP.y}–${BUS_STOP.y + BUS_STOP.rows - 1}; main path now runs to x ${MAIN_PATH.toX}`);
  writePreview('secret-grove-map.png', drawPreview(map, groundCanvas));
  console.log('  preview  tools/previews/secret-grove-map.png');
}
