#!/usr/bin/env node
// -----------------------------------------------------------------------------
// apollo-bay.js — draws the "Night on the beach" memory (Apollo Bay): a moonlit
// sea, the town's lights on the headland, foam creeping up the sand, and the two
// of us sitting cross-legged on a blanket, seen from behind.
//
//   npm run scene:beach                     # (re)draw everything
//   npm run scene:beach -- --keep us,sand   # don't overwrite layers you've redrawn
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/memories/apollo-bay/*.png   the 8 cutscene layers
//   tools/previews/apollo-bay.png             flattened preview (3x size)
// -----------------------------------------------------------------------------
import path from 'node:path';

import { Canvas, rng } from '../lib/canvas.js';
import { ROOT, makeSaver, thickLine, rimLight, writePreview } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // night sky, top to bottom
  sky: ['#13152e', '#1b1d40', '#272a57', '#3a3a6e', '#5a4a7e', '#86628e', '#b07a9a'],
  night: '#1b1d40',
  headland: '#2a2547',
  moon: '#fff3dc',
  moonShade: '#efdcc0',
  stars: ['#fff3dc', '#ffffff', '#f6d983', '#b8a6d9', '#fff3dc'],
  townLight: '#f6d983',
  townLightWarm: '#e9a35b',
  // the sea
  sea: ['#3d4682', '#3a3a6e', '#272a57', '#272a57', '#1b1d40'],
  moonPath: '#fff3dc',
  ripple: '#b8a6d9',
  foam: '#e8f6f2',
  // the sand
  sandLight: '#8a7894',
  sand: '#6f6080',
  sandDark: '#574a66',
  blanket: '#9e4a5c',
  blanketTop: '#c46a80',
  // her: pink bob with dark roots, olive skin, light-pink dress
  herHair: '#e0607e',
  herHairHi: '#f08aa3',
  herHairShade: '#b84a66',
  herRoots: '#2e2230',
  herSkin: '#d9a47c',
  herSkinShade: '#bf8862',
  herDress: '#f59ac4',
  herDressShade: '#d877a6',
  herDressHi: '#f8b6d6',
  herShoes: '#ffffff',
  // him: short black hair, brown jacket (long, over his jeans), jeans
  himHair: '#231c24',
  himHairHi: '#4a3d4a',
  himSkin: '#ecbf9f',
  himSkinShade: '#d6a585',
  jacket: '#8a5a3c',
  jacketShade: '#64402c',
  jacketHi: '#ab7a52',
  jeans: '#5b7bb5',
  jeansShade: '#465f94',
  outline: '#2a1f2a',
  moonlight: '#fff3dc',
};
const MOONLIT = [38, 35, 71]; // we're tinted towards this, a little, in the moonlight
const DIM = 0.35;

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const PI = Math.PI;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'apollo-bay');
const save = makeSaver();

const HORIZON = 90;
const MOON = { x: 252, y: 34 };
const hill = (x) => (x < 196 ? HORIZON : Math.round(HORIZON - Math.min(16, (x - 196) * 0.22) + Math.sin(x * 0.15) * 1.2));
const sandTop = (x) => 132 + Math.round(Math.sin(x * 0.05) * 1.5);
const r = rng(11); // one generator for the whole scene, so it comes out the same every run

// ---- 1. sky.png — night sky, the headland, the moon --------------------------------------
function drawSky() {
  const c = new Canvas(W, H);
  c.gradientV(0, 0, W, HORIZON, PAL.sky);
  c.rect(0, HORIZON, W, H - HORIZON, PAL.night);
  for (let x = 196; x < W; x++) for (let y = hill(x); y < HORIZON; y++) c.px(x, y, PAL.headland);
  c.circle(MOON.x, MOON.y, 10, PAL.moon);
  c.circle(MOON.x - 3, MOON.y - 3, 2, PAL.moonShade);
  c.circle(MOON.x + 3, MOON.y + 4, 1.5, PAL.moonShade);
  c.px(MOON.x + 4, MOON.y - 4, PAL.moonShade);
  return c;
}

// ---- 2. stars.png (twinkle) -----------------------------------------------------------------
function drawStars() {
  const c = new Canvas(W, H);
  for (let i = 0; i < 110; i++) {
    const x = r.int(2, W - 3);
    const y = r.int(2, 82);
    if (Math.hypot(x - MOON.x, y - MOON.y) < 22 || y > hill(x) - 3) continue;
    const color = r.pick(PAL.stars);
    c.px(x, y, color);
    if (r() < 0.14) {
      c.px(x - 1, y, color, 0.5);
      c.px(x + 1, y, color, 0.5);
      c.px(x, y - 1, color, 0.5);
      c.px(x, y + 1, color, 0.5);
    }
  }
  return c;
}

// ---- 3. glow.png — the moon's halo (pulse) ----------------------------------------------------
function drawGlow() {
  const c = new Canvas(W, H);
  c.glow(MOON.x, MOON.y, 30, PAL.moon, 0.3);
  return c;
}

// ---- 4. lights.png — the town's lights on the headland (flicker) -------------------------------
function drawLights() {
  const c = new Canvas(W, H);
  for (let i = 0; i < 14; i++) {
    const x = r.int(212, 316);
    const y = Math.min(HORIZON - 2, hill(x) + r.int(2, 9));
    c.glow(x, y, 3, PAL.townLight, 0.35);
    c.px(x, y, r() < 0.5 ? PAL.townLight : PAL.townLightWarm);
    if (r() < 0.3) c.px(x + 1, y, PAL.townLight);
  }
  return c;
}

// ---- 5. sea.png — the sea, the moon's path on the water (slide) --------------------------------
function drawSea() {
  const c = new Canvas(W, H);
  c.gradientV(0, HORIZON, W, 46, PAL.sea);
  for (let y = HORIZON + 2; y < 134; y += 2) {
    const half = 3 + (y - HORIZON) * 0.3;
    for (let x = Math.round(MOON.x - half); x <= MOON.x + half; x++) {
      if (r() < 0.45) c.px(x, y, r() < 0.5 ? PAL.moonPath : PAL.ripple, 0.9);
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(HORIZON + 3, 132);
    const len = r.int(2, 6);
    for (let k = 0; k < len; k++) c.px((x + k) % W, y, PAL.ripple, 0.45);
  }
  return c;
}

// ---- 6. sand.png — the beach and our blanket ----------------------------------------------------
const BLANKET = { x: 159, y: 147, rx: 28, ry: 3.5 };

function drawSand() {
  const c = new Canvas(W, H);
  for (let x = 0; x < W; x++) for (let y = sandTop(x); y < H; y++) c.px(x, y, PAL.sand);
  c.gradientV(0, 140, W, 40, [PAL.sand, PAL.sandDark]);
  for (let i = 0; i < 90; i++) c.px(r.int(0, W - 1), r.int(136, H - 1), r() < 0.5 ? PAL.sandLight : PAL.sandDark);
  c.ellipse(BLANKET.x, BLANKET.y, BLANKET.rx, BLANKET.ry, PAL.blanket); // wide enough for our crossed legs
  c.ellipse(BLANKET.x, BLANKET.y - 1, BLANKET.rx - 2, BLANKET.ry - 1, PAL.blanketTop);
  return c;
}

// ---- 7. foam.png — the foam creeping up and back (3 frames) ----------------------------------
function drawFoam() {
  const c = new Canvas(W * 3, H);
  [0, 2, 1].forEach((lift, f) => {
    for (let x = 0; x < W; x++) {
      const y0 = sandTop(x) - lift + Math.round(Math.sin(x * 0.07 + f * 2.1) * 1.4);
      for (let y = sandTop(x); y < y0 + 4; y++) c.px(f * W + x, y, PAL.sandDark, 0.5); // wet sand
      if (Math.sin(x * 0.31 + f * 1.7) > -0.4) c.px(f * W + x, y0, PAL.foam, 0.9);
      if (Math.sin(x * 0.53 + f) > 0.3) c.px(f * W + x, y0 + 1, PAL.ripple, 0.7);
      if ((x * 7 + f * 13) % 23 === 0) c.px(f * W + x, y0 + 3, PAL.foam, 0.6);
    }
  });
  return c;
}

// ---- 8. us.png — the two of us sitting cross-legged, from behind (still) ------------------------
// Round heads on short necks, sloping shoulders, a back that tapers to the
// waist, arms down our sides with our hands on our knees, and our crossed knees
// poking out either side at the bottom.
const FEET = 148; // the blanket line we sit on
const US = { her: 149, him: 169 };

const HER_LOOK = {
  shoulders: 7, height: 19, headR: 6.3, knees: 12, lapWidth: 11, // her dress drapes over her lap
  kneeUp: -1, kneeUpOut: 8, shoes: PAL.herShoes, // her left knee is up (on our left, seen from behind),
  // tucked in close so her back mostly hides it (kneeUpOut = px out from her middle), arm resting on it
  body: PAL.herDress, bodyShade: PAL.herDressShade, bodyHi: PAL.herDressHi,
  knee: PAL.herSkin, kneeShade: PAL.herSkinShade, lap: PAL.herDress, lapShade: PAL.herDressShade,
  arm: PAL.herSkin, armShade: PAL.herSkinShade, sleeve: PAL.herDress,
  skin: PAL.herSkin, head: herHead,
};
const HIM_LOOK = {
  shoulders: 8, height: 22, headR: 6.2, knees: 10, lapWidth: 8, jacket: true,
  body: PAL.jacket, bodyShade: PAL.jacketShade, bodyHi: PAL.jacketHi,
  knee: PAL.jeans, kneeShade: PAL.jeansShade, lap: PAL.jacketShade, lapShade: PAL.jacketShade,
  arm: PAL.jacketShade, armShade: PAL.jacketShade,
  skin: PAL.himSkin, head: himHead,
};

function sittingFromBehind(c, cx, who) {
  const sh = who.shoulders;
  const top = FEET - who.height; // the tops of the shoulders
  // crossed knees poking out either side, and the lap between them
  for (const side of [-1, 1]) {
    if (side === who.kneeUp) continue;
    c.ellipse(cx + side * who.knees, FEET - 2, 4, 2.5, who.knee);
    c.rect(cx + side * who.knees - 3, FEET, 7, 1, who.kneeShade);
  }
  c.ellipse(cx, FEET - 2, who.lapWidth, 2.5, who.lap);
  c.rect(cx - who.lapWidth + 2, FEET, who.lapWidth * 2 - 3, 1, who.lapShade);
  // a knee pulled up beside the body: shin up from the foot, rounded knee on top
  const kneeX = cx + (who.kneeUp ?? 0) * (who.kneeUpOut ?? who.knees - 1);
  if (who.kneeUp) {
    c.rect(kneeX - 2, FEET - 10, 5, 10, who.knee);
    c.ellipse(kneeX, FEET - 10, 2.5, 2, who.knee);
    c.rect(who.kneeUp < 0 ? kneeX - 2 : kneeX + 2, FEET - 9, 1, 9, who.kneeShade); // shade on the outside
    if (who.shoes) c.rect(kneeX - 2 + who.kneeUp, FEET - 1, 5, 2, who.shoes);
  }
  // the back: rounded shoulders, in a little at the waist, out at the hips
  const bottom = FEET - (who.jacket ? 1 : 3); // his jacket hangs down over the seat
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / (bottom - top);
    let half = sh - 1.6 * Math.sin(Math.min(1, t / 0.6) * (PI / 2)) + (t > 0.6 ? 2 * ((t - 0.6) / 0.4) : 0);
    half -= [3, 1, 0.5][y - top] ?? 0; // round the tops of the shoulders
    const l = Math.round(cx - half);
    const rr = Math.round(cx + half);
    c.rect(l, y, rr - l + 1, 1, who.body);
    c.rect(l, y, 2, 1, who.bodyShade); // the moon is off to the right: shade on the left
    if (t < 0.5) c.px(rr, y, who.bodyHi);
  }
  c.rect(cx - sh + 1, bottom, sh * 2 - 1, 1, who.bodyShade); // hem
  if (who.jacket) {
    c.rect(cx, top + 4, 1, bottom - top - 5, who.bodyShade); // back seam
    c.rect(cx - 3, top - 1, 7, 2, who.bodyShade); // collar
    c.rect(cx + 2, top + 1, 3, 1, who.bodyHi); // light on his shoulder
  } else {
    c.rect(cx - sh + 2, FEET - 9, sh * 2 - 3, 1, who.bodyShade); // the waist of her dress
  }
  // arms down our sides, hands resting on our knees
  for (const side of [-1, 1]) {
    const sx = cx + side * (sh - 1);
    const col = side < 0 ? who.armShade : who.arm;
    if (side === who.kneeUp) {
      // this arm rests on the raised knee
      thickLine(c, sx, top + 2, sx + side * 2, top + 5, 2, col);
      thickLine(c, sx + side * 2, top + 5, kneeX, FEET - 12, 2, col);
      c.rect(kneeX - 1, FEET - 12, 2, 2, who.skin); // hand on the knee
    } else {
      // close to the body, like the reference: elbow just out, hand down by the knee
      thickLine(c, sx, top + 2, sx + side, top + 10, 2, col);
      thickLine(c, sx + side, top + 10, sx + side * 2, FEET - 5, 2, col);
      c.rect(sx + side * 2 - (side < 0 ? 1 : 0), FEET - 5, 2, 2, who.skin); // hand on the knee
    }
    if (who.sleeve) c.rect(sx - (side < 0 ? 1 : 0), top + 1, 2, 3, who.sleeve);
  }
  // a short neck, then the head
  c.rect(cx - 2, top - 3, 4, 3, who.skin);
  who.head(c, cx, top - 3 - Math.round(who.headR) + 1, who.headR);
}

function herHead(c, hx, hy, rad) {
  const s = PAL;
  c.circle(hx, hy, rad, s.herHair);
  c.ellipse(hx, hy + 2, rad + 0.3, rad - 0.6, s.herHair); // the bob, full to her jaw
  c.rect(hx - 5, hy + Math.round(rad) + 1, 11, 1, s.herHairShade);
  // grown-out roots: dark on top, dithering into the pink
  for (let y = hy - 7; y <= hy - 2; y++)
    for (let x = hx - 7; x <= hx + 7; x++) {
      if (Math.hypot(x - hx, y - hy) > rad) continue;
      if (y < hy - 3 || (x + y) % 2 === 0) c.px(x, y, s.herRoots);
    }
  for (const [x, y] of [[2, -1], [3, 1], [-3, 2], [4, 4]]) c.px(hx + x, hy + y, s.herHairHi);
  c.line(hx - 2, hy + 2, hx - 2, hy + 6, s.herHairShade); // a strand or two
  c.line(hx + 2, hy + 3, hx + 2, hy + 6, s.herHairShade);
}

function himHead(c, hx, hy, rad) {
  const s = PAL;
  c.circle(hx, hy, rad, s.himHair); // short hair, coming down low at the back
  c.rect(hx - Math.round(rad) - 1, hy, 1, 3, s.himSkin); // ears
  c.rect(hx + Math.round(rad) + 1, hy, 1, 3, s.himSkin);
  c.px(hx + Math.round(rad) + 1, hy + 1, s.himSkinShade);
  for (const [x, y] of [[1, -4], [3, -3], [-2, -5], [4, 0]]) c.px(hx + x, hy + y, s.himHairHi);
}

/** Blend every pixel a little towards the moonlit night colour. */
function moonlit(c) {
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const [rr, g, b, a] = c.get(x, y);
      if (!a) continue;
      c.clear(x, y);
      c.px(x, y, [rr, g, b].map((v, i) => Math.round(v + (MOONLIT[i] - v) * DIM)), a / 255);
    }
}

function drawUs() {
  const c = new Canvas(W, H);
  for (const [x, look] of [[US.him, HIM_LOOK], [US.her, HER_LOOK]]) {
    const one = new Canvas(W, H);
    sittingFromBehind(one, x, look);
    rimLight(one, PAL.moonlight, 0.2);
    one.outline(PAL.outline);
    moonlit(one);
    c.blit(one, 0, 0);
  }
  return c;
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing the night on the beach…');
const layers = {};
layers.sky = drawSky();
layers.stars = drawStars();
layers.glow = drawGlow();
layers.lights = drawLights();
layers.sea = drawSea();
layers.sand = drawSand();
layers.foam = drawFoam();
layers.us = drawUs();
for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);

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
writePreview('apollo-bay.png', flat);
console.log('  preview  tools/previews/apollo-bay.png');
