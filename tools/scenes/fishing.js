#!/usr/bin/env node
// -----------------------------------------------------------------------------
// fishing.js — draws the fishing minigame off the end of the pier: a sunset sea,
// the wooden pier with her standing at the end (the rod and line are drawn by
// the game, so they can move), plus the little sprites the game animates — the
// bobber, ripples, bubbles, the envelope she reels in, seaweed, and the letter
// paper. Also adds the "Fishing" spot (the end of the pier) to maps/world.json.
//
//   npm run scene:fishing                     # (re)draw everything
//   npm run scene:fishing -- --keep pier,sky  # don't overwrite layers you've redrawn
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/fishing/*.png       the scene layers (her.png = 4 frames) + sprites
//   maps/world.json                   the "Fishing" object layer (one rectangle)
//   tools/previews/fishing.png        flattened preview (3x size), mid-cast
//
// If you move her or the pier, update "scene" in data/fishing.json to match
// (where her hand is, where the water is, how far she casts).
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas, rng } from '../lib/canvas.js';
import { HER, figure } from '../lib/cutscenes.js';
import { ROOT, makeSaver, ring, rimLight, writePreview } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // sunset sky, top to bottom
  sky: ['#4a3f78', '#6e4f8a', '#a2648f', '#d47c8c', '#ef9a8a', '#f6b98c', '#f9d49a'],
  sun: '#fff1c4',
  sunGlow: '#ffd98a',
  cloudLit: '#f7b3a2',
  cloudRim: '#fbd3b2',
  cloudShade: '#c9798f',
  bird: '#5a3f62',
  headland: '#7a5383',
  headlandShade: '#694775',
  lighthouse: '#f4e6d8',
  lighthouseRed: '#c75a5a',
  // the sea
  sea: ['#e39a92', '#c47a8e', '#9a608a', '#734f84', '#55457a', '#433c6e'],
  sunPath: '#ffe3a8',
  sunPathWarm: '#f9c38f',
  ripple: '#f2b4a6',
  glint: '#fff3dc',
  // the pier
  wood: '#8a5a44',
  woodHi: '#b8805c',
  woodDark: '#5e3a30',
  woodDeep: '#3e2630',
  rope: '#d9b98a',
  bucket: '#8f9fbf',
  bucketShade: '#6f7fa3',
  bucketHi: '#c9d3e6',
  foam: '#fbe3d0',
  // her dress (light pink), and its sash and lace
  dress: '#f59ac4',
  dressShade: '#d877a6',
  dressDeep: '#b9608f',
  dressHi: '#f8b6d6',
  dressRim: '#ffc9c0', // the sunset catching its front edge
  lace: '#fff3dc',
  laceShade: '#efdcc0',
  sash: '#c46a80',
  sashHi: '#e58f9e',
  sashDark: '#9e4a5c',
  skin: '#d9a47c',
  skinShade: '#bf8862',
  // sprites
  bobberRed: '#d9465a',
  bobberRedHi: '#f07a84',
  bobberWhite: '#fff6ea',
  bobberShade: '#e6d6c6',
  bubble: '#f4fbff',
  bubbleHi: '#ffffff',
  paper: '#fff6e8',
  paperShade: '#f3e2c8',
  paperEdge: '#c46a80',
  paperInner: '#f2c6a0',
  envelope: '#fff3dc',
  envelopeShade: '#efdcc0',
  seal: '#d9465a',
  sealHi: '#f07a84',
  weed: '#4f8a50',
  weedHi: '#8cc269',
  weedDark: '#2f6048',
  drip: '#bfe6ec',
  outline: '#2a1f2a',
  sunlight: '#ffd98a',
};

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const OUT = path.join(ROOT, 'public', 'assets', 'fishing');
const MAP_FILE = path.join(ROOT, 'maps', 'world.json');
const save = makeSaver();
const r = rng(31); // one generator for the whole scene, so it comes out the same every run

const HORIZON = 92;
const SUN = { x: 236, y: 88, r: 13 };
const DECK = { top: 122, right: 112, thick: 5 }; // the pier's walkway, seen from the side
const WATERLINE = 146; // where the pier posts go into the sea
const HER_FEET = { x: 96, y: DECK.top }; // matches "scene.hand" in data/fishing.json

// ---- 1. sky.png — sunset, the sun sinking into the sea, a far-off headland ------------------
function drawSky() {
  const c = new Canvas(W, H);
  c.gradientV(0, 0, W, HORIZON, PAL.sky);
  c.rect(0, HORIZON, W, H - HORIZON, PAL.sea[0]);
  c.glow(SUN.x, SUN.y, 46, PAL.sunGlow, 0.35);
  for (let y = SUN.y - SUN.r; y < HORIZON; y++)
    for (let x = SUN.x - SUN.r; x <= SUN.x + SUN.r; x++) {
      if (Math.hypot(x - SUN.x, y - SUN.y) <= SUN.r) c.px(x, y, PAL.sun);
    }
  // a headland on the far right with a tiny lighthouse
  const top = (x) => Math.round(HORIZON - Math.min(9, (x - 268) * 0.3) + Math.sin(x * 0.4) * 0.6);
  for (let x = 268; x < W; x++)
    for (let y = top(x); y < HORIZON; y++) c.px(x, y, y > top(x) + 3 ? PAL.headlandShade : PAL.headland);
  const lh = { x: 300, y: top(300) };
  c.rect(lh.x - 1, lh.y - 9, 3, 9, PAL.lighthouse);
  c.rect(lh.x - 1, lh.y - 6, 3, 2, PAL.lighthouseRed);
  c.rect(lh.x - 1, lh.y - 11, 3, 2, PAL.lighthouseRed);
  c.px(lh.x, lh.y - 12, PAL.sun);
  return c;
}

// ---- 2. clouds.png — soft sunset clouds and a few far-off birds (drift; wraps) -------------
function cloud(c, cx, cy, width) {
  const puffs = [];
  for (let i = 0; i < Math.round(width / 6); i++) {
    puffs.push({ x: cx - width / 2 + r() * width, y: cy - r() * 3, rx: r.int(5, 10), ry: r.int(2, 4) });
  }
  const wrap = (x) => ((Math.round(x) % W) + W) % W;
  for (const p of puffs) {
    for (let y = Math.floor(p.y - p.ry); y <= p.y + p.ry; y++)
      for (let x = Math.floor(p.x - p.rx); x <= p.x + p.rx; x++) {
        const d = ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2;
        if (d > 1) continue;
        // the sun is low and to the right: undersides glow, right edges catch the light
        const color = y > p.y + p.ry * 0.3 ? PAL.cloudLit : x > p.x + p.rx * 0.5 ? PAL.cloudRim : PAL.cloudShade;
        c.px(wrap(x), y, color, 0.9);
      }
  }
}

function drawClouds() {
  const c = new Canvas(W, H);
  cloud(c, 60, 30, 70);
  cloud(c, 170, 52, 50);
  cloud(c, 270, 22, 60);
  cloud(c, 120, 70, 34);
  // birds: tiny "v"s
  for (const [x, y] of [[96, 42], [104, 46], [212, 34]]) {
    c.px(x - 1, y - 1, PAL.bird);
    c.px(x, y, PAL.bird);
    c.px(x + 1, y - 1, PAL.bird);
  }
  return c;
}

// ---- 3. sea.png — the sea and the sun's path on the water (slide) ---------------------------
function drawSea() {
  const c = new Canvas(W, H);
  c.gradientV(0, HORIZON, W, H - HORIZON, PAL.sea);
  for (let y = HORIZON + 1; y < H; y += 2) {
    const half = 4 + (y - HORIZON) * 0.35;
    for (let x = Math.round(SUN.x - half); x <= SUN.x + half; x++) {
      if (r() < 0.4) c.px(x, y, r() < 0.5 ? PAL.sunPath : PAL.sunPathWarm, 0.85);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(HORIZON + 3, H - 1);
    const len = r.int(2, 4 + Math.round((y - HORIZON) / 18));
    for (let k = 0; k < len; k++) c.px((x + k) % W, y, PAL.ripple, 0.4);
  }
  return c;
}

// ---- 4. glints.png — sparkles on the water (twinkle) -----------------------------------------
function drawGlints() {
  const c = new Canvas(W, H);
  for (let i = 0; i < 40; i++) {
    const near = r() < 0.6; // most glints sit in the sun's path
    const y = r.int(HORIZON + 2, H - 4);
    const x = near ? Math.round(SUN.x + (r() - 0.5) * (8 + (y - HORIZON) * 0.7)) : r.int(120, W - 1);
    c.px(x, y, PAL.glint);
    if (r() < 0.3) c.px(x + 1, y, PAL.glint, 0.6);
  }
  return c;
}

// ---- 5. pier.png — the wooden pier and her bucket ------------------------------
function drawPier() {
  const c = new Canvas(W, H);
  // posts down into the sea (behind the deck)
  for (const x of [6, 38, 70, 102]) {
    c.rect(x, DECK.top + DECK.thick, 5, H - DECK.top - DECK.thick, PAL.woodDark);
    c.rect(x + 3, DECK.top + DECK.thick, 1, H - DECK.top - DECK.thick, PAL.wood); // sunlit side
    // under the water: tint them towards the sea, with a ring of foam where they go in
    for (let y = WATERLINE; y < H; y++)
      for (let xx = x; xx < x + 5; xx++) c.px(xx, y, PAL.sea[4], 0.55);
    c.rect(x - 1, WATERLINE, 7, 1, PAL.foam);
    c.px(x - 2, WATERLINE + 1, PAL.foam, 0.6);
    c.px(x + 6, WATERLINE + 1, PAL.foam, 0.6);
  }
  // the deck: a thin sunlit top, plank ends along the front
  c.rect(0, DECK.top, DECK.right, 1, PAL.woodHi);
  c.rect(0, DECK.top + 1, DECK.right, DECK.thick - 1, PAL.wood);
  c.rect(0, DECK.top + DECK.thick - 1, DECK.right, 1, PAL.woodDark);
  for (let x = 4; x < DECK.right; x += 7) c.rect(x, DECK.top + 1, 1, DECK.thick - 2, PAL.woodDark);
  c.rect(DECK.right - 1, DECK.top, 1, DECK.thick, PAL.woodDeep);
  // a little rope railing along the start of the pier
  const rails = [8, 30, 52];
  for (const x of rails) {
    c.rect(x, DECK.top - 9, 2, 9, PAL.woodDark);
    c.px(x + 1, DECK.top - 9, PAL.woodHi);
  }
  for (let i = 0; i < rails.length - 1; i++) {
    const a = rails[i] + 1;
    const b = rails[i + 1];
    for (let x = a; x <= b; x++) {
      const t = (x - a) / (b - a);
      c.px(x, Math.round(DECK.top - 8 + Math.sin(t * Math.PI) * 2.5), PAL.rope);
    }
  }
  // her bucket
  const bx = 70;
  const by = DECK.top;
  ring(c, bx + 1, by - 8, 4, 3, PAL.bucketShade); // the handle (its lower half goes behind the bucket)
  c.rect(bx - 3, by - 7, 8, 7, PAL.bucket);
  c.rect(bx - 3, by - 7, 2, 7, PAL.bucketShade);
  c.rect(bx - 4, by - 8, 10, 1, PAL.bucketHi);
  c.rect(bx + 3, by - 6, 1, 4, PAL.bucketHi);

  // a soft shadow on the deck where she stands
  c.rect(HER_FEET.x - 7, DECK.top, 14, 1, PAL.woodDark);
  return c;
}

// ---- 6. her.png — her at the end of the pier, her dress moving in the breeze (frames) ---------
// Side-on, facing the sea (and the sun). Her head and legs are the usual
// figure(); the dress is drawn here in more detail: a fitted bodice with a
// scooped neck and puff sleeve, a ribbon sash tied in a bow at the back, and a
// pleated A-line skirt with a lace hem that the sea breeze blows back. The rod
// is drawn by the game from her hand (local 13, 29 = "scene.hand" in fishing.json).
const FIG = { w: 24, h: 48 };
const BREEZE = [0, 1, 2, 1]; // how far the skirt is blown back in each frame (a gentle loop)

function dimTowardsDusk(c, amount) {
  const dusk = [74, 52, 92];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const [rr, g, b, a] = c.get(x, y);
      if (!a) continue;
      c.clear(x, y);
      c.px(x, y, [rr, g, b].map((v, i) => Math.round(v + (dusk[i] - v) * amount)), a / 255);
    }
}

function drawDress(breeze) {
  const d = new Canvas(FIG.w, FIG.h);
  const D = PAL;

  // Skirt (y 28–37): front edge flares a little forward, the back billows out behind her.
  const skirtTop = 28;
  const hem = 37;
  for (let y = skirtTop; y <= hem; y++) {
    const t = (y - skirtTop) / (hem - skirtTop);
    const front = Math.round(15 + 2.5 * t);
    const back = Math.round(9 - (2.5 + breeze) * t ** 1.3);
    for (let x = back; x <= front; x++) {
      let color = D.dress;
      if (x <= back + 1) color = D.dressDeep; // the back of the skirt, away from the sun
      else if (x <= back + 2) color = D.dressShade;
      else if (x === front) color = D.dressRim; // lit by the sunset
      else if (x === front - 1) color = D.dressHi;
      d.px(x, y, color);
    }
    // pleats: soft folds fanning out from the waist, swinging back with the breeze
    if (y >= skirtTop + 2) {
      for (const k of [0, 1, 2]) {
        const px = Math.round(10.5 + k * 1.6 + (k * 1.1 - breeze * 0.6) * t);
        if (px > back + 2 && px < front - 1) {
          d.px(px, y, D.dressShade);
          if (y > skirtTop + 4) d.px(px + 1, y, D.dressHi);
        }
      }
    }
  }
  // lace hem: a cream band, with little scallops underneath
  const hemBack = Math.round(9 - (2.5 + breeze));
  const hemFront = Math.round(15 + 2.5);
  for (let x = hemBack; x <= hemFront; x++) {
    d.px(x, hem, D.lace);
    if ((x + breeze) % 2 === 0) d.px(x, hem + 1, D.lace);
  }
  d.px(hemBack, hem, D.laceShade);

  // Bodice (y 20–27): fitted, a curve at the front, back straight.
  const bodice = { 20: [10, 13], 21: [9, 15], 22: [9, 16], 23: [9, 16], 24: [9, 15], 25: [9, 15], 26: [9, 15], 27: [9, 15] };
  for (const [yy, [l, r]] of Object.entries(bodice)) {
    const y = Number(yy);
    for (let x = l; x <= r; x++) {
      let color = D.dress;
      if (x === l) color = D.dressShade;
      else if (x === r) color = D.dressRim;
      else if (x === r - 1 && y >= 22 && y <= 23) color = D.dressHi; // light on her chest
      d.px(x, y, color);
    }
  }
  d.px(14, 20, D.skin); // scooped neckline
  d.px(15, 21, D.skin);
  d.px(14, 21, D.lace); // a thin lace edge along it
  d.px(13, 20, D.lace);
  d.px(13, 25, D.dressShade); // a little seam down the front
  d.px(13, 26, D.dressShade);

  // Sash: a deeper-rose band at the waist (2 px), lit at the front.
  for (let x = 9; x <= 15; x++) {
    d.px(x, 26, x === 15 ? D.sashHi : D.sash);
    d.px(x, 27, x === 15 ? D.sash : D.sashDark);
  }
  // ...tied in a bow at the back: two loops either side of the knot, and two
  // tails that the breeze lifts out behind her.
  d.map(
    [
      '.ss...',
      'shs...',
      'shsK..',
      'ssKK..',
      'shs...',
      '.ss...',
    ],
    { s: D.sash, h: D.sashHi, K: D.sashDark },
    4, 24
  );
  for (let i = 0; i < 4; i++) {
    const lift = (i * (0.6 + breeze * 0.5)) | 0;
    d.px(7 - lift, 28 + i, i % 2 ? D.sashDark : D.sash); // tail
    if (i < 3) d.px(8 - lift, 28 + i, D.sashDark);
  }

  // Puff sleeve on her shoulder: round and light on top, a crease underneath.
  d.map(
    [
      '.hhh.',
      'dhhhh',
      'dhhhd',
      '.eee.',
    ],
    { h: D.dressHi, d: D.dress, e: D.dressDeep },
    10, 20
  );

  d.outline(D.outline);

  // Her arm, over the dress: down from the sleeve, elbow in, forearm forward to
  // her hand on the rod. A darker pink line around it keeps it apart from the dress.
  const arm = new Canvas(FIG.w, FIG.h);
  arm.rect(12, 24, 2, 3, D.skin);
  arm.px(12, 24, D.skinShade);
  arm.px(12, 25, D.skinShade);
  arm.rect(13, 27, 2, 2, D.skin);
  arm.px(13, 27, D.skinShade);
  arm.rect(13, 29, 2, 2, D.skin); // her hand (holds the rod)
  arm.px(13, 30, D.skinShade);
  for (let y = 23; y <= 31; y++)
    for (let x = 10; x <= 16; x++) {
      if (arm.get(x, y)[3]) continue;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => arm.get(x + dx, y + dy)[3]);
      if (touches && d.get(x, y)[3] && y > 23) d.px(x, y, D.dressDeep);
    }
  d.blit(arm, 0, 0);
  return d;
}

function drawHer() {
  const sheet = new Canvas(W * BREEZE.length, H);
  BREEZE.forEach((breeze, f) => {
    const her = figure({ ...HER, view: 'side' });
    // take away the plain dress and arm (rows 20–37); keep her head, hair and legs
    for (let y = 20; y <= 37; y++) for (let x = 0; x < FIG.w; x++) her.clear(x, y);
    her.blit(drawDress(breeze), 0, 0);
    rimLight(her, PAL.sunlight, 0.25);
    dimTowardsDusk(her, 0.1);
    sheet.blit(her, f * W + HER_FEET.x - 12, HER_FEET.y - 47);
  });
  return sheet;
}

// ---- Sprites ----------------------------------------------------------------------------------
const SPRITE_PAL = {
  k: PAL.woodDeep, p: PAL.outline, r: PAL.bobberRed, R: PAL.bobberRedHi, w: PAL.bobberWhite, W: PAL.bobberShade,
};

/** bobber.png — 7x9, red cap, white bottom. The game shows only the top 6 rows while it floats. */
function drawBobber() {
  const c = new Canvas(7, 9);
  c.map(
    [
      '...k...',
      '...k...',
      '..prp..',
      '.pRrrp.',
      '.prrrp.',
      '.pwwwp.',
      '.pwWwp.',
      '..pWp..',
      '...p...',
    ],
    SPRITE_PAL
  );
  return c;
}

/** ripple.png — 3 frames (17x6 each) of a ring spreading out on the water. */
function drawRipple() {
  const fw = 17;
  const c = new Canvas(fw * 3, 6);
  [[3, 1, 1], [5.5, 1.6, 0.9], [7.5, 2.2, 0.6]].forEach(([rx, ry, a], f) => {
    ring(c, f * fw + 8, 3, rx, ry, PAL.glint, a);
  });
  return c;
}

/** bubble.png — 2 frames (5x5 each): a small bubble and a big one. */
function drawBubble() {
  const c = new Canvas(10, 5);
  // small
  c.px(2, 1, PAL.bubble); c.px(1, 2, PAL.bubble); c.px(3, 2, PAL.bubble); c.px(2, 3, PAL.bubble);
  c.px(1, 1, PAL.bubbleHi);
  // big
  ring(c, 7, 2, 2, 2, PAL.bubble);
  c.px(6, 1, PAL.bubbleHi);
  return c;
}

/** envelope.png — 15x11, sealed with a heart. */
function drawEnvelope() {
  const c = new Canvas(15, 11);
  c.rect(1, 1, 13, 9, PAL.envelope);
  // the flap: a "V" from the top corners to the middle
  for (let x = 1; x <= 13; x++) {
    const y = 1 + Math.round(4 - Math.abs(x - 7) * (4 / 6));
    c.px(x, y, PAL.envelopeShade);
  }
  c.rect(1, 9, 13, 1, PAL.envelopeShade);
  // heart seal
  c.map(['r.r', 'RrR', '.r.'].map((s) => s), { r: PAL.seal, R: PAL.sealHi }, 6, 4);
  c.outline(PAL.outline);
  return c;
}

/** seaweed.png — 13x18, a dripping clump of seaweed hanging from the hook (top middle). */
function drawSeaweed() {
  const c = new Canvas(13, 18);
  const fronds = [
    { x: 6, len: 15, sway: 2.2, phase: 0, color: PAL.weed },
    { x: 4, len: 11, sway: -2.5, phase: 1, color: PAL.weedDark },
    { x: 8, len: 12, sway: 2.8, phase: 2, color: PAL.weedDark },
    { x: 5, len: 13, sway: -1.6, phase: 3, color: PAL.weed },
  ];
  for (const f of fronds) {
    for (let y = 1; y <= f.len; y++) {
      const x = 6 + (f.x - 6) * (y / f.len) + Math.sin(y * 0.6 + f.phase) * (f.sway * y) / f.len;
      c.rect(Math.round(x), y, 2, 1, f.color);
      if (y % 4 === 2) c.px(Math.round(x), y, PAL.weedHi);
    }
  }
  c.rect(5, 0, 3, 2, PAL.weedDark); // the knot on the hook
  c.outline(PAL.outline);
  c.px(3, 16, PAL.drip);
  c.px(9, 15, PAL.drip);
  return c;
}

/** paper.png — 16x16 nine-slice letter paper (4 px corners): rose edge, peach inner line. */
function drawPaper() {
  const c = new Canvas(16, 16);
  c.rect(1, 0, 14, 16, PAL.paperEdge);
  c.rect(0, 1, 16, 14, PAL.paperEdge);
  c.rect(1, 1, 14, 14, PAL.paper);
  c.rect(2, 2, 12, 1, PAL.paperInner);
  c.rect(2, 13, 12, 1, PAL.paperInner);
  c.rect(2, 2, 1, 12, PAL.paperInner);
  c.rect(13, 2, 1, 12, PAL.paperInner);
  c.rect(1, 14, 14, 1, PAL.paperShade);
  return c;
}

// ---- The map: a "Fishing" spot at the end of the pier --------------------------------------
// The pier is tiles x 2–7, y 13–14; the spot is its last two tiles.
const SPOT = { x: 2, y: 13, w: 2, h: 2 };

function addFishingSpot() {
  const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  const T = map.tilewidth;
  let layer = map.layers.find((l) => l.name === 'Fishing');
  if (!layer) {
    layer = {
      id: map.nextlayerid++, name: 'Fishing', type: 'objectgroup', draworder: 'topdown',
      opacity: 1, visible: true, x: 0, y: 0, objects: [],
    };
    // Keep it just below Triggers so it's easy to find in Tiled.
    const at = map.layers.findIndex((l) => l.name === 'Triggers');
    map.layers.splice(at === -1 ? map.layers.length : at + 1, 0, layer);
  }
  layer.objects = [{
    id: map.nextobjectid++, name: 'end of the pier', type: '',
    x: SPOT.x * T, y: SPOT.y * T, width: SPOT.w * T, height: SPOT.h * T, rotation: 0, visible: true,
  }];
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1));
  console.log(`  map      Fishing spot at tiles x ${SPOT.x}–${SPOT.x + SPOT.w - 1}, y ${SPOT.y}–${SPOT.y + SPOT.h - 1}`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing the pier at sunset…');
const layers = { sky: drawSky(), clouds: drawClouds(), sea: drawSea(), glints: drawGlints(), pier: drawPier(), her: drawHer() };
const sprites = {
  bobber: drawBobber(), ripple: drawRipple(), bubble: drawBubble(),
  envelope: drawEnvelope(), seaweed: drawSeaweed(), paper: drawPaper(),
};
for (const [name, canvas] of Object.entries({ ...layers, ...sprites })) save(path.join(OUT, `${name}.png`), canvas);
addFishingSpot();

// Preview: the layers, plus the rod, line, bobber and a few bubbles mid-bite.
const flat = new Canvas(W, H);
for (const layer of Object.values(layers)) flat.blit(layer, 0, 0);
const hand = { x: 97, y: 104 };
const tip = { x: 131, y: 76 };
const bob = { x: 214, y: 134 };
for (let i = 0; i <= 40; i++) {
  const t = i / 40;
  flat.px(hand.x + (tip.x - hand.x) * t, hand.y + (tip.y - hand.y) * t, i < 8 ? '#c9a27a' : PAL.woodDeep);
}
for (let i = 0; i <= 120; i++) {
  const t = i / 120;
  const sag = Math.sin(t * Math.PI) * 10;
  flat.px(tip.x + (bob.x - tip.x) * t, tip.y + (bob.y - tip.y) * t + sag, PAL.glint, 0.8);
}
const bobberTop = new Canvas(7, 6);
bobberTop.blit(sprites.bobber, 0, 0);
flat.blit(bobberTop, bob.x - 3, bob.y - 5);
const rippleFrame = new Canvas(17, 6);
rippleFrame.blit(sprites.ripple, -17, 0); // frame 2
flat.blit(rippleFrame, bob.x - 8, bob.y - 2);
for (const [dx, dy] of [[-6, -3], [5, -6], [8, -1]]) flat.blit(sprites.bubble, bob.x + dx - 7, bob.y + dy);
writePreview('fishing.png', flat);
console.log('  preview  tools/previews/fishing.png');
