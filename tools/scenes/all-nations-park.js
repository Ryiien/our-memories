#!/usr/bin/env node
// -----------------------------------------------------------------------------
// all-nations-park.js — draws the "One year at All Nations Park" memory: the
// top of the hill at night, the city lit up across the suburbs, a hazy
// city-glow sky, a tall light pole, gum trees, the row of basalt boulders along
// the gravel, and the two of us on the bench, seen from behind — her blonde
// hair on his shoulder, her arm around him.
// Clothes from the photo that night: her black jacket and pink-and-white floral
// scarf; his buzzcut, olive-brown jacket and purple checked shirt.
//
//   npm run scene:all-nations                  # (re)draw everything
//   npm run scene:all-nations -- --keep us     # don't overwrite layers you've redrawn
//
// Also puts the hilltop bench on the map (first time only): a gravel pad with
// basalt boulders either side of a bench, in the clearing east of RMIT.
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/memories/all-nations-park/*.png   the cutscene layers
//   public/assets/tiles/all-nations.png             the bench on the map (4 x 2 tiles)
//   tools/previews/all-nations-park.png             flattened preview (3x size)
//   tools/previews/all-nations-park-map.png         the map piece on grass (3x size)
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas, bayer, rng } from '../lib/canvas.js';
import { ROOT, makeSaver, thickLine, rimLight, softEllipse, foliage, blobsIn, writePreview, stampBuilding } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // the sky: night up top, warm city glow down by the skyline
  sky: ['#1b1d40', '#272a57', '#3a3a6e', '#5a4a7e', '#86628e', '#b07a9a', '#cf9488'],
  stars: ['#fff3dc', '#ffffff', '#b8a6d9'],
  cloud: '#4a3f6e',
  cloudMid: '#6e5682',
  cloudLit: '#a67890', // undersides, lit by the city
  // the city
  cbd: '#3c3556', // far towers, hazy
  cbdShade: '#332d4a',
  tower: '#251f33', // the tall building nearer by
  towerEdge: '#3a3150',
  suburbs: '#211b2e', // rooftops and trees between us and the city
  suburbsHi: '#2c2540',
  window: '#f6d983',
  windowWarm: '#e9a35b',
  windowCool: '#fff3dc',
  light: ['#f6d983', '#fff3dc', '#e9a35b', '#f2c6a0', '#ffffff'],
  // the hilltop
  gravel: '#4e4254',
  gravelLit: '#6a5866',
  gravelDark: '#3a3044',
  gravelSpeck: ['#7a6870', '#5e4e5c', '#342a3c'],
  grass: '#2c3a3a',
  basalt: '#24222e',
  basaltMid: '#33303e',
  basaltHi: '#4a4656',
  basaltLit: '#6e6270', // the lamp catching their tops
  gumLeaves: ['#1a2328', '#22302f', '#2c3e38', '#3e5246'],
  gumBark: '#6e6878',
  gumBarkShade: '#4e4858',
  pole: '#4a4656',
  poleHi: '#6a6476',
  lamp: '#fff3dc',
  lampGlow: '#f6d983',
  // the bench (weathered teal-grey timber, like the real one), at night
  bench: '#4a5a5e',
  benchHi: '#66787a',
  benchShade: '#34404a',
  benchLeg: '#2e2a36',
  // her: blonde, black jacket, pink-and-white floral scarf
  herHair: '#e8c87e',
  herHairHi: '#f6e2a8',
  herHairShade: '#c49e58',
  herHairDeep: '#a07c46',
  herSkin: '#d9a47c',
  jacket: '#2e2a36',
  jacketHi: '#4a4456',
  jacketShade: '#221e2a',
  scarf: '#f0d4dc',
  scarfShade: '#d8a8b8',
  scarfRose: '#c46a80',
  scarfWhite: '#fff8f4',
  // him: buzzcut, olive-brown jacket, purple checked shirt
  himSkin: '#ecbf9f',
  himSkinShade: '#d6a585',
  buzz: '#1e171b',
  coat: '#6b5f45',
  coatHi: '#867856',
  coatShade: '#4f4632',
  shirt: '#6a3468',
  shirtCheck: '#8e4a84',
  outline: '#2a1f2a',
  cityLight: '#f2c6a0', // the glow on us from the city in front
  vignette: '#13152e',
};
const NIGHT = [38, 35, 71]; // we're tinted towards this a little

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const PI = Math.PI;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'all-nations-park');
const save = makeSaver();
const r = rng(19); // one generator for the whole scene, so it comes out the same every run

const SKYLINE = 102; // where the far city sits
const crest = (x) => 116 + Math.round(Math.sin(x * 0.03 + 1) * 1.5 + (x < 60 ? (60 - x) * 0.05 : 0)); // the top of our hill
const POLE = { x: 92, top: 40 }; // the light pole on the left
const BENCH = { x: 158, w: 72, rail1: 127, rail2: 134, seat: 141, ground: 156 };
const HER = { cx: 188, top: 111 }; // her shoulders
const HIM = { cx: 206, top: 108 }; // his (he's a bit taller)

// ---- small helpers ------------------------------------------------------------------
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function tint(c, color, t) {
  for (let i = 0; i < c.data.length; i += 4) {
    if (!c.data[i + 3]) continue;
    const out = mix([c.data[i], c.data[i + 1], c.data[i + 2]], color, t);
    c.data[i] = out[0];
    c.data[i + 1] = out[1];
    c.data[i + 2] = out[2];
  }
}

// ---- 1. sky.png — a hazy night, warm where the city lights it from below ----------------
function drawSky() {
  const c = new Canvas(W, H);
  c.gradientV(0, 0, W, SKYLINE + 4, PAL.sky);
  c.rect(0, SKYLINE + 4, W, H - SKYLINE - 4, PAL.sky[PAL.sky.length - 1]);
  return c;
}

// ---- 2. stars.png — only a few make it through the city glow (twinkle) ---------------------
function drawStars() {
  const c = new Canvas(W, H);
  for (let i = 0; i < 45; i++) {
    const x = r.int(2, W - 3);
    const y = r.int(2, 46);
    const color = r.pick(PAL.stars);
    c.px(x, y, color, y < 30 ? 1 : 0.6);
    if (r() < 0.12) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.px(x + dx, y + dy, color, 0.45);
  }
  return c;
}

// ---- 3. clouds.png — low clouds lit from underneath (drift, wraps) ---------------------------
function drawClouds() {
  const c = new Canvas(W, H);
  const banks = [
    { x: 40, y: 54, rx: 46, ry: 6 },
    { x: 150, y: 44, rx: 58, ry: 5 },
    { x: 250, y: 60, rx: 50, ry: 6 },
    { x: 300, y: 36, rx: 34, ry: 4 },
    { x: 95, y: 70, rx: 40, ry: 4 },
    { x: 200, y: 76, rx: 46, ry: 3 },
  ];
  for (const b of banks) {
    const puffs = blobsIn(r, b.x, b.y, b.rx, b.ry, 14, 3, 7);
    for (let y = b.y - b.ry - 8; y <= b.y + b.ry + 6; y++)
      for (let x = b.x - b.rx - 8; x <= b.x + b.rx + 8; x++) {
        let inside = false;
        let low = 0;
        for (const p of puffs) {
          const d = Math.hypot(x - p.x, (y - p.y) * 1.6) / p.r;
          if (d <= 1) {
            inside = true;
            low = Math.max(low, (y - p.y) / p.r); // how far down this puff we are
          }
        }
        if (!inside) continue;
        const v = low + (bayer(x, y) - 0.5) * 0.5;
        const color = v > 0.35 ? PAL.cloudLit : v > -0.2 ? PAL.cloudMid : PAL.cloud;
        c.px(((x % W) + W) % W, y, color, 0.85);
      }
  }
  return c;
}

// ---- 4. city.png — the far towers, the tall building nearer by, the suburbs ------------------
// Far towers: [left x, width, top y]. The tall one in the middle is the CBD's tallest.
const CBD = [
  [118, 9, 84], [127, 7, 78], [134, 10, 70], [144, 6, 80], [150, 8, 64], [158, 5, 58], [163, 9, 72],
  [172, 7, 66], [179, 11, 76], [190, 6, 82], [196, 8, 74], [204, 10, 86], [214, 6, 90], [96, 10, 92],
  [106, 8, 88], [220, 12, 92],
];
const TOWER = { x: 262, w: 22, top: 44 }; // the dark building from the photo, off to the right

function suburbsTop(x) {
  // treetops and roofs: lumpy, with the odd pointy roof
  return SKYLINE - 1 + Math.round(Math.sin(x * 0.21) * 1.5 + Math.sin(x * 0.07 + 2) * 2 + (x % 23 < 4 ? -(2 - Math.abs((x % 23) - 2)) : 0));
}

function drawCity() {
  const c = new Canvas(W, H);
  for (const [x, w, top] of CBD) {
    c.rect(x, top, w, SKYLINE - top + 2, PAL.cbd);
    c.rect(x + w - 2, top, 2, SKYLINE - top + 2, PAL.cbdShade);
  }
  c.rect(160, 50, 1, 8, PAL.cbd); // a spire
  // the near tower, with a lighter edge where the city glow catches it
  c.rect(TOWER.x, TOWER.top, TOWER.w, 70, PAL.tower);
  c.rect(TOWER.x, TOWER.top, 1, 70, PAL.towerEdge);
  c.rect(TOWER.x - 3, TOWER.top + 18, 3, 52, PAL.tower); // a lower wing
  c.rect(TOWER.x + 4, TOWER.top - 3, 6, 3, PAL.tower); // plant room on the roof
  // the suburbs: a dark band of roofs and trees
  for (let x = 0; x < W; x++) {
    const top = suburbsTop(x);
    c.rect(x, top, 1, 24, PAL.suburbs);
    if (x % 23 < 4) c.px(x, top, PAL.suburbsHi);
  }
  return c;
}

// ---- 5. windows.png — lit windows in the towers (flicker) ------------------------------------
function drawWindows() {
  const c = new Canvas(W, H);
  for (const [x, w, top] of CBD)
    for (let y = top + 2; y < SKYLINE - 1; y += 3)
      for (let wx = x + 1; wx < x + w - 1; wx += 2) if (r() < 0.32) c.px(wx, y, r() < 0.7 ? PAL.window : PAL.windowCool, 0.75);
  for (let y = TOWER.top + 3; y < SKYLINE + 6; y += 3)
    for (let wx = TOWER.x + 2; wx < TOWER.x + TOWER.w - 1; wx += 3)
      if (r() < 0.45) c.rect(wx, y, 2, 1, r() < 0.6 ? PAL.window : PAL.windowWarm);
  c.px(TOWER.x + 7, TOWER.top - 4, '#e0607e'); // the red light on the roof
  return c;
}

// ---- 6. lights.png — streetlights and windows across the suburbs (twinkle) --------------------
function drawLights() {
  const c = new Canvas(W, H);
  for (let i = 0; i < 150; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(suburbsTop(x) + 2, 118);
    const color = r.pick(PAL.light);
    if (r() < 0.12) {
      // a blurry bokeh blob, like the photo
      c.circle(x, y, 1.5, color, 0.45);
      c.px(x, y, color);
    } else {
      c.px(x, y, color, r.range(0.6, 1));
    }
  }
  return c;
}

// ---- 7. hill.png — the gravel hilltop, the light pole, gum trunks -------------------------------
function drawHill() {
  const c = new Canvas(W, H);
  for (let x = 0; x < W; x++) {
    const top = crest(x);
    c.rect(x, top, 1, 2, PAL.grass); // a fringe of grass along the edge
    for (let y = top + 2; y < H; y++) {
      // lit by the lamp on the left, darker towards the front
      const lit = Math.max(0, 1 - Math.hypot((x - POLE.x) / 150, (y - 130) / 60));
      const v = lit * 1.6 - (y - 120) / 120 + (bayer(x, y) - 0.5) * 0.7;
      c.px(x, y, v > 0.8 ? PAL.gravelLit : v > -0.1 ? PAL.gravel : PAL.gravelDark);
    }
    if (r() < 0.5) c.px(x, top - 1, PAL.grass); // tufts
  }
  for (let i = 0; i < 260; i++) c.px(r.int(0, W - 1), r.int(122, H - 1), r.pick(PAL.gravelSpeck));
  // a worn path heading off between the rocks and the bench
  for (let y = 120; y < H; y++) {
    const cx = 118 + (y - 120) * 0.6;
    const half = 6 + (y - 120) * 0.35;
    for (let x = Math.round(cx - half); x <= cx + half; x++) if ((x + y) % 3 === 0) c.px(x, y, PAL.gravelLit, 0.35);
  }
  // the light pole
  c.rect(POLE.x, POLE.top, 2, crest(POLE.x) + 4 - POLE.top, PAL.pole);
  c.rect(POLE.x + 1, POLE.top, 1, crest(POLE.x) + 4 - POLE.top, PAL.poleHi);
  c.rect(POLE.x - 3, POLE.top - 2, 8, 3, PAL.pole); // lamp head
  c.rect(POLE.x - 2, POLE.top + 1, 6, 1, PAL.lamp);
  softEllipse(c, POLE.x + 1, crest(POLE.x) + 5, 6, 1.5, PAL.gravelDark, 0.8); // its foot
  // the gums' pale trunks (their leaves sway on trees.png)
  for (const [x, top, lean] of [[10, 30, -2], [24, 52, 2], [300, 64, 3]]) {
    thickLine(c, x, crest(x) + 3, x + lean, top, 3, PAL.gumBark);
    thickLine(c, x, crest(x) + 3, x + lean, top, 1, PAL.gumBarkShade);
  }
  thickLine(c, 24, 80, 34, 66, 2, PAL.gumBark); // a branch
  return c;
}

// ---- 8. trees.png — the gum trees' leaves (sway) --------------------------------------------------
function drawTrees() {
  const c = new Canvas(W, H);
  foliage(c, [...blobsIn(r, 12, 30, 22, 18, 22, 5, 10), ...blobsIn(r, 30, 60, 16, 12, 12, 4, 8)], PAL.gumLeaves, 3, { sun: 'left' });
  foliage(c, blobsIn(r, 304, 66, 18, 14, 16, 4, 8), PAL.gumLeaves, 5);
  // a low bush on the right edge of the hill
  foliage(c, blobsIn(r, 300, 112, 20, 6, 10, 4, 7), PAL.gumLeaves, 7);
  return c;
}

// ---- 9. lamp.png — the light pole's glow (pulse) ------------------------------------------------
function drawLamp() {
  const c = new Canvas(W, H);
  c.glow(POLE.x + 1, POLE.top + 2, 22, PAL.lampGlow, 0.4);
  softEllipse(c, POLE.x + 20, 138, 60, 18, PAL.lampGlow, 0.08); // the pool of light on the gravel
  return c;
}

// ---- 10. rocks.png — the row of basalt boulders along the gravel (still) ----------------------------
// A line from the bottom-left back up towards the bench, big at the front, small at the back.
function boulder(c, cx, cy, rw, rh, seed) {
  const g = rng(seed);
  softEllipse(c, cx + 2, cy + rh * 0.6, rw * 1.1, rh * 0.35 + 1, PAL.basalt, 0.6); // shadow
  // a chunky, angular lump: a jagged polygon, flat-ish on the bottom
  const pts = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = PI + (i / (n - 1)) * PI; // round the top half, left to right
    const k = g.range(0.75, 1.05);
    pts.push([cx + Math.cos(a) * rw * k, cy + Math.sin(a) * rh * k * 1.6]);
  }
  pts.push([cx + rw * 0.9, cy + rh * 0.5], [cx - rw * 0.9, cy + rh * 0.5]);
  const rock = new Canvas(c.width, c.height);
  fillPolygon(rock, pts, PAL.basaltMid);
  // facets: a lit top-left face, a shaded right face, a dark bottom (the lamp is on the left)
  const peak = pts.reduce((p, q) => (q[1] < p[1] ? q : p));
  for (let y = 0; y < c.height; y++)
    for (let x = Math.floor(cx - rw - 1); x <= cx + rw + 1; x++) {
      if (!rock.get(x, y)[3]) continue;
      const below = y - (cy + rh * 0.1);
      if (below > 0 && below + (bayer(x, y) - 0.5) * 2 > 0) rock.px(x, y, PAL.basalt);
      else if (x > peak[0] + (y - peak[1]) * 0.6) rock.px(x, y, PAL.basalt);
      else if (y < peak[1] + rh * 0.9 && x < peak[0]) rock.px(x, y, PAL.basaltHi);
    }
  // the lamp catching its top edge
  for (let x = Math.floor(cx - rw); x < peak[0] + 2; x++)
    for (let y = 0; y < c.height; y++) {
      if (!rock.get(x, y)[3]) continue;
      rock.px(x, y, PAL.basaltLit, 0.8);
      break;
    }
  c.blit(rock, 0, 0);
}

/** Fills a polygon (even-odd rule, pixel centres). */
function fillPolygon(c, pts, color) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y + 0.5) !== (y1 <= y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) c.px(x, y, color);
  }
}

function drawRocks() {
  const c = new Canvas(W, H);
  const ROW = [
    [16, 168, 22, 13], [52, 158, 17, 11], [80, 150, 14, 9], [102, 142, 11, 7], [120, 136, 9, 6],
    [134, 131, 7, 5], [64, 136, 6, 4], [6, 132, 8, 5],
  ];
  // smaller ones lining the grass along the top of the hill, like the real park
  // (the bush on the right takes over at x 280)
  for (let x = 4, i = 0; x < 280; x += r.int(10, 16), i++) {
    const rw = r.range(4, 6.5);
    const rh = r.range(2.5, 3.5);
    boulder(c, x, crest(x) + 1, rw, rh, 100 + i);
  }
  ROW.forEach(([x, y, rw, rh], i) => boulder(c, x, y, rw, rh, 40 + i));
  // little basalt stones scattered along the line
  for (let i = 0; i < 40; i++) {
    const t = r();
    const x = Math.round(10 + t * 130 + r.range(-10, 10));
    const y = Math.round(172 - t * 44 + r.range(-4, 6));
    c.rect(x, y, r.int(1, 3), r.int(1, 2), r() < 0.5 ? PAL.basalt : PAL.basaltMid);
    c.px(x, y, PAL.basaltHi);
  }
  return c;
}

// ---- 11. us.png — the two of us on the bench, from behind (4 frames: her scarf in the breeze) ---------
const FRAMES = 4;
const BREEZE = [0, 1, 2, 1]; // how far her scarf's tail and loose hair drift, per frame

/** A back from behind: rounded shoulders, in a little at the waist. Returns nothing; draws on c. */
function back(c, cx, top, bottom, half, body, shade, hi) {
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / (bottom - top);
    let w = half - 1.4 * Math.sin(Math.min(1, t / 0.7) * (PI / 2));
    w -= [3, 1, 0.5][y - top] ?? 0; // round the tops of the shoulders
    const l = Math.round(cx - w);
    const rr = Math.round(cx + w);
    c.rect(l, y, rr - l + 1, 1, body);
    c.rect(l, y, 2, 1, hi); // the lamp is off to the left
    c.px(rr, y, shade);
  }
}

function him(c) {
  const s = PAL;
  const { cx, top } = HIM;
  back(c, cx, top, BENCH.seat, 10, s.coat, s.coatShade, s.coatHi);
  c.rect(cx, top + 5, 1, BENCH.seat - top - 5, s.coatShade); // back seam
  c.px(cx - 6, top + 1, s.coatShade); // shoulder seams
  c.px(cx + 6, top + 1, s.coatShade);
  c.rect(cx - 5, top + 2, 3, 1, s.coatHi); // light on his left shoulder
  // his right arm down by his side (his left one is round her: hisArm, drawn over her)
  thickLine(c, cx + 9, top + 2, cx + 10, BENCH.seat, 2, s.coatShade);
  // collar: the jacket's, with his purple checked shirt peeking out over it
  c.rect(cx - 4, top - 1, 9, 2, s.coatShade);
  for (let x = cx - 3; x <= cx + 3; x++) c.px(x, top - 2, x % 2 ? s.shirt : s.shirtCheck);
  // neck and buzzcut head
  c.rect(cx - 2, top - 4, 5, 2, s.himSkin);
  c.rect(cx + 1, top - 4, 2, 2, s.himSkinShade);
  const hy = top - 10;
  c.circle(cx, hy, 6, s.himSkin);
  c.rect(cx - 7, hy, 1, 3, s.himSkin); // ears
  c.rect(cx + 7, hy, 1, 3, s.himSkin);
  c.px(cx + 7, hy + 1, s.himSkinShade);
  // the buzzcut: close-cropped, so his skin shows through the stubble a little
  for (let y = hy - 7; y <= hy + 4; y++)
    for (let x = cx - 7; x <= cx + 7; x++) {
      if (Math.hypot(x - cx, y - hy) > 6.4) continue;
      if (y > hy + 4 || (y === hy + 4 && (x + y) % 2)) continue; // a soft hairline at the nape
      c.px(x, y, s.buzz, Math.abs(x - cx) > 5 ? 0.8 : 0.95); // thinner over the ears, so it reads as stubble
    }
  for (const [x, y] of [[-3, -4], [-2, -5], [-1, -5]]) c.px(cx + x, hy + y, s.himSkinShade, 0.6); // the lamp's sheen
}

/** His left arm round her back, over her hair, hand on her far shoulder. */
function hisArm(c) {
  const s = PAL;
  const shoulder = { x: HIM.cx - 9, y: HIM.top + 3 };
  const elbow = { x: HER.cx + 2, y: HER.top + 9 }; // a little lower than her arm round him
  const hand = { x: HER.cx - 9, y: HER.top + 2 };
  thickLine(c, shoulder.x, shoulder.y, elbow.x, elbow.y, 2, s.coat);
  thickLine(c, elbow.x, elbow.y, hand.x + 1, hand.y + 2, 2, s.coat);
  c.line(shoulder.x, shoulder.y, elbow.x, elbow.y, s.coatHi); // light along the top of his sleeve
  c.line(elbow.x, elbow.y, hand.x + 2, hand.y + 1, s.coatHi);
  c.rect(hand.x, hand.y, 2, 3, s.himSkin);
  c.px(hand.x, hand.y + 2, s.himSkinShade);
}

function her(c, f) {
  const s = PAL;
  const { cx, top } = HER;
  const b = BREEZE[f];
  back(c, cx, top, BENCH.seat, 9, s.jacket, s.jacketShade, s.jacketHi);
  c.px(cx - 5, top + 1, s.jacketShade);
  // her left arm by her side
  thickLine(c, cx - 8, top + 2, cx - 9, BENCH.seat, 2, s.jacketHi);
  // her right arm round his back, hand on his far shoulder
  thickLine(c, cx + 7, top + 3, cx + 14, top + 6, 2, s.jacket);
  thickLine(c, cx + 14, top + 6, HIM.cx + 7, HIM.top + 4, 2, s.jacket);
  c.rect(HIM.cx + 8, HIM.top + 1, 2, 3, s.herSkin);
  // the scarf, wrapped round her neck
  c.rect(cx - 5, top - 2, 10, 3, s.scarf);
  c.rect(cx - 5, top, 10, 1, s.scarfShade);
  for (const [x, y] of [[-4, -2], [-1, -1], [2, -2], [4, 0]]) c.px(cx + x, top + y, s.scarfRose); // little roses
  c.px(cx - 2, top - 2, s.scarfWhite);
  // its tail, over her left shoulder, lifting in the breeze
  for (let y = 0; y < 10; y++) {
    const x = cx - 7 - Math.round((y / 9) * b);
    c.rect(x, top - 1 + y, 3, 1, y % 3 === 1 ? s.scarfShade : s.scarf);
    if (y % 4 === 2) c.px(x + 1, top - 1 + y, s.scarfRose);
  }
  c.rect(cx - 7 - b, top + 9, 3, 1, s.scarfWhite); // fringe at the end
  // her head, leaning over onto his shoulder
  const hx = cx + 5;
  const hy = top - 8;
  c.circle(hx, hy, 6.4, s.herHair);
  // long hair down her back, falling from her tilted head to the middle of her back
  for (let y = hy; y <= top + 9; y++) {
    const t = (y - hy) / (top + 9 - hy);
    const mid = hx + (cx - hx) * t;
    const half = 6.5 - t * 1.5 - (y > top + 6 ? (y - top - 6) * 1.2 : 0);
    for (let x = Math.round(mid - half); x <= mid + half; x++) c.px(x, y, s.herHair);
  }
  // strands and shading
  for (let y = hy - 6; y <= top + 9; y++)
    for (let x = hx - 8; x <= hx + 8; x++) {
      const [, , , a] = c.get(x, y);
      if (!a) continue;
      const [rr, gg, bb] = c.get(x, y);
      if (rr !== 0xe8 || gg !== 0xc8 || bb !== 0x7e) continue; // only her hair
      const strand = (x * 3 + Math.floor(y / 4)) % 5;
      if (strand === 0) c.px(x, y, s.herHairShade);
      else if (strand === 2 && y < top) c.px(x, y, s.herHairHi);
    }
  for (let y = hy - 5; y <= hy - 2; y++) c.px(hx - 3, y, s.herHairHi); // the lamp's sheen on top
  c.px(hx - 2, hy - 5, s.herHairHi);
  c.rect(hx + 3, hy + 1, 1, top - hy + 2, s.herHairDeep); // where her hair meets his shoulder
  // a few loose ends drifting in the breeze
  c.px(cx - 4 - b, top + 9, s.herHairShade);
  c.px(cx + 3 + (b > 1 ? 1 : 0), top + 10, s.herHair);
}

function drawUs() {
  const sheet = new Canvas(W * FRAMES, H);
  for (let f = 0; f < FRAMES; f++) {
    const c = new Canvas(W, H);
    softEllipse(c, BENCH.x + BENCH.w / 2, BENCH.ground, 44, 3, PAL.outline, 0.6); // our shadow under the bench
    const one = new Canvas(W, H);
    him(one);
    her(one, f);
    hisArm(one);
    tint(one, NIGHT, 0.2);
    rimLight(one, PAL.cityLight, 0.25);
    one.outline(PAL.outline);
    c.blit(one, 0, 0);
    sheet.blit(c, f * W, 0);
  }
  return sheet;
}

// ---- 12. bench.png — the bench's backrest and legs, in front of us (still) ---------------------------
function drawBench() {
  const c = new Canvas(W, H);
  const s = PAL;
  const { x, w, rail1, rail2, seat, ground } = BENCH;
  // legs and the uprights holding the backrest
  for (const lx of [x + 4, x + w - 6]) {
    c.rect(lx, rail1 - 1, 2, ground - rail1 + 1, s.benchLeg);
    c.rect(lx - 1, ground - 1, 4, 1, s.benchLeg);
  }
  for (const lx of [x + 10, x + w - 12]) c.rect(lx, seat + 2, 2, ground - seat - 2, s.benchLeg); // the front legs, further off
  // the seat's back edge, under the backrest
  c.rect(x + 1, seat, w - 2, 2, s.benchShade);
  // two backrest rails
  for (const ry of [rail1, rail2]) {
    c.rect(x, ry, w, 4, s.bench);
    c.rect(x, ry, w, 1, s.benchHi);
    c.rect(x, ry + 3, w, 1, s.benchShade);
    for (let gx = x + 6; gx < x + w; gx += 9 + (gx % 4)) c.px(gx, ry + 1, s.benchShade); // the grain
  }
  rimLight(c, s.cityLight, 0.15);
  c.outline(s.outline);
  return c;
}

// ---- 13. vignette.png --------------------------------------------------------------------------
function drawVignette() {
  const c = new Canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - W / 2) / (W * 0.62), (y - H * 0.55) / (H * 0.7));
      const level = Math.max(0, (d - 0.62) * 3.2) * 3;
      const band = Math.floor(level) + (level % 1 > bayer(x, y) ? 1 : 0);
      if (band > 0) c.px(x, y, PAL.vignette, Math.min(0.6, band * 0.16));
    }
  return c;
}

// ---- The hilltop bench for the map: all-nations.png (4 x 2 tiles) -----------------------------------------
// Daytime, like the map: a basalt boulder either side of the bench (top row,
// solid) on a pad of tan gravel that spills onto the row below (walkable,
// where the trigger is).
const MAP_PIECE = { cols: 4, rows: 2 };
const AT = { x: 45, y: 1 }; // map tiles: top of the clearing east of RMIT, centred between the bushes and the trees
const MAP_BUSHES = { x: 44, y: 0, w: 6 }; // a row of bushes behind it, along the top edge
const HEDGE_GID = 8; // cosy tileset HEDGE tile (id 7) + 1, solid
const MAP_TRIGGER = { x: 1, y: 1, w: 2, h: 1 }; // in front of the bench (tiles, from the piece's top-left)
const DAY = {
  gravel: '#dccaa4',
  gravelShade: '#c4ae86',
  gravelHi: '#ece0c4',
  basalt: '#4a4858',
  basaltMid: '#5e5c6e',
  basaltHi: '#82809a',
  shadow: '#4f8a50',
  bench: '#6e8a84',
  benchHi: '#90aaa2',
  benchShade: '#526a66',
  leg: '#3e4448',
};

function drawMapPiece() {
  const c = new Canvas(MAP_PIECE.cols * 16, MAP_PIECE.rows * 16);
  const s = DAY;
  const g = rng(7);
  // the gravel pad: a soft-edged oval, speckled
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot((x - 31.5) / 31, (y - 15) / 15);
      if (d > 1 - (bayer(x, y) - 0.5) * 0.12) continue;
      c.px(x, y, d > 0.86 ? s.gravelShade : s.gravel);
      const k = g();
      if (k < 0.1) c.px(x, y, s.gravelShade);
      else if (k < 0.16) c.px(x, y, s.gravelHi);
    }
  // basalt boulders: a big one and a little one either side
  for (const [x, y, rw, rh] of [[8, 9, 6, 4.5], [13, 12, 3, 2], [56, 9, 6, 4.5], [51, 13, 2.5, 2]]) {
    c.ellipse(x + 1, y + rh, rw, 1.5, s.shadow, 0.35);
    c.ellipse(x, y, rw, rh, s.basalt);
    c.ellipse(x - 1, y - 1, rw - 1.5, rh - 1.2, s.basaltMid);
    c.rect(Math.round(x - rw * 0.5), Math.round(y - rh + 1), Math.max(1, Math.round(rw * 0.5)), 1, s.basaltHi);
  }
  // the bench, facing down the map (towards the view), 2 tiles wide in the middle
  const b = new Canvas(32, 16);
  b.ellipse(16, 14, 14, 1.5, s.shadow, 0.35);
  b.rect(2, 2, 28, 3, s.bench); // backrest
  b.rect(2, 2, 28, 1, s.benchHi);
  b.rect(2, 8, 28, 3, s.bench); // seat
  b.rect(2, 8, 28, 1, s.benchHi);
  b.rect(2, 10, 28, 1, s.benchShade);
  for (const x of [3, 27]) b.rect(x, 5, 2, 9, s.leg);
  b.outline(s.leg);
  c.blit(b, 16, 0);
  return c;
}

function addToMap() {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (map.tilesets.some((t) => t.name === 'all-nations')) {
    console.log('  map      already has the hilltop bench — left untouched');
    return;
  }
  const layer = (name) => map.layers.find((l) => l.name === name);
  // the top row (boulders + bench) is solid; the gravel in front is walkable
  stampBuilding(map, {
    name: 'all-nations', image: '../public/assets/tiles/all-nations.png', cols: MAP_PIECE.cols, rows: MAP_PIECE.rows, at: AT,
    walkable: [4, 5, 6, 7],
  });
  for (let x = MAP_BUSHES.x; x < MAP_BUSHES.x + MAP_BUSHES.w; x++) layer('Decor').data[MAP_BUSHES.y * map.width + x] = HEDGE_GID;
  layer('Triggers').objects.push({
    id: map.nextobjectid++, name: 'hilltop bench', type: '', visible: true, rotation: 0,
    x: (AT.x + MAP_TRIGGER.x) * 16, y: (AT.y + MAP_TRIGGER.y) * 16, width: MAP_TRIGGER.w * 16, height: MAP_TRIGGER.h * 16,
    properties: [{ name: 'memoryId', type: 'string', value: 'all-nations-park' }],
  });
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  console.log(`  map      put the hilltop bench at tiles x ${AT.x}–${AT.x + MAP_PIECE.cols - 1}, y ${AT.y}–${AT.y + MAP_PIECE.rows - 1} (+ a row of bushes behind it and the "hilltop bench" trigger)`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing our night at All Nations Park…');
const layers = {
  sky: drawSky(),
  stars: drawStars(),
  clouds: drawClouds(),
  city: drawCity(),
  windows: drawWindows(),
  lights: drawLights(),
  hill: drawHill(),
  trees: drawTrees(),
  lamp: drawLamp(),
  rocks: drawRocks(),
  us: drawUs(),
  bench: drawBench(),
  vignette: drawVignette(),
};
for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);
const piece = drawMapPiece();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'all-nations.png'), piece);
addToMap();

// ---- Previews (3x) ----------------------------------------------------------------------------
const flat = new Canvas(W, H);
for (const src of Object.values(layers)) {
  const first = new Canvas(W, H); // frame 1 of any flip-book
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [rr, g, b, a] = src.get(x, y);
      if (a) first.px(x, y, [rr, g, b], a / 255);
    }
  flat.blit(first, 0, 0);
}
writePreview('all-nations-park.png', flat);
const onGrass = new Canvas(6 * 16, 4 * 16);
onGrass.rect(0, 0, onGrass.width, onGrass.height, '#8cc269');
onGrass.blit(piece, 16, 16);
writePreview('all-nations-park-map.png', onGrass);
console.log('  previews tools/previews/all-nations-park.png, all-nations-park-map.png');
