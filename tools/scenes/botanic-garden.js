#!/usr/bin/env node
// -----------------------------------------------------------------------------
// botanic-garden.js — draws the "Dandenong Ranges Botanic Garden" memory as
// layered pixel art, plus the garden itself for the map (a pond with a
// boardwalk out to a lookout), and adds that garden, a path to it (moving the
// picnic out of its way) and its
// trigger to maps/world.json (only the first time).
//
//   npm run scene:garden                      # (re)draw everything
//   npm run scene:garden -- --keep us,pond    # don't overwrite layers you've redrawn
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/memories/botanic-garden/*.png   the 11 cutscene layers
//   public/assets/tiles/garden.png                the garden for the map (10x9 tiles, 2 water frames)
//   tools/previews/botanic-garden.png             flattened preview (3x size)
//   tools/previews/botanic-garden-map.png         the garden on grass (3x size)
//
// Reference: a photo from the day — a sunny, washed-out sky, tall gums,
// golden and orange autumn trees reflected in a still pond, reeds, and the two
// of us leaning on a weathered grey timber railing, her head on his shoulder.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas, rng, bayer } from '../lib/canvas.js';
import { ROOT, makeSaver, thickLine, rimLight, softEllipse, writePreview, stampBuilding, blobsIn, foliage } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // sky: bright and a little over-exposed, like the photo
  skyTop: '#cfe6e6',
  skyMid: '#e4f1ea',
  skyHaze: '#f7f6e4',
  sunCore: '#fffdf0',
  haze: '#fff6dc',
  // far hills of forest, soft and misty
  mist: ['#86a594', '#98b6a2', '#adc8b2'],
  // tall gums: pale trunks, olive canopies
  gumTrunk: '#e6dfd0',
  gumTrunkShade: '#b9b0a0',
  gumBark: '#8e8576',
  gumLeaves: ['#2f4b3a', '#425f45', '#5a7a52', '#7a9862'],
  // autumn trees
  gold: ['#8a6a2c', '#b8923a', '#dfbd55', '#f3dc86'],
  amber: ['#7a3e2c', '#a8573a', '#d27e40', '#eca75c'],
  lime: ['#56682c', '#7f9234', '#a9b84a', '#d4dc7c'],
  shrub: ['#2c4a32', '#3f6a3a', '#5f9040', '#8ebd58'],
  bankDark: '#22362a',
  // the pond
  water: '#33503f',
  waterDeep: '#263f33',
  waterSky: '#9fbfb2',
  glint: '#f4fbf0',
  // reeds and rushes
  reed: '#7a9446',
  reedLight: '#a9bf62',
  reedDark: '#4e6634',
  reedTip: '#cdd383',
  cattail: '#6e4a32',
  // weathered grey timber (railing in the cutscene, boardwalk on the map)
  timberHi: '#d9d2c2',
  timber: '#b5ab98',
  timberShade: '#8f8574',
  timberDark: '#635b4e',
  // her (as in the photo): light-brown bob with a fringe, pale blue sundress
  // with white puff sleeves, a black bag. (Her usual pink: '#e0607e'.)
  herHair: '#9a6a44',
  herHairHi: '#c4925e',
  herHairShade: '#74492f',
  herSkin: '#d9a47c',
  herSkinShade: '#bf8862',
  herBlush: '#e0877a',
  dress: '#b9d0ec',
  dressShade: '#8eaad2',
  dressHi: '#dbe7f6',
  sleeve: '#f3f5fa',
  sleeveShade: '#cfd6e6',
  bag: '#2b2630',
  bagHi: '#4a4452',
  flower: '#f08aa3',
  flowerHi: '#ffc2d0',
  piercing: '#e4e8f2',
  // him: faded military-green cap with sunglasses up top, dark blue-green T-shirt, jeans
  himSkin: '#ecbf9f',
  himSkinShade: '#d6a585',
  himBlush: '#e09c84',
  himHair: '#231c24',
  cap: '#7c8262',
  capHi: '#9ca07e',
  capDark: '#5a5f45',
  shades: '#1b1a22',
  shadesHi: '#7d8aa0',
  tee: '#24494c',
  teeShade: '#193537',
  teeHi: '#376466',
  jeans: '#7b93ba',
  jeansShade: '#5f779f',
  eye: '#2a1f2a',
  outline: '#2a1f2a',
  // the map tile version (brighter, to sit next to the cosy tileset)
  mapWater: '#4f8f86',
  mapWaterDeep: '#3f7772',
  mapWaterLight: '#86c0b0',
  mapBank: '#6b7a3c',
  mapEarth: '#7a6040',
  mapTimberHi: '#c4b496',
  mapTimber: '#a8967a',
  mapTimberShade: '#857358',
  mapTimberDark: '#5e4f3c',
  lilyPad: '#6fa850',
  rhodo: ['#2f5a38', '#3f7442', '#5a9450', '#78ad5c'],
  rhodoFlowers: ['#e86a8a', '#f59ac4', '#c94a6e', '#fff3dc'],
};

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const PI = Math.PI;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'botanic-garden');
const save = makeSaver();

const BANK_Y = 94; // where the far bank meets the water (the mirror line)

// ---- 1. sky.png — bright hazy sky, brightest at the top right -------------------------
function drawSky() {
  const c = new Canvas(W, H);
  c.gradientV(0, 0, W, 100, [PAL.skyTop, PAL.skyMid, PAL.skyHaze]);
  softEllipse(c, 300, 6, 150, 90, PAL.skyHaze, 0.9);
  softEllipse(c, 300, 0, 70, 46, PAL.sunCore, 0.9);
  return c;
}

// ---- 2. trees-back.png — misty forest + the tall gums ---------------------------------
const GUMS = [
  // trunk x, trunk width, top of the trunk, canopy clumps [dx, dy, rx, ry]
  { x: 118, w: 4, top: 30, clumps: [[-14, -16, 16, 11], [8, -22, 14, 10], [-2, -2, 11, 7]] },
  { x: 166, w: 5, top: 18, clumps: [[-10, -14, 18, 11], [14, -8, 14, 9], [0, -26, 16, 10]] },
  { x: 206, w: 3, top: 34, clumps: [[-6, -10, 12, 8], [10, -18, 12, 9]] },
  { x: 244, w: 5, top: 14, clumps: [[-12, -6, 14, 9], [10, -14, 16, 10], [-4, -26, 14, 9]] },
  { x: 298, w: 4, top: 30, clumps: [[-14, -14, 14, 10], [10, -4, 12, 8]] },
];

function drawTreesBack() {
  const c = new Canvas(W, H);
  const r = rng(501);
  // far forest across the whole valley, fading into the haze
  const mist = [];
  for (let x = -10; x < W + 20; x += 14) mist.push({ x, y: r.range(66, 76), r: r.range(12, 20) });
  for (let x = 0; x < W + 10; x += 9) mist.push({ x, y: r.range(82, 90), r: r.range(8, 12) });
  foliage(c, mist, PAL.mist, 502);
  c.rect(0, 88, W, BANK_Y - 88, PAL.mist[0]);

  // the gums: pale trunks with peeling bark, branches up into sparse canopies
  for (const g of GUMS) {
    for (let y = g.top; y < BANK_Y; y++) {
      const wobble = Math.round(Math.sin(y * 0.09 + g.x) * 1.2);
      const w = g.w + (y > BANK_Y - 10 ? 1 : 0);
      c.rect(g.x + wobble, y, w, 1, PAL.gumTrunk);
      c.px(g.x + wobble, y, PAL.gumTrunkShade); // shade on the side away from the sun
      if ((y * 7 + g.x) % 11 === 0) c.px(g.x + wobble + 1, y, PAL.gumBark);
    }
    for (const [dx, dy] of g.clumps) thickLine(c, g.x + 1, g.top + 8, g.x + dx, g.top + dy + 4, dx < 0 ? 1 : 2, PAL.gumTrunkShade);
    const blobs = g.clumps.flatMap(([dx, dy, rx, ry]) => blobsIn(r, g.x + dx, g.top + dy, rx, ry, 9, 4, 7));
    foliage(c, blobs, PAL.gumLeaves, g.x);
    // sky through the gaps (gum canopies are open and airy)
    for (let i = 0; i < 26; i++) {
      const b = r.pick(blobs);
      c.rect(Math.round(b.x + r.range(-3, 3)), Math.round(b.y + r.range(-3, 3)), r.int(1, 2), 1, PAL.skyMid);
    }
  }
  return c;
}

// ---- 3. trees-autumn.png — the golden and orange trees, shrubs on the far bank --------
function drawTreesAutumn() {
  const c = new Canvas(W, H);
  const r = rng(511);
  // left: a big golden tree, an orange one in front, yellow-green beside them
  foliage(c, blobsIn(r, 28, 46, 34, 34, 34, 7, 12), PAL.gold, 512);
  foliage(c, blobsIn(r, 86, 66, 26, 22, 22, 6, 10), PAL.lime, 513);
  foliage(c, blobsIn(r, 52, 72, 26, 18, 24, 6, 10), PAL.amber, 514);
  // right: a bright green tree catching the sun
  foliage(c, blobsIn(r, 296, 66, 30, 24, 24, 6, 11), PAL.lime, 515);
  // shrubs and ferns all along the far bank
  const bank = [];
  for (let x = -6; x < W + 8; x += 7) bank.push({ x, y: r.range(86, 90), r: r.range(5, 9) });
  foliage(c, bank, PAL.shrub, 516);
  // dark line where the bank meets the water
  for (let x = 0; x < W; x++) {
    c.px(x, BANK_Y - 1, PAL.bankDark);
    if ((x * 5) % 7 < 3) c.px(x, BANK_Y - 2, PAL.bankDark);
  }
  return c;
}

// ---- 4. pond.png — still dark water mirroring the trees ---------------------------------
function drawPond(mirror) {
  const c = new Canvas(W, H);
  const r = rng(521);
  c.gradientV(0, BANK_Y, W, H - BANK_Y, [PAL.water, PAL.water, PAL.waterDeep]);
  // the reflection: the scene above, upside down, darkened and broken into ripples
  for (let y = BANK_Y; y < H; y++) {
    const d = y - BANK_Y;
    const strength = Math.max(0, 0.62 - d / 140);
    const shift = Math.round(Math.sin(y * 0.8) * (1 + d / 30));
    for (let x = 0; x < W; x++) {
      const [rr, gg, bb, a] = mirror.get(x + shift, BANK_Y - 1 - d);
      if (!a) continue;
      const broken = (y % 3 === 0 && (x + y * 3) % 13 < 5) ? 0.4 : 1; // ripple lines
      c.px(x, y, [rr, gg, bb], strength * broken);
    }
  }
  // the sky's reflection: pale streaks, mostly on the bright right side
  for (let i = 0; i < 70; i++) {
    const y = r.int(BANK_Y + 4, H - 6);
    const x = r.int(150, W) - (y - BANK_Y);
    c.rect(x, y, r.int(4, 14), 1, PAL.waterSky, 0.35);
  }
  return c;
}

// ---- 5. glints.png — sun sparkling on the water (twinkle) -------------------------------
function drawGlints() {
  const c = new Canvas(W, H);
  const r = rng(531);
  for (let i = 0; i < 30; i++) {
    const y = r.int(BANK_Y + 3, 132);
    const x = r.int(170, 318);
    c.px(x, y, PAL.glint);
    if (r() < 0.4) c.px(x + 1, y, PAL.glint, 0.6);
  }
  for (let i = 0; i < 8; i++) c.px(r.int(4, 130), r.int(BANK_Y + 6, 128), PAL.glint, 0.8);
  return c;
}

// ---- 6. reeds.png — rushes and cattails along the near bank (sway) ----------------------
function reedClump(c, r, x, base, height, spread, cattails = 1) {
  for (let i = 0; i < spread * 2; i++) {
    const bx = x + r.int(-spread, spread);
    const h = Math.round(height * r.range(0.55, 1));
    const lean = r.range(-0.18, 0.18);
    const col = r.pick([PAL.reed, PAL.reed, PAL.reedLight, PAL.reedDark]);
    for (let k = 0; k < h; k++) {
      const px = Math.round(bx + lean * k);
      c.px(px, base - k, k > h - 3 ? PAL.reedTip : k < 4 ? PAL.reedDark : col);
    }
  }
  for (let i = 0; i < cattails; i++) {
    const bx = x + r.int(-spread + 1, spread - 1);
    const top = base - Math.round(height * r.range(0.8, 1.05));
    c.rect(bx, top + 5, 1, base - top - 5, PAL.reedDark);
    c.rect(bx - 1, top + 1, 2, 5, PAL.cattail);
    c.px(bx, top, PAL.reedDark);
  }
}

function drawReeds() {
  const c = new Canvas(W, H);
  const r = rng(541);
  // left: tall and thick, like the photo
  for (const [x, base, h, s, cats] of [[6, 150, 46, 7, 1], [24, 146, 40, 8, 2], [44, 150, 36, 7, 0], [64, 148, 32, 7, 1], [84, 150, 26, 6, 0], [104, 150, 20, 5, 0]])
    reedClump(c, r, x, base, h, s, cats);
  // right: a bright stand catching the light
  for (const [x, base, h, s, cats] of [[214, 150, 20, 5, 0], [232, 148, 30, 6, 1], [254, 150, 38, 8, 1], [278, 146, 44, 8, 2], [302, 150, 42, 8, 1], [318, 148, 36, 6, 0]])
    reedClump(c, r, x, base, h, s, cats);
  rimLight(c, PAL.reedTip, 0.5);
  return c;
}

// ---- 7. deck.png — the boardwalk we're standing on --------------------------------------
function drawDeck() {
  const c = new Canvas(W, H);
  // planks running across, getting deeper towards us (a touch of perspective)
  // (a shade darker than the railing, so the railing stands out in front)
  const r = rng(571);
  let y = DECK_TOP;
  for (let row = 0; y < H; row++) {
    const h = 3 + Math.floor(row / 2);
    c.rect(0, y, W, h, row % 3 === 1 ? PAL.timberShade : PAL.timber);
    c.rect(0, y + h - 1, W, 1, PAL.timberDark);
    for (let x = r.int(20, 120); x < W; x += r.int(90, 150)) c.rect(x, y, 1, h - 1, PAL.timberDark); // plank ends
    for (let i = 0; i < 4; i++) c.rect(r.int(0, W), y + r.int(0, h - 2), r.int(5, 16), 1, PAL.timberShade); // grain
    y += h;
  }
  c.rect(0, DECK_TOP, W, 1, PAL.timberDark); // the deck's back edge
  softEllipse(c, 163, FEET, 26, 4, PAL.timberDark, 0.5); // our shadow
  return c;
}

// ---- 8. us.png — the two of us at the railing (8-frame flip-book) -----------------------
// Both facing us, like the photo: him tall in a cap, her head tilted a little towards him.
const HER = { x: 151, headX: 153, headY: 95 }; // body centre + her head, tilted a touch towards him
const HIM = { x: 173, headX: 171, headY: 80 };
const RAIL_TOP = 125; // top surface of the railing (hands rest just above it)
const DECK_TOP = 146; // back edge of the boardwalk we're standing on
const FEET = 154;

function drawHim(dy, blink) {
  const c = new Canvas(W, H);
  const s = PAL;
  const x = HIM.x;
  // jeans (mostly behind the railing) + shoes on the boardwalk
  c.rect(x - 8, 120, 7, FEET - 121, s.jeans);
  c.rect(x + 1, 120, 7, FEET - 121, s.jeans);
  c.rect(x - 1, 120, 2, 6, s.jeans);
  c.rect(x - 8, 120, 1, FEET - 121, s.jeansShade);
  c.rect(x + 1, 128, 1, FEET - 129, s.jeansShade);
  c.rect(x - 9, FEET - 1, 8, 2, s.capDark);
  c.rect(x + 1, FEET - 1, 8, 2, s.capDark);
  // his right arm (our left) goes round her, behind her head: just the sleeve shows
  c.rect(x - 12, 94 + dy, 4, 8, s.teeShade);
  // T-shirt: broad shoulders, loose body
  c.rect(x - 9, 93 + dy, 18, 28 - dy, s.tee);
  c.clear(x - 9, 93 + dy);
  c.clear(x + 8, 93 + dy);
  c.rect(x - 9, 94 + dy, 2, 27 - dy, s.teeShade); // shade on the left (sun is on the right)
  c.rect(x + 2, 93 + dy, 6, 1, s.teeHi); // sun on his shoulder
  c.rect(x - 8, 118, 16, 3, s.teeShade); // hem
  // short sleeves + his left arm (our right) down to the railing
  c.rect(x + 8, 94 + dy, 4, 8, s.tee);
  c.rect(x + 8, 101 + dy, 4, 1, s.teeShade);
  thickLine(c, x + 9, 102 + dy, x + 11, 113, 3, s.himSkin);
  thickLine(c, x + 11, 113, x + 13, RAIL_TOP - 3, 3, s.himSkin);
  c.rect(x + 11, RAIL_TOP - 3, 5, 3, s.himSkin); // hand on the rail
  c.px(x + 10, 110, s.himSkinShade);
  // neck + crew neckline
  c.rect(HIM.headX - 2, 86 + dy, 5, 7, s.himSkin);
  c.px(HIM.headX - 2, 89 + dy, s.himSkinShade);
  c.rect(HIM.headX - 3, 93 + dy, 7, 1, s.teeShade);
  // head: face, short dark hair at the sides, ears
  const hx = HIM.headX;
  const hy = HIM.headY + dy;
  c.ellipse(hx, hy + 1, 5.6, 6.4, s.himSkin);
  c.rect(hx - 6, hy - 2, 2, 5, s.himHair); // sideburns under the cap
  c.rect(hx + 5, hy - 2, 2, 5, s.himHair);
  c.px(hx - 6, hy + 1, s.himSkinShade); // ears
  c.px(hx + 6, hy + 1, s.himSkinShade);
  // cap: dome, sunglasses pushed up on top, brim facing forward
  c.ellipse(hx, hy - 5, 6.6, 4.4, s.cap);
  c.rect(hx - 6, hy - 5, 13, 3, s.cap);
  c.rect(hx + 1, hy - 9, 4, 1, s.capHi);
  c.rect(hx - 5, hy - 8, 4, 2, s.shades); // sunglasses
  c.rect(hx + 1, hy - 8, 4, 2, s.shades);
  c.rect(hx - 1, hy - 8, 2, 1, s.shades);
  c.px(hx + 3, hy - 8, s.shadesHi);
  c.px(hx - 3, hy - 8, s.shadesHi);
  // the brim: sticks out past the cap, lit on top, dark underneath
  c.rect(hx - 8, hy - 3, 17, 1, s.capHi);
  c.rect(hx - 8, hy - 2, 17, 1, s.cap);
  c.rect(hx - 7, hy - 1, 15, 1, s.capDark);
  c.clear(hx - 8, hy - 3);
  c.clear(hx + 8, hy - 3);
  // face: eyes (in the brim's shadow), a small smile
  if (blink) {
    c.rect(hx - 3, hy + 2, 2, 1, s.himSkinShade);
    c.rect(hx + 2, hy + 2, 2, 1, s.himSkinShade);
  } else {
    c.px(hx - 2, hy + 1, s.eye);
    c.px(hx - 2, hy + 2, s.eye);
    c.px(hx + 2, hy + 1, s.eye);
    c.px(hx + 2, hy + 2, s.eye);
  }
  c.rect(hx - 1, hy + 0, 3, 1, s.himSkinShade); // shadow of the brim on his face
  c.px(hx - 4, hy + 4, s.himBlush);
  c.px(hx + 4, hy + 4, s.himBlush);
  c.rect(hx - 1, hy + 5, 2, 1, s.himSkinShade);
  rimLight(c, PAL.haze, 0.3);
  c.outline(s.outline);
  return c;
}

function drawHer(dy, blink) {
  const c = new Canvas(W, H);
  const s = PAL;
  const x = HER.x;
  // legs + white shoes + skirt (the railing covers most of it)
  c.rect(x - 4, 140, 3, FEET - 141, s.herSkin);
  c.rect(x + 1, 140, 3, FEET - 141, s.herSkin);
  c.rect(x - 5, FEET - 1, 4, 2, s.sleeve);
  c.rect(x + 1, FEET - 1, 4, 2, s.sleeve);
  for (let y = 116; y <= 141; y++) {
    const flare = Math.round(((y - 116) / 25) * 4);
    c.rect(x - 7 - flare, y, 14 + flare * 2, 1, s.dress);
    c.px(x - 7 - flare, y, s.dressShade);
    if ((y + Math.round(flare / 2)) % 6 === 0) c.rect(x - 3, y, 1, 3, s.dressShade); // folds
  }
  c.rect(x - 11, 141, 22, 1, s.dressShade);
  // bodice with thin straps and a sweetheart neckline; a tie at the front
  c.rect(x - 7, 104 + dy, 14, 13 - dy, s.dress);
  c.rect(x - 7, 104 + dy, 2, 13 - dy, s.dressShade);
  c.rect(x + 2, 106 + dy, 4, 1, s.dressHi);
  c.px(x, 108 + dy, s.dressShade);
  c.px(x - 1, 109 + dy, s.dressShade);
  c.px(x + 1, 109 + dy, s.dressShade);
  c.rect(x - 7, 115, 14, 1, s.dressShade); // waist
  // chest + shoulders (skin above the neckline)
  c.rect(x - 6, 101 + dy, 12, 3, s.herSkin);
  c.px(x - 1, 104 + dy, s.herSkin);
  c.px(x, 104 + dy, s.herSkin);
  c.rect(x - 4, 101 + dy, 1, 3, s.dress); // straps
  c.rect(x + 3, 101 + dy, 1, 3, s.dress);
  // white puff sleeves
  c.ellipse(x - 8, 104 + dy, 3, 3, s.sleeve);
  c.ellipse(x + 8, 104 + dy, 3, 3, s.sleeve);
  c.px(x - 10, 106 + dy, s.sleeveShade);
  c.px(x - 9, 107 + dy, s.sleeveShade);
  // black bag on her hip, strap over her shoulder
  c.line(x + 5, 101 + dy, x - 5, 117, s.bag);
  c.rect(x - 9, 116, 6, 7, s.bag);
  c.rect(x - 8, 117, 4, 1, s.bagHi);
  // her right arm (our left) out along the railing, holding a pink flower
  thickLine(c, x - 9, 107 + dy, x - 12, 115, 3, s.herSkin);
  thickLine(c, x - 12, 115, x - 18, RAIL_TOP - 3, 3, s.herSkin);
  c.rect(x - 21, RAIL_TOP - 3, 5, 3, s.herSkin); // hand on the rail
  c.px(x - 12, 113, s.herSkinShade);
  for (const [fx, fy, col] of [[0, 0, s.flower], [1, -1, s.flower], [-1, -1, s.flower], [0, -2, s.flower], [0, -1, s.flowerHi], [2, 0, s.flower], [-2, 0, s.flower]])
    c.px(x - 21 + fx, RAIL_TOP - 4 + fy, col);
  // neck
  c.rect(HER.headX - 3, 98 + dy, 4, 4, s.herSkin);
  c.px(HER.headX - 3, 99 + dy, s.herSkinShade);
  // head, leaning on his shoulder: light-brown bob to the jaw, fringe
  const hx = HER.headX;
  const hy = HER.headY + dy;
  c.circle(hx, hy - 1, 6.6, s.herHair);
  c.rect(hx - 7, hy - 1, 3, 8, s.herHair); // bob framing the face, down to the jaw
  c.rect(hx + 5, hy - 1, 3, 7, s.herHair);
  c.rect(hx - 7, hy + 6, 3, 1, s.herHairShade);
  c.ellipse(hx, hy + 2, 4.6, 4.6, s.herSkin); // face
  c.rect(hx - 5, hy - 4, 10, 3, s.herHair); // fringe
  for (const fx of [hx - 4, hx - 1, hx + 2]) c.px(fx, hy - 1, s.herHair); // wispy fringe ends
  for (const [px, py] of [[hx + 2, hy - 6], [hx + 3, hy - 5], [hx - 2, hy - 7], [hx + 5, hy - 2], [hx + 6, hy]]) c.px(px, py, s.herHairHi);
  for (const [px, py] of [[hx - 6, hy + 2], [hx - 6, hy + 4], [hx - 5, hy - 3]]) c.px(px, py, s.herHairShade);
  // eyes, eyebrow piercing, blush, little smile
  if (blink) {
    c.rect(hx - 3, hy + 2, 2, 1, s.herSkinShade);
    c.rect(hx + 2, hy + 2, 2, 1, s.herSkinShade);
  } else {
    c.px(hx - 2, hy + 1, s.eye);
    c.px(hx - 2, hy + 2, s.eye);
    c.px(hx + 2, hy + 1, s.eye);
    c.px(hx + 2, hy + 2, s.eye);
  }
  c.px(hx - 3, hy, s.piercing);
  c.px(hx - 3, hy + 4, s.herBlush);
  c.px(hx + 3, hy + 4, s.herBlush);
  c.rect(hx - 1, hy + 5, 2, 1, s.herSkinShade);
  rimLight(c, PAL.haze, 0.3);
  c.outline(s.outline);
  return c;
}

function drawUs() {
  // breathing (1 px), at different times so we don't move as one; a blink each
  const HER_DY = [0, 0, -1, -1, -1, 0, 0, 0];
  const HIM_DY = [0, 0, 0, 0, -1, -1, -1, 0];
  const sheet = new Canvas(W * 8, H);
  for (let f = 0; f < 8; f++) {
    const frame = new Canvas(W, H);
    frame.blit(drawHim(HIM_DY[f], f === 2), 0, 0);
    frame.blit(drawHer(HER_DY[f], f === 6), 0, 0);
    sheet.blit(frame, f * W, 0);
  }
  return sheet;
}

// ---- 9. railing.png — weathered timber railing in the foreground ------------------------
function drawRailing() {
  const c = new Canvas(W, H);
  const r = rng(551);
  const plank = (x0, y0, w, h, light) => {
    c.rect(x0, y0, w, h, PAL.timber);
    c.rect(x0, y0, w, 1, light ? PAL.timberHi : PAL.timber);
    c.rect(x0, y0 + h - 1, w, 1, PAL.timberShade);
    // grain and cracks
    for (let i = 0; i < w / 6; i++) {
      const gx = x0 + r.int(0, w - 8);
      const gy = y0 + r.int(1, h - 2);
      c.rect(gx, gy, r.int(4, 14), 1, r() < 0.3 ? PAL.timberDark : PAL.timberShade);
    }
  };
  // posts (behind the top rail), with diagonal braces like the photo
  for (const px of [6, 110, 214, 300]) {
    c.rect(px, RAIL_TOP + 6, 8, H - RAIL_TOP - 6, PAL.timberShade);
    c.rect(px + 5, RAIL_TOP + 6, 3, H - RAIL_TOP - 6, PAL.timberDark);
    c.rect(px, RAIL_TOP + 6, 1, H - RAIL_TOP - 6, PAL.timber);
  }
  thickLine(c, 12, 176, 52, 140, 4, PAL.timberShade);
  thickLine(c, 12, 177, 52, 141, 1, PAL.timberDark);
  thickLine(c, 268, 140, 302, 172, 4, PAL.timberShade);
  // middle rail
  plank(0, 152, W, 5, false);
  // top rail: flat top catching the sun, front face below
  c.rect(0, RAIL_TOP, W, 3, PAL.timberHi);
  plank(0, RAIL_TOP + 2, W, 6, false);
  c.rect(0, RAIL_TOP + 8, W, 1, PAL.timberDark);
  for (let x = 0; x < W; x += 9) c.px(x + r.int(0, 6), RAIL_TOP + 1, PAL.timber); // weathered top
  c.outline(PAL.outline);
  return c;
}

// ---- 10. leaves.png — a few autumn leaves drifting down (frames) ------------------------
const LEAF_FRAMES = 24;

function drawLeaves() {
  const sheet = new Canvas(W * LEAF_FRAMES, H);
  const r = rng(561);
  const leaves = Array.from({ length: 7 }, () => ({
    x: r.int(8, 110),
    y: r.int(36, 64),
    fall: r.int(34, 52),
    phase: r(),
    col: r.pick([PAL.gold[2], PAL.gold[3], PAL.amber[2], PAL.amber[3]]),
  }));
  for (let f = 0; f < LEAF_FRAMES; f++) {
    const c = new Canvas(W, H);
    for (const l of leaves) {
      const t = (f / LEAF_FRAMES + l.phase) % 1;
      const x = Math.round(l.x + Math.sin(t * PI * 4) * 4 + t * 10);
      const y = Math.round(l.y + t * l.fall);
      const a = Math.min(1, Math.sin(t * PI) * 2.2); // fade in at the top, out at the bottom
      if (Math.floor(t * 8) % 2) {
        c.rect(x, y, 2, 1, l.col, a);
      } else {
        c.px(x, y, l.col, a);
        c.px(x + 1, y + 1, l.col, a);
      }
    }
    sheet.blit(c, f * W, 0);
  }
  return sheet;
}

// ---- 11. haze.png — warm sunlight washing in from the top right (pulse) -----------------
function drawHaze() {
  const c = new Canvas(W, H);
  softEllipse(c, 310, 0, 160, 110, PAL.haze, 0.38);
  softEllipse(c, 316, 0, 80, 56, PAL.sunCore, 0.35);
  return c;
}

// ---- The garden for the map: garden.png (10 x 9 tiles, 2 water frames) ------------------
// The pond fills the middle, trees line the back and right, and a boardwalk
// runs from the bottom up to a railed lookout deck over the water.
const TOP = 16; // a row of headroom above the pond, so the back trees' crowns fit
const GARDEN = { cols: 10, rows: 9, at: { x: 50, y: 29 } };
const DECK = { x: 48, y: 48 + TOP, w: 64, h: 32 }; // tiles 3–6, rows 4–5 (pixels inside the garden image)
const WALK = { x: 64, w: 32 }; // tiles 4–5, from the deck down to the bottom edge
const POND = { cx: 80, cy: 62 + TOP, rx: 62, ry: 29 };

const inPond = (x, y) => {
  const wob = Math.sin(x * 0.21) * 0.06 + Math.cos(y * 0.33) * 0.05;
  return ((x - POND.cx) / POND.rx) ** 2 + ((y - POND.cy) / POND.ry) ** 2 <= 1 + wob;
};

/** Tile ids (row * cols + col) she can walk on: the deck and the boardwalk. */
function walkableTiles() {
  const ids = [];
  for (let ty = 0; ty < GARDEN.rows; ty++)
    for (let tx = 0; tx < GARDEN.cols; tx++) {
      const onDeck = tx >= DECK.x / 16 && tx < (DECK.x + DECK.w) / 16 && ty >= DECK.y / 16 && ty < (DECK.y + DECK.h) / 16;
      const onWalk = tx >= WALK.x / 16 && tx < (WALK.x + WALK.w) / 16 && ty >= (DECK.y + DECK.h) / 16;
      if (onDeck || onWalk) ids.push(ty * GARDEN.cols + tx);
    }
  return ids;
}

/** A round 3/4-view tree for the map: canopy blobs over a short trunk. */
function mapTree(c, solid, r, x, y, size, colors, { gum = false } = {}) {
  const trunkH = gum ? 10 : 6;
  c.ellipse(x, y + size * 0.9 + trunkH, size * 0.7, 2, '#3f6a3a', 0.45); // shadow
  solid.rect(x - 2, y + size * 0.6, 4, trunkH + 4, '#000');
  c.rect(x - 1, Math.round(y + size * 0.6), 3, trunkH + 3, gum ? PAL.gumTrunk : PAL.timberDark);
  c.px(x - 1, Math.round(y + size * 0.6) + 2, gum ? PAL.gumTrunkShade : PAL.cattail);
  const blobs = blobsIn(r, x, y, size * 0.75, size * 0.65, gum ? 7 : 9, size * 0.35, size * 0.55);
  foliage(c, blobs, colors, Math.round(x * 31 + y));
  for (const b of blobs) solid.circle(b.x, b.y, b.r * 0.8, '#000');
}

function rhododendron(c, solid, r, x, y, size) {
  const blobs = blobsIn(r, x, y, size, size * 0.7, 6, size * 0.45, size * 0.7);
  foliage(c, blobs, PAL.rhodo, Math.round(x * 7 + y));
  for (let i = 0; i < size * 2.2; i++) {
    const b = r.pick(blobs);
    const fx = Math.round(b.x + r.range(-b.r * 0.6, b.r * 0.6));
    const fy = Math.round(b.y + r.range(-b.r * 0.6, b.r * 0.4));
    const col = r.pick(PAL.rhodoFlowers);
    c.px(fx, fy, col);
    c.px(fx + 1, fy, col);
    c.px(fx, fy - 1, col);
  }
  for (const b of blobs) solid.circle(b.x, b.y, b.r * 0.85, '#000');
}

/** Draws one frame of the garden; `phase` moves the ripples. Also returns a solid-pixel mask. */
function drawGardenFrame(phase) {
  const w = GARDEN.cols * 16;
  const h = GARDEN.rows * 16;
  const c = new Canvas(w, h);
  const solid = new Canvas(w, h);
  const r = rng(601); // same seed every frame, so only the water changes

  // bank: earth then a mossy rim around the water
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (inPond(x, y)) continue;
      let near = 0;
      for (let d = 1; d <= 3 && !near; d++) if (inPond(x, y - d) || inPond(x, y + d) || inPond(x - d, y) || inPond(x + d, y)) near = d;
      if (near) {
        c.px(x, y, near === 1 ? PAL.mapEarth : PAL.mapBank);
        solid.px(x, y, '#000');
      }
    }
  // water: deeper in the middle, autumn colours reflected along the far edge
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inPond(x, y)) continue;
      solid.px(x, y, '#000');
      const depth = 1 - Math.hypot((x - POND.cx) / POND.rx, (y - POND.cy) / POND.ry);
      c.px(x, y, depth > 0.45 + (bayer(x, y) - 0.5) * 0.3 ? PAL.mapWaterDeep : PAL.mapWater);
      const fromTop = y - (POND.cy - POND.ry * Math.sqrt(Math.max(0, 1 - ((x - POND.cx) / POND.rx) ** 2)));
      if (fromTop < 7 && (x + y) % 2 === 0) {
        const tint = x < 40 ? PAL.gold[2] : x < 70 ? PAL.amber[2] : x < 110 ? PAL.lime[2] : PAL.gumLeaves[2];
        c.px(x, y, tint, 0.55 - fromTop * 0.07);
      }
    }
  // ripples and sky glints that shift between the two frames (wrapping inside the pond)
  for (const [mx, my] of [[30, 64], [60, 88], [112, 72], [124, 90], [40, 82], [98, 102], [20, 76], [134, 80]]) {
    for (let i = 0; i < 4; i++) {
      const x = mx + ((i + phase * 3) % 6);
      if (inPond(x, my) && inPond(x + 2, my)) c.px(x, my, PAL.mapWaterLight, i === 0 || i === 3 ? 0.5 : 1);
    }
  }
  for (const [gx, gy] of [[44, 70], [118, 84], [70, 100], [104, 62]]) if (phase === 0) c.px(gx, gy, PAL.glint);
  for (const [gx, gy] of [[48, 76], [122, 78], [26, 86], [92, 60]]) if (phase === 1) c.px(gx, gy, PAL.glint);
  // lily pads with a pink flower or two
  for (const [lx, ly, fl] of [[28, 90, true], [34, 94, false], [124, 68, true], [130, 96, false], [118, 100, true]]) {
    c.ellipse(lx, ly, 2.5, 1.5, PAL.lilyPad);
    c.px(lx + 1, ly - 1, PAL.mapWaterDeep);
    if (fl) c.px(lx - 1, ly - 1, PAL.flower);
  }

  // reeds along the near and side banks
  const reeds = (x0, x1, base) => {
    for (let x = x0; x < x1; x += 2) {
      const hgt = r.int(4, 9);
      const yb = base(x);
      for (let k = 0; k < hgt; k++) c.px(x + (k > 5 ? 1 : 0), yb - k, k > hgt - 2 ? PAL.reedTip : k < 2 ? PAL.reedDark : r() < 0.5 ? PAL.reed : PAL.reedLight);
      if (r() < 0.15) c.rect(x, yb - hgt - 2, 2, 3, PAL.cattail);
      solid.rect(x - 1, yb - hgt, 3, hgt + 1, '#000');
    }
  };
  const nearEdge = (x) => Math.round(POND.cy + POND.ry * Math.sqrt(Math.max(0, 1 - ((x - POND.cx) / POND.rx) ** 2)) + 2);
  reeds(18, 60, nearEdge);
  reeds(100, 140, nearEdge);
  reeds(18, 26, () => 66 + TOP);
  reeds(134, 142, () => 74 + TOP);

  // the boardwalk: planks across, a shadow on the water under the raised deck
  const plankRows = (x0, y0, ww, hh) => {
    for (let y = y0; y < y0 + hh; y++)
      for (let x = x0; x < x0 + ww; x++) {
        const row = Math.floor((y - y0) / 4);
        const gap = (y - y0) % 4 === 3;
        const joint = (x + row * 23) % 47 === 0; // long planks, ends staggered
        const tone = row % 3 === 1 ? PAL.mapTimber : PAL.mapTimberHi;
        c.px(x, y, gap || joint ? PAL.mapTimberShade : (x * 3 + y) % 17 === 0 ? PAL.mapTimber : tone);
      }
  };
  c.rect(DECK.x + 2, DECK.y + DECK.h, DECK.w - 2, 3, PAL.mapWaterDeep);
  c.rect(DECK.x + 2, DECK.y + DECK.h, DECK.w - 2, 1, PAL.mapTimberDark);
  plankRows(DECK.x + 2, DECK.y + 2, DECK.w - 4, DECK.h - 2);
  plankRows(WALK.x + 2, DECK.y + DECK.h, WALK.w - 4, h - DECK.y - DECK.h);
  // railings: along the back of the deck, down its sides, and the walkway over the water
  const railH = (x0, x1, y) => {
    c.rect(x0, y, x1 - x0, 2, PAL.mapTimberHi);
    c.rect(x0, y + 2, x1 - x0, 1, PAL.mapTimberDark);
    for (let x = x0; x < x1; x += 10) c.rect(x, y + 2, 2, 3, PAL.mapTimberShade);
  };
  const railV = (x, y0, y1) => {
    c.rect(x, y0, 2, y1 - y0, PAL.mapTimberShade);
    c.rect(x, y0, 1, y1 - y0, PAL.mapTimberHi);
    for (let y = y0; y < y1; y += 8) c.rect(x, y, 2, 2, PAL.mapTimberDark);
  };
  railH(DECK.x, DECK.x + DECK.w, DECK.y);
  railV(DECK.x, DECK.y, DECK.y + DECK.h);
  railV(DECK.x + DECK.w - 2, DECK.y, DECK.y + DECK.h);
  railH(DECK.x, WALK.x + 2, DECK.y + DECK.h - 2);
  railH(WALK.x + WALK.w - 2, DECK.x + DECK.w, DECK.y + DECK.h - 2);
  railV(WALK.x, DECK.y + DECK.h, 100 + TOP);
  railV(WALK.x + WALK.w - 2, DECK.y + DECK.h, 100 + TOP);

  // trees along the back and the right; rhododendrons in bloom by the path
  mapTree(c, solid, r, 19, TOP + 8, 14, PAL.gold);
  mapTree(c, solid, r, 43, TOP + 4, 12, PAL.gumLeaves, { gum: true });
  mapTree(c, solid, r, 67, TOP + 10, 13, PAL.amber);
  mapTree(c, solid, r, 92, TOP + 4, 12, PAL.gumLeaves, { gum: true });
  mapTree(c, solid, r, 117, TOP + 8, 13, PAL.lime);
  mapTree(c, solid, r, 141, TOP + 4, 13, PAL.gumLeaves, { gum: true });
  mapTree(c, solid, r, 146, TOP + 40, 10, PAL.amber);
  mapTree(c, solid, r, 146, TOP + 70, 10, PAL.gold);
  rhododendron(c, solid, r, 18, TOP + 104, 10);
  rhododendron(c, solid, r, 40, TOP + 116, 7);
  rhododendron(c, solid, r, 124, TOP + 108, 9);
  rhododendron(c, solid, r, 144, TOP + 100, 9);
  rhododendron(c, solid, r, 13, TOP + 84, 7);

  // the boardwalk always wins: nothing solid on it
  for (const id of walkableTiles()) solid.rect((id % GARDEN.cols) * 16, Math.floor(id / GARDEN.cols) * 16, 16, 16, '#fff');
  return { c, solid };
}

/** Solid tiles = more than a few solid pixels (boardwalk tiles are always walkable). */
function gardenCollision(solid) {
  const walk = walkableTiles();
  const open = [];
  for (let ty = 0; ty < GARDEN.rows; ty++)
    for (let tx = 0; tx < GARDEN.cols; tx++) {
      const id = ty * GARDEN.cols + tx;
      let count = 0;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const [rr, , , a] = solid.get(tx * 16 + x, ty * 16 + y);
          if (a && rr === 0) count++;
        }
      const limit = ty === 0 ? 1 : 40; // the headroom row is all treetops: any leaves there = solid
      if (walk.includes(id) || count < limit) open.push(id);
    }
  return open;
}

// ---- Add the garden, a path to it, and its trigger to maps/world.json (first time only) -----
const BRANCH_TOP = 22; // first row below the main east–west path
const PICNIC_TO = { x: 29, y: 25 }; // top-left tile of the picnic's new 4x3 spot (open grass)

/** Moves the picnic's trigger, and the blanket tiles inside it, to `to` (tiles). */
function movePicnic(map, layer, to) {
  const trigger = layer('Triggers').objects.find((o) => o.properties?.some((p) => p.name === 'memoryId' && p.value === 'park-picnic'));
  if (!trigger) return console.warn('  ! no park-picnic trigger found — picnic not moved');
  const from = { x: trigger.x / 16, y: trigger.y / 16 };
  const decor = layer('Decor').data;
  const tiles = [];
  for (let dy = 0; dy < trigger.height / 16; dy++)
    for (let dx = 0; dx < trigger.width / 16; dx++) {
      const i = (from.y + dy) * map.width + from.x + dx;
      if (decor[i]) tiles.push({ dx, dy, gid: decor[i] });
      decor[i] = 0;
    }
  for (const t of tiles) decor[(to.y + t.dy) * map.width + to.x + t.dx] = t.gid;
  trigger.x = to.x * 16;
  trigger.y = to.y * 16;
  console.log(`  map      moved the picnic from tiles (${from.x}, ${from.y}) to (${to.x}, ${to.y})`);
}

function addToMap(walkable, animated) {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (map.tilesets.some((t) => t.name === 'garden')) {
    console.log('  map      already has the garden — left untouched');
    return;
  }
  const { cols, rows, at } = GARDEN;
  const layer = (name) => map.layers.find((l) => l.name === name);
  const set = (name, x, y, gid) => (layer(name).data[y * map.width + x] = gid);
  // clear the trees that stood here (their trunks are in Decor, treetops in Above)
  for (let y = at.y - 2; y < at.y + rows; y++)
    for (let x = at.x; x < at.x + cols; x++) {
      set('Above', x, y, 0);
      if (y >= at.y) set('Collision', x, y, 0);
    }
  stampBuilding(map, { name: 'garden', image: '../public/assets/tiles/garden.png', cols, rows, at, walkable, frames: 2, animated, frameMs: 600 });
  // the picnic sat on the branch path's way down; move it (blanket + trigger) to open grass
  movePicnic(map, layer, PICNIC_TO);
  // the branch path (cosy tile 4 = path, gid 5): one tile left of where it was, so it
  // runs straight down from the main path beside the garden, then along to the boardwalk
  const walkX = at.x + WALK.x / 16;
  for (let y = BRANCH_TOP; y < BRANCH_TOP + 4; y++) set('Ground', 50, y, 1); // old branch edge back to grass
  for (let y = BRANCH_TOP; y <= 39; y++) for (const x of [48, 49]) set('Ground', x, y, 5);
  for (let x = 50; x <= walkX + 1; x++) for (const y of [38, 39]) set('Ground', x, y, 5);
  // trigger: the whole lookout deck
  layer('Triggers').objects.push({
    id: map.nextobjectid++,
    name: 'garden lookout',
    type: '',
    x: (at.x + DECK.x / 16) * 16,
    y: (at.y + DECK.y / 16) * 16,
    width: DECK.w,
    height: DECK.h,
    rotation: 0,
    visible: true,
    properties: [{ name: 'memoryId', type: 'string', value: 'botanic-garden' }],
  });
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  console.log(`  map      added the garden at tiles x ${at.x}–${at.x + cols - 1}, y ${at.y}–${at.y + rows - 1}, a path down from the main path + trigger`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing the botanic garden…');
const sky = drawSky();
const treesBack = drawTreesBack();
const treesAutumn = drawTreesAutumn();
const mirror = new Canvas(W, H); // what the pond reflects
mirror.blit(sky, 0, 0);
mirror.blit(treesBack, 0, 0);
mirror.blit(treesAutumn, 0, 0);
const layers = {
  sky,
  'trees-back': treesBack,
  'trees-autumn': treesAutumn,
  pond: drawPond(mirror),
  glints: drawGlints(),
  reeds: drawReeds(),
  deck: drawDeck(),
  us: drawUs(),
  railing: drawRailing(),
  leaves: drawLeaves(),
  haze: drawHaze(),
};
for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);

// the map garden: two frames side by side; tiles that differ between them shimmer
const frameA = drawGardenFrame(0);
const frameB = drawGardenFrame(1);
const gw = GARDEN.cols * 16;
const garden = new Canvas(gw * 2, GARDEN.rows * 16);
garden.blit(frameA.c, 0, 0);
garden.blit(frameB.c, gw, 0);
save(path.join(ROOT, 'public', 'assets', 'tiles', 'garden.png'), garden);
const animated = [];
for (let id = 0; id < GARDEN.cols * GARDEN.rows; id++) {
  const tx = (id % GARDEN.cols) * 16;
  const ty = Math.floor(id / GARDEN.cols) * 16;
  let differs = false;
  for (let y = 0; y < 16 && !differs; y++)
    for (let x = 0; x < 16 && !differs; x++) differs = frameA.c.get(tx + x, ty + y).join() !== frameB.c.get(tx + x, ty + y).join();
  if (differs) animated.push(id);
}
const walkable = gardenCollision(frameA.solid);
addToMap(walkable, animated);
console.log('  walkable garden tiles (. = walk, # = solid):');
for (let ty = 0; ty < GARDEN.rows; ty++) {
  let row = '             ';
  for (let tx = 0; tx < GARDEN.cols; tx++) row += walkable.includes(ty * GARDEN.cols + tx) ? '.' : '#';
  console.log(row);
}

// ---- Previews (3x) ----------------------------------------------------------------------------
const flat = new Canvas(W, H);
for (const name of Object.keys(layers)) {
  const src = layers[name];
  if (src.width === W) flat.blit(src, 0, 0);
  else {
    const first = new Canvas(W, H); // frame 1 of a flip-book
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [r, g, b, a] = src.get(x, y);
      if (a) first.px(x, y, [r, g, b], a / 255);
    }
    flat.blit(first, 0, 0);
  }
}
writePreview('botanic-garden.png', flat);
const mapPreview = new Canvas(gw + 32, GARDEN.rows * 16 + 32);
mapPreview.rect(0, 0, mapPreview.width, mapPreview.height, '#8cc269');
mapPreview.rect(16 + WALK.x, GARDEN.rows * 16 + 16, WALK.w, 16, '#dcc08a');
mapPreview.blit(frameA.c, 16, 16);
writePreview('botanic-garden-map.png', mapPreview);
console.log('  preview  tools/previews/botanic-garden.png, tools/previews/botanic-garden-map.png');
