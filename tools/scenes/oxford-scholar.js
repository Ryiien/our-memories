#!/usr/bin/env node
// -----------------------------------------------------------------------------
// oxford-scholar.js — draws "The Oxford Scholar" memory (our pub next to RMIT)
// as layered pixel art, plus the pub and RMIT's Building 80 for the map, and
// swaps them in for the old café on maps/world.json (only the first time).
//
//   npm run scene:pub                       # (re)draw everything
//   npm run scene:pub -- --keep us,table    # don't overwrite layers you've redrawn
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/memories/oxford-scholar/*.png   the 12 cutscene layers
//   public/assets/tiles/oxford-scholar.png        the pub (128x96 = 8x6 tiles)
//   public/assets/tiles/rmit.png                  RMIT next door (112x96 = 7x6 tiles)
//   tools/previews/oxford-scholar.png             flattened preview (3x size)
//   tools/previews/oxford-scholar-street.png      the two buildings on the map (3x)
//
// The scene: dusk, inside the pub at a high table by the big timber-framed
// windows. She has a Long Island iced tea, he has a pint, and they clink
// glasses over a basket of fries. Outside: Swanston Street, a tram going past,
// people out on the footpath (some standing about, some strolling by) and
// RMIT's Building 80 with its red sign.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas, rng, bayer } from '../lib/canvas.js';
import { P } from '../lib/palette.js';
import { ROOT, makeSaver, thickLine, rimLight, softEllipse, text, textWidth, miniText, miniWidth, writePreview, stampBuilding } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // outside at dusk
  sky: ['#33315f', '#4f4579', '#7c5c8e', '#b8789a', '#e8a088'],
  tower: '#2c2a4a',
  towerShade: '#24223e',
  towerHi: '#4a4370',
  litWindow: '#ffd98a',
  facets: ['#2c3c64', '#3a5182', '#4d679a', '#6582b4', '#2a3557'],
  facetHi: '#93acd2',
  shopfront: '#1d2030',
  rmitRed: '#e60028',
  rmitRedDark: '#a8001e',
  signPanel: '#25232b',
  signText: '#ffffff',
  pavement: '#6b6370',
  kerb: '#857c88',
  road: '#3e3846',
  rail: '#6a6272',
  pole: '#2a2633',
  wire: '#1f1c26',
  lampHead: '#fff1c4',
  trunk: '#4a3a34',
  leaves: ['#a8883a', '#c9a443', '#e2c463'],
  // the tram (Yarra Trams white + green)
  // a W-class tram (the green-and-cream City Circle one)
  tramCream: '#ecd89c',
  tramCreamShade: '#cdb67a',
  tramRoof: '#d9c08a',
  tramRoofShade: '#b9a06c',
  tramClerestory: '#6e665c', // the raised strip along the top of the roof
  tramGreen: '#3d7a3c',
  tramGreenDark: '#2c5c2c',
  tramGold: '#c9a94a', // lining + fleet number
  tramGrab: '#f2c94c', // yellow grab poles by the doors
  tramFender: '#1e1c22',
  tramBogie: '#2e2a30',
  tramGlass: '#5a4c58', // dark glass in cream frames...
  tramGlow: '#c99a5e', // ...with a warm glow from the lights inside
  tramPassenger: '#2e2830',
  tramRouteBox: '#2f6a34',
  // inside the pub
  brick: ['#9c4a3a', '#8f4334', '#a65242'],
  mortar: '#6b3128',
  render: '#e6d9bc', // the cream pilasters
  renderShade: '#c9b996',
  timber: '#b0703c',
  timberShade: '#8a5228',
  timberHi: '#d08c50',
  timberDark: '#5e3820',
  wainscot: '#6e4228',
  wainscotHi: '#8a5634',
  floor: '#56341f',
  floorLine: '#432716',
  glassTint: '#ffd9a0',
  glassStreak: '#ffffff',
  boardGreen: '#1f3a2e',
  gold: '#d6b25a',
  lampShade: '#2a2420',
  lampRim: '#b0764a',
  bulb: '#fff1c4',
  warmLight: '#ffd98a',
  canvasBag: '#e9e2d0',
  canvasBagShade: '#c9c0aa',
  books: ['#e60028', '#efe6cf', '#2b3a67'],
  // the table
  tableTop: '#b07444',
  tableTopHi: '#c98a54',
  tableEdge: '#7a4a2a',
  metal: '#2e2a30',
  metalHi: '#5a5560',
  stoolSeat: '#3a2520',
  stoolSeatHi: '#5a3a2e',
  // drinks + fries
  glass: '#e6eef4',
  longIsland: '#a65e2a',
  longIslandTop: '#c47a3a',
  ice: '#ecd6b8',
  lemon: '#f4d03f',
  lemonRind: '#d9a520',
  straw: '#e60028', // an RMIT-red straw
  beer: '#e3a33a',
  beerShade: '#c4822a',
  beerHi: '#f4c96a',
  foam: '#f6efd8',
  foamShade: '#e2d6b4',
  fries: '#f2c35a',
  friesShade: '#d99a3a',
  basket: '#8a8e96',
  basketShade: '#6a6e76',
  paper: '#ffffff',
  paperCheck: '#e60028', // red-and-white paper, RMIT colours
  sauce: '#c8281e',
  ramekin: '#f2efe8',
  steam: '#ffffff',
  bubble: '#fbe3a0',
  sparkle: '#fff6c8',
  // us — same colours as the walking sprites (tools/lib/palette.js)
  herHair: P.herHair, // pink bob...
  herHairHi: P.herHairHi,
  herHairShade: '#b8475f',
  herRoots: P.herRoots, // ...with the black roots grown out
  herSkin: P.herSkin,
  herSkinShade: P.herSkinShade,
  herBlush: P.herBlush,
  herSkinHi: '#e8b892',
  herDress: P.herDress,
  herDressShade: P.herDressShade,
  herDressHi: P.herDressHi, // puff sleeve, light on the pleats
  herDressDeep: P.herDressDeep, // the crease under her sleeve
  lace: P.cream, // lace neckline + hem
  laceShade: P.creamShade,
  sash: P.berry, // her sash...
  sashDark: '#7e3a4a',
  sashLoop: P.roseDark, // ...tied in a bow at the back
  sashLoopHi: P.rose,
  herShoes: P.white,
  herSole: '#cfd0d8',
  piercing: P.silver,
  himHair: P.himHair,
  himHairHi: P.himHairHi,
  himSkin: P.himSkin,
  himSkinShade: '#d6a585',
  himBlush: P.himBlush,
  jacket: P.himJacket,
  jacketShade: P.himJacketShade,
  jacketHi: P.himJacketHi,
  shirt: P.himShirt,
  shirtShade: '#d9d2c4',
  button: '#b8ae9c',
  belt: '#2e2220',
  buckle: '#d6b25a',
  jeans: '#33467a', // dark denim
  jeansShade: '#25345c',
  jeansHi: '#4a5f96',
  himShoes: P.shoeDark,
  himShoesHi: '#5a5470',
  himSole: '#e2ddd2',
  eye: '#1a1214',
  outline: '#1a1014',
  // edges
  vignette: '#1a0e0a',
  // the buildings on the map
  pubBrick: '#a8473a',
  pubBrickLine: '#8e3a2f',
  pubCream: '#efe3c8',
  pubCreamShade: '#d6c6a4',
  pubCreamDark: '#b8a582',
  pubRoof: '#5f5a66',
  pubRoofLine: '#524d58',
  pubGlass: '#3d4a5e',
  pubGlassHi: '#6f8199',
  pubLit: '#f0c070',
  pubLitHi: '#f8d896',
  pubFin: '#c08048',
  pubFinShade: '#94602f',
  pubSign: '#2a2420',
  step: '#8a8580',
};
const PUB_SIGN = 'OXFORD SCHOLAR';
const PUB_YEAR = '1887';

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const PI = Math.PI;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'oxford-scholar');
const save = makeSaver();

/** Stable pseudo-random number 0..1 for a grid cell (so the art never changes between runs). */
const hash = (a, b, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// The big window behind us: outer frame, timber posts between three bays,
// and the glass area the outside shows through.
const WIN = { left: 39, right: 280, top: 14, glassTop: 18, glassBottom: 100 };
const POSTS = [[39, 43], [118, 122], [197, 201], [276, 280]];
const BAYS = [[44, 117], [123, 196], [202, 275]];
const TRANSOM = 38; // the bar across the top panes
const SILL = 104; // top of the window ledge

// ---- 1. street.png — Swanston Street at dusk (seen through the window) ------------------
function drawStreet() {
  const c = new Canvas(W, H);
  c.gradientV(0, 0, W, 104, PAL.sky);
  c.rect(0, 104, W, H - 104, PAL.road);

  // far city towers behind the tree
  for (const [x, w, top] of [[40, 22, 30], [64, 16, 46], [84, 24, 22], [110, 20, 38], [132, 22, 26], [150, 18, 44]]) {
    c.rect(x, top, w, 92 - top, PAL.tower);
    c.rect(x + w - 3, top, 3, 92 - top, PAL.towerShade);
    c.rect(x, top, w, 1, PAL.towerHi);
  }

  // RMIT Building 80: a wall of blue faceted glass (triangles), lighter up top
  const b80 = 168;
  for (let y = 8; y < 84; y++)
    for (let x = b80; x < W; x++) {
      const lx = (x - b80) % 10;
      const ly = (y - 8) % 10;
      const cell = [Math.floor((x - b80) / 10), Math.floor((y - 8) / 10)];
      const half = lx + ly < 10 ? 0 : 1; // which triangle of the diamond
      let col = PAL.facets[Math.floor(hash(cell[0], cell[1], half) * PAL.facets.length)];
      if (y < 40 && hash(cell[0], cell[1], half + 7) < 0.25) col = PAL.facetHi; // catching the sky
      c.px(x, y, col);
      if (lx + ly === 9 || lx === 0) c.px(x, y, PAL.tower, 0.35); // frame lines
    }
  c.rect(b80, 8, 2, 84, PAL.tower); // building edge
  // RMIT sign: red logo + white letters on a dark panel, red trim under it
  c.rect(202, 55, 40, 13, PAL.signPanel);
  c.rect(202, 67, 40, 2, PAL.rmitRed);
  drawRmitLogo(c, 205, 57, 9);
  text(c, 'RMIT', 216, 58, PAL.signText);
  // ground floor shopfront
  c.rect(b80, 84, W - b80, 8, PAL.shopfront);
  for (let x = b80 + 6; x < W; x += 14) c.rect(x, 84, 2, 8, PAL.tower);

  // far footpath, kerb, road with tram tracks
  c.rect(0, 88, b80, 4, PAL.pavement);
  c.rect(0, 92, W, 1, PAL.kerb);
  c.rect(0, 93, W, 11, PAL.road);
  c.rect(0, 97, W, 1, PAL.rail);
  c.rect(0, 101, W, 1, PAL.rail);

  // a plane tree on the far footpath, leaves turning gold
  const r = rng(1887);
  c.rect(70, 58, 4, 34, PAL.trunk);
  c.line(72, 66, 60, 52, PAL.trunk);
  c.line(73, 62, 86, 48, PAL.trunk);
  for (let i = 0; i < 160; i++) {
    const a = r() * PI * 2;
    const d = Math.sqrt(r());
    const x = Math.round(72 + Math.cos(a) * d * 24);
    const y = Math.round(48 + Math.sin(a) * d * 17);
    const col = PAL.leaves[Math.min(2, Math.floor((1 - (y - 31) / 34) * 2 + r()))];
    c.rect(x, y, 2, 2, col);
  }

  // tram pole + street lamp, overhead wires
  c.rect(112, 22, 2, 70, PAL.pole);
  c.line(112, 40, 100, 40, PAL.pole);
  c.rect(97, 40, 6, 2, PAL.pole);
  c.line(0, 32, W, 32, PAL.wire);
  c.line(0, 36, W, 36, PAL.wire);
  c.line(113, 24, b80, 20, PAL.wire, 0.7); // span wire
  return c;
}

/** RMIT's red "pixel" logo, as a small rounded red square. */
function drawRmitLogo(c, x, y, size) {
  c.rect(x, y, size, size, PAL.rmitRed);
  for (const [dx, dy] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) c.clear(x + dx, y + dy);
  c.rect(x + 1, y + size - 2, size - 2, 1, PAL.rmitRedDark);
}

// ---- 2. street-lights.png — lit windows + the street lamp (flicker) -----------------------
function drawStreetLights() {
  const c = new Canvas(W, H);
  const r = rng(427);
  // office lights in the far towers
  for (const [x, w, top] of [[40, 22, 30], [64, 16, 46], [84, 24, 22], [110, 20, 38], [132, 22, 26], [150, 18, 44]])
    for (let y = top + 3; y < 86; y += 4)
      for (let xx = x + 2; xx < x + w - 4; xx += 3) if (r() < 0.22) c.rect(xx, y, 2, 1, PAL.litWindow, 0.85);
  // warm shopfront glow at the bottom of Building 80
  for (let x = 174; x < W; x += 14) c.rect(x, 86, 8, 4, PAL.litWindow, 0.6);
  // the street lamp
  softEllipse(c, 100, 43, 9, 6, PAL.warmLight, 0.5);
  c.rect(98, 42, 4, 1, PAL.lampHead);
  return c;
}

// ---- 2b. people on Swanston Street ------------------------------------------------------------
//   people.png         standing about on the far footpath (still)
//   walkers-left.png   strolling to the left  (drift)
//   walkers-right.png  strolling to the right (drift, negative speed)
// Little people about 15 px tall, feet on the far footpath. They sit behind
// the tram layer, so it glides in front of them.
const FOOTPATH = 91; // their feet
const FOLK = {
  skin: ['#f0cfb4', '#e8c0a0', '#c98e66', '#a8714c', '#8a5a3c'],
  hair: ['#2a1f24', '#5a3a28', '#d8b060', '#1a1418', '#8a4a30', '#c8c0c8'],
  coat: {
    navy: ['#3a4a6a', '#2c3852'],
    wine: ['#6a3a44', '#4e2a32'],
    olive: ['#4a5a3a', '#36432a'],
    camel: ['#9a7a52', '#7a5e3c'],
    black: ['#2e2c3a', '#22202c'],
    rust: ['#8a4a3a', '#6a362a'],
    cream: ['#c8b89a', '#a8987c'],
    teal: ['#2e5a5e', '#224446'],
  },
  legs: ['#22202c', '#3a3f5a', '#4a3a30', '#2e3446'],
  shoes: '#1a1418',
  tote: '#e9e2d0',
  backpack: ['#2a3557', '#6a2a32', '#3a4a2e'],
  phone: '#cfe6ff',
  dog: '#b07a4a',
  dogShade: '#8a5a34',
};

/**
 * One little person, feet at (x, feet). o = { facing: 'left'|'right'|'front',
 * stride, coat: [colour, shade], longCoat, legs, skin, hair, hairStyle:
 * 'short'|'long'|'bun'|'beanie', beanie, backpack, tote, phone, dog }.
 */
function person(c, x, feet, o) {
  const d = o.facing === 'right' ? 1 : o.facing === 'left' ? -1 : 0;
  const top = feet - 14;
  const [coat, coatShade] = o.coat;
  // legs and shoes
  if (d === 0) {
    c.rect(x - 1, top + 10, 1, 4, o.legs);
    c.rect(x + 1, top + 10, 1, 4, o.legs);
    c.px(x - 1, feet, FOLK.shoes);
    c.px(x + 1, feet, FOLK.shoes);
  } else if (o.stride) {
    c.px(x, top + 10, o.legs);
    for (const k of [-1, 1]) {
      c.px(x + k, top + 11, o.legs);
      c.px(x + k, top + 12, o.legs);
      c.px(x + 2 * k, top + 13, o.legs);
      c.px(x + 2 * k, feet, FOLK.shoes);
    }
    c.px(x + 3 * d, feet, FOLK.shoes); // toe of the front foot
  } else {
    c.rect(x - 1, top + 10, 2, 4, o.legs);
    c.rect(x - 1, feet, 2, 1, FOLK.shoes);
    c.px(d > 0 ? x + 1 : x - 2, feet, FOLK.shoes);
  }
  // backpack (behind)
  if (o.backpack && d) c.rect(x - 2 * d, top + 4, 1, 5, o.backpack);
  // coat
  c.rect(x - 1, top + 4, 3, 6 + (o.longCoat ? 2 : 0), coat);
  const back = d > 0 ? x - 1 : x + 1;
  c.rect(back, top + 4, 1, 6 + (o.longCoat ? 2 : 0), coatShade);
  if (d === 0) {
    c.rect(x - 2, top + 5, 1, 4, coat); // arms
    c.rect(x + 2, top + 5, 1, 4, coatShade);
    c.px(x - 2, top + 9, o.skin);
    c.px(x + 2, top + 9, o.skin);
  } else {
    c.rect(x, top + 5, 1, 4, coatShade); // arm down her/his side
    c.px(x + (o.stride ? -d : 0), top + 9, o.skin); // hand (swinging back mid-step)
  }
  // head + hair
  c.rect(x - 1, top + 1, 3, 3, o.skin);
  c.rect(x - 1, top, 3, 1, o.hair);
  if (d) {
    c.rect(x - d, top + 1, 1, o.hairStyle === 'long' ? 4 : 2, o.hair); // the back of the head
    if (o.hairStyle === 'long') c.px(x - 2 * d, top + 3, o.hair);
    c.px(x + d, top + 1, o.hair); // fringe
  } else {
    c.px(x - 1, top + 1, o.hair);
    c.px(x + 1, top + 1, o.hair);
    if (o.hairStyle === 'long') {
      c.rect(x - 2, top + 1, 1, 4, o.hair);
      c.rect(x + 2, top + 1, 1, 4, o.hair);
    }
  }
  if (o.hairStyle === 'bun') c.px(x - d, top - 1, o.hair);
  if (o.hairStyle === 'beanie') {
    c.rect(x - 1, top - 1, 3, 2, o.beanie);
    c.px(x, top - 2, o.beanie);
  }
  // things they carry
  if (o.tote) {
    const tx = x + (d || 1) * 2;
    c.rect(tx, top + 8, 2, 3, FOLK.tote);
    c.px(tx + (d < 0 ? 0 : 1), top + 9, PAL.rmitRed); // a little RMIT logo
    c.px(tx, top + 7, FOLK.tote, 0.7); // the strap
  }
  if (o.phone) {
    const px = x + (d || 1);
    c.px(px, top + 6, FOLK.phone);
    c.px(px, top + 2, FOLK.phone, 0.35); // its glow on their face
    c.px(px, top + 5, o.skin);
  }
  if (o.dog) {
    const dx = x + d * 5;
    const dy = feet - 2;
    c.rect(dx - 2, dy, 5, 2, FOLK.dog);
    c.rect(dx - 2, dy + 1, 5, 1, FOLK.dogShade);
    c.px(dx - 2, feet, FOLK.dogShade);
    c.px(dx + 2, feet, FOLK.dogShade);
    c.rect(dx + 2 * d, dy - 2, 2, 2, FOLK.dog); // head
    c.px(dx + 3 * d, dy - 1, FOLK.dogShade); // nose
    c.px(dx - 3 * d, dy - 1, FOLK.dog); // tail up
    c.line(x + d, top + 8, dx + 2 * d, dy - 1, '#1a1418', 0.6); // lead
  }
}

/** Pull the little people back into the dusk, with a touch of warm light from above. */
function dusk(c) {
  rimLight(c, PAL.warmLight, 0.18);
  const night = [44, 42, 74];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const [rr, g, b, a] = c.get(x, y);
      if (!a) continue;
      c.clear(x, y);
      c.px(x, y, [rr, g, b].map((v, i) => Math.round(v + (night[i] - v) * 0.22)), a / 255);
    }
  return c;
}

function drawPeople() {
  const c = new Canvas(W, H);
  const f = FOOTPATH;
  // left window: a couple chatting under the plane tree, someone waiting for the tram
  person(c, 52, f, { facing: 'right', coat: FOLK.coat.camel, longCoat: true, legs: FOLK.legs[0], skin: FOLK.skin[1], hair: FOLK.hair[2], hairStyle: 'long' });
  person(c, 57, f, { facing: 'left', coat: FOLK.coat.navy, legs: FOLK.legs[1], skin: FOLK.skin[3], hair: FOLK.hair[0] });
  person(c, 106, f, { facing: 'front', coat: FOLK.coat.olive, legs: FOLK.legs[2], skin: FOLK.skin[0], hair: FOLK.hair[1], hairStyle: 'beanie', beanie: '#c46a80', tote: true });
  // right window, outside RMIT: students chatting, someone on their phone, a dog walker
  person(c, 210, f, { facing: 'right', coat: FOLK.coat.teal, legs: FOLK.legs[3], skin: FOLK.skin[2], hair: FOLK.hair[3], backpack: FOLK.backpack[0] });
  person(c, 215, f, { facing: 'left', coat: FOLK.coat.rust, legs: FOLK.legs[0], skin: FOLK.skin[4], hair: FOLK.hair[0], hairStyle: 'bun', tote: true });
  person(c, 239, f, { facing: 'front', coat: FOLK.coat.black, longCoat: true, legs: FOLK.legs[1], skin: FOLK.skin[1], hair: FOLK.hair[4], hairStyle: 'long', phone: true });
  person(c, 262, f, { facing: 'left', coat: FOLK.coat.wine, legs: FOLK.legs[2], skin: FOLK.skin[0], hair: FOLK.hair[5], dog: true });
  return dusk(c);
}

function drawWalkersLeft() {
  const c = new Canvas(W, H);
  const f = FOOTPATH;
  person(c, 24, f, { facing: 'left', stride: true, coat: FOLK.coat.cream, longCoat: true, legs: FOLK.legs[0], skin: FOLK.skin[0], hair: FOLK.hair[1], hairStyle: 'bun' });
  person(c, 96, f, { facing: 'left', stride: true, coat: FOLK.coat.navy, legs: FOLK.legs[3], skin: FOLK.skin[2], hair: FOLK.hair[0], backpack: FOLK.backpack[1] });
  // a couple holding hands
  person(c, 166, f, { facing: 'left', stride: true, coat: FOLK.coat.wine, legs: FOLK.legs[1], skin: FOLK.skin[1], hair: FOLK.hair[2], hairStyle: 'long' });
  person(c, 171, f, { facing: 'left', stride: true, coat: FOLK.coat.black, legs: FOLK.legs[0], skin: FOLK.skin[3], hair: FOLK.hair[3] });
  c.rect(167, f - 5, 4, 1, FOLK.skin[1]); // their hands
  person(c, 286, f, { facing: 'left', stride: true, coat: FOLK.coat.olive, legs: FOLK.legs[2], skin: FOLK.skin[4], hair: FOLK.hair[0], hairStyle: 'beanie', beanie: '#e2c463' });
  return dusk(c);
}

function drawWalkersRight() {
  const c = new Canvas(W, H);
  const f = FOOTPATH;
  person(c, 70, f, { facing: 'right', stride: true, coat: FOLK.coat.rust, legs: FOLK.legs[1], skin: FOLK.skin[0], hair: FOLK.hair[4], tote: true });
  person(c, 190, f, { facing: 'right', stride: true, coat: FOLK.coat.teal, longCoat: true, legs: FOLK.legs[0], skin: FOLK.skin[3], hair: FOLK.hair[1], hairStyle: 'long', phone: true });
  person(c, 252, f, { facing: 'right', stride: true, coat: FOLK.coat.camel, legs: FOLK.legs[3], skin: FOLK.skin[2], hair: FOLK.hair[0], backpack: FOLK.backpack[2] });
  return dusk(c);
}

// ---- 3. tram.png — a W-class tram gliding past (960 wide, "drift" scrolls it) ---------------
function drawTram() {
  const c = new Canvas(W * 3, H);
  // A W-class: cream window band under a rounded tan roof, green below with
  // gold lining, doors in the middle with yellow grab poles, a trolley pole up
  // to the wire, and the "35" route box on the roof. Front on the left: it's
  // heading left.
  const x0 = 300; // enters the window about a second after the scene opens
  const len = 112;
  const x1 = x0 + len - 1;
  const mid = x0 + Math.round(len / 2);
  const T = { roof: 69, trim: 75, band: 76, belt: 86, panel: 87, fender: 96, bottom: 100 };

  // roof: rounded at both ends, the raised clerestory strip along the top
  c.rect(x0 + 14, T.roof, len - 28, 2, PAL.tramClerestory);
  c.rect(x0 + 6, T.roof + 2, len - 12, 1, PAL.tramRoof);
  c.rect(x0 + 3, T.roof + 3, len - 6, 1, PAL.tramRoof);
  c.rect(x0 + 1, T.roof + 4, len - 2, 2, PAL.tramRoof);
  c.rect(x0 + 1, T.roof + 5, len - 2, 1, PAL.tramRoofShade);
  // the "35" route box standing up at the front
  c.rect(x0 + 4, T.roof - 6, 11, 8, PAL.tramRouteBox);
  miniText(c, '35', x0 + 6, T.roof - 5, PAL.signText);
  // green trim under the roof, then the cream window band
  c.rect(x0, T.trim, len, 1, PAL.tramGreen);
  c.rect(x0, T.band, len, T.belt - T.band, PAL.tramCream);
  c.rect(x0, T.band, 1, T.belt - T.band, PAL.tramCreamShade); // the rounded front
  // windows: dark glass in cream frames, small transom panes over bigger
  // ones, a warm glow from the lights inside
  const windows = (from, to) => {
    for (let wx = from; wx + 4 <= to; wx += 6) {
      c.rect(wx, T.band + 1, 5, 2, PAL.tramGlass);
      c.rect(wx, T.band + 4, 5, 5, PAL.tramGlass);
      c.rect(wx, T.band + 4, 5, 1, PAL.tramGlow); // the glow along the top of each pane
      c.rect(wx, T.band + 1, 5, 1, PAL.tramGlow, 0.6);
    }
  };
  windows(x0 + 2, x0 + 13); // the driver's cab
  windows(x0 + 16, mid - 9); // front saloon
  windows(mid + 9, x1 - 2); // back saloon
  // people inside
  for (const wx of [x0 + 2, x0 + 22, x0 + 34, mid + 15, mid + 27, mid + 39]) {
    c.rect(wx + 1, T.band + 6, 2, 3, PAL.tramPassenger);
    c.px(wx + 1, T.band + 5, PAL.tramPassenger);
  }
  // green belt and lower panels, with gold lining
  c.rect(x0, T.belt, len, 1, PAL.tramGreenDark);
  c.rect(x0, T.panel, len, T.fender - T.panel, PAL.tramGreen);
  c.rect(x0, T.panel, 1, T.fender - T.panel, PAL.tramGreenDark);
  for (const [l, r] of [[x0 + 16, mid - 9], [mid + 9, x1 - 2]]) {
    c.rect(l, T.panel + 1, r - l, 1, PAL.tramGold, 0.7);
    c.rect(l, T.fender - 2, r - l, 1, PAL.tramGold, 0.7);
    c.rect(l, T.panel + 1, 1, T.fender - T.panel - 2, PAL.tramGold, 0.7);
    c.rect(r - 1, T.panel + 1, 1, T.fender - T.panel - 2, PAL.tramGold, 0.7);
  }
  miniText(c, '946', x0 + 3, T.panel + 2, PAL.tramGold); // fleet number on the cab
  // doors in the middle: two leaves, windows up top, yellow grab poles either side
  for (const dx of [mid - 7, mid + 1]) {
    c.rect(dx, T.band, 6, T.fender - T.band, PAL.tramGreen);
    c.rect(dx + 1, T.band + 1, 4, 7, PAL.tramGlass);
    c.rect(dx + 1, T.band + 1, 4, 1, PAL.tramGlow);
    c.rect(dx + 1, T.band + 12, 4, 6, PAL.tramGreenDark, 0.5);
  }
  c.rect(mid - 1, T.band, 2, T.fender - T.band, PAL.tramGreenDark);
  c.rect(mid - 9, T.band + 1, 1, T.fender - T.band - 2, PAL.tramGrab);
  c.rect(mid + 8, T.band + 1, 1, T.fender - T.band - 2, PAL.tramGrab);
  // front: headlight, marker lights, side mirror
  c.px(x0, T.panel + 4, PAL.lampHead);
  c.px(x0, T.panel + 2, '#e9a35b');
  c.px(x0, T.panel + 6, '#c8281e');
  c.rect(x0 - 2, T.band + 2, 1, 3, PAL.tramFender);
  c.px(x0 - 1, T.band + 3, PAL.tramFender);
  // black fender along the bottom, the bogies and wheels on the rail
  c.rect(x0 - 1, T.fender, len + 2, 2, PAL.tramFender);
  c.rect(x0 - 1, T.fender + 1, len + 2, 1, PAL.tramBogie);
  for (const bx of [x0 + 20, x1 - 20]) {
    c.rect(bx - 9, T.fender + 2, 18, 2, PAL.tramBogie);
    c.circle(bx - 5, T.bottom, 1.6, PAL.tramFender);
    c.circle(bx + 5, T.bottom, 1.6, PAL.tramFender);
  }
  // the trolley pole, trailing back from the roof up to the overhead wire
  const poleX = mid + 6;
  c.rect(poleX - 3, T.roof - 1, 7, 1, PAL.tramBogie); // its base on the roof
  c.line(poleX, T.roof - 1, poleX + 30, 37, PAL.wire);
  c.line(poleX + 1, T.roof - 1, poleX + 31, 37, PAL.wire, 0.6);
  c.rect(poleX + 29, 36, 4, 1, PAL.wire); // the shoe on the wire
  return c;
}

// ---- 4. interior.png — brick walls, the timber window, ledge, signs, lamps ----------------
function brickWall(c, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const row = Math.floor(y / 3);
      const mortarRow = y % 3 === 2;
      const mortarCol = (x + (row % 2) * 4) % 8 === 7;
      if (mortarRow || mortarCol) c.px(x, y, PAL.mortar);
      else c.px(x, y, PAL.brick[Math.floor(hash(Math.floor((x + (row % 2) * 4) / 8), row) * PAL.brick.length)]);
    }
}

function drawInterior() {
  const c = new Canvas(W, H);
  brickWall(c, 0, 0, W, SILL);

  // cut the glass out of the wall (the street layers show through)
  for (let y = WIN.glassTop; y < WIN.glassBottom; y++) for (let x = WIN.left; x <= WIN.right; x++) c.clear(x, y);

  // glass: a faint warm reflection and a few diagonal streaks
  for (const [a, b] of BAYS) {
    c.rect(a, WIN.glassTop, b - a + 1, WIN.glassBottom - WIN.glassTop, PAL.glassTint, 0.05);
    for (const off of [10, 16, 44]) {
      for (let i = 0; i < 26; i++) {
        const x = a + off + i;
        const y = WIN.glassBottom - 6 - i * 2;
        if (x > b || y < WIN.glassTop) break;
        c.px(x, y, PAL.glassStreak, 0.1);
        c.px(x, y - 1, PAL.glassStreak, 0.1);
      }
    }
  }

  // timber frame: head, posts, transom, mullions, bottom rail
  c.rect(WIN.left, WIN.top, WIN.right - WIN.left + 1, 4, PAL.timber);
  c.rect(WIN.left, WIN.top, WIN.right - WIN.left + 1, 1, PAL.timberHi);
  for (const [a, b] of POSTS) {
    c.rect(a, WIN.top, b - a + 1, SILL - WIN.top, PAL.timber);
    c.rect(a, WIN.top, 1, SILL - WIN.top, PAL.timberHi);
    c.rect(b, WIN.top, 1, SILL - WIN.top, PAL.timberShade);
  }
  for (const [a, b] of BAYS) {
    c.rect(a, TRANSOM, b - a + 1, 3, PAL.timber);
    c.rect(a, TRANSOM + 2, b - a + 1, 1, PAL.timberShade);
    // small panes up top
    for (let x = a + 18; x < b - 8; x += 18) c.rect(x, WIN.glassTop, 2, TRANSOM - WIN.glassTop, PAL.timber);
  }
  // the outer bays are split into a grid; the middle one is one big pane (behind our glasses)
  for (const [a, b] of [BAYS[0], BAYS[2]]) {
    const mid = Math.round((a + b) / 2);
    c.rect(mid, TRANSOM + 3, 2, WIN.glassBottom - TRANSOM - 3, PAL.timber);
    c.rect(mid + 1, TRANSOM + 3, 1, WIN.glassBottom - TRANSOM - 3, PAL.timberShade);
    c.rect(a, 72, b - a + 1, 2, PAL.timber);
  }
  c.rect(WIN.left, WIN.glassBottom, WIN.right - WIN.left + 1, SILL - WIN.glassBottom, PAL.timber);

  // the ledge, wood panelling below it, floorboards
  c.rect(WIN.left - 4, SILL, WIN.right - WIN.left + 9, 3, PAL.timberHi);
  c.rect(WIN.left - 4, SILL + 3, WIN.right - WIN.left + 9, 4, PAL.timberShade);
  c.rect(0, SILL + 7, W, 43, PAL.wainscot);
  for (let x = 6; x < W; x += 26) {
    c.rect(x, SILL + 13, 20, 1, PAL.wainscotHi);
    c.rect(x, SILL + 13, 1, 30, PAL.wainscotHi);
    c.rect(x, SILL + 42, 20, 1, PAL.timberDark);
    c.rect(x + 19, SILL + 13, 1, 30, PAL.timberDark);
  }
  c.rect(0, 150, W, H - 150, PAL.floor);
  for (let y = 154; y < H; y += 5) c.rect(0, y, W, 1, PAL.floorLine);
  for (let y = 150; y < H; y += 5) for (let x = (y * 7) % 40; x < W; x += 40) c.rect(x, y, 1, 5, PAL.floorLine);

  // cream rendered pilasters either side of the window (like the building outside)
  for (const [x, w] of [[31, 8], [281, 5]]) {
    c.rect(x, 0, w, SILL + 7, PAL.render);
    for (let y = 6; y < SILL + 7; y += 8) c.rect(x, y, w, 1, PAL.renderShade);
    c.rect(x + w - 1, 0, 1, SILL + 7, PAL.renderShade);
  }

  // left wall: an RMIT banner
  c.rect(4, 42, 25, 1, PAL.timberDark);
  c.line(6, 42, 16, 38, PAL.timberDark);
  c.line(26, 42, 16, 38, PAL.timberDark);
  for (let y = 43; y <= 54; y++) {
    const notch = 3 - Math.abs(y - 48.5); // swallowtail cut into the right end
    c.rect(5, y, notch > 0 ? 22 - Math.round(notch) : 22, 1, PAL.rmitRed);
  }
  c.rect(5, 54, 22, 1, PAL.rmitRedDark);
  miniText(c, 'RMIT', 7, 46, PAL.signText);

  // right wall: a little pub sign
  c.rect(288, 38, 32, 26, PAL.gold);
  c.rect(289, 39, 30, 24, PAL.boardGreen);
  for (const [str, y] of [['THE', 42], ['OXFORD', 49], ['SCHOLAR', 56]]) miniText(c, str, 304 - Math.floor(miniWidth(str) / 2), y, PAL.gold);

  // on the ledge behind her: a tote bag with the RMIT logo, and a stack of books
  c.rect(62, 90, 14, 14, PAL.canvasBag);
  c.rect(62, 101, 14, 3, PAL.canvasBagShade);
  c.rect(74, 90, 2, 14, PAL.canvasBagShade);
  c.line(65, 90, 66, 85, PAL.canvasBagShade);
  c.line(66, 85, 71, 85, PAL.canvasBagShade);
  c.line(71, 85, 72, 90, PAL.canvasBagShade);
  drawRmitLogo(c, 66, 94, 5);
  PAL.books.forEach((col, i) => {
    c.rect(82 - i, 100 - i * 3, 16, 3, col);
    c.rect(82 - i, 102 - i * 3, 16, 1, PAL.timberDark, 0.35);
  });

  // pendant lamps: cords, shades with copper rims (their glow is lamps.png)
  for (const x of LAMPS) {
    c.rect(x, 0, 1, 26, PAL.lampShade);
    for (let i = 0; i < 6; i++) c.rect(x - 2 - i, 26 + i, 5 + i * 2, 1, PAL.lampShade);
    c.rect(x - 7, 31, 15, 1, PAL.lampRim);
    c.rect(x - 1, 32, 3, 1, PAL.bulb);
  }
  return c;
}
const LAMPS = [96, 160, 224];

// ---- 5. lamps.png — warm glow under the pendant lamps (pulse) -----------------------------
function drawLamps() {
  const c = new Canvas(W, H);
  for (const x of LAMPS) {
    softEllipse(c, x, 34, 16, 10, PAL.warmLight, 0.45);
    softEllipse(c, x, 34, 6, 3, PAL.bulb, 0.6);
  }
  // a soft pool of light on the table
  softEllipse(c, 160, 108, 30, 5, PAL.warmLight, 0.25);
  return c;
}

// ---- 6. table.png — high table + stools, fries, sauce ---------------------------------------
const TABLE = { left: 141, right: 179, top: 108 };

function drawTable() {
  const c = new Canvas(W, H);
  // stools (behind our legs; we sit on them)
  for (const sx of [130, 190]) {
    c.line(sx - 6, 123, sx - 10, 162, PAL.metal);
    c.line(sx + 6, 123, sx + 10, 162, PAL.metal);
    c.line(sx - 5, 123, sx - 9, 162, PAL.metalHi, 0.5);
    c.rect(sx - 8, 142, 17, 1, PAL.metal);
    c.ellipse(sx, 121, 9, 2, PAL.stoolSeat);
    c.rect(sx - 8, 120, 17, 1, PAL.stoolSeatHi);
  }
  // pedestal + foot
  c.rect(157, TABLE.top + 5, 6, 158 - TABLE.top - 5, PAL.metal);
  c.rect(158, TABLE.top + 5, 1, 158 - TABLE.top - 5, PAL.metalHi);
  c.rect(147, 158, 26, 3, PAL.metal);
  // top
  c.rect(TABLE.left, TABLE.top, TABLE.right - TABLE.left + 1, 2, PAL.tableTopHi);
  c.rect(TABLE.left, TABLE.top + 2, TABLE.right - TABLE.left + 1, 1, PAL.tableTop);
  c.rect(TABLE.left, TABLE.top + 3, TABLE.right - TABLE.left + 1, 3, PAL.tableEdge);

  // fries in a little metal basket lined with red-and-white paper
  const fy = TABLE.top - 1; // bottom of the basket
  for (let y = fy - 5; y <= fy; y++) {
    const inset = Math.floor((y - (fy - 5)) / 2);
    c.rect(153 + inset, y, 15 - inset * 2, 1, y === fy ? PAL.basketShade : PAL.basket);
  }
  for (let x = 152; x <= 168; x++) c.px(x, fy - 6, (x >> 1) % 2 ? PAL.paperCheck : PAL.paper);
  const r = rng(2024);
  for (let i = 0; i < 16; i++) {
    const x = 153 + r.int(0, 14);
    const h = r.int(3, 6);
    const lean = r.int(-1, 1);
    for (let k = 0; k < h; k++) c.px(x + Math.round((lean * k) / 3), fy - 7 - k, k === h - 1 ? PAL.fries : r() < 0.4 ? PAL.friesShade : PAL.fries);
  }
  // a pot of tomato sauce
  c.rect(170, TABLE.top - 3, 6, 3, PAL.ramekin);
  c.rect(171, TABLE.top - 3, 4, 1, PAL.sauce);
  c.outline(PAL.outline);
  return c;
}

// ---- 7. us.png — the two of us clinking glasses (8 frames: breathing + blinks) ------------
// Hands and glasses stay put; heads and bodies breathe 1px at different times.
const HER_X = 132;
const HIM_X = 188;
const HER_GLASS = { x: 148, top: 78, bottom: 93 }; // 7 wide
const PINT = { x: 155, top: 76, bottom: 90 }; // 9 wide at the top
const CLINK = { x: 154, y: 80 };

function drawHer(c, dy, blink) {
  const s = PAL;
  const top = 95 + dy; // her shoulders
  // legs (still): knees out from under the skirt, shins, white shoes with an ankle strap
  thickLine(c, 138, 117, 144, 118, 3, s.herSkin);
  thickLine(c, 143, 120, 142, 136, 3, s.herSkin);
  c.line(143, 121, 142, 135, s.herSkinShade); // the back of her shin, away from the light
  c.px(145, 118, s.herSkinHi); // light on her knee
  c.px(146, 119, s.herSkinHi);
  c.rect(141, 137, 6, 2, s.herShoes);
  c.rect(141, 139, 6, 1, s.herSole);
  c.rect(141, 136, 4, 1, s.herShoes); // strap
  c.px(146, 137, s.herSole);

  // her dress: bodice (back in shadow, a curve at the front, light on the front edge)
  for (let y = top; y <= 111; y++) {
    const bust = y >= top + 4 && y <= top + 8 ? 1 : 0;
    for (let x = 127; x <= 137 + bust; x++) {
      let col = s.herDress;
      if (x <= 128) col = s.herDressShade;
      else if (x === 137 + bust) col = s.herDressHi;
      c.px(x, y, col);
    }
  }
  c.clear(127, top);
  c.clear(137, top);
  c.px(135, top, s.herSkin); // lace scoop neckline
  c.px(136, top, s.lace);
  c.px(137, top + 1, s.lace);
  c.px(133, top + 6, s.herDressShade); // a seam down the front of the bodice
  c.px(133, top + 7, s.herDressShade);
  // skirt draped over her lap: soft pleats, a lace hem with little scallops
  for (let y = 112; y <= 118; y++) {
    const right = 139 + Math.min(2, y - 112);
    for (let x = 125; x <= right; x++) {
      let col = s.herDress;
      if (x <= 126) col = s.herDressShade;
      else if (y > 113 && (x - 128) % 3 === 0) col = s.herDressShade;
      else if (y > 113 && (x - 129) % 3 === 0) col = s.herDressHi;
      c.px(x, y, col);
    }
  }
  for (let x = 125; x <= 141; x++) {
    c.px(x, 119, x % 2 ? s.lace : s.laceShade);
    if (x % 2 === 0) c.px(x, 120, s.lace);
  }
  // sash at her waist, tied in a bow at the back with its tails hanging down
  for (let x = 127; x <= 138; x++) {
    c.px(x, 110, x === 138 ? s.sashLoopHi : s.sash);
    c.px(x, 111, s.sashDark);
  }
  c.map(['.bb...', 'brbK..', 'bbKKK.', 'brbK..', '.bb...'], { b: s.sashLoop, r: s.sashLoopHi, K: s.sashDark }, 122, 108);
  for (const [x, y, col] of [[126, 113, s.sash], [125, 114, s.sashDark], [125, 115, s.sash], [124, 116, s.sashDark], [127, 113, s.sashDark], [127, 114, s.sash]]) c.px(x, y, col);

  // neck
  c.rect(131, 91 + dy, 4, 5, s.herSkin);
  c.px(131, 94 + dy, s.herSkinShade);
  c.px(132, 94 + dy, s.herSkinShade);
  // head: pink bob with dark roots, fringe pink at the ends, facing right
  const hx = HER_X;
  const hy = 85 + dy;
  c.circle(hx, hy, 6.6, s.herHair);
  c.rect(hx - 7, hy, 7, 8, s.herHair); // the back of the bob, down to her jaw
  c.rect(hx - 7, hy + 7, 7, 1, s.herHairShade);
  c.ellipse(hx + 3, hy + 2, 4.6, 5, s.herSkin); // face
  c.px(hx + 8, hy + 2, s.herSkin); // nose
  c.rect(hx, hy - 4, 8, 3, s.herHair); // fringe over her forehead
  for (const x of [hx + 3, hx + 5, hx + 7]) c.px(x, hy - 1, s.herHair); // ragged fringe ends
  c.rect(hx - 1, hy - 2, 2, 9, s.herHair); // hair over her ear, down to the jaw
  c.px(hx - 1, hy + 6, s.herHairShade);
  // grown-out roots: dark on top, dithering into pink
  for (let y = hy - 8; y <= hy - 4; y++)
    for (let x = hx - 8; x <= hx + 8; x++) {
      const [r, g, b, a] = c.get(x, y);
      if (!a || `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}` !== s.herHair) continue;
      if (y < hy - 5 || (y === hy - 5 && (x + y) % 2 === 0) || (y === hy - 4 && (x + y) % 4 === 0)) c.px(x, y, s.herRoots);
    }
  // strands: light catching the curve of the bob, shade where it tucks under
  for (const [x, y] of [[hx - 4, hy - 1], [hx - 3, hy - 2], [hx - 5, hy + 1], [hx + 1, hy - 3], [hx - 6, hy + 2], [hx - 2, hy - 2], [hx + 4, hy - 3]]) c.px(x, y, s.herHairHi);
  for (const [x, y] of [[hx - 6, hy + 4], [hx - 6, hy + 5], [hx - 3, hy + 5], [hx - 3, hy + 6], [hx - 5, hy + 6]]) c.px(x, y, s.herHairShade);
  // eye (with a lash), eyebrow piercing, blush
  if (blink) {
    c.px(hx + 6, hy + 2, s.herSkinShade);
    c.px(hx + 7, hy + 2, s.eye);
  } else {
    c.px(hx + 6, hy + 1, s.eye);
    c.px(hx + 6, hy + 2, s.eye);
    c.px(hx + 7, hy + 1, s.eye); // lash
  }
  c.px(hx + 7, hy, s.piercing); // eyebrow piercing
  c.px(hx + 5, hy + 4, s.herBlush);
  c.px(hx + 6, hy + 4, s.herBlush, 0.6);
}

function drawHim(c, dy, blink) {
  const s = PAL;
  const top = 88 + dy; // his shoulders
  // legs (still): loose dark jeans. His thigh lies along the stool seat, a
  // little lower at the knee, with soft folds across his lap...
  for (let x = 174; x <= 194; x++) {
    const t = (194 - x) / 20;
    const thighTop = Math.round(113 + 2 * t);
    c.rect(x, thighTop, 1, 121 - thighTop, s.jeans);
    c.px(x, thighTop, s.jeansHi); // light along the top
    c.px(x, 120, s.jeansShade); // shadow underneath
  }
  c.ellipse(174, 118, 3, 2.5, s.jeans); // his knee, rounded at the front but level with his thigh
  c.px(173, 116, s.jeansHi);
  for (const [x, y] of [[179, 116], [180, 117], [184, 116], [185, 117], [186, 118]]) c.px(x, y, s.jeansShade); // folds
  // ...then his shin angles back from the knee so his feet rest on the
  // stool's footrest (the ring at y 142): wide and loose, flaring a touch at
  // the bottom, a crease down the front, bunching at the ankle.
  const shinX = (y) => 175.5 + (7.5 * (y - 120)) / 18; // the middle of his shin at row y
  for (let y = 120; y <= 138; y++) {
    const flare = y > 133 ? 1 : 0;
    const left = Math.round(shinX(y) - 4) - flare;
    const right = Math.round(shinX(y) + 3);
    c.rect(left, y, right - left + 1, 1, s.jeans);
    c.px(right, y, s.jeansShade); // the back of his leg, away from the light
    if (y >= 122 && y <= 133) c.px(Math.round(shinX(y) - 1), y, s.jeansHi, 0.6); // crease
  }
  c.rect(178, 120, 1, 2, s.jeansShade); // the fold behind his knee
  for (const [dx, y] of [[-3, 135], [-2, 135], [1, 136], [2, 136], [-4, 137]]) c.px(Math.round(shinX(y)) + dx, y, s.jeansShade); // bunched at the ankle
  // shoes: dark, laced, with pale soles, resting on the footrest, toes towards her
  c.rect(178, 139, 9, 2, s.himShoes);
  c.px(177, 140, s.himShoes);
  c.rect(177, 141, 10, 1, s.himSole);
  c.px(180, 139, s.himShoesHi);
  c.px(182, 139, s.himShoesHi);

  // body: open brown jacket over a white shirt (front faces left). It's long:
  // it falls past his hips, and the back of it rests on the stool behind him.
  const hem = 121;
  c.rect(182, top, 13, hem - top, s.jacket);
  c.rect(195, 112, 1, hem - 112, s.jacket); // flaring out a little at the back
  c.rect(192, top + 1, 3, hem - top - 1, s.jacketShade); // his back, in shadow
  c.rect(195, 112, 1, hem - 112, s.jacketShade);
  c.rect(185, top, 8, 1, s.jacketHi); // light on the shoulders
  c.clear(194, top);
  // a rounded chest at the front (not a square corner at the shoulder)
  c.clear(182, top);
  c.clear(182, top + 1);
  c.clear(183, top);
  // shirt down the front, starting a little below his collar: a narrow V
  // that widens as it goes down, a button or two
  c.px(184, top + 1, s.shirt); // collar point
  c.rect(183, top + 2, 2, 2, s.shirt);
  c.rect(182, top + 4, 3, 115 - top - 4, s.shirt);
  c.rect(184, top + 4, 1, 113 - top - 4, s.shirtShade);
  c.px(182, top + 2, s.jacket);
  c.px(182, top + 3, s.jacket);
  for (const by of [top + 8, top + 14, top + 20]) c.px(183, by, s.button);
  // jacket: collar up behind his neck, lapel, a seam, pocket, hem
  c.rect(187, top - 1, 3, 2, s.jacketShade);
  c.line(185, top + 2, 185, top + 13, s.jacketShade); // lapel edge
  c.line(186, top + 1, 187, top + 6, s.jacketHi); // lapel catching the light
  c.line(190, top + 4, 190, hem - 2, s.jacketShade); // side seam
  c.rect(186, 109, 4, 1, s.jacketShade); // pocket flap
  c.rect(185, 118, 11, 1, s.jacketShade, 0.6); // a soft fold where it bunches on the seat
  c.rect(185, hem - 1, 11, 1, s.jacketShade); // hem
  // the open front: belt, then his jeans on his lap below it
  c.rect(182, 113, 3, 1, s.belt);
  c.px(182, 113, s.buckle);
  c.rect(182, 114, 3, hem - 114, s.jeans);
  c.px(184, 114, s.jeansShade);
  c.rect(185, 114, 1, hem - 114, s.jacketShade); // the jacket's front edge
  // neck (his hair is short, so it shows)
  c.rect(185, 83 + dy, 4, 6, s.himSkin);
  c.px(188, 85 + dy, s.himSkinShade);
  c.rect(185, 85 + dy, 3, 1, s.himSkinShade); // shadow under his jaw
  // head: short black hair with a fringe, facing left
  const hx = HIM_X - 1;
  const hy = 78 + dy;
  c.circle(hx, hy, 6.6, s.himSkin);
  c.ellipse(hx - 2, hy + 2, 4.6, 4.6, s.himSkin);
  c.px(hx - 7, hy + 1, s.himSkin); // nose
  for (let y = hy - 8; y <= hy + 3; y++)
    for (let x = hx - 8; x <= hx + 8; x++) {
      const inHead = (x - hx) ** 2 + (y - hy) ** 2 <= 6.6 * 6.6 + 4;
      if (!inHead) continue;
      if (y <= hy - 3 || (x >= hx + 2 && y <= hy + 1)) c.px(x, y, s.himHair);
    }
  c.rect(hx - 7, hy - 4, 6, 2, s.himHair); // fringe
  c.px(hx - 6, hy - 2, s.himHair);
  c.px(hx - 4, hy - 2, s.himHair);
  c.px(hx - 7, hy - 2, s.himHair); // a strand of fringe
  // his ear, and the hair trimmed short around it
  c.px(hx + 1, hy + 1, s.himSkinShade);
  c.px(hx + 1, hy + 2, s.himSkinShade);
  c.px(hx + 2, hy + 1, s.himSkin);
  c.px(hx + 2, hy + 2, s.himSkinShade);
  c.px(hx + 1, hy, s.himHair); // sideburn
  // texture in his hair
  for (const [x, y] of [[hx - 2, hy - 5], [hx + 1, hy - 6], [hx + 3, hy - 4], [hx - 4, hy - 6], [hx, hy - 7], [hx + 4, hy - 2], [hx - 5, hy - 4]]) c.px(x, y, s.himHairHi);
  // eye, blush, jaw
  if (blink) c.px(hx - 5, hy + 1, s.himSkinShade);
  else {
    c.px(hx - 5, hy, s.eye);
    c.px(hx - 5, hy + 1, s.eye);
  }
  c.px(hx - 4, hy + 3, s.himBlush);
  c.px(hx - 1, hy + 5, s.himSkinShade);
  c.px(hx, hy + 5, s.himSkinShade);
}

function drawGlasses(c) {
  const s = PAL;
  // her Long Island: tall glass, iced-tea brown, ice, lemon wedge, red straw
  const g = HER_GLASS;
  c.rect(g.x + 1, g.top + 3, 5, g.bottom - g.top - 3, s.longIsland);
  c.rect(g.x + 1, g.top + 3, 5, 1, s.longIslandTop);
  for (const [x, y] of [[1, 5], [2, 5], [3, 7], [4, 7], [1, 9], [2, 10], [4, 11]]) c.px(g.x + x, g.top + y, s.ice);
  c.rect(g.x, g.top, 1, g.bottom - g.top + 1, s.glass);
  c.rect(g.x + 6, g.top, 1, g.bottom - g.top + 1, s.glass);
  c.rect(g.x, g.bottom, 7, 1, s.glass);
  c.line(g.x + 4, g.top + 3, g.x + 6, g.top - 6, s.straw);
  c.px(g.x - 1, g.top, s.lemon);
  c.px(g.x, g.top - 1, s.lemon);
  c.px(g.x + 1, g.top - 1, s.lemonRind);
  // his pint: gold beer, creamy head, glass tapering towards the base
  const p = PINT;
  for (let y = p.top; y <= p.bottom; y++) {
    const inset = y >= p.bottom - 4 ? 1 : 0;
    const l = p.x + inset;
    const rgt = p.x + 8 - inset;
    let col = y < p.top + 3 ? s.foam : s.beer;
    if (y === p.top + 2) col = s.foamShade;
    c.rect(l, y, rgt - l + 1, 1, col);
    if (y >= p.top + 3) {
      c.px(l + 2, y, s.beerHi);
      c.px(rgt - 1, y, s.beerShade);
    }
    c.px(l, y, s.glass);
    c.px(rgt, y, s.glass);
  }
  for (const x of [1, 3, 6]) c.px(p.x + x, p.top - 1, s.foam); // foam bubbling over the rim
  c.rect(p.x + 1, p.bottom, 7, 1, s.glass);
}

function drawUsFrame(herDy, himDy, herBlink, himBlink) {
  const c = new Canvas(W, H);
  drawHer(c, herDy, herBlink);
  drawHim(c, himDy, himBlink);
  drawGlasses(c);
  // her arm: puff sleeve, shoulder -> elbow -> hand around her glass
  thickLine(c, 135, 99 + herDy, 140, 103, 3, PAL.herSkin);
  thickLine(c, 140, 103, 146, 88, 3, PAL.herSkin);
  c.px(140, 104, PAL.herSkinShade); // the crook of her elbow
  c.px(141, 105, PAL.herSkinShade);
  c.ellipse(135, 97 + herDy, 2.6, 2, PAL.herDressHi); // puff sleeve...
  c.rect(133, 99 + herDy, 5, 1, PAL.herDressDeep); // ...gathered underneath
  c.px(134, 95 + herDy, PAL.herDress);
  c.rect(145, 84, 3, 5, PAL.herSkin);
  c.rect(148, 85, 2, 3, PAL.herSkin); // fingers over the glass
  c.px(148, 86, PAL.herSkinShade); // between her fingers
  c.px(145, 88, PAL.herSkinShade);
  // his arm: shoulder -> elbow -> hand around his pint
  thickLine(c, 184, 90 + himDy, 178, 101, 3, PAL.jacket);
  thickLine(c, 178, 101, 167, 86, 3, PAL.jacket);
  c.px(179, 100, PAL.jacketHi); // light on his elbow
  c.px(176, 96, PAL.jacketHi);
  c.rect(167, 85, 2, 3, PAL.jacketShade); // jacket cuff...
  c.rect(166, 84, 1, 3, PAL.shirt); // ...and his shirt cuff peeking out
  c.rect(163, 81, 3, 5, PAL.himSkin);
  c.rect(162, 82, 2, 3, PAL.himSkin); // fingers over the glass
  c.px(162, 83, PAL.himSkinShade); // between his fingers
  c.px(165, 85, PAL.himSkinShade);
  rimLight(c, PAL.warmLight, 0.28);
  c.outline(PAL.outline);
  return c;
}

function drawUs() {
  const HER_DY = [0, 0, -1, -1, -1, 0, 0, 0];
  const HIM_DY = [0, 0, 0, 0, -1, -1, -1, 0];
  const sheet = new Canvas(W * 8, H);
  for (let f = 0; f < 8; f++) sheet.blit(drawUsFrame(HER_DY[f], HIM_DY[f], f === 6, f === 2), f * W, 0);
  return sheet;
}

// ---- 8. steam.png — steam off the fries, bubbles in the beer, the clink (12 frames) --------
const STEAM_FRAMES = 12;

function drawSteam() {
  const sheet = new Canvas(W * STEAM_FRAMES, H);
  for (let f = 0; f < STEAM_FRAMES; f++) {
    const c = new Canvas(W, H);
    // three wisps rising off the fries
    for (const [sx, sy, phase] of [[156, 99, 0], [160, 98, 5], [164, 99, 9]]) {
      for (let k = 0; k < 3; k++) {
        const rise = (f * 1.5 + phase + k * 5) % 15;
        const y = Math.round(sy - rise);
        const x = sx + Math.round(Math.sin((rise + sx) * 0.6) * 1.2);
        const a = 0.4 * (1 - rise / 15);
        c.px(x, y, PAL.steam, a);
        c.px(x, y - 1, PAL.steam, a * 0.7);
      }
    }
    // bubbles rising in the pint
    for (const [bx, phase] of [[157, 0], [159, 4], [161, 7], [158, 9]]) {
      const y = PINT.bottom - 1 - ((f + phase) % 10);
      if (y > PINT.top + 3) c.px(bx, y, PAL.bubble, 0.85);
    }
    // the "clink": a little star where the glasses touch
    const star = f === 0 ? 3 : f === 1 ? 2 : f === 2 ? 1 : 0;
    if (star) {
      c.px(CLINK.x, CLINK.y, PAL.sparkle);
      for (let i = 1; i <= star; i++) {
        const a = 1 - (i - 1) / (star + 1);
        c.px(CLINK.x - i, CLINK.y - i, PAL.sparkle, a);
        c.px(CLINK.x + i, CLINK.y - i, PAL.sparkle, a);
        c.px(CLINK.x, CLINK.y - i - 1, PAL.sparkle, a);
        c.px(CLINK.x - i - 1, CLINK.y, PAL.sparkle, a * 0.6);
        c.px(CLINK.x + i + 1, CLINK.y, PAL.sparkle, a * 0.6);
      }
    }
    sheet.blit(c, f * W, 0);
  }
  return sheet;
}

// ---- 9. vignette.png — soft warm-dark edges ---------------------------------------------------
function drawVignette() {
  const c = new Canvas(W, H);
  const levels = [0, 0.16, 0.32, 0.48, 0.62];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 160) / 178, (y - 92) / 120);
      const t = Math.max(0, Math.min(1, (d - 0.6) / 0.42));
      const lv = t * 4;
      const i = Math.min(4, Math.floor(lv) + (lv % 1 > bayer(x, y) ? 1 : 0));
      if (i) c.px(x, y, PAL.vignette, levels[i]);
    }
  return c;
}

// ---- The buildings for the map ------------------------------------------------------------------
const PUB = { cols: 8, rows: 6, at: { x: 27, y: 0 } }; // where the café was; doors at tiles x 30–31
// RMIT: right up against the pub, where the house east of it was, and wide
// enough that the pavement sticks out past it by one tile (like it does on the left)
const RMIT = { cols: 7, rows: 6, at: { x: 35, y: 0 } };
const OLD_HOUSE = { x: 37, y: 2, w: 5, h: 4 }; // the placeholder house RMIT replaces (cleared first)

/** The Oxford Scholar: red brick, cream render, timber-fin awning, "1887" up top. */
function drawPub() {
  const c = new Canvas(PUB.cols * 16, PUB.rows * 16);
  const w = c.width;
  const s = PAL;
  // flat roof + a chimney
  c.rect(0, 0, w, 9, s.pubRoof);
  for (let y = 2; y < 9; y += 3) c.rect(0, y, w, 1, s.pubRoofLine);
  c.rect(8, 0, 9, 12, s.pubBrick);
  c.rect(7, 0, 11, 2, s.pubCream);
  c.rect(8, 5, 9, 1, s.pubBrickLine);
  // parapet with balusters
  c.rect(0, 8, w, 7, s.pubCream);
  for (let x = 2; x < w - 2; x += 3) c.rect(x, 10, 1, 3, s.pubCreamDark);
  // pediment in the middle, with the year
  for (let y = 1; y <= 14; y++) {
    const half = Math.round(((y - 1) * 22) / 13);
    c.rect(64 - half, y, half * 2, 1, s.pubCream);
    c.px(64 - half, y, s.pubCreamDark);
    c.px(63 + half, y, s.pubCreamShade);
  }
  miniText(c, PUB_YEAR, 64 - Math.ceil(miniWidth(PUB_YEAR) / 2), 7, s.pubCreamDark);
  // cornice with dentils
  c.rect(0, 14, w, 4, s.pubCream);
  for (let x = 1; x < w; x += 2) c.px(x, 16, s.pubCreamShade);
  c.rect(0, 17, w, 1, s.pubCreamDark);
  // two floors of red brick
  const brick = (y0, y1) => {
    c.rect(0, y0, w, y1 - y0, s.pubBrick);
    for (let y = y0 + 2; y < y1; y += 3) c.rect(0, y, w, 1, s.pubBrickLine, 0.5);
  };
  brick(18, 39);
  brick(42, 60);
  // windows: cream surrounds, sash bar, a few lit
  const WIN_X = [14, 39, 64, 89, 114];
  const windowAt = (cx, y0, h, lit) => {
    c.rect(cx - 5, y0, 11, h, s.pubCream);
    c.rect(cx - 3, y0 + 2, 7, h - 3, lit ? s.pubLit : s.pubGlass);
    c.rect(cx - 3, y0 + Math.floor(h / 2), 7, 1, s.pubCream);
    c.px(cx - 2, y0 + 3, lit ? s.pubLitHi : s.pubGlassHi);
    c.rect(cx - 5, y0 + h, 11, 1, s.pubCreamDark);
  };
  WIN_X.forEach((x, i) => windowAt(x, 21, 15, i === 1 || i === 4));
  WIN_X.forEach((x, i) => windowAt(x, 45, 13, i === 2 || i === 3));
  // a little triangular hood over the middle first-floor window
  for (let i = 0; i < 4; i++) c.rect(64 - 6 + i, 44 - i, 13 - i * 2, 1, s.pubCream);
  // string course + cornice
  c.rect(0, 39, w, 3, s.pubCream);
  c.rect(0, 41, w, 1, s.pubCreamShade);
  c.rect(0, 60, w, 4, s.pubCream);
  for (let x = 1; x < w; x += 2) c.px(x, 62, s.pubCreamShade);
  c.rect(0, 64, w, 1, s.pubCreamDark);
  // ground floor: cream rusticated render
  c.rect(0, 65, w, 28, s.pubCream);
  for (let y = 68; y < 93; y += 4) {
    c.rect(0, y, w, 1, s.pubCreamShade);
    for (let x = (y % 8 === 0 ? 0 : 5); x < w; x += 10) c.px(x, y - 3, s.pubCreamShade);
  }
  // two arched windows on the left
  for (const x0 of [5, 23]) {
    for (let x = x0; x < x0 + 12; x++) {
      const top = Math.round(72 + (1 - Math.sin((PI * (x - x0 + 0.5)) / 12)) * 4);
      c.rect(x, top, 1, 89 - top, s.pubGlass);
    }
    c.rect(x0 + 5, 70, 2, 2, s.pubCreamDark); // keystone
    c.px(x0 + 3, 77, s.pubGlassHi);
    c.rect(x0 - 1, 89, 14, 1, s.pubCreamDark);
  }
  // timber-fin awning over the doors + glazing
  for (let x = 42; x < w; x++) {
    const t = (x - 42) % 8;
    const depth = t < 4 ? t : 7 - t;
    c.rect(x, 64, 1, 4 + depth, t < 4 ? s.pubFin : s.pubFinShade);
  }
  // timber-framed glazing, dark up top with the sign, lit below
  c.rect(44, 70, w - 46, 23, s.timber);
  c.rect(46, 71, w - 50, 6, s.pubSign);
  miniText(c, PUB_SIGN, 85 - Math.floor(miniWidth(PUB_SIGN) / 2), 72, s.signText);
  // double doors (tiles x 3–4) + side windows
  for (const [x0, x1] of [[50, 62], [65, 77], [81, 93], [96, 108], [111, 123]]) {
    c.rect(x0, 78, x1 - x0 + 1, 14, s.pubLit);
    c.rect(x0, 84, x1 - x0 + 1, 1, s.timber);
    c.rect(x0 + Math.floor((x1 - x0) / 2), 78, 1, 14, s.timber);
    c.px(x0 + 1, 79, s.pubLitHi);
  }
  c.rect(63, 78, 2, 15, s.timberShade); // between the doors
  c.px(61, 86, s.timberDark); // handles
  c.px(66, 86, s.timberDark);
  c.rect(40, 65, 4, 28, s.pubCreamShade); // pilaster
  // step + edges
  c.rect(0, 93, w, 3, s.step);
  c.rect(0, 0, 1, 93, s.pubCreamDark);
  c.rect(w - 1, 0, 1, 93, s.pubCreamDark);
  return c;
}

/** RMIT's Building 80: faceted blue glass, the red RMIT sign, a red door. */
function drawRmitBuilding() {
  const c = new Canvas(RMIT.cols * 16, RMIT.rows * 16);
  const w = c.width;
  const s = PAL;
  for (let y = 0; y < 60; y++)
    for (let x = 0; x < w; x++) {
      const lx = x % 8;
      const ly = y % 8;
      const half = lx + ly < 8 ? 0 : 1;
      let col = s.facets[Math.floor(hash(Math.floor(x / 8) + 50, Math.floor(y / 8), half) * s.facets.length)];
      if (hash(Math.floor(x / 8), Math.floor(y / 8), half + 3) < 0.2) col = s.facetHi;
      c.px(x, y, col);
      if (lx + ly === 7) c.px(x, y, s.tower, 0.3);
    }
  // red canopy, dark sign panel with the logo and name, zig-zag red trim under it
  c.rect(0, 60, w, 2, s.rmitRed);
  c.rect(0, 62, w, 12, s.signPanel);
  const signW = 9 + 4 + textWidth('RMIT'); // logo, gap, name — centred
  const signX = Math.round((w - signW) / 2);
  drawRmitLogo(c, signX, 63, 9);
  text(c, 'RMIT', signX + 13, 64, s.signText);
  for (let x = 0; x < w; x++) c.rect(x, 74, 1, 2 + ((x >> 2) % 2), s.rmitRed);
  // glass shopfront + the red door
  c.rect(0, 77, w, 16, s.shopfront);
  const door = w / 2; // the doors are in the middle, the panes mirrored either side
  for (let i = 0; i < 4; i++) {
    c.rect(door + 11 + 12 * i, 78, 9, 14, s.litWindow, 0.45);
    c.rect(door - 20 - 12 * i, 78, 9, 14, s.litWindow, 0.45);
  }
  // glass double doors in a red frame, with tall door pulls
  c.rect(door - 8, 77, 16, 16, s.rmitRed);
  c.rect(door - 8, 77, 16, 1, s.rmitRedDark);
  c.rect(door - 6, 79, 12, 14, s.shopfront);
  c.rect(door - 6, 79, 5, 14, s.litWindow, 0.6);
  c.rect(door + 1, 79, 5, 14, s.litWindow, 0.6);
  c.rect(door - 2, 83, 1, 5, s.signText);
  c.rect(door + 1, 83, 1, 5, s.signText);
  c.rect(0, 93, w, 3, s.step);
  return c;
}

// ---- Swap the café on maps/world.json for the pub + RMIT (first time only) ---------------------
function addToMap() {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  const triggers = map.layers.find((l) => l.name === 'Triggers').objects;
  const memoryIdOf = (o) => o.properties?.find((p) => p.name === 'memoryId');
  let trigger = triggers.find((o) => ['cafe', 'oxford-scholar'].includes(memoryIdOf(o)?.value));
  if (map.tilesets.some((t) => t.name === 'oxford-scholar')) {
    console.log('  map      already has the Oxford Scholar — left untouched');
    return;
  }
  const decor = map.layers.find((l) => l.name === 'Decor').data;
  for (let y = OLD_HOUSE.y; y < OLD_HOUSE.y + OLD_HOUSE.h; y++)
    for (let x = OLD_HOUSE.x; x < OLD_HOUSE.x + OLD_HOUSE.w; x++) decor[y * map.width + x] = 0;
  stampBuilding(map, { name: 'oxford-scholar', image: '../public/assets/tiles/oxford-scholar.png', ...PUB });
  stampBuilding(map, { name: 'rmit', image: '../public/assets/tiles/rmit.png', ...RMIT });
  // the trigger in front of the doors (re-using the café's, if it's there)
  if (!trigger) {
    trigger = { id: map.nextobjectid++, type: '', x: 0, y: 0, rotation: 0, visible: true, properties: [{ name: 'memoryId', type: 'string', value: '' }] };
    triggers.push(trigger);
  }
  Object.assign(trigger, { name: 'pub doors', x: (PUB.at.x + 3) * 16, y: (PUB.at.y + PUB.rows) * 16, width: 32, height: 16 });
  memoryIdOf(trigger).value = 'oxford-scholar';
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  console.log(`  map      the café is now the Oxford Scholar (tiles x ${PUB.at.x}–${PUB.at.x + PUB.cols - 1}), RMIT next door (x ${RMIT.at.x}–${RMIT.at.x + RMIT.cols - 1}) + trigger`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing the Oxford Scholar…');
const layers = {
  street: drawStreet(),
  'street-lights': drawStreetLights(),
  people: drawPeople(),
  'walkers-left': drawWalkersLeft(),
  'walkers-right': drawWalkersRight(),
  tram: drawTram(),
  interior: drawInterior(),
  lamps: drawLamps(),
  table: drawTable(),
  us: drawUs(),
  steam: drawSteam(),
  vignette: drawVignette(),
};
for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);
const pub = drawPub();
const rmit = drawRmitBuilding();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'oxford-scholar.png'), pub);
save(path.join(ROOT, 'public', 'assets', 'tiles', 'rmit.png'), rmit);
addToMap();

// ---- Previews (3x) ----------------------------------------------------------------------------
const flat = new Canvas(W, H);
flat.rect(0, 0, W, H, '#000000');
for (const [name, canvas] of Object.entries(layers)) {
  if (name === 'tram') {
    const view = new Canvas(W, H); // the tram as it passes the middle window
    view.blit(canvas, -230, 0);
    flat.blit(view, 0, 0);
  } else flat.blit(canvas, 0, 0); // frame sheets: frame 1 sits at x 0..319
}
writePreview('oxford-scholar.png', flat);
const street = new Canvas(16 * 16, 8 * 16);
street.rect(0, 0, street.width, street.height, '#8cc269');
street.rect(0, 6 * 16, street.width, 16, '#e6d3b0');
street.rect(0, 7 * 16, street.width, 16, '#a99886');
street.blit(pub, 16, 0);
street.blit(rmit, 16 + (RMIT.at.x - PUB.at.x) * 16, 0);
writePreview('oxford-scholar-street.png', street);
console.log('  preview  tools/previews/oxford-scholar.png, tools/previews/oxford-scholar-street.png');
