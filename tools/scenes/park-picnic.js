#!/usr/bin/env node
// -----------------------------------------------------------------------------
// park-picnic.js — draws the "Picnic in the park" memory as layered pixel art:
// the two of us lying on our stomachs on a blanket facing each other, reading,
// a drink each, our bikes standing in the grass behind us (his yellow road
// bike, her purple mountain bike — drawn from photos). Also swaps the picnic blanket on the map for a little picnic of
// our own (blanket, books, drinks, the two bikes) — only the first time.
//
//   npm run scene:picnic                      # (re)draw everything
//   npm run scene:picnic -- --keep us,bikes   # don't overwrite layers you've redrawn
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/memories/park-picnic/*.png   the 8 cutscene layers
//   public/assets/tiles/picnic.png             the picnic for the map (4x2 tiles)
//   tools/previews/park-picnic.png             flattened preview (3x size)
//   tools/previews/park-picnic-map.png         the map picnic on grass (3x size)
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas, rng } from '../lib/canvas.js';
import { ROOT, makeSaver, ring, thickLine, rimLight, softEllipse, writePreview, stampBuilding, blobsIn, foliage } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // a warm, clear afternoon
  skyTop: '#8fcbe6',
  sky: '#b4dcec',
  skyLow: '#dcefe9',
  sunCore: '#fffbe6',
  sun: '#fff1b8',
  sunGlow: '#f6d983',
  cloud: '#ffffff',
  cloudShade: '#e3f1ef',
  farHill: '#b9dca0',
  nearHill: '#9cc98a',
  // the park
  grassFar: '#a9d67a',
  grass: '#8cc269',
  grassMid: '#6fae5f',
  grassDark: '#4f8a50',
  leaves: ['#2f6048', '#4f8a50', '#6fae5f', '#a9d67a'],
  trunk: '#7a4a38',
  trunkHi: '#a0694c',
  flowers: ['#e58f9e', '#fff3dc', '#f6d983', '#b8a6d9'],
  // the blanket: rose and cream gingham
  check: '#e58f9e',
  checkLight: '#f3c2c8',
  checkCream: '#fff3dc',
  blanketEdge: '#c46a80',
  shadow: '#c46a80',
  // our bikes (from the photos): his yellow steel road bike with a white fork,
  // hers a plum-purple mountain bike
  yellow: '#f2c84b',
  yellowShade: '#c99a2e',
  yellowHi: '#fbe38a',
  purple: '#7a3270',
  purpleShade: '#521f4c',
  purpleHi: '#a85597',
  bikeWhite: '#f2f0ea',
  bikeWhiteShade: '#c9c6be',
  bar: '#26232b', // black bars, rack, her saddle
  cage: '#f07aa8', // her pink bottle cage
  chrome: '#dfe3ea',
  chromeShade: '#9aa0ae',
  tyre: '#2e2a33',
  spoke: '#c9cdd6',
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
  herDressHi: '#f8b6d6', // puff sleeve, light on the pleats
  herDressDeep: '#b9608f', // the crease under her sleeve
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
  himShoes: '#3b3550',
  himShoesHi: '#5a5470', // laces
  himSole: '#e2ddd2',
  // books + drinks
  herBook: '#6f8fc9',
  himBook: '#c66b54',
  pages: '#fff3dc',
  pagesShade: '#e6d2b4',
  glass: '#e6f3ec',
  herDrink: '#f59ab0', // something pink and cold, with a straw
  straw: '#ffffff',
  lemon: '#f6d983',
  bottle: '#a8642c', // his: a brown glass bottle
  bottleHi: '#e3a868',
  label: '#fff3dc',
  // butterflies
  butterflyA: '#f6d983',
  butterflyB: '#b8a6d9',
  eye: '#2a1f2a',
  outline: '#2a1f2a',
};

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const PI = Math.PI;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'park-picnic');
const save = makeSaver();

const HORIZON = 82; // where the grass meets the hills
const SUN = { x: 96, y: 30 };

// ---- 1. sky.png — clear sky, soft hills -----------------------------------------------
function drawSky() {
  const c = new Canvas(W, H);
  c.gradientV(0, 0, W, HORIZON, [PAL.skyTop, PAL.sky, PAL.skyLow]);
  for (let x = 0; x < W; x++) {
    const far = Math.round(HORIZON - 12 + Math.sin(x * 0.02) * 5);
    const near = Math.round(HORIZON - 5 + Math.sin(x * 0.031 + 1) * 4);
    for (let y = far; y < H; y++) c.px(x, y, PAL.farHill);
    for (let y = near; y < H; y++) c.px(x, y, PAL.nearHill);
  }
  return c;
}

// ---- 2. sun.png — the sun, top left (pulse) ---------------------------------------------
function drawSun() {
  const c = new Canvas(W, H);
  c.glow(SUN.x, SUN.y, 28, PAL.sunGlow, 0.32);
  c.circle(SUN.x, SUN.y, 10, PAL.sun);
  c.circle(SUN.x - 2, SUN.y - 2, 5.5, PAL.sunCore);
  return c;
}

// ---- 3. clouds.png — fluffy clouds, drawn three times so the drift wraps ------------------
function cloud(c, x, y, w) {
  for (const ox of [-W, 0, W]) {
    const cx = x + ox;
    c.ellipse(cx, y + 2, w * 0.5, 5, PAL.cloudShade);
    c.ellipse(cx - w * 0.22, y, w * 0.25, 5, PAL.cloud);
    c.ellipse(cx + w * 0.12, y - 3, w * 0.24, 7, PAL.cloud);
    c.ellipse(cx + w * 0.32, y + 1, w * 0.18, 4, PAL.cloud);
    c.rect(cx - w * 0.45, y + 2, w * 0.9, 3, PAL.cloud);
  }
}

function drawClouds() {
  const c = new Canvas(W, H);
  cloud(c, 160, 40, 50);
  cloud(c, 270, 58, 34);
  cloud(c, 20, 64, 26);
  return c;
}

// ---- 5. trees.png — a big shady tree each side (sway) ------------------------------------
function tree(c, r, x, baseY, size, seed) {
  c.ellipse(x + 4, baseY, size * 0.9, 3, PAL.grassDark, 0.5); // shadow on the grass
  const trunkTop = baseY - size * 1.5;
  for (let y = Math.round(trunkTop); y <= baseY; y++) {
    const w = y > baseY - 4 ? 8 : 6; // flares out at the roots
    c.rect(x - w / 2, y, w, 1, PAL.trunk);
    c.rect(x - w / 2 + 1, y, 2, 1, PAL.trunkHi); // sun from the left
  }
  thickLine(c, x, trunkTop + 6, x - size * 0.5, trunkTop - size * 0.3, 2, PAL.trunk);
  thickLine(c, x, trunkTop + 4, x + size * 0.45, trunkTop - size * 0.4, 2, PAL.trunk);
  foliage(c, blobsIn(r, x, trunkTop - size * 0.55, size * 1.05, size * 0.8, 26, size * 0.28, size * 0.45), PAL.leaves, seed, { sun: 'left' });
}

function drawTrees() {
  const c = new Canvas(W, H);
  const r = rng(701);
  tree(c, r, 300, 92, 30, 702);
  tree(c, r, 22, 90, 26, 703);
  tree(c, r, 118, HORIZON - 2, 10, 704); // a small one far off
  // low bushes along the bottom of the hills
  const bushes = [];
  for (const x of [70, 84, 150, 170, 268]) bushes.push(...blobsIn(r, x, HORIZON - 1, 8, 3, 4, 3, 5));
  foliage(c, bushes, PAL.leaves, 705, { sun: 'left' });
  return c;
}

// ---- 4. ground.png — the grass, wildflowers, and our blanket ------------------------------
const BLANKET = { backY: 98, frontY: 134, back: [92, 226], front: [74, 244] };
const blanketEdges = (y) => {
  const t = (y - BLANKET.backY) / (BLANKET.frontY - BLANKET.backY);
  return [BLANKET.back[0] + (BLANKET.front[0] - BLANKET.back[0]) * t, BLANKET.back[1] + (BLANKET.front[1] - BLANKET.back[1]) * t];
};

function drawGround() {
  const c = new Canvas(W, H);
  const r = rng(711);
  c.gradientV(0, HORIZON, W, H - HORIZON, [PAL.grassFar, PAL.grass, PAL.grass, PAL.grassMid]);
  // tufts and wildflowers, bigger towards us
  for (let i = 0; i < 320; i++) {
    const y = r.int(HORIZON + 2, H - 1);
    const x = r.int(0, W - 1);
    const near = (y - HORIZON) / (H - HORIZON);
    c.px(x, y, PAL.grassDark);
    c.px(x - 1, y - 1, PAL.grassMid);
    c.px(x + 1, y - 1, PAL.grassMid);
    if (near > 0.3) c.px(x, y - 2, PAL.grassDark);
    if (r() < 0.14) {
      const col = r.pick(PAL.flowers);
      c.px(x, y - 2, col);
      if (near > 0.4) {
        c.px(x - 1, y - 1, col);
        c.px(x + 1, y - 1, col);
        c.px(x, y - 1, PAL.sun);
      }
    }
  }
  // the blanket: gingham in perspective (checks get bigger towards us)
  softEllipse(c, 160, BLANKET.frontY + 1, 92, 5, PAL.grassDark, 0.6); // its shadow
  for (let y = BLANKET.backY; y <= BLANKET.frontY; y++) {
    const [l, rr] = blanketEdges(y);
    const t = (y - BLANKET.backY) / (BLANKET.frontY - BLANKET.backY);
    const v = Math.floor((t * (1 + t * 0.6)) * 9); // rows of checks
    for (let x = Math.round(l); x <= Math.round(rr); x++) {
      const u = Math.floor(((x - l) / (rr - l)) * 16);
      const stripes = (u % 2) + (v % 2);
      c.px(x, y, stripes === 2 ? PAL.check : stripes === 1 ? PAL.checkLight : PAL.checkCream);
    }
    c.px(Math.round(l), y, PAL.blanketEdge);
    c.px(Math.round(rr), y, PAL.blanketEdge);
  }
  c.rect(BLANKET.front[0], BLANKET.frontY, BLANKET.front[1] - BLANKET.front[0] + 1, 2, PAL.blanketEdge);
  const [bl, br] = blanketEdges(BLANKET.backY);
  c.rect(Math.round(bl), BLANKET.backY, Math.round(br - bl) + 1, 1, PAL.blanketEdge);
  return c;
}

// ---- 6. bikes.png — our bikes on their kickstands (from the photos) ----------------------
const HIS_BIKE = {
  // yellow steel road bike: level top tube, white fork + head tube, white saddle,
  // flat black bars, a black front rack, skinny tyres
  R: 10, wheelbase: 37, level: true, chunky: false, rack: true,
  frame: PAL.yellow, shade: PAL.yellowShade, hi: PAL.yellowHi,
  fork: PAL.bikeWhite, headTube: PAL.bikeWhite, saddle: PAL.bikeWhite, chainring: PAL.bar,
};
const HER_BIKE = {
  // plum-purple mountain bike: sloping top tube, chunky tyres, flat bars, black
  // saddle, a pink bottle cage, white lettering on the down tube
  R: 9, wheelbase: 33, level: false, chunky: true, cage: PAL.cage, lettering: PAL.bikeWhite,
  frame: PAL.purple, shade: PAL.purpleShade, hi: PAL.purpleHi,
  fork: PAL.purple, headTube: PAL.purple, saddle: PAL.bar, chainring: PAL.chromeShade,
};

const lerp = (a, b, t) => ({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) });

/** A side-on bike facing left, standing on its kickstand, front hub at (x, groundY - R). */
function bike(c, x, groundY, b) {
  const R = b.R;
  const F = { x, y: groundY - R }; // front hub
  const B = { x: x + b.wheelbase, y: groundY - R }; // back hub
  const BB = { x: x + Math.round(b.wheelbase * 0.55), y: groundY - R + 2 }; // pedals
  const HEAD = { x: x + 6, y: groundY - Math.round(R * 2.5) }; // top of the head tube
  const HEAD_LOW = { x: x + 4, y: HEAD.y + 6 };
  const SEAT = { x: BB.x + 5, y: b.level ? HEAD.y : HEAD.y + 4 }; // top of the seat tube

  // wheels: tyres (knobbly on hers), silver rims, spokes, hubs
  for (const w of [F, B]) {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * PI * 2 + 0.2;
      c.line(w.x, w.y, w.x + Math.cos(ang) * (R - 2), w.y + Math.sin(ang) * (R - 2), PAL.spoke, 0.6);
    }
    ring(c, w.x, w.y, R, R, PAL.tyre);
    if (b.chunky) {
      ring(c, w.x, w.y, R - 1, R - 1, PAL.tyre);
      for (let a = 0; a < 16; a++) c.px(Math.round(w.x + Math.cos((a / 16) * PI * 2) * (R + 1)), Math.round(w.y + Math.sin((a / 16) * PI * 2) * (R + 1)), PAL.tyre);
    }
    ring(c, w.x, w.y, R - (b.chunky ? 2 : 1), R - (b.chunky ? 2 : 1), PAL.chrome);
    c.px(w.x, w.y, PAL.chromeShade);
  }
  // kickstand
  c.line(BB.x + 3, BB.y + 1, BB.x + 6, groundY, PAL.chromeShade);
  // the frame
  if (b.level) thickLine(c, SEAT.x - 1, SEAT.y + 2, HEAD.x + 1, HEAD.y + 2, 2, b.frame); // level top tube
  else thickLine(c, HEAD.x + 1, HEAD.y + 2, SEAT.x - 1, SEAT.y + 2, 2, b.frame); // sloping top tube
  thickLine(c, HEAD_LOW.x, HEAD_LOW.y, BB.x, BB.y, 2, b.frame); // down tube
  thickLine(c, BB.x, BB.y, SEAT.x, SEAT.y + 1, 2, b.frame); // seat tube
  c.line(BB.x, BB.y, B.x, B.y, b.shade); // chain stay
  c.line(SEAT.x, SEAT.y + 3, B.x, B.y, b.shade); // seat stay
  thickLine(c, HEAD.x, HEAD.y, HEAD_LOW.x, HEAD_LOW.y, 2, b.headTube); // head tube
  thickLine(c, HEAD_LOW.x, HEAD_LOW.y, F.x - 1, F.y, 2, b.fork); // fork
  c.px(HEAD.x + 8, HEAD.y + 2, b.hi); // glints on the paint
  c.px(SEAT.x, SEAT.y + 6, b.hi);
  if (b.lettering) for (const t of [0.3, 0.38, 0.46, 0.54]) { const p = lerp(HEAD_LOW, BB, t); c.px(p.x, p.y, b.lettering); }
  if (b.cage) { const p = lerp(HEAD_LOW, BB, 0.62); c.rect(p.x - 1, p.y - 3, 3, 2, b.cage); }
  // chainring + crank + pedal
  ring(c, BB.x, BB.y, 3, 3, b.chainring);
  c.line(BB.x, BB.y, BB.x - 2, BB.y + 4, PAL.chrome);
  c.rect(BB.x - 4, BB.y + 4, 4, 1, PAL.tyre);
  // seat post + saddle
  c.rect(SEAT.x, SEAT.y - 2, 1, 3, PAL.chrome);
  c.rect(SEAT.x - 3, SEAT.y - 4, 8, 2, b.saddle);
  c.rect(SEAT.x - 2, SEAT.y - 3, 6, 1, b.saddle === PAL.bikeWhite ? PAL.bikeWhiteShade : PAL.tyre);
  // stem + flat bars with grips
  c.rect(HEAD.x, HEAD.y - 3, 1, 3, PAL.chrome);
  c.line(HEAD.x - 1, HEAD.y - 3, HEAD.x + 4, HEAD.y - 3, PAL.bar);
  c.rect(HEAD.x + 4, HEAD.y - 4, 2, 2, PAL.bar);
  // front rack: a little black platform over the front wheel
  if (b.rack) {
    c.rect(HEAD.x - 10, HEAD.y + 1, 10, 1, PAL.bar);
    c.line(HEAD.x - 10, HEAD.y + 2, F.x - 2, F.y - 1, PAL.bar);
  }
}

function drawBikes() {
  const c = new Canvas(W, H);
  // shadows first, then hers (further back), then his
  softEllipse(c, 272, 93, 24, 2, PAL.grassDark, 0.6);
  softEllipse(c, 214, 96, 26, 2, PAL.grassDark, 0.6);
  bike(c, 256, 92, HER_BIKE);
  bike(c, 194, 95, HIS_BIKE);
  rimLight(c, PAL.cloud, 0.25);
  return c;
}

// ---- 7. us.png — lying on the blanket, reading (8-frame flip-book) ------------------------
// Both on our stomachs, propped on our elbows, feet kicking slowly: him at the
// back facing right, her in front facing left, towards him.
const HIM = { gx: 106, gy: 112 }; // his hips + the blanket line under him
const HER = { gx: 190, gy: 128 }; // (she's drawn facing right, then mirrored)

/** One of us lying down. `who` holds the colours; legs = [angle, angle] of the lower legs. */
function lying(c, { gx, gy }, who, legs, blink) {
  const s = PAL;
  const tall = who.tall ? 3 : 0;
  // lower legs bent up behind us, feet in the air (drawn first: behind the thighs)
  const knee = { x: gx - 15 - tall, y: gy - 3 };
  legs.forEach((ang, i) => {
    const len = 12 + tall;
    const fx = Math.round(knee.x + Math.sin(ang) * len);
    const fy = Math.round(knee.y - Math.cos(ang) * len);
    thickLine(c, knee.x, knee.y - 1, fx, fy, 3, i === 0 ? who.legShade : who.leg);
    c.rect(fx - 1, fy - 2, 4, 3, who.shoes);
    c.rect(fx - 1, fy - 2, 4, 1, i === 0 && !who.jacket ? who.shoes : who.sole); // the sole, facing up
    if (who.jacket) {
      c.rect(fx, fy + 1, 3, 2, who.legHi); // turned-up cuffs on his jeans
      c.px(fx, fy - 1, who.lace); // laces
      c.px(fx + 2, fy - 1, who.lace);
    } else {
      c.rect(fx, fy + 1, 3, 1, who.shoes); // ankle strap
    }
  });
  // thighs, from the knees to the hips
  for (let x = knee.x - 1; x <= gx; x++) {
    const thick = x < knee.x + 4 ? 4 : 5;
    c.rect(x, gy - thick - 1, 1, thick, x > gx - who.skirt ? who.body : who.leg);
    c.px(x, gy - 1, x > gx - who.skirt ? who.bodyShade : who.legShade);
  }
  if (who.skirt) {
    // soft pleats down her skirt, and a lace hem with little scallops
    for (let x = gx - who.skirt + 2; x <= gx - 1; x += 3) {
      c.rect(x, gy - 5, 1, 3, who.bodyShade);
      c.rect(x + 1, gy - 5, 1, 3, who.bodyHi);
    }
    const hemX = gx - who.skirt + 1;
    for (let y = gy - 6; y <= gy - 1; y++) {
      c.px(hemX, y, y % 2 ? who.lace : who.laceShade);
      if (y % 2 === 0) c.px(hemX - 1, y, who.lace);
    }
  } else if (who.jacket) {
    // jeans: a seam along his thigh, light on the knee, a back pocket by his hip
    c.line(knee.x + 1, gy - 3, gx - 4, gy - 3, who.legShade);
    c.px(knee.x, gy - 5, who.legHi);
    c.px(knee.x + 1, gy - 5, who.legHi);
    c.rect(gx - 9, gy - 6, 5, 1, who.legShade);
    c.rect(gx - 9, gy - 5, 1, 2, who.legShade);
    c.rect(gx - 5, gy - 5, 1, 2, who.legShade);
    c.px(gx - 7, gy - 4, who.legHi); // a rivet
  }
  // the far arm (in shadow, behind the body)
  thickLine(c, gx + 13 + tall, gy - 10, gx + 17 + tall, gy - 2, 3, who.armShade);
  thickLine(c, gx + 17 + tall, gy - 2, gx + 25 + tall, gy - 4, 3, who.armShade);
  // body: low at the hips, rising to the shoulders (propped on our elbows)
  const len = 16 + tall;
  for (let x = gx - 3; x <= gx + len; x++) {
    const t = Math.max(0, Math.min(1, (x - gx) / len));
    const top = Math.round(gy - 7 - 4 * t - (x < gx + 2 ? 1 : 0));
    const bottom = Math.round(gy - 1 - 3 * t);
    c.rect(x, top, 1, bottom - top + 1, who.body);
    c.px(x, bottom, who.bodyShade);
    c.px(x, top, who.bodyHi);
  }
  const bodyTop = (x) => Math.round(gy - 7 - 4 * Math.max(0, Math.min(1, (x - gx) / len)) - (x < gx + 2 ? 1 : 0));
  const bodyBottom = (x) => Math.round(gy - 1 - 3 * Math.max(0, Math.min(1, (x - gx) / len)));
  if (who.jacket) {
    // white shirt showing at the open front of the jacket
    for (let x = gx + 7; x <= gx + len; x++) c.px(x, Math.round(gy - 1 - 3 * ((x - gx) / len)) - 1, s.shirt);
    // jacket: a seam along his side, its hem riding over his jeans at the hip, a pocket flap
    c.line(gx + 1, gy - 4, gx + len - 3, gy - 7, who.bodyShade);
    for (let y = bodyTop(gx - 3); y <= bodyBottom(gx - 3); y++) c.px(gx - 3, y, who.bodyShade);
    c.rect(gx + 3, gy - 3, 3, 1, who.bodyShade);
  } else {
    // her sash at the waist, tied in a bow on her back with the tails lying on the skirt
    for (const x of [gx + 2, gx + 3])
      for (let y = bodyTop(x); y <= bodyBottom(x); y++) c.px(x, y, x === gx + 2 ? who.sashDark : who.sash);
    const by = bodyTop(gx + 2) - 2;
    c.map(['bb.bb', 'brKrb', 'bb.bb'], { b: who.sashLoop, r: who.sashLoopHi, K: who.sashDark }, gx, by - 1);
    c.px(gx, by + 3, who.sash); // tails
    c.px(gx - 1, by + 4, who.sashDark);
    c.px(gx + 4, by + 3, who.sash);
  }
  // neck + head (side view, facing right, looking down at the book): the neck
  // rises out of the top of the shoulders and the head sits on it
  const shoulder = { x: gx + len, y: gy - 11 };
  const hx = shoulder.x + 4;
  const hy = shoulder.y - 6; // head sits low on the shoulders: only a short neck shows
  c.rect(shoulder.x - 3, hy + 4, 4, shoulder.y - hy - 2, who.skin);
  c.px(shoulder.x - 3, hy + 6, who.skinShade);
  if (who.jacket) {
    c.rect(shoulder.x - 4, shoulder.y - 1, 2, 2, who.bodyHi); // his collar
    c.px(shoulder.x, shoulder.y, s.shirt); // shirt collar point
  } else {
    c.px(shoulder.x - 4, shoulder.y, who.lace); // lace along her neckline
    c.px(shoulder.x, shoulder.y + 1, who.lace);
  }
  who.head(c, hx, hy, blink);
  // near arm: shoulder -> elbow on the blanket -> hands on the book
  thickLine(c, gx + 14 + tall, gy - 10, gx + 18 + tall, gy - 2, 3, who.arm);
  thickLine(c, gx + 18 + tall, gy - 2, gx + 26 + tall, gy - 3, 3, who.arm);
  if (who.sleeve) {
    // a puff sleeve on her shoulder, gathered underneath
    c.ellipse(gx + 15 + tall, gy - 11, 2.4, 1.6, who.bodyHi);
    c.rect(gx + 13 + tall, gy - 9, 4, 1, who.bodyDeep);
  }
  if (who.jacket) {
    c.px(gx + 18 + tall, gy - 3, who.bodyHi); // light on his elbow
    c.rect(gx + 23 + tall, gy - 4, 2, 3, who.bodyShade); // jacket cuff...
    c.rect(gx + 25 + tall, gy - 4, 1, 3, s.shirt); // ...and his shirt cuff
  }
  c.rect(gx + 26 + tall, gy - 4, 3, 2, who.skin); // hand on the page
}

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
      const [r, g, b, a] = c.get(x, y);
      if (!a || `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}` !== s.herHair) continue;
      if (y < hy - 4 || (x + y) % 2 === 0) c.px(x, y, s.herRoots);
    }
  for (const [x, y] of [[hx - 4, hy - 1], [hx - 3, hy - 2], [hx - 5, hy + 1], [hx + 4, hy - 2]]) c.px(x, y, s.herHairHi);
  if (blink) c.px(hx + 5, hy + 2, s.herSkinShade);
  else {
    c.px(hx + 5, hy + 2, s.eye); // eyes down on the page
    c.px(hx + 6, hy + 2, s.eye);
  }
  c.px(hx + 6, hy, s.piercing);
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
  body: PAL.herDress, bodyShade: PAL.herDressShade, bodyHi: PAL.herDressHi, bodyDeep: PAL.herDressDeep, skirt: 9,
  lace: PAL.lace, laceShade: PAL.laceShade,
  sash: PAL.sash, sashDark: PAL.sashDark, sashLoop: PAL.sashLoop, sashLoopHi: PAL.sashLoopHi,
  leg: PAL.herSkin, legShade: PAL.herSkinShade, shoes: PAL.herShoes, sole: '#cfd0d8',
  arm: PAL.herSkin, armShade: PAL.herSkinShade, sleeve: PAL.herDress,
  skin: PAL.herSkin, skinShade: PAL.herSkinShade, head: herHead,
};
const HIM_LOOK = {
  body: PAL.jacket, bodyShade: PAL.jacketShade, bodyHi: PAL.jacketHi, skirt: 0, jacket: true, tall: true,
  leg: PAL.jeans, legShade: PAL.jeansShade, legHi: PAL.jeansHi, shoes: PAL.himShoes, sole: PAL.himSole, lace: PAL.himShoesHi,
  arm: PAL.jacket, armShade: PAL.jacketShade,
  skin: PAL.himSkin, skinShade: PAL.himSkinShade, head: himHead,
};

/** An open book lying on the blanket, pages fanning up a little at the outer edges. */
function book(c, x, y, cover) {
  c.rect(x, y, 15, 1, cover);
  c.rect(x, y - 2, 15, 2, PAL.pages);
  c.px(x, y - 3, PAL.pages);
  c.px(x + 14, y - 3, PAL.pages);
  c.rect(x + 7, y - 2, 1, 2, PAL.pagesShade); // the spine
  for (const px of [x + 2, x + 4, x + 10, x + 12]) c.px(px, y - 1, PAL.pagesShade); // lines of text
}

function herDrink(c, x, y) {
  c.rect(x, y - 9, 6, 10, PAL.glass);
  c.rect(x + 1, y - 6, 4, 6, PAL.herDrink);
  c.px(x + 1, y - 4, PAL.glass); // ice
  c.px(x + 3, y - 2, PAL.glass);
  c.line(x + 3, y - 6, x + 5, y - 13, PAL.straw);
  c.rect(x - 1, y - 10, 2, 2, PAL.lemon);
}

function hisDrink(c, x, y) {
  c.rect(x, y - 9, 5, 10, PAL.bottle);
  c.rect(x + 1, y - 13, 3, 4, PAL.bottle);
  c.rect(x + 1, y - 14, 3, 1, PAL.chrome); // cap
  c.rect(x, y - 6, 5, 4, PAL.label);
  c.rect(x + 1, y - 9, 1, 3, PAL.bottleHi);
}

/** Left-right mirror image of a canvas. */
function mirror(src) {
  const out = new Canvas(src.width, src.height);
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const [r, g, b, a] = src.get(x, y);
      if (a) out.px(src.width - 1 - x, y, [r, g, b], a / 255);
    }
  return out;
}

function drawUsFrame(f) {
  const c = new Canvas(W, H);
  const k = (f / 8) * PI * 2;
  // soft shadows on the blanket under each of us
  softEllipse(c, HIM.gx + 6, HIM.gy, 30, 2, PAL.shadow, 0.5);
  softEllipse(c, HER.gx - 6, HER.gy, 28, 2, PAL.shadow, 0.5);

  const him = new Canvas(W, H);
  hisDrink(him, HIM.gx + 44, HIM.gy - 7); // just behind his book, clear of her kicking feet
  book(him, HIM.gx + 26, HIM.gy - 1, PAL.himBook);
  lying(him, HIM, HIM_LOOK, [0.15 + Math.sin(k + 1) * 0.2, 0.35 + Math.sin(k + 1 + PI) * 0.2], f === 2);
  rimLight(him, PAL.sunCore, 0.25);
  him.outline(PAL.outline);

  // her: drawn facing right at the mirror-image spot, then flipped to face him
  const drawn = new Canvas(W, H);
  const at = { gx: W - 1 - HER.gx, gy: HER.gy };
  herDrink(drawn, at.gx + 46, at.gy - 1);
  book(drawn, at.gx + 25, at.gy - 1, PAL.herBook);
  lying(drawn, at, HER_LOOK, [0.1 + Math.sin(k) * 0.35, 0.45 + Math.sin(k + PI) * 0.35], f === 6);
  const her = mirror(drawn);
  rimLight(her, PAL.sunCore, 0.25);
  her.outline(PAL.outline);

  c.blit(him, 0, 0);
  c.blit(her, 0, 0);
  return c;
}

function drawUs() {
  const sheet = new Canvas(W * 8, H);
  for (let f = 0; f < 8; f++) sheet.blit(drawUsFrame(f), f * W, 0);
  return sheet;
}

// ---- 8. butterflies.png — two butterflies fluttering about (4 frames) ---------------------
function drawButterflies() {
  const sheet = new Canvas(W * 4, H);
  for (let f = 0; f < 4; f++) {
    for (const [bx, by, col] of [[70, 74, PAL.butterflyA], [262, 108, PAL.butterflyB]]) {
      const x = f * W + bx + Math.round(Math.cos((f * PI) / 2) * 5);
      const y = by + Math.round(Math.sin((f * PI) / 2) * 3);
      sheet.px(x, y, PAL.outline);
      sheet.px(x, y + 1, PAL.outline);
      if (f % 2 === 0) {
        sheet.rect(x - 3, y - 1, 3, 3, col);
        sheet.rect(x + 1, y - 1, 3, 3, col);
        sheet.px(x - 2, y, PAL.cloud);
        sheet.px(x + 2, y, PAL.cloud);
      } else {
        sheet.rect(x - 1, y - 2, 1, 3, col);
        sheet.rect(x + 1, y - 2, 1, 3, col);
      }
    }
  }
  return sheet;
}

// ---- The picnic for the map: picnic.png (4 x 2 tiles) -------------------------------------
// Top row: the two bikes on their kickstands (solid). Bottom row: the blanket with
// two books and two drinks (she can walk on it).
const MAP_PICNIC = { cols: 4, rows: 2 };

/** A tiny side-on bike for the map, facing left, front hub at (x, gy - 4). */
function mapBike(c, x, gy, b) {
  const R = 4;
  for (const wx of [x, x + 15]) {
    ring(c, wx, gy - R, R, R, PAL.tyre);
    if (b.chunky) ring(c, wx, gy - R, R - 1, R - 1, PAL.tyre);
    c.px(wx, gy - R, PAL.chrome);
  }
  const BB = { x: x + 8, y: gy - 3 };
  c.line(x + 2, gy - 9, BB.x, BB.y, b.frame); // down tube
  if (b.level) c.line(x + 3, gy - 10, x + 11, gy - 10, b.frame);
  else c.line(x + 3, gy - 10, x + 10, gy - 8, b.frame);
  c.line(BB.x, BB.y, x + 11, gy - 11, b.frame); // seat tube
  c.line(BB.x, BB.y, x + 15, gy - R, b.shade);
  c.line(x + 11, gy - 10, x + 15, gy - R, b.shade);
  c.line(x + 2, gy - 10, x, gy - R, b.fork); // fork
  c.rect(x + 9, gy - 12, 4, 1, b.saddle);
  c.rect(x + 1, gy - 12, 1, 2, PAL.chrome);
  c.line(x, gy - 12, x + 3, gy - 12, PAL.bar); // bars
  if (b.rack) c.rect(x - 3, gy - 10, 4, 1, PAL.bar);
  if (b.cage) c.px(x + 5, gy - 7, b.cage);
}

function drawMapPicnic() {
  const c = new Canvas(MAP_PICNIC.cols * 16, MAP_PICNIC.rows * 16);
  // the bikes
  c.ellipse(20, 15, 11, 1.5, PAL.grassDark, 0.5);
  c.ellipse(46, 15, 11, 1.5, PAL.grassDark, 0.5);
  mapBike(c, 11, 15, HIS_BIKE);
  mapBike(c, 38, 15, HER_BIKE);
  // the blanket
  c.rect(11, 20, 42, 11, PAL.grassDark, 0.4); // shadow
  for (let y = 18; y < 30; y++)
    for (let x = 10; x < 52; x++) {
      const stripes = (Math.floor((x - 10) / 3) % 2) + (Math.floor((y - 18) / 3) % 2);
      c.px(x, y, stripes === 2 ? PAL.check : stripes === 1 ? PAL.checkLight : PAL.checkCream);
    }
  c.rect(10, 29, 42, 1, PAL.blanketEdge);
  // two open books and a drink each
  for (const [bx, cover] of [[16, PAL.himBook], [34, PAL.herBook]]) {
    c.rect(bx, 22, 9, 5, cover);
    c.rect(bx + 1, 22, 7, 4, PAL.pages);
    c.rect(bx + 4, 22, 1, 4, PAL.pagesShade);
  }
  c.rect(27, 20, 2, 4, PAL.bottle);
  c.px(27, 19, PAL.bottle);
  c.rect(45, 21, 3, 3, PAL.herDrink);
  c.px(45, 21, PAL.glass);
  c.px(47, 19, PAL.straw);
  return c;
}

/** Swap the picnic's blanket tiles for our picnic, at the top-left of its trigger (first time only). */
function addToMap() {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (map.tilesets.some((t) => t.name === 'picnic')) {
    console.log('  map      already has our picnic — left untouched');
    return;
  }
  const layer = (name) => map.layers.find((l) => l.name === name);
  const trigger = layer('Triggers').objects.find((o) => o.properties?.some((p) => p.name === 'memoryId' && p.value === 'park-picnic'));
  if (!trigger) return console.warn('  ! no park-picnic trigger in the map — picnic not added');
  const at = { x: trigger.x / 16, y: trigger.y / 16 };
  // clear the old blanket (and anything else in the picnic spot)
  for (let y = at.y; y < at.y + trigger.height / 16; y++)
    for (let x = at.x; x < at.x + trigger.width / 16; x++) layer('Decor').data[y * map.width + x] = 0;
  // top row (bikes) solid, bottom row (blanket) walkable
  const walkable = Array.from({ length: MAP_PICNIC.cols }, (_, i) => MAP_PICNIC.cols + i);
  stampBuilding(map, { name: 'picnic', image: '../public/assets/tiles/picnic.png', ...MAP_PICNIC, at, walkable });
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  console.log(`  map      put our picnic (bikes + blanket) at tiles x ${at.x}–${at.x + MAP_PICNIC.cols - 1}, y ${at.y}–${at.y + MAP_PICNIC.rows - 1}`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing the picnic in the park…');
const layers = {
  sky: drawSky(),
  sun: drawSun(),
  clouds: drawClouds(),
  ground: drawGround(),
  trees: drawTrees(),
  bikes: drawBikes(),
  us: drawUs(),
  butterflies: drawButterflies(),
};
for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);
const mapPicnic = drawMapPicnic();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'picnic.png'), mapPicnic);
addToMap();

// ---- Previews (3x) ----------------------------------------------------------------------------
const flat = new Canvas(W, H);
for (const src of Object.values(layers)) {
  const first = new Canvas(W, H); // frame 1 of any flip-book
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = src.get(x, y);
      if (a) first.px(x, y, [r, g, b], a / 255);
    }
  flat.blit(first, 0, 0);
}
writePreview('park-picnic.png', flat);
const mapPreview = new Canvas(mapPicnic.width + 32, mapPicnic.height + 32);
mapPreview.rect(0, 0, mapPreview.width, mapPreview.height, '#8cc269');
mapPreview.blit(mapPicnic, 16, 16);
writePreview('park-picnic-map.png', mapPreview);
console.log('  preview  tools/previews/park-picnic.png, tools/previews/park-picnic-map.png');
