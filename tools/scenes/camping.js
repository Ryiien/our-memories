#!/usr/bin/env node
// -----------------------------------------------------------------------------
// camping.js — draws the "Camping by the waterfall" memory as layered pixel
// art: a starry night at our campsite, the two of us in camping chairs either
// side of the firepit (the round steel ring on a concrete pad, with the
// swing-out grill plate, from the photo), our dome tent with a lantern inside,
// and the waterfall pouring down the sandstone cliff behind us. He's smoking a
// joint; the smoke curls up into the dark.
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
  // the tent (grey dome, navy fly, teal trim, like ours)
  tent: '#5f6680',
  tentShade: '#474d66',
  fly: '#283050',
  flyShade: '#1c2240',
  trim: '#3a8f9e',
  pole: '#9aa0b6',
  tentInside: '#191726',
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
  himShoes: '#3b3550',
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

// ---- 8. tent.png — our dome tent, door open, a lantern inside ---------------------------------
const TENT = { x: 52, base: 114, rx: 36, h: 36 };

function drawTent() {
  const c = new Canvas(W, H);
  softEllipse(c, TENT.x + 4, TENT.base + 1, TENT.rx + 8, 4, PAL.outline, 0.6);
  // guy ropes out to the pegs
  c.line(TENT.x - TENT.rx + 4, TENT.base - 20, TENT.x - TENT.rx - 10, TENT.base + 2, PAL.rope, 0.6);
  c.line(TENT.x + TENT.rx - 4, TENT.base - 20, TENT.x + TENT.rx + 10, TENT.base + 2, PAL.rope, 0.6);
  const top = (x) => TENT.base - Math.round(TENT.h * Math.sqrt(Math.max(0, 1 - ((x - TENT.x) / TENT.rx) ** 2)));
  const flyEdge = (x) => TENT.base - 15 + Math.round(Math.sin((x - TENT.x) * 0.35) * 1.5); // scalloped hem
  for (let x = TENT.x - TENT.rx; x <= TENT.x + TENT.rx; x++) {
    for (let y = top(x); y < TENT.base; y++) {
      const side = (x - TENT.x) / TENT.rx;
      const onFly = y < flyEdge(x);
      const shade = side < -0.55 || (bayer(x, y) < 0.3 && side < -0.35);
      c.px(x, y, onFly ? (shade ? PAL.flyShade : PAL.fly) : shade ? PAL.tentShade : PAL.tent);
    }
    c.px(x, flyEdge(x), PAL.trim); // teal trim along the fly's hem
    c.px(x, top(x), PAL.pole, 0.6); // the dome's outline catches the light
  }
  // the crossing poles
  for (let a = 0; a <= 64; a++) {
    const ang = PI + (a / 64) * PI; // the upper half only
    c.px(Math.round(TENT.x + Math.cos(ang) * TENT.rx * 0.55), Math.round(TENT.base + Math.sin(ang) * (TENT.h - 1)), PAL.pole, 0.5);
  }
  c.rect(TENT.x - TENT.rx, TENT.base - 1, TENT.rx * 2 + 1, 1, PAL.tentShade);
  // the door: an arch on the side facing the fire, open, a lantern glowing inside
  const door = { x: 68, top: TENT.base - 26, half: 10 };
  for (let y = door.top; y < TENT.base; y++) {
    const t = (y - door.top) / (TENT.base - door.top);
    const half = Math.round(door.half * Math.sqrt(t));
    for (let x = door.x - half; x <= door.x + half; x++) c.px(x, y, PAL.tentInside);
  }
  c.glow(door.x + 2, TENT.base - 9, 11, PAL.lantern, 0.45);
  c.rect(door.x + 1, TENT.base - 10, 3, 4, PAL.lantern);
  c.px(door.x + 2, TENT.base - 11, PAL.grillHi);
  c.rect(door.x - 11, door.top + 4, 3, 10, PAL.flyShade); // the rolled-back door flap
  c.rect(door.x - 11, door.top + 4, 1, 10, PAL.trim);
  tint(c, NIGHT, 0.12);
  sideLight(c, 1, PAL.fireLight, 0.4, 2);
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

// ---- 13. us.png — the two of us in camping chairs by the fire (8 frames: a blink each) -------
// Both drawn side-on, facing right: her as she is, him at the mirror-image spot,
// then flipped to face her across the fire.

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
  body: PAL.herDress, bodyShade: PAL.herDressShade, bodyHi: PAL.herDressHi, skirtTo: 7, dress: true,
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
 * Returns where the tip of the joint is (if holding one).
 */
function seated(c, hx, who, { blink = false, joint = false } = {}) {
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
  c.rect(hx + 11, GROUND_Y - 2, 5, 2, who.shoes);
  for (let x = hx - 4; x <= knee.x + 1; x++) {
    const inDress = who.dress && x <= hx + who.skirtTo;
    c.rect(x, SEAT_Y - 6, 1, 5, inDress ? who.body : who.thigh);
    c.px(x, SEAT_Y - 2, inDress ? who.bodyShade : who.thighShade);
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
  if (who.dress) c.rect(hx - 5, SEAT_Y - 7, 13, 2, who.body); // her dress over her lap
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
  const elbow = { x: hx + 1, y: SEAT_Y - 10 };
  thickLine(c, sx, shoulderY + 1, elbow.x, elbow.y, 3, who.arm);
  c.rect(sx - 1, shoulderY + 1, 3, 2, who.sleeve);
  if (!joint) {
    // forearm resting along the armrest, hand over the end
    thickLine(c, elbow.x, elbow.y, hx + 8, SEAT_Y - 10, 3, who.arm);
    c.rect(hx + 8, SEAT_Y - 11, 3, 3, who.skin);
    return null;
  }
  // forearm raised, the joint held up between his fingers
  const hand = { x: hx + 8, y: shoulderY + 3 };
  thickLine(c, elbow.x, elbow.y, hand.x - 1, hand.y + 1, 3, who.arm);
  c.rect(elbow.x + 4, elbow.y - 3, 2, 1, who.sleeve); // cuff
  c.rect(hand.x - 1, hand.y - 1, 3, 3, who.skin);
  c.px(hand.x + 2, hand.y, who.skinShade); // finger + thumb
  c.line(hand.x + 2, hand.y - 1, hand.x + 6, hand.y - 3, PAL.paper);
  return { x: hand.x + 7, y: hand.y - 4 }; // the lit end
}

let JOINT_TIP = null; // where the ember ends up after he's mirrored (worked out in drawUs)

function drawUsFrame(f) {
  const c = new Canvas(W, H);
  softEllipse(c, HER_HIP + 2, GROUND_Y + 1, 18, 2, PAL.outline, 0.5);
  softEllipse(c, HIM_HIP - 2, GROUND_Y + 1, 18, 2, PAL.outline, 0.5);

  const her = new Canvas(W, H);
  seated(her, HER_HIP, HER_LOOK, { blink: f === 2 });
  tint(her, NIGHT, 0.22);
  sideLight(her, 1, PAL.fireLight, 0.6, 2);
  her.outline(PAL.outline);

  const drawn = new Canvas(W, H);
  const tip = seated(drawn, W - 1 - HIM_HIP, HIM_LOOK, { blink: f === 6, joint: true });
  tint(drawn, NIGHT, 0.22);
  sideLight(drawn, 1, PAL.fireLight, 0.6, 2);
  drawn.outline(PAL.outline);
  const him = mirror(drawn);
  JOINT_TIP = { x: W - 1 - tip.x, y: tip.y };

  c.blit(her, 0, 0);
  c.blit(him, 0, 0);
  return c;
}

function drawUs() {
  const FR = 8;
  const sheet = new Canvas(W * FR, H);
  for (let f = 0; f < FR; f++) sheet.blit(drawUsFrame(f), f * W, 0);
  return sheet;
}

// ---- 14. smoke.png — the joint's ember and its smoke curling up (6 frames) -------------------
function drawSmoke() {
  const FR = 6;
  const sheet = new Canvas(W * FR, H);
  const { x: ex, y: ey } = JOINT_TIP;
  for (let f = 0; f < FR; f++) {
    const c = new Canvas(W, H);
    // the ember: brightest when he's just had a drag
    c.glow(ex, ey, 3, PAL.ember, f < 2 ? 0.55 : 0.3);
    c.px(ex, ey, f < 2 ? PAL.emberHot : PAL.ember);
    // a thin wisp of smoke, drifting up and away from the fire
    for (let k = 0; k < 4; k++) {
      for (let s = 0; s < 6; s++) {
        const age = ((k * 6 + s + f) % 24) / 24; // 0 = just left the ember, 1 = gone
        const x = Math.round(ex + Math.sin(age * 9 + k * 1.7) * 3 * age + age * 6);
        const y = Math.round(ey - 2 - age * 30);
        const a = (1 - age) * 0.55;
        c.px(x, y, PAL.smoke, a);
        if (age > 0.4) c.px(x + 1, y, PAL.smoke, a * 0.6);
      }
    }
    sheet.blit(c, f * W, 0);
  }
  return sheet;
}

// ---- 15. sparks.png — embers floating up from the fire (4 frames) ----------------------------
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

// ---- 16. vignette.png — darker towards the edges -------------------------------------------
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
  // the tent (tiles 0-1, rows 0-1), door facing the fire
  c.ellipse(17, 29, 14, 2, PAL.mapGrassDark, 0.5);
  for (let x = 3; x <= 29; x++) {
    const top = 28 - Math.round(20 * Math.sqrt(Math.max(0, 1 - ((x - 16) / 13) ** 2)));
    for (let y = top; y <= 28; y++) c.px(x, y, y < 20 ? '#3b4570' : x < 9 ? '#8a90a8' : '#a3a9bf');
    c.px(x, top, '#2b3354');
    c.px(x, 20, PAL.trim);
  }
  for (let y = 17; y <= 28; y++) {
    const half = Math.round(((y - 17) / 11) * 4);
    for (let x = 22 - half; x <= 22 + half; x++) c.px(x, y, '#2a2638');
  }
  c.px(22, 26, PAL.lantern);
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
const us = drawUs(); // first: works out where his joint is, for the smoke
const layers = {
  sky: drawSky(),
  stars: drawStars(),
  glow: drawGlow(),
  cliff: drawCliff(),
  waterfall: drawWaterfall(),
  trees: drawTrees(),
  ground: drawGround(),
  tent: drawTent(),
  firelight: drawFirelight(),
  pit: drawPit(),
  fire: drawFire(),
  'pit-front': drawPitFront(),
  us,
  smoke: drawSmoke(),
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
