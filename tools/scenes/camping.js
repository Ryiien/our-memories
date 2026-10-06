#!/usr/bin/env node
// -----------------------------------------------------------------------------
// camping.js — draws the "Camping by the waterfall" memory as layered pixel
// art: a starry night at our campsite, the two of us in camping chairs either
// side of the firepit (the round steel ring on a concrete pad, with the
// swing-out grill plate, from the photo), our red dome tent with its door unzipped and a lantern inside,
// a faded row of trees, and the waterfall pouring down the sandstone cliff
// behind us. She's toasting a marshmallow; he takes a drag on a joint and breathes the
// smoke out into the dark.
// Also stamps a little campsite (tent, chairs, a crackling fire) onto the map,
// with its trigger, right of the momo hiding under the tree in the bottom-left
// — only the first time.
//
//   npm run scene:camping                      # (re)draw everything
//   npm run scene:camping -- --keep us,tent    # don't overwrite layers you've redrawn
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/memories/camping/*.png   the cutscene layers
//   public/assets/tiles/campsite.png       the campsite for the map (5x3 tiles, 3 fire frames)
//   tools/previews/camping.png             flattened preview (3x size)
//   tools/previews/camping-map.png         the map campsite on grass (3x size)
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas, rng, bayer, hexToRgb } from '../lib/canvas.js';
import { ROOT, makeSaver, thickLine, softEllipse, writePreview, stampBuilding, blobsIn, foliage } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // night sky, top to bottom
  sky: ['#0f1027', '#13152e', '#1b1d40', '#272a57', '#3a3a6e'],
  moon: '#fff3dc',
  moonShade: '#efdcc0',
  stars: ['#fff3dc', '#ffffff', '#f6d983', '#b8a6d9', '#fff3dc'],
  // the sandstone cliff, in moonlight (dark to light) + its ledges
  rock: ['#2e2438', '#3e2f45', '#4d3a4f', '#5e4656', '#6f525c'],
  ledge: '#9a7a7a', // moonlit tops of the ledges
  ledgeShadow: '#221a2c', // under the overhangs
  wetRock: '#2a2236',
  // the waterfall
  water: ['#6f78ac', '#a9b4d6', '#dfe6f5'],
  mist: '#c9d2ec',
  // the bush (eucalypts, scrub) — dark, cool
  leaves: ['#141c26', '#1c2a30', '#27393b', '#365049'],
  bark: '#7c7590',
  barkShade: '#555068',
  barkHi: '#a39cb4',
  // the row of trees between the campsite and the cliff, faded by the night mist
  treeline: ['#252a48', '#2e3556', '#3a4363', '#4b5574'],
  treelineBark: '#5a5d80',
  haze: '#4a4f7a',
  // the campsite
  dirt: ['#2a2130', '#3a2c38', '#4a3840'],
  litter: ['#5c4648', '#6e5450', '#2a2130'],
  pad: '#6c6676', // concrete pad under the firepit
  padHi: '#8a8392',
  padShade: '#4a4454',
  // the firepit: rusty steel ring, logs, the swing-out grill plate
  steel: '#6a3a2e',
  steelShade: '#45261f',
  steelHi: '#b0623a', // its rim, lit by the fire
  pitInside: '#2a1a1e',
  log: '#3e2a26',
  logHi: '#6a4632',
  coal: '#f08a3c',
  coalHot: '#ffd27a',
  grill: '#2c2630',
  grillHi: '#5a5262',
  // fire
  flame: ['#c8462f', '#ef7d32', '#f6b14a', '#fde3a0'],
  fireLight: '#f3a35a',
  fireGlow: '#f08a3c',
  // the tent: our red dome, lit up from inside like in the photo (dark edges to bright middle)
  tentRed: ['#3e0a12', '#6e1018', '#a3141f', '#d0202a', '#ee3a3a'],
  tentSeam: '#3a0812',
  tentGlow: '#e0343a', // the red light it throws on the ground
  groundsheet: '#a39cab',
  tentInside: '#2a0e16',
  lantern: '#f6d983',
  rope: '#8a8496',
  // camping chairs: hers the bright blue one from the photo, his navy
  herChair: '#2f86a8',
  herChairShade: '#1f5f7a',
  himChair: '#2b3550',
  himChairShade: '#1d2338',
  chairFrame: '#7d8294',
  // her: pink bob with dark roots, olive skin, light-pink dress, white shoes
  herHair: '#e0607e',
  herHairHi: '#f08aa3',
  herHairShade: '#b84a66',
  herRoots: '#2e2230',
  herSkin: '#d9a47c',
  herSkinShade: '#bf8862',
  herBlush: '#e0877a',
  herDress: '#f59ac4',
  herDressShade: '#d877a6',
  herDressHi: '#f8b6d6',
  herDressDeep: '#b9608f', // the crease under her puff sleeve
  lace: '#fff3dc', // lace neckline + hem
  laceShade: '#efdcc0',
  sash: '#9e4a5c', // her sash...
  sashDark: '#7e3a4a',
  sashLoop: '#c46a80', // ...tied in a bow at the back
  sashLoopHi: '#e58f9e',
  herShoes: '#ffffff',
  piercing: '#e4e8f2',
  // him: short black hair with a fringe, open brown jacket, white shirt, jeans
  himHair: '#231c24',
  himHairHi: '#4a3d4a',
  himSkin: '#ecbf9f',
  himSkinShade: '#d6a585',
  himBlush: '#e09c84',
  jacket: '#8a5a3c',
  jacketShade: '#64402c',
  jacketHi: '#ab7a52',
  shirt: '#f4f1ea',
  jeans: '#5b7bb5',
  jeansShade: '#465f94',
  jeansHi: '#7a96c8',
  belt: '#2e2220',
  himShoes: '#3b3550',
  himShoesHi: '#5a5470', // laces
  himSole: '#e2ddd2',
  // her marshmallow stick (held out over the fire from her armrest)
  stick: '#6b4a36',
  mallow: '#f6efe4',
  mallowToast: '#d9a066',
  // his joint + its smoke
  paper: '#efe6d6',
  ember: '#f08a3c',
  emberHot: '#ffd27a',
  smoke: '#c9c4d6',
  eye: '#2a1f2a',
  outline: '#2a1f2a',
  vignette: '#0b0c1e',
  // the map campsite (daytime, like the rest of the map)
  mapDirt: '#c4a273',
  mapDirtDark: '#a98a62',
  mapGrassDark: '#4f8a50',
};
const NIGHT = '#26284f'; // people + tent are tinted towards this, a little

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const PI = Math.PI;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'camping');
const save = makeSaver();
const r = rng(1910); // one generator for the whole scene, so it comes out the same every run

const MOON = { x: 46, y: 22 };
const FALL = { x: 251, top: 0, bottom: 104 }; // the waterfall (top is worked out from the cliff)
const BUSH_Y = 104; // the bush line along the bottom of the cliff
const PIT = { x: 160, y: 116, rx: 16, ry: 4.5, wall: 8 }; // centre of the firepit's top opening
const SEAT_Y = 118; // top of the chair seats
const GROUND_Y = 131; // where the chair legs stand
const HER_HIP = 114;
const HIM_HIP = 206; // (he's drawn facing right at W-1-206, then mirrored to face her)

// The top edge of the cliff: a wobbly skyline, dipping a little where the water pours over.
const cliffTop = (x) =>
  Math.round(46 + Math.sin(x * 0.029 + 0.6) * 5 + Math.sin(x * 0.11) * 1.6 + (Math.abs(x - FALL.x) < 9 ? 3 : 0));
FALL.top = cliffTop(FALL.x) + 1;

const mix = (a, b, t) => {
  const A = typeof a === 'string' ? hexToRgb(a) : a;
  const B = typeof b === 'string' ? hexToRgb(b) : b;
  return A.map((v, i) => Math.round(v + (B[i] - v) * t));
};

/** Blend every opaque pixel towards `color` by `t` (night-time dimming). */
function tint(c, color, t) {
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const [rr, g, b, a] = c.get(x, y);
      if (!a) continue;
      const i = (y * c.width + x) * 4;
      const out = mix([rr, g, b], color, t);
      c.data[i] = out[0];
      c.data[i + 1] = out[1];
      c.data[i + 2] = out[2];
    }
}

/** Firelight from one side: brighten the edge pixels facing `dir` (+1 = right). */
function sideLight(c, dir, color, amount, depth = 2) {
  const copy = new Canvas(c.width, c.height);
  copy.data.set(c.data);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      if (!copy.get(x, y)[3]) continue;
      for (let d = 1; d <= depth; d++) {
        if (!copy.get(x + dir * d, y)[3]) {
          c.px(x, y, color, amount / d);
          break;
        }
      }
    }
}

/** Left-right mirror image of a canvas. */
function mirror(src) {
  const out = new Canvas(src.width, src.height);
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const [rr, g, b, a] = src.get(x, y);
      if (a) out.px(src.width - 1 - x, y, [rr, g, b], a / 255);
    }
  return out;
}

// ---- 1. sky.png — night sky and the moon ------------------------------------------------
function drawSky() {
  const c = new Canvas(W, H);
  c.gradientV(0, 0, W, 90, PAL.sky);
  c.rect(0, 90, W, H - 90, PAL.sky[PAL.sky.length - 1]);
  c.circle(MOON.x, MOON.y, 7, PAL.moon);
  c.circle(MOON.x - 2, MOON.y - 2, 1.5, PAL.moonShade);
  c.circle(MOON.x + 2, MOON.y + 3, 1.2, PAL.moonShade);
  c.px(MOON.x + 3, MOON.y - 3, PAL.moonShade);
  return c;
}

// ---- 2. stars.png (twinkle) -----------------------------------------------------------------
function drawStars() {
  const c = new Canvas(W, H);
  for (let i = 0; i < 120; i++) {
    const x = r.int(2, W - 3);
    const y = r.int(2, 60);
    if (Math.hypot(x - MOON.x, y - MOON.y) < 16 || y > cliffTop(x) - 4) continue;
    const color = r.pick(PAL.stars);
    c.px(x, y, color);
    if (r() < 0.12) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.px(x + dx, y + dy, color, 0.5);
    }
  }
  return c;
}

// ---- 3. glow.png — the moon's halo (pulse) ----------------------------------------------------
function drawGlow() {
  const c = new Canvas(W, H);
  c.glow(MOON.x, MOON.y, 24, PAL.moon, 0.28);
  return c;
}

// ---- 4. cliff.png — layered sandstone, ledges catching the moonlight ---------------------------
function drawCliff() {
  const c = new Canvas(W, H);
  // strata boundaries (each wobbles a little along its length)
  const bands = [52, 58, 65, 71, 79, 86, 93, 99];
  const boundary = (i, x) => bands[i] + Math.round(Math.sin(x * 0.045 + i * 1.9) * 1.6 + Math.sin(x * 0.17 + i) * 0.7);
  const bandAt = (x, y) => {
    let i = 0;
    while (i < bands.length && y >= boundary(i, x)) i++;
    return i;
  };
  // which stretches of each ledge catch the light (broken, not ruler-straight)
  const lit = bands.map((_, i) => Array.from({ length: W }, (_, x) => Math.sin(x * 0.09 + i * 3.1) + Math.sin(x * 0.023 + i) > -0.6));

  for (let x = 0; x < W; x++) {
    for (let y = cliffTop(x); y < BUSH_Y + 6; y++) {
      const band = bandAt(x, y);
      // each band has its own tone; moonlight from the left, lighter higher up
      const tone = [3, 2, 3, 2, 3, 1, 2, 1, 1][band] + (x < 140 ? 0.4 : 0) - (y > 95 ? 0.6 : 0);
      const v = tone + (bayer(x, y) - 0.5) * 0.9 + Math.sin(x * 0.3 + band * 7) * 0.25;
      c.px(x, y, PAL.rock[Math.max(0, Math.min(PAL.rock.length - 1, Math.round(v)))]);
    }
    // the very top edge: a lit lip
    c.px(x, cliffTop(x), PAL.ledge);
    // ledges: shadow under the overhang, light on the top of the ledge below
    bands.forEach((_, i) => {
      const yb = boundary(i, x);
      if (yb <= cliffTop(x) + 1) return;
      c.px(x, yb - 1, PAL.ledgeShadow);
      if (lit[i][x]) c.px(x, yb, PAL.ledge, 0.75);
    });
  }
  // vertical cracks and joints between blocks
  for (let i = 0; i < 46; i++) {
    const x = r.int(2, W - 3);
    const b = r.int(0, bands.length - 2);
    const y0 = boundary(b, x) + 1;
    const y1 = boundary(b + 1, x) - 2;
    if (y0 <= cliffTop(x) + 2) continue;
    for (let y = y0; y <= y1; y++) c.px(x, y, PAL.ledgeShadow, 0.8);
  }
  // dark, wet rock behind the falling water
  for (let y = FALL.top; y < BUSH_Y + 6; y++) {
    const half = 7 + (y - FALL.top) * 0.06;
    for (let x = Math.round(FALL.x - half); x <= FALL.x + half; x++) c.px(x, y, PAL.wetRock, 0.85);
  }
  // scrubby bushes along the top of the cliff
  const scrub = [];
  for (let x = 0; x < W; x += r.int(5, 11)) {
    if (Math.abs(x - FALL.x) < 8 || r() < 0.3) continue;
    scrub.push(...blobsIn(r, x, cliffTop(x) - 1, 4, 1.5, 3, 1.5, 3.2));
  }
  foliage(c, scrub, PAL.leaves, 1911, { sun: 'left' });
  return c;
}

// ---- 5. waterfall.png — falling water, catching the moon (4 frames) --------------------------
function drawWaterfall() {
  const FR = 4;
  const sheet = new Canvas(W * FR, H);
  for (let f = 0; f < FR; f++) {
    const c = new Canvas(W, H);
    for (let y = FALL.top; y <= FALL.bottom; y++) {
      const t = (y - FALL.top) / (FALL.bottom - FALL.top);
      const half = 3.5 + t * 3.5; // spreads as it falls
      for (let x = Math.round(FALL.x - half); x <= Math.round(FALL.x + half); x++) {
        const edge = Math.abs(x - FALL.x) / half; // 0 middle .. 1 edge
        // streaks that slide down a few pixels each frame
        const s = (x * 37 + Math.floor((y - f * 4) / 3) * 13 + (x % 3) * 5) % 7;
        const level = s < 2 ? 2 : s < 5 ? 1 : 0;
        const alpha = edge > 0.8 ? 0.45 : 0.9;
        if (edge > 0.8 && (x + y + f) % 2) continue; // ragged, see-through edges
        c.px(x, y, PAL.water[Math.max(0, level - (edge > 0.6 ? 1 : 0))], alpha);
      }
    }
    // white water pouring over the lip
    for (let x = FALL.x - 4; x <= FALL.x + 4; x++) c.px(x, FALL.top, PAL.water[2]);
    // spray where it hits the pool (most of it hidden behind the bushes)
    for (let i = 0; i < 40; i++) {
      const a = ((i * 2.39 + f * 0.7) % (PI * 2)) - PI;
      const d = ((i * 7 + f * 3) % 11) + 2;
      const x = Math.round(FALL.x + Math.cos(a) * d * 1.3);
      const y = Math.round(FALL.bottom - 3 - Math.abs(Math.sin(a)) * d * 0.6);
      c.px(x, y, PAL.mist, 0.5);
    }
    softEllipse(c, FALL.x, FALL.bottom - 2, 14, 5, PAL.mist, 0.35);
    sheet.blit(c, f * W, 0);
  }
  return sheet;
}

// ---- 5b. treeline.png — a faded row of trees between the campsite and the cliff -----------------
// Cool and pale next to the warm rock, and fading into the night mist towards
// the ground, so it reads as further back than the campsite. Shorter in front
// of the waterfall, so the water still shows.
function drawTreeline() {
  const c = new Canvas(W, H);
  const rr = rng(1915);
  const base = BUSH_Y + 5; // hidden behind the scrub and the ground from here down
  const trees = [];
  for (let x = -6; x < W + 6; x += rr.int(10, 16)) {
    const near = Math.abs(x - FALL.x) < 18;
    trees.push({ x, top: near ? rr.int(90, 94) : rr.int(64, 78), lean: rr.range(-1, 1) });
  }
  // thin pale trunks first, so they peek out between the crowns
  for (const t of trees) {
    for (let y = t.top + 8; y < base; y++) {
      const tx = Math.round(t.x + t.lean * (base - y) * 0.08);
      c.rect(tx, y, 2, 1, PAL.treelineBark);
    }
  }
  // the crowns: a few ragged clumps each (gums are open, not round), then a
  // low band of scrub joining the row together along the bottom
  trees.forEach((t, i) => {
    const h = base - t.top;
    const blobs = [];
    for (let k = 0; k < 3; k++) {
      const cx = t.x + t.lean * 2 + rr.int(-7, 7);
      const cy = t.top + 4 + rr.range(0, h * 0.45);
      blobs.push(...blobsIn(rr, cx, cy, 6, 3, 5, 2, 4.5));
    }
    foliage(c, blobs, PAL.treeline, 1916 + i, { sun: 'left' });
  });
  const under = [];
  for (let x = -4; x < W + 4; x += 5) {
    if (Math.abs(x - FALL.x) < 12) continue; // leave the pool under the waterfall clear
    under.push(...blobsIn(rr, x, base - 7, 3, 2, 2, 2.5, 4.5));
  }
  foliage(c, under, PAL.treeline, 1915, { sun: 'left' });
  // night mist: everything fades into the haze, more towards the ground
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [rr2, g, b, a] = c.get(x, y);
      if (!a) continue;
      const low = Math.max(0, Math.min(1, (y - 70) / (base - 70)));
      const t = 0.18 + low * 0.4 + (bayer(x, y) - 0.5) * 0.12;
      const out = mix([rr2, g, b], PAL.haze, Math.max(0, Math.min(1, t)));
      const i = (y * W + x) * 4;
      c.data[i] = out[0];
      c.data[i + 1] = out[1];
      c.data[i + 2] = out[2];
    }
  return c;
}

// ---- 6. trees.png — gum trees either side, scrub along the cliff's foot (sway) ----------------
function gum(c, x, lean, seed) {
  // a pale, smooth trunk going up out of frame, a fork, a dark crown at the top
  for (let y = 0; y <= 112; y++) {
    const cx = Math.round(x + lean * (112 - y) * 0.06);
    const w = y > 106 ? 9 : 6;
    c.rect(cx - w / 2, y, w, 1, PAL.bark);
    c.rect(cx - w / 2, y, 2, 1, PAL.barkHi); // moonlight from the left
    c.rect(cx + w / 2 - 2, y, 2, 1, PAL.barkShade);
    if ((y * 7 + x) % 13 === 0) c.rect(cx - 1, y, 3, 1, PAL.barkShade); // peeling bark
  }
  const rr = rng(seed);
  foliage(c, blobsIn(rr, x + lean * 6, 6, 26, 14, 22, 5, 9), PAL.leaves, seed, { sun: 'left' });
}

function drawTrees() {
  const c = new Canvas(W, H);
  // scrub along the foot of the cliff (a little lower in front of the pool)
  const scrub = [];
  for (let x = -6; x < W + 6; x += 7) {
    const near = Math.abs(x - FALL.x) < 14;
    scrub.push(...blobsIn(r, x, BUSH_Y + (near ? 3 : 0), 6, 3, 3, near ? 3 : 4, near ? 5 : 7));
  }
  foliage(c, scrub, PAL.leaves, 1912, { sun: 'left' });
  gum(c, 10, 1, 1913);
  gum(c, 306, -1, 1914);
  return c;
}

// ---- 7. ground.png — the campsite clearing and the concrete pad --------------------------------
function drawGround() {
  const c = new Canvas(W, H);
  c.gradientV(0, BUSH_Y + 2, W, H - BUSH_Y - 2, [PAL.dirt[0], PAL.dirt[1], PAL.dirt[2], PAL.dirt[1]]);
  // leaf litter, twigs and a few tufts of grass, bigger towards us
  for (let i = 0; i < 260; i++) {
    const y = r.int(BUSH_Y + 4, H - 1);
    const x = r.int(0, W - 1);
    const near = (y - BUSH_Y) / (H - BUSH_Y);
    const col = r.pick(PAL.litter);
    c.px(x, y, col);
    if (near > 0.35 && r() < 0.5) c.px(x + 1, y, col); // a gum leaf
    if (r() < 0.06) c.line(x, y, x + r.int(3, 7), y + r.int(-1, 1), PAL.litter[1]); // a twig
    if ((x < 60 || x > 270) && r() < 0.2) {
      c.px(x, y - 1, PAL.leaves[2]);
      c.px(x - 1, y - 2, PAL.leaves[3]);
      c.px(x + 1, y - 2, PAL.leaves[2]);
    }
  }
  // the round concrete pad the firepit stands on
  c.ellipse(PIT.x, PIT.y + 7, 34, 9, PAL.padShade);
  c.ellipse(PIT.x, PIT.y + 6, 33, 8, PAL.pad);
  for (let x = PIT.x - 30; x <= PIT.x + 30; x++) {
    const dy = Math.round(8 * Math.sqrt(Math.max(0, 1 - ((x - PIT.x) / 33) ** 2)));
    c.px(x, PIT.y + 6 - dy, PAL.padHi); // its back edge
  }
  for (let i = 0; i < 30; i++) c.px(PIT.x + r.int(-28, 28), PIT.y + 6 + r.int(-5, 6), PAL.padShade, 0.6); // ash + scuffs
  return c;
}

// ---- 8. tent.png — our red dome tent, door unzipped, a lantern glowing inside -------------------
const TENT = { x: 52, base: 114, rx: 34, h: 32 };

function drawTent() {
  const c = new Canvas(W, H);
  // the red light it throws on the ground around it
  softEllipse(c, TENT.x, TENT.base + 1, TENT.rx + 20, 7, PAL.tentGlow, 0.3);
  c.glow(TENT.x, TENT.base - 12, TENT.rx + 12, PAL.tentGlow, 0.14);
  softEllipse(c, TENT.x + 2, TENT.base + 1, TENT.rx + 4, 3, PAL.outline, 0.5);
  // guy ropes out to the pegs
  c.line(TENT.x - TENT.rx + 4, TENT.base - 18, TENT.x - TENT.rx - 10, TENT.base + 2, PAL.rope, 0.6);
  c.line(TENT.x + TENT.rx - 4, TENT.base - 18, TENT.x + TENT.rx + 10, TENT.base + 2, PAL.rope, 0.6);
  // the dome: steep sides, a rounded top
  const top = (x) => TENT.base - Math.round(TENT.h * Math.pow(Math.max(0, 1 - ((x - TENT.x) / TENT.rx) ** 2), 0.55));
  const apex = top(TENT.x);
  const n = PAL.tentRed.length - 1;
  for (let x = TENT.x - TENT.rx; x <= TENT.x + TENT.rx; x++) {
    for (let y = top(x); y < TENT.base; y++) {
      // brightest in the middle, where the light inside shines through the fabric
      const d = Math.hypot((x - TENT.x) / TENT.rx, (y - (TENT.base - 11)) / TENT.h);
      const v = (1 - d) * n * 1.25 + 0.6 + (bayer(x, y) - 0.5) * 0.9;
      c.px(x, y, PAL.tentRed[Math.max(0, Math.min(n, Math.round(v)))]);
    }
    c.px(x, top(x), PAL.tentRed[1]); // its edge against the night
  }
  // seams: two curving down from the top to the pegged-out corners...
  for (const sgn of [-1, 1]) {
    for (let k = 0; k <= 60; k++) {
      const t = k / 60;
      const x = Math.round(TENT.x + sgn * TENT.rx * 0.82 * Math.sin((t * PI) / 2));
      const y = Math.round(apex + (TENT.base - 1 - apex) * t * t);
      c.px(x, y, PAL.tentSeam, 0.8);
    }
  }
  // ...and the pole down the middle of the front, catching the light on one side
  for (let y = apex; y < TENT.base; y++) {
    c.px(TENT.x, y, PAL.tentSeam);
    c.px(TENT.x + 1, y, PAL.tentRed[n], 0.7);
  }
  // the pale groundsheet peeking out along the bottom
  c.rect(TENT.x - Math.round(TENT.rx * 0.6), TENT.base - 1, Math.round(TENT.rx * 1.2), 1, PAL.groundsheet);
  c.rect(TENT.x - TENT.rx, TENT.base, TENT.rx * 2 + 1, 1, PAL.tentRed[0]);
  // the door: the zip down the middle, undone at the bottom and one side
  // pulled back a little, so you can see the lantern on the floor inside
  const door = { top: TENT.base - 20, open: 7 }; // where the zip's undone to, how far it's pulled back
  for (let y = door.top; y < TENT.base - 1; y++) {
    const w = Math.round(door.open * ((y - door.top) / (TENT.base - door.top)) ** 1.3);
    for (let x = TENT.x + 1; x <= TENT.x + w; x++) c.px(x, y, PAL.tentInside);
    c.px(TENT.x + w + 1, y, PAL.tentRed[n]); // the edge of the pulled-back flap, catching the light
  }
  const lamp = { x: TENT.x + 2, y: TENT.base - 2 }; // its bottom-left, on the groundsheet
  c.glow(lamp.x + 1, lamp.y - 2, 8, PAL.lantern, 0.5);
  c.rect(lamp.x, lamp.y - 3, 3, 3, PAL.lantern);
  c.rect(lamp.x, lamp.y - 4, 3, 1, PAL.grillHi); // its lid
  c.px(lamp.x + 1, lamp.y - 5, PAL.grillHi); // and handle
  tint(c, NIGHT, 0.06);
  sideLight(c, 1, PAL.fireLight, 0.3, 2);
  return c;
}

// ---- 9. firelight.png — the warm glow of the fire on everything (pulse) -----------------------
function drawFirelight() {
  const c = new Canvas(W, H);
  softEllipse(c, PIT.x, PIT.y - 4, 120, 46, PAL.fireGlow, 0.28);
  softEllipse(c, PIT.x, PIT.y - 4, 60, 26, PAL.fireLight, 0.22);
  return c;
}

// ---- 10. pit.png — the back of the firepit, the logs, the grill plate swung out -------------
const ringY = (x, sign) => PIT.y + sign * PIT.ry * Math.sqrt(Math.max(0, 1 - ((x - PIT.x) / PIT.rx) ** 2));

function drawPit() {
  const c = new Canvas(W, H);
  // the grill: a short post behind the right of the ring, an arm, and the
  // flat plate swung out beside the ring at about rim height (like the photo)
  const post = { x: PIT.x + 13, top: PIT.y - 11 };
  c.rect(post.x, post.top, 2, PIT.y - post.top, PAL.grill);
  c.px(post.x, post.top, PAL.grillHi);
  c.rect(post.x, post.top + 1, 6, 1, PAL.grill); // the arm
  for (let i = 0; i < 5; i++) {
    const x0 = post.x + 5 - i; // seen a little from above: a slanted slab
    c.rect(x0, post.top + i, 13, 1, i === 0 ? PAL.grillHi : PAL.grill);
    c.px(x0 + 12, post.top + i, PAL.grillHi); // its lit edge
  }
  for (let x = post.x + 6; x < post.x + 16; x += 3) c.line(x, post.top + 1, x - 2, post.top + 3, PAL.grillHi, 0.5); // slots
  c.rect(post.x + 16, post.top + 2, 3, 1, PAL.grill); // the handle
  // the inside of the ring: dark steel, glowing at the bottom
  for (let x = PIT.x - PIT.rx; x <= PIT.x + PIT.rx; x++) {
    const yb = Math.round(ringY(x, -1));
    for (let y = yb; y <= Math.round(ringY(x, 1)); y++) c.px(x, y, PAL.pitInside);
    c.px(x, yb, PAL.steelHi); // the far rim
    c.px(x, yb + 1, PAL.steelShade);
  }
  // logs criss-crossed in the middle, glowing coals between
  thickLine(c, PIT.x - 11, PIT.y + 2, PIT.x + 8, PIT.y - 2, 3, PAL.log);
  thickLine(c, PIT.x - 7, PIT.y - 2, PIT.x + 11, PIT.y + 2, 3, PAL.log);
  c.line(PIT.x - 10, PIT.y + 1, PIT.x + 6, PIT.y - 2, PAL.logHi);
  for (let i = 0; i < 18; i++) c.px(PIT.x + r.int(-12, 12), PIT.y + r.int(-1, 3), r() < 0.4 ? PAL.coalHot : PAL.coal);
  return c;
}

// ---- 11. fire.png — the flames (4 frames) ----------------------------------------------------
function flameTongue(c, x, base, h, sway, scale) {
  for (let y = 0; y <= h; y++) {
    const t = y / h;
    const half = Math.pow(1 - t, 0.8) * 4.5 * scale;
    const cx = x + sway * t * t;
    for (let i = 0; i < PAL.flame.length; i++) {
      const w = half * (1 - i * 0.24);
      if (w <= 0.3 || t > 1 - i * 0.18) continue;
      for (let px = Math.round(cx - w); px <= Math.round(cx + w); px++) c.px(px, base - y, PAL.flame[i]);
    }
  }
}

function drawFire() {
  const FR = 4;
  const sheet = new Canvas(W * FR, H);
  const tongues = [[-9, 12], [-5, 17], [0, 24], [4, 18], [9, 11], [-1, 15]];
  for (let f = 0; f < FR; f++) {
    const c = new Canvas(W, H);
    const base = PIT.y + 2;
    c.glow(PIT.x, base - 8, 20, PAL.fireGlow, 0.3);
    tongues.forEach(([dx, h], i) => {
      const hh = Math.round(h * (0.8 + 0.25 * Math.sin(f * 1.7 + i * 2.1)));
      const sway = Math.sin(f * 1.3 + i) * 2.2;
      flameTongue(c, PIT.x + dx, base, hh, sway, i === 2 ? 1.2 : 0.85);
    });
    // a flicker breaking off above the tallest flame
    const fx = PIT.x + Math.round(Math.sin(f * 2.3) * 3);
    const fy = base - 27 - (f % 2) * 3;
    c.rect(fx, fy, 2, 2, PAL.flame[1]);
    c.px(fx, fy, PAL.flame[2]);
    sheet.blit(c, f * W, 0);
  }
  return sheet;
}

// ---- 12. pit-front.png — the front of the steel ring ------------------------------------------
function drawPitFront() {
  const c = new Canvas(W, H);
  for (let x = PIT.x - PIT.rx; x <= PIT.x + PIT.rx; x++) {
    const yt = Math.round(ringY(x, 1));
    const side = Math.abs(x - PIT.x) / PIT.rx;
    for (let y = yt; y < yt + PIT.wall; y++) {
      const dark = side > 0.75 || (side > 0.55 && bayer(x, y) < 0.5);
      c.px(x, y, dark ? PAL.steelShade : PAL.steel);
    }
    c.px(x, yt, PAL.steelHi); // the near rim, lit from inside
    c.px(x, yt + PIT.wall - 1, PAL.steelShade);
    if ((x - PIT.x + 40) % 9 === 0 && side < 0.8) c.rect(x, yt + 3, 1, 3, PAL.steelShade); // air holes
  }
  // the ends of the ring at the sides
  for (const s of [-1, 1]) c.rect(PIT.x + s * PIT.rx - (s > 0 ? 0 : 0), PIT.y, 1, PIT.wall, PAL.steelShade);
  return c;
}

// ---- 13. us.png — the two of us by the fire, him having a smoke (16 frames, see DRAG) -------
// Both drawn side-on, facing right: her as she is, him at the mirror-image spot,
// then flipped to face her across the fire. The joint's ember and its smoke are
// drawn into the same frames, so they always line up with his hand.

function herHead(c, hx, hy, blink) {
  const s = PAL;
  c.circle(hx, hy, 6.2, s.herHair);
  c.rect(hx - 6, hy, 6, 7, s.herHair); // the back of the bob, down to her jaw (sticks out past her neck)
  c.rect(hx - 6, hy + 6, 6, 1, s.herHairShade);
  c.ellipse(hx + 3, hy + 2, 4.2, 4.6, s.herSkin); // face
  c.px(hx + 7, hy + 3, s.herSkin); // nose
  c.rect(hx, hy - 4, 7, 3, s.herHair); // fringe
  for (const x of [hx + 3, hx + 5, hx + 7]) c.px(x, hy - 1, s.herHair);
  c.rect(hx - 1, hy - 2, 2, 8, s.herHair); // hair over her ear
  // grown-out roots: dark on top, dithering into the pink
  for (let y = hy - 7; y <= hy - 3; y++)
    for (let x = hx - 7; x <= hx + 7; x++) {
      const [rr, g, b, a] = c.get(x, y);
      if (!a || `#${[rr, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}` !== s.herHair) continue;
      if (y < hy - 4 || (x + y) % 2 === 0) c.px(x, y, s.herRoots);
    }
  for (const [x, y] of [[hx - 4, hy - 1], [hx - 3, hy - 2], [hx - 5, hy + 1], [hx + 4, hy - 2]]) c.px(x, y, s.herHairHi);
  if (blink) c.px(hx + 5, hy + 2, s.herSkinShade);
  else {
    c.px(hx + 5, hy + 1, s.eye); // looking into the fire
    c.px(hx + 5, hy + 2, s.eye);
  }
  c.px(hx + 6, hy - 1, s.piercing);
  c.px(hx + 4, hy + 4, s.herBlush);
}

function himHead(c, hx, hy, blink) {
  const s = PAL;
  c.circle(hx, hy, 6.4, s.himSkin);
  c.ellipse(hx + 2, hy + 2, 4.4, 4.4, s.himSkin);
  c.px(hx + 7, hy + 2, s.himSkin); // nose
  for (let y = hy - 8; y <= hy + 3; y++)
    for (let x = hx - 8; x <= hx + 8; x++) {
      if ((x - hx) ** 2 + (y - hy) ** 2 > 6.4 * 6.4 + 4) continue;
      if (y <= hy - 3 || (x <= hx - 2 && y <= hy + 1)) c.px(x, y, s.himHair);
    }
  c.rect(hx + 1, hy - 4, 6, 2, s.himHair); // fringe
  c.px(hx + 6, hy - 2, s.himHair);
  c.px(hx + 4, hy - 2, s.himHair);
  c.px(hx - 1, hy + 1, s.himSkinShade); // ear
  c.px(hx - 1, hy + 2, s.himSkinShade);
  for (const [x, y] of [[hx + 2, hy - 5], [hx - 1, hy - 6], [hx - 3, hy - 4]]) c.px(x, y, s.himHairHi);
  if (blink) c.px(hx + 5, hy + 2, s.himSkinShade);
  else {
    c.px(hx + 5, hy + 1, s.eye);
    c.px(hx + 5, hy + 2, s.eye);
  }
  c.px(hx + 4, hy + 4, s.himBlush);
}

const HER_LOOK = {
  tall: 0, chair: PAL.herChair, chairShade: PAL.herChairShade,
  body: PAL.herDress, bodyShade: PAL.herDressShade, bodyHi: PAL.herDressHi, bodyDeep: PAL.herDressDeep, skirtTo: 7, dress: true,
  thigh: PAL.herSkin, thighShade: PAL.herSkinShade, shin: PAL.herSkin, shoes: PAL.herShoes,
  arm: PAL.herSkin, sleeve: PAL.herDress, skin: PAL.herSkin, skinShade: PAL.herSkinShade, head: herHead,
};
const HIM_LOOK = {
  tall: 3, chair: PAL.himChair, chairShade: PAL.himChairShade,
  body: PAL.jacket, bodyShade: PAL.jacketShade, bodyHi: PAL.jacketHi, jacket: true,
  thigh: PAL.jeans, thighShade: PAL.jeansShade, shin: PAL.jeans, shoes: PAL.himShoes,
  arm: PAL.jacket, sleeve: PAL.jacketShade, skin: PAL.himSkin, skinShade: PAL.himSkinShade, head: himHead,
};

/**
 * One of us in a camping chair, side-on, facing right, hips at (hx, SEAT_Y).
 * `joint` = which JOINT_POSES pose he's in; `marshmallow` = a toasting stick in her resting hand.
 * Returns where the tip of the joint and his lips are (if holding one).
 */
function seated(c, hx, who, { blink = false, joint = null, marshmallow = false } = {}) {
  const t = who.tall;
  const lean = (y) => Math.round((SEAT_Y - 2 - y) * -0.12); // leaning back into the chair
  const shoulderY = SEAT_Y - 20 - t;
  const sx = hx + lean(shoulderY); // shoulder x

  // the chair, behind us: back rest, far legs, the seat sling
  thickLine(c, hx - 6, SEAT_Y, hx - 9, SEAT_Y - 23 - t, 4, who.chairShade);
  c.line(hx - 10, SEAT_Y + 1, hx - 12, SEAT_Y - 24 - t, PAL.chairFrame);
  c.line(hx - 8, SEAT_Y + 1, hx + 8, GROUND_Y, PAL.chairFrame, 0.7);
  c.line(hx + 8, SEAT_Y + 1, hx - 8, GROUND_Y, PAL.chairFrame, 0.7);
  for (let x = hx - 8; x <= hx + 9; x++) {
    const sag = Math.round(2 * Math.sin((PI * (x - hx + 8)) / 17));
    c.rect(x, SEAT_Y - 1 + sag, 1, 2, who.chair);
  }

  // legs: thigh along the seat, shin down to the ground
  const knee = { x: hx + 10, y: SEAT_Y - 3 };
  thickLine(c, knee.x, knee.y, hx + 12, GROUND_Y - 3, 3, who.shin);
  c.line(knee.x, knee.y + 2, hx + 12, GROUND_Y - 4, who.thighShade); // the back of the shin, in shadow
  c.rect(hx + 11, GROUND_Y - 2, 5, 2, who.shoes);
  if (who.dress) {
    c.rect(hx + 12, GROUND_Y - 3, 3, 1, who.shoes); // ankle strap
  } else {
    c.rect(hx + 12, GROUND_Y - 4, 3, 1, PAL.jeansHi); // turned-up cuffs
    c.rect(hx + 11, GROUND_Y - 1, 5, 1, PAL.himSole);
    c.px(hx + 13, GROUND_Y - 2, PAL.himShoesHi); // laces
  }
  for (let x = hx - 4; x <= knee.x + 1; x++) {
    const inDress = who.dress && x <= hx + who.skirtTo;
    c.rect(x, SEAT_Y - 6, 1, 5, inDress ? who.body : who.thigh);
    c.px(x, SEAT_Y - 2, inDress ? who.bodyShade : who.thighShade);
  }
  if (who.dress) {
    // a lace hem with little scallops (the pleats go on after her body, below)
    for (let y = SEAT_Y - 7; y <= SEAT_Y - 2; y++) {
      c.px(hx + who.skirtTo, y, y % 2 ? PAL.lace : PAL.laceShade);
      if (y % 2 === 0) c.px(hx + who.skirtTo + 1, y, PAL.lace);
    }
  } else {
    // jeans: light along the top of his thigh, a seam, his knee
    for (let x = hx + 4; x <= knee.x; x++) c.px(x, SEAT_Y - 6, PAL.jeansHi);
    c.line(hx + 4, SEAT_Y - 4, knee.x - 1, SEAT_Y - 4, who.thighShade);
    c.px(knee.x + 1, SEAT_Y - 5, PAL.jeansHi);
  }

  // body, leaning back a little
  for (let y = shoulderY; y <= SEAT_Y - 3; y++) {
    const x0 = hx - 4 + lean(y);
    c.rect(x0, y, 8, 1, who.body);
    c.px(x0, y, who.bodyShade); // his/her back
    if (who.jacket && y > shoulderY + 1 && y < SEAT_Y - 5) c.px(x0 + 7, y, PAL.shirt); // white shirt at the open front
  }
  c.clear(sx - 4, shoulderY);
  c.rect(sx - 3, shoulderY, 6, 1, who.bodyHi);
  if (who.dress) {
    c.rect(hx - 5, SEAT_Y - 7, 13, 2, who.body); // her dress over her lap
    // soft pleats along her skirt
    for (const x of [hx, hx + 3]) {
      c.rect(x, SEAT_Y - 6, 1, 4, who.bodyShade);
      c.rect(x + 1, SEAT_Y - 6, 1, 4, who.bodyHi);
    }
    // lace along her neckline
    c.px(sx + 2, shoulderY, PAL.lace);
    c.px(sx + 3, shoulderY + 1, PAL.lace);
    // the sash at her waist, tied in a bow at her back
    const waist = SEAT_Y - 9;
    for (const y of [waist, waist + 1]) {
      const x0 = hx - 4 + lean(y);
      c.rect(x0, y, 8, 1, y === waist ? PAL.sash : PAL.sashDark);
    }
    const bx = hx - 4 + lean(waist);
    c.map(['bb.', 'brK', 'bb.'], { b: PAL.sashLoop, r: PAL.sashLoopHi, K: PAL.sashDark }, bx - 2, waist - 1);
    c.px(bx - 1, waist + 2, PAL.sash); // a tail
    c.px(bx - 1, waist + 3, PAL.sashDark);
  } else {
    // his jacket: collar up behind his neck, a lapel, a pocket flap, and it
    // falls over his lap; a belt shows at the open front
    c.rect(sx - 2, shoulderY - 1, 2, 1, who.bodyShade);
    c.px(sx + 2, shoulderY, PAL.shirt); // shirt collar point
    for (let y = shoulderY + 2; y < SEAT_Y - 6; y++) c.px(hx - 4 + lean(y) + 6, y, who.bodyShade); // lapel
    c.rect(hx - 4 + lean(SEAT_Y - 10) + 2, SEAT_Y - 10, 3, 1, who.bodyShade); // pocket flap
    c.rect(hx - 4, SEAT_Y - 6, 8, 3, who.body); // over his lap...
    c.rect(hx - 4, SEAT_Y - 3, 8, 1, who.bodyShade); // ...to its hem
    c.rect(hx - 4 + lean(SEAT_Y - 6) + 6, SEAT_Y - 6, 2, 1, PAL.belt);
  }
  // neck + head
  c.rect(sx - 1, shoulderY - 3, 3, 3, who.skin);
  who.head(c, sx + 1, shoulderY - 9, blink);

  // the near armrest + the chair's near legs
  c.line(hx - 9, SEAT_Y - 9, hx + 8, SEAT_Y - 9, who.chairShade);
  c.line(hx + 8, SEAT_Y - 8, hx + 8, SEAT_Y, PAL.chairFrame);
  c.line(hx - 7, SEAT_Y + 1, hx + 9, GROUND_Y, PAL.chairFrame);
  c.line(hx + 9, SEAT_Y + 1, hx - 7, GROUND_Y, PAL.chairFrame);
  c.rect(hx - 8, GROUND_Y, 3, 1, PAL.chairFrame);
  c.rect(hx + 8, GROUND_Y, 3, 1, PAL.chairFrame);

  // near arm
  const pose = joint ? JOINT_POSES[joint] : null;
  const elbow = pose ? { x: hx + pose.elbow[0], y: SEAT_Y + pose.elbow[1] } : { x: hx + 1, y: SEAT_Y - 10 };
  thickLine(c, sx, shoulderY + 1, elbow.x, elbow.y, 3, who.arm);
  if (who.dress) {
    // a puff sleeve, light on top, gathered underneath
    c.ellipse(sx, shoulderY + 2, 2.2, 1.6, who.bodyHi);
    c.rect(sx - 1, shoulderY + 4, 3, 1, who.bodyDeep);
  } else {
    c.rect(sx - 1, shoulderY + 1, 3, 2, who.sleeve);
    c.px(elbow.x, elbow.y + 1, who.bodyHi); // light on his elbow
  }
  if (!pose) {
    // forearm resting along the armrest, hand over the end
    thickLine(c, elbow.x, elbow.y, hx + 8, SEAT_Y - 10, 3, who.arm);
    if (marshmallow) {
      // a long stick held out to the edge of the flames, a marshmallow on the end
      const tip = { x: hx + 38, y: SEAT_Y - 15 };
      c.line(hx + 9, SEAT_Y - 9, tip.x, tip.y, PAL.stick);
      c.rect(tip.x - 1, tip.y - 2, 3, 3, PAL.mallow);
      c.rect(tip.x - 1, tip.y, 3, 1, PAL.mallowToast); // toasting underneath
      c.px(tip.x + 1, tip.y - 1, PAL.mallowToast);
    }
    c.rect(hx + 8, SEAT_Y - 11, 3, 3, who.skin);
    return null;
  }
  // forearm raised, the joint held between his fingers
  const hand = { x: hx + pose.hand[0], y: shoulderY + pose.hand[1] };
  thickLine(c, elbow.x, elbow.y, hand.x - 1, hand.y + 1, 3, who.arm);
  const cuff = { x: Math.round(elbow.x + (hand.x - elbow.x) * 0.6), y: Math.round(elbow.y + (hand.y - elbow.y) * 0.6) };
  c.rect(cuff.x, cuff.y, 2, 1, who.sleeve);
  const shirtCuff = { x: Math.round(elbow.x + (hand.x - elbow.x) * 0.8), y: Math.round(elbow.y + (hand.y - elbow.y) * 0.8) };
  c.rect(shirtCuff.x, shirtCuff.y, 2, 1, PAL.shirt); // his shirt cuff peeking out
  c.rect(hand.x - 1, hand.y - 1, 3, 3, who.skin);
  c.px(hand.x + 2, hand.y, who.skinShade); // finger + thumb
  const [jx, jy] = pose.joint;
  const tip = { x: hand.x + jx[1] + 1, y: hand.y + jy[1] + Math.sign(jy[1] - jy[0]) };
  c.line(hand.x + jx[0], hand.y + jy[0], hand.x + jx[1], hand.y + jy[1], PAL.paper);
  return { tip, mouth: { x: sx + 7, y: shoulderY - 5 } }; // the lit end, and his lips
}

// His arm through a drag: elbow [x from his hips, y from the seat], hand
// [x from his hips, y from his shoulders], joint [[x0, x1], [y0, y1]] from his hand.
const JOINT_POSES = {
  rest: { elbow: [1, -10], hand: [8, 3], joint: [[2, 6], [-1, -1]] }, // held out, chatting
  raise: { elbow: [2, -12], hand: [8, -1], joint: [[2, 6], [-1, -1]] }, // on the way up / down
  lips: { elbow: [3, -14], hand: [7, -4], joint: [[-2, 3], [-1, -1]] }, // a drag
};

// The 16-frame loop (4 fps = 4 s): chatting, a drag, then breathing it out.
const DRAG = {
  frames: 16,
  pose: (f) => (f === 5 || f === 9 ? 'raise' : f >= 6 && f <= 8 ? 'lips' : 'rest'),
  hot: (f) => f >= 6 && f <= 9, // the ember flares while he draws on it
  exhale: [10, 11, 12], // frames he breathes the smoke out
  herBlink: (f) => f === 2 || f === 13,
  hisBlink: (f) => f === 7 || f === 8 || f === 15, // eyes closed for the drag
};

/** A smoke particle's spot `age` frames after it left (x0, y0), rising and drifting away from the fire. */
function smokeAt(x0, y0, age, seed, { up = 2, out = 0 } = {}) {
  const wobble = Math.sin(age * 0.9 + seed * 1.7) * Math.min(3, age * 0.5);
  const forward = out * (1 - Math.exp(-age * 0.6)) * 6; // a puff shoots out, then slows
  return { x: Math.round(x0 + forward + age * 0.6 + wobble), y: Math.round(y0 - 1 - age * up) };
}

/** The ember, the thin wisp from it, and the breathed-out puff, for frame f. */
function drawSmoke(c, f, tips, mouth) {
  const N = DRAG.frames;
  const { x: ex, y: ey } = tips[f];
  // the wisp: two bits leave the ember every frame (one while his arm moves,
  // none while he's drawing on it), each lasting 9 frames
  for (let age = 8; age >= 0; age--) {
    const b = (f - age + N) % N;
    for (let k = 0; k < 2; k++) {
      if (DRAG.pose(b) === 'lips' || (DRAG.pose(b) === 'raise' && k)) continue;
      const p = smokeAt(tips[b].x, tips[b].y, age + k * 0.5, b * 2 + k, { up: 2.4 });
      const a = (1 - age / 9) * 0.55;
      c.px(p.x, p.y, PAL.smoke, a);
      if (age > 3) c.px(p.x + 1, p.y, PAL.smoke, a * 0.6);
    }
  }
  // the puff he breathes out: out from his lips towards the fire, then up and away
  for (const b of DRAG.exhale) {
    const age = (f - b + N) % N;
    if (age > 7) continue;
    for (let k = 0; k < 8; k++) {
      const p = smokeAt(mouth.x - 1, mouth.y + (k % 3) - 1, age + (k % 2) * 0.4, b * 5 + k, { up: 1.4, out: -1 - (k % 4) * 0.35 });
      const a = (1 - age / 8) * 0.6;
      const size = Math.min(3, 1 + Math.floor(age / 2)); // spreads out as it rises
      c.rect(p.x - (size >> 1), p.y - (size >> 1), size, size, PAL.smoke, a);
    }
  }
  // the ember, flaring while he draws on it
  const hot = DRAG.hot(f);
  c.glow(ex, ey, hot ? 4 : 3, PAL.ember, hot ? 0.6 : 0.3);
  c.px(ex, ey, hot ? PAL.emberHot : PAL.ember);
}

function drawUsFrame(f, hims) {
  const c = new Canvas(W, H);
  softEllipse(c, HER_HIP + 2, GROUND_Y + 1, 18, 2, PAL.outline, 0.5);
  softEllipse(c, HIM_HIP - 2, GROUND_Y + 1, 18, 2, PAL.outline, 0.5);

  const her = new Canvas(W, H);
  seated(her, HER_HIP, HER_LOOK, { blink: DRAG.herBlink(f), marshmallow: true });
  tint(her, NIGHT, 0.22);
  sideLight(her, 1, PAL.fireLight, 0.6, 2);
  her.outline(PAL.outline);

  c.blit(her, 0, 0);
  c.blit(hims[f].him, 0, 0);
  drawSmoke(c, f, hims.map((h) => h.tip), hims[0].mouth);
  return c;
}

/** Him in frame f, drawn facing right then mirrored; plus where his joint's tip and lips end up. */
function himFrame(f) {
  const drawn = new Canvas(W, H);
  const at = seated(drawn, W - 1 - HIM_HIP, HIM_LOOK, { blink: DRAG.hisBlink(f), joint: DRAG.pose(f) });
  tint(drawn, NIGHT, 0.22);
  sideLight(drawn, 1, PAL.fireLight, 0.6, 2);
  drawn.outline(PAL.outline);
  const flip = (p) => ({ x: W - 1 - p.x, y: p.y });
  return { him: mirror(drawn), tip: flip(at.tip), mouth: flip(at.mouth) };
}

function drawUs() {
  const N = DRAG.frames;
  const hims = Array.from({ length: N }, (_, f) => himFrame(f)); // all first: the smoke trails behind the joint
  const sheet = new Canvas(W * N, H);
  for (let f = 0; f < N; f++) sheet.blit(drawUsFrame(f, hims), f * W, 0);
  return sheet;
}

// ---- 14. sparks.png — embers floating up from the fire (4 frames) ----------------------------
function drawSparks() {
  const FR = 4;
  const sheet = new Canvas(W * FR, H);
  const sparks = Array.from({ length: 12 }, () => ({ x: PIT.x + r.int(-10, 10), y: r.int(0, 40), drift: r.range(-1, 1) }));
  for (let f = 0; f < FR; f++) {
    for (const s of sparks) {
      const rise = (s.y + f * 10) % 44; // 0 = just left the fire
      const x = Math.round(s.x + s.drift * rise * 0.3 + Math.sin((rise + s.x) * 0.3));
      const y = PIT.y - 20 - rise;
      sheet.px(f * W + x, y, rise < 22 ? PAL.coalHot : PAL.coal, rise < 34 ? 1 : 0.5);
    }
  }
  return sheet;
}

// ---- 15. vignette.png — darker towards the edges -------------------------------------------
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

// ---- The campsite for the map: campsite.png (5 x 3 tiles, 3 fire frames side by side) ---------
// Tent on the left (solid), her chair, the firepit, his chair along the middle
// row (solid), open ground all around (walkable). Daytime, like the map.
const MAP_CAMP = { cols: 5, rows: 3, frames: 3 };
const MAP_TRIGGER = { x: 2, y: 2, w: 3, h: 1 }; // in front of the fire (tiles, from the campsite's top-left)

function drawMapCampFrame(f) {
  const c = new Canvas(MAP_CAMP.cols * 16, MAP_CAMP.rows * 16);
  // a worn, dirt clearing (dithered at the edges into the grass)
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const d = Math.hypot((x - 44) / 38, (y - 25) / 19);
      if (d > 1) continue;
      if (d > 0.8 && bayer(x, y) < (d - 0.8) * 5) continue;
      c.px(x, y, d > 0.65 || bayer(x, y) < 0.15 ? PAL.mapDirtDark : PAL.mapDirt);
    }
  // the tent (tiles 0-1, rows 0-1): our red dome
  c.ellipse(17, 29, 14, 2, PAL.mapGrassDark, 0.5);
  for (let x = 3; x <= 29; x++) {
    const top = 28 - Math.round(20 * Math.pow(Math.max(0, 1 - ((x - 16) / 13) ** 2), 0.55));
    for (let y = top; y <= 28; y++) c.px(x, y, x < 8 ? PAL.tentRed[2] : x > 25 || y > 26 ? PAL.tentRed[3] : PAL.tentRed[4]);
    c.px(x, top, PAL.tentRed[1]);
  }
  for (let y = 9; y <= 28; y++) c.px(16, y, PAL.tentRed[1]); // the pole down the front
  c.rect(10, 28, 13, 1, PAL.groundsheet);
  for (let y = 18; y <= 27; y++) {
    const w = Math.round(((y - 18) / 9) * 3); // the door, unzipped and pulled back a little
    for (let x = 17; x <= 16 + w; x++) c.px(x, y, PAL.tentInside);
  }
  c.px(18, 27, PAL.lantern);
  c.line(3, 26, 0, 30, PAL.rope);
  c.line(29, 26, 32, 30, PAL.rope);
  // chairs (tiles 2 and 4 of the middle row), facing the fire
  for (const [cx, col, shade, dir] of [[40, PAL.herChair, PAL.herChairShade, 1], [72, PAL.himChair, PAL.himChairShade, -1]]) {
    c.ellipse(cx, 30, 6, 1.5, PAL.mapGrassDark, 0.4);
    c.rect(cx - 4, 22, 8, 5, col); // seat
    c.rect(cx - 4 - (dir > 0 ? 1 : -4), 17, 2, 9, shade); // back rest (away from the fire)
    c.rect(cx - 5, 22, 1, 4, shade); // arm rests
    c.rect(cx + 4, 22, 1, 4, shade);
    c.line(cx - 4, 27, cx - 3, 30, PAL.chairFrame);
    c.line(cx + 3, 27, cx + 4, 30, PAL.chairFrame);
  }
  // the firepit (tile 3 of the middle row): concrete pad, steel ring, flames
  c.ellipse(56, 27, 9, 4, PAL.padShade);
  c.ellipse(56, 26, 8, 3, '#c9c3cf');
  c.ellipse(56, 25, 5, 2, PAL.steel);
  c.ellipse(56, 25, 4, 1.2, PAL.pitInside);
  c.rect(51, 25, 11, 3, PAL.steel);
  c.rect(51, 27, 11, 1, PAL.steelShade);
  c.rect(61, 18, 1, 8, PAL.grill); // grill post + plate
  c.rect(61, 18, 5, 1, PAL.grill);
  const flames = [[[54, 3], [56, 6], [58, 4]], [[54, 5], [56, 4], [58, 6]], [[54, 4], [56, 7], [58, 3]]][f];
  for (const [fx, h] of flames) {
    for (let y = 0; y < h; y++) {
      const t = y / h;
      c.px(fx, 24 - y, t < 0.4 ? PAL.flame[2] : t < 0.75 ? PAL.flame[1] : PAL.flame[0]);
      if (t < 0.4) c.px(fx + 1, 24 - y, PAL.flame[1]);
    }
  }
  c.px(56, 24, PAL.flame[3]);
  return c;
}

function drawMapCamp() {
  const sheet = new Canvas(MAP_CAMP.cols * 16 * MAP_CAMP.frames, MAP_CAMP.rows * 16);
  for (let f = 0; f < MAP_CAMP.frames; f++) sheet.blit(drawMapCampFrame(f), f * MAP_CAMP.cols * 16, 0);
  return sheet;
}

/** Stamp the campsite at tiles AT (first time only) and add its trigger. */
const AT = { x: 25, y: 34 }; // right of the momo under the tree in the bottom-left

function addToMap() {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (map.tilesets.some((t) => t.name === 'campsite')) {
    console.log('  map      already has our campsite — left untouched');
    return;
  }
  const layer = (name) => map.layers.find((l) => l.name === name);
  for (let y = AT.y; y < AT.y + MAP_CAMP.rows; y++)
    for (let x = AT.x; x < AT.x + MAP_CAMP.cols; x++) layer('Decor').data[y * map.width + x] = 0;
  // solid: the tent (tiles 0,1 / 5,6), the chairs and the firepit (7, 8, 9)
  const solid = [0, 1, 5, 6, 7, 8, 9];
  const walkable = Array.from({ length: MAP_CAMP.cols * MAP_CAMP.rows }, (_, i) => i).filter((i) => !solid.includes(i));
  stampBuilding(map, {
    name: 'campsite', image: '../public/assets/tiles/campsite.png', cols: MAP_CAMP.cols, rows: MAP_CAMP.rows, at: AT,
    walkable, frames: MAP_CAMP.frames, animated: [3, 8], frameMs: 180,
  });
  layer('Triggers').objects.push({
    id: map.nextobjectid++, name: 'campfire', type: '', visible: true, rotation: 0,
    x: (AT.x + MAP_TRIGGER.x) * 16, y: (AT.y + MAP_TRIGGER.y) * 16, width: MAP_TRIGGER.w * 16, height: MAP_TRIGGER.h * 16,
    properties: [{ name: 'memoryId', type: 'string', value: 'camping' }],
  });
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  console.log(`  map      put our campsite at tiles x ${AT.x}–${AT.x + MAP_CAMP.cols - 1}, y ${AT.y}–${AT.y + MAP_CAMP.rows - 1} (+ "campfire" trigger)`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing our camping trip…');
const layers = {
  sky: drawSky(),
  stars: drawStars(),
  glow: drawGlow(),
  cliff: drawCliff(),
  waterfall: drawWaterfall(),
  treeline: drawTreeline(),
  trees: drawTrees(),
  ground: drawGround(),
  tent: drawTent(),
  firelight: drawFirelight(),
  pit: drawPit(),
  fire: drawFire(),
  'pit-front': drawPitFront(),
  us: drawUs(),
  sparks: drawSparks(),
  vignette: drawVignette(),
};
for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);
const mapCamp = drawMapCamp();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'campsite.png'), mapCamp);
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
writePreview('camping.png', flat);
const mapPreview = new Canvas(MAP_CAMP.cols * 16 + 32, MAP_CAMP.rows * 16 + 32);
mapPreview.rect(0, 0, mapPreview.width, mapPreview.height, '#8cc269');
const frame0 = drawMapCampFrame(0);
mapPreview.blit(frame0, 16, 16);
writePreview('camping-map.png', mapPreview);
console.log('  preview  tools/previews/camping.png, tools/previews/camping-map.png');
