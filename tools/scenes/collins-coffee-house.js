#!/usr/bin/env node
// -----------------------------------------------------------------------------
// collins-coffee-house.js — draws "High tea at Collins Coffee House" as
// layered pixel art, plus the building (the sandstone Gothic one on Collins
// Street, with its spire on the corner tower) for the map, where it takes the
// place of the little house left of the Oxford Scholar (only the first time).
//
//   npm run scene:collins                      # (re)draw everything
//   npm run scene:collins -- --keep us,table   # don't overwrite layers you've redrawn
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/memories/collins-coffee-house/*.png   the cutscene layers
//   public/assets/tiles/collins.png                     the building (128x96 = 8x6 tiles)
//   tools/previews/collins-coffee-house.png             flattened preview (3x size)
//   tools/previews/collins-coffee-house-map.png         the building on the street (3x)
//
// The scene: a bright day, inside the high tea room. Dark timber panelling, a
// Gothic arched window onto the plane trees of Collins Street, the gold-framed
// sign, a pastry cabinet, other guests faded into the background. Across a round wooden table with a three-tier stand of
// cakes, sandwiches and quiches: her in her long blue puff-sleeve dress on a red
// velvet chair, pouring tea from the white-and-gold teapot; him in his dark
// plum shirt on a red velvet armchair, holding a coupe glass.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas, rng, bayer, hexToRgb } from '../lib/canvas.js';
import { P } from '../lib/palette.js';
import { ROOT, makeSaver, thickLine, rimLight, softEllipse, text, textWidth, miniText, miniWidth, writePreview, stampBuilding } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // outside the window: a bright day on Collins Street
  sky: ['#8fbfe8', '#a9cdee', '#c6def4'],
  cloud: '#f2f6fb',
  leaves: ['#2f5a34', '#3f7240', '#56904c', '#79ad5c'],
  // sandstone (the building across the street, and ours on the map)
  stone: '#e6c7a0',
  stoneHi: '#f4dcbc',
  stoneShade: '#c9a47c',
  stoneDark: '#a07a58',
  granite: '#8e8a8c',
  graniteDark: '#6e6a70',
  slate: '#5a5e72',
  slateLine: '#474a5c',
  glassDark: '#2f3a44',
  glassHi: '#5a6e7c',
  litWindow: '#ffd98a',
  // the room: dark timber panelling (dark to light)
  wood: ['#24140f', '#331d15', '#43271b', '#573323', '#6e432c'],
  woodHi: '#8c5a38',
  // sunlight through the window
  sun: '#fff1c8',
  // checkered floor tiles
  tileLight: '#cfcac2',
  tileDark: '#9f9a95',
  // the sign: cream, gold double frame, gold letters (like the logo)
  signCream: '#f6efdf',
  gold: '#c99a1a',
  goldHi: '#ecc95c',
  goldShade: '#94700f',
  // pastry cabinet + the shelves behind the counter
  cabinetGlass: '#fff4dc',
  cakes: ['#f2a7c3', '#fce3a8', '#a8d08d', '#f6efe4', '#c98a5a', '#e7708a'],
  bottles: ['#3f6b3a', '#8a3a2a', '#c99a1a', '#5a4a6a', '#d9d6d0', '#2f4a5a'],
  lamp: '#ffd98a',
  // chairs: both red velvet (hers a carved timber chair, his a buttoned armchair)
  velvet: ['#5a1820', '#7e2430', '#a3343e'],
  // the other guests, faded into the room behind us
  guestFade: '#5e4234',
  guestTops: ['#3a4a6a', '#7a3a4a', '#e8e0d0', '#4a5a3a', '#6a5a7a'],
  guestHair: ['#2a1c18', '#6a4a2a', '#c9a46a', '#3a2a2a'],
  guestSkin: ['#e8bc9a', '#c99070', '#a87050'],
  // the round timber table
  table: '#7a4026',
  tableHi: '#a8623a',
  tableShade: '#4f2616',
  // china, silver, tea
  china: '#f8f6f2',
  chinaShade: '#d6d2da',
  chinaGold: '#d4a73a',
  floral: ['#6f8fd8', '#e889a6'],
  silver: '#c8ccd6',
  silverShade: '#8a8e9a',
  tea: '#9a4e24',
  teaHi: '#c4743c',
  steam: '#ffffff',
  // the food on the stand
  pinkIcing: '#f2a7c3',
  pastry: '#d9a25e',
  pastryShade: '#b07a3e',
  matcha: '#9cc27a',
  cream: '#fbf3e4',
  blueberry: '#3a3f7a',
  bread: '#f4e8cc',
  crust: '#d4ad74',
  cucumber: '#7fbf5a',
  quiche: '#f2c25a',
  tomato: '#d9483a',
  // drinks + the little things on the table
  glass: '#e8eef6',
  glassShade: '#b8c4d4',
  chocolate: '#6a3a28',
  chocolateFoam: '#c99a6e',
  flowerBlue: ['#4a5fc8', '#7e95f0'],
  flowerWhite: '#fbfbff',
  stem: '#4f8a46',
  // her: pink bob with dark roots, olive skin, the light blue puff-sleeve dress she wore
  herHair: P.herHair,
  herHairHi: P.herHairHi,
  herHairShade: '#b8475f',
  herRoots: P.herRoots,
  herSkin: P.herSkin,
  herSkinShade: P.herSkinShade,
  herBlush: P.herBlush,
  herDress: '#a9c0e8',
  herDressShade: '#869fd2',
  herDressHi: '#c9d9f4',
  ribbon: '#7088c2',
  necklace: '#e8c45a',
  herShoes: P.white,
  piercing: P.silver,
  // him: messy dark hair, dark plum button-up, black trousers
  himHair: P.himHair,
  himHairHi: P.himHairHi,
  himSkin: P.himSkin,
  himSkinShade: '#d6a585',
  himBlush: P.himBlush,
  himShirt: '#4c2a3e',
  himShirtShade: '#381d2d',
  himShirtHi: '#6c3f58',
  button: '#22141c',
  trousers: '#2a2730',
  trousersHi: '#3e3a46',
  trousersShade: '#1c1a22',
  sole: '#14100e',
  shoeHi: '#6a5a50',
  himShoes: P.shoeDark,
  eye: '#1a1214',
  outline: '#1a1014',
  warmLight: '#fff1c8',
  vignette: '#140a08',
  step: '#8a8580',
};
const SIGN = ['COLLINS', 'COFFEE HOUSE', 'HIGH TEA ROOM'];

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const PI = Math.PI;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'collins-coffee-house');
const save = makeSaver();
const r = rng(333); // one generator for the whole scene, so it comes out the same every run

const FLOOR_Y = 118; // where the back wall meets the floor
const SEAT = 114; // the top of both chair cushions, where we sit
const FEET = 142; // where chair legs and shoes meet the floor
const WINDOW = { cx: 48, hw: 27, top: 12, bottom: 100 }; // the big Gothic window, left of her
const TABLE = { x: 160, y: 106, rx: 46, ry: 3 }; // centre of the table top
const STAND = { x: 162, plates: [74, 88, 102], rx: 11 }; // the three-tier stand
const HER_CUP = { x: 143, y: 100 }; // centre of the rim of her teacup
const TEAPOT = { x: 134, y: 86 }; // the middle of the teapot in her hand
const SPOUT = { x: 141, y: 90 }; // the tip of its spout, as she pours

/**
 * A pointed (Gothic) arch: for a column `dx` from the middle of an opening
 * `hw` wide each side, how far below the point its top edge is.
 */
const archDrop = (dx, hw) => Math.round(hw * Math.sqrt(3) - Math.sqrt(Math.max(0, 4 * hw * hw - (Math.abs(dx) + hw) ** 2)));

/** Fill a pointed-arch opening (top = the point, down to `bottom`). */
function arch(c, cx, hw, top, bottom, color, alpha = 1) {
  for (let dx = -hw; dx <= hw; dx++) {
    const y0 = top + archDrop(dx, hw);
    if (y0 <= bottom) c.rect(cx + dx, y0, 1, bottom - y0 + 1, color, alpha);
  }
}

/** Make a pointed-arch hole in a canvas (so the layer behind shows through). */
function clearArch(c, cx, hw, top, bottom) {
  for (let dx = -hw; dx <= hw; dx++)
    for (let y = top + archDrop(dx, hw); y <= bottom; y++) c.clear(cx + dx, y);
}

// ---- 1. outside.png — the sky and the sandstone building across the street ----------------------
function drawOutside() {
  const c = new Canvas(W, H);
  c.gradientV(0, 0, W, 110, PAL.sky);
  for (const [x, y, w] of [[10, 18, 26], [52, 30, 20], [30, 44, 14]]) {
    softEllipse(c, x + w / 2, y, w / 2, 4, PAL.cloud, 0.8);
  }
  // across the street: sandstone with pointed windows, lit by the sun
  c.rect(0, 52, 100, 60, PAL.stone);
  for (let y = 55; y < 112; y += 4) c.rect(0, y, 100, 1, PAL.stoneShade, 0.4);
  for (const x of [8, 26, 44, 62, 80]) {
    arch(c, x, 4, 60, 76, PAL.glassDark);
    arch(c, x, 4, 86, 102, PAL.glassDark);
    c.px(x - 2, 66, PAL.glassHi);
    c.px(x - 2, 92, PAL.glassHi);
  }
  c.rect(0, 80, 100, 2, PAL.stoneDark);
  return c;
}

// ---- 2. leaves.png — the plane trees outside the window (sway) ----------------------------------
function drawLeaves() {
  const c = new Canvas(W, H);
  // big five-pointed plane leaves, in clumps across the window
  for (let i = 0; i < 70; i++) {
    const x = r.int(WINDOW.cx - WINDOW.hw, WINDOW.cx + WINDOW.hw);
    const y = r.int(WINDOW.top + 4, 70);
    const col = r.pick(PAL.leaves);
    c.circle(x, y, r.range(2, 3.6), col);
    c.px(x - 3, y - 1, col);
    c.px(x + 3, y - 1, col);
    c.px(x, y - 4, col);
    if (r() < 0.4) c.px(x - 1, y - 1, PAL.leaves[3]);
  }
  // a branch
  thickLine(c, WINDOW.cx + 30, 40, WINDOW.cx - 10, 58, 2, '#6a5a48');
  return c;
}

// ---- 3. room.png — panelling, the window, the sign, the cabinet, chairs, floor ------------------
function panelling(c) {
  const s = PAL;
  // upper wall: vertical boards with raised, moulded panels
  c.rect(0, 0, W, FLOOR_Y, s.wood[1]);
  for (let x = 0; x < W; x += 6) c.rect(x, 0, 1, 82, s.wood[0], 0.6);
  for (let x0 = 4; x0 < W; x0 += 36) {
    c.rect(x0, 8, 30, 70, s.wood[2]);
    c.rect(x0, 8, 30, 1, s.woodHi, 0.6); // light catching the top moulding
    c.rect(x0, 8, 1, 70, s.wood[3]);
    c.rect(x0 + 29, 8, 1, 70, s.wood[0]);
    c.rect(x0, 77, 30, 1, s.wood[0]);
    c.rect(x0 + 3, 11, 24, 64, s.wood[1]);
  }
  // dado rail
  c.rect(0, 80, W, 3, s.wood[3]);
  c.rect(0, 80, W, 1, s.woodHi);
  c.rect(0, 83, W, 1, s.wood[0]);
  // wainscot: panels of diagonal boards (chevrons, like the room)
  for (let x0 = 2; x0 < W; x0 += 26) {
    for (let y = 87; y < FLOOR_Y - 3; y++)
      for (let x = x0; x < x0 + 22; x++) {
        const mid = x0 + 11;
        const d = (y + Math.abs(x - mid)) % 4;
        c.px(x, y, d === 0 ? s.wood[0] : d === 1 ? s.wood[3] : s.wood[2]);
      }
    c.rect(x0, 86, 22, 1, s.wood[0]);
    c.rect(x0, FLOOR_Y - 3, 22, 1, s.wood[3]);
  }
  c.rect(0, FLOOR_Y - 2, W, 2, s.wood[0]); // skirting
}

function gothicWindow(c) {
  const s = PAL;
  const { cx, hw, top, bottom } = WINDOW;
  // stone surround, then the timber frame, then cut out the glass
  arch(c, cx, hw + 3, top - 3, bottom + 2, s.stoneShade);
  arch(c, cx, hw + 2, top - 2, bottom + 2, s.stone);
  arch(c, cx, hw, top, bottom, s.wood[2]);
  // two lancets and a round light above them
  clearArch(c, cx - 13, 10, top + 22, bottom - 2);
  clearArch(c, cx + 13, 10, top + 22, bottom - 2);
  for (let y = top + 7; y <= top + 21; y++)
    for (let x = cx - 8; x <= cx + 8; x++) if (Math.hypot(x - cx, y - (top + 14)) <= 6.5) c.clear(x, y);
  // the glazing bars across the lancets
  for (const y of [top + 46, top + 66]) {
    c.rect(cx - 23, y, 21, 1, s.wood[2]);
    c.rect(cx + 3, y, 21, 1, s.wood[2]);
  }
  // light along the frame's inner edges
  for (let dx = -hw; dx <= hw; dx++) c.px(cx + dx, top + archDrop(dx, hw), s.woodHi);
  // the sill
  c.rect(cx - hw - 4, bottom + 1, hw * 2 + 9, 3, s.stone);
  c.rect(cx - hw - 4, bottom + 1, hw * 2 + 9, 1, s.stoneHi);
  c.rect(cx - hw - 4, bottom + 4, hw * 2 + 9, 1, s.stoneDark);
}

function sign(c) {
  const s = PAL;
  const x0 = 98;
  const y0 = 16;
  const w = 124;
  const h = 38;
  c.rect(x0 - 2, y0 - 2, w + 4, h + 4, s.wood[0]); // hung on the panelling
  c.rect(x0, y0, w, h, s.signCream);
  for (const inset of [1, 3]) {
    c.rect(x0 + inset, y0 + inset, w - inset * 2, 1, s.gold);
    c.rect(x0 + inset, y0 + h - 1 - inset, w - inset * 2, 1, s.gold);
    c.rect(x0 + inset, y0 + inset, 1, h - inset * 2, s.gold);
    c.rect(x0 + w - 1 - inset, y0 + inset, 1, h - inset * 2, s.gold);
  }
  const mid = x0 + w / 2;
  text(c, SIGN[0], Math.round(mid - textWidth(SIGN[0]) / 2), y0 + 7, s.gold);
  text(c, SIGN[1], Math.round(mid - textWidth(SIGN[1]) / 2), y0 + 17, s.gold);
  miniText(c, SIGN[2], Math.round(mid - miniWidth(SIGN[2]) / 2), y0 + 28, s.goldShade);
}

function cabinet(c) {
  const s = PAL;
  // shelves behind the counter: bottles, teapots, cups
  c.rect(232, 26, 80, 54, s.wood[0]);
  for (const y of [42, 58, 74]) {
    c.rect(232, y, 80, 2, s.wood[3]);
    c.rect(232, y, 80, 1, s.woodHi);
  }
  for (let x = 236; x < 308; x += r.int(4, 6)) {
    const hgt = r.int(7, 11);
    const col = r.pick(s.bottles);
    c.rect(x, 42 - hgt, 3, hgt, col);
    c.rect(x + 1, 42 - hgt - 2, 1, 2, col);
    c.px(x, 42 - hgt + 1, s.cabinetGlass, 0.5);
  }
  for (let x = 238; x < 306; x += 9) {
    c.ellipse(x + 2, 55, 3, 2.5, s.china); // teapots and cups
    c.px(x + 5, 54, s.china);
    c.rect(x, 52, 4, 1, s.chinaGold);
  }
  for (let x = 236; x < 308; x += 7) {
    c.rect(x, 66, 5, 8, r.pick([s.cakes[1], s.china, s.glassShade]));
    c.rect(x, 66, 5, 1, s.chinaGold);
  }
  // the pastry cabinet: dark timber, lit glass, two shelves of cakes
  c.rect(230, 82, 84, 36, s.wood[0]);
  c.rect(232, 84, 80, 22, s.cabinetGlass, 0.85);
  c.rect(232, 95, 80, 1, s.silverShade);
  for (const y of [93, 104]) {
    for (let x = 235; x < 309; x += 6) {
      const col = r.pick(s.cakes);
      c.rect(x, y - 3, 4, 3, col);
      c.rect(x, y - 3, 4, 1, r.pick([s.cream, s.pinkIcing, s.blueberry]));
    }
  }
  c.rect(230, 106, 84, 2, s.gold);
  c.rect(230, 108, 84, 10, s.wood[2]);
  for (let x = 236; x < 312; x += 14) c.rect(x, 110, 10, 6, s.wood[3]);
  // a glowing pendant above it
  c.line(270, 0, 270, 14, s.wood[0]);
  c.rect(266, 14, 9, 3, s.gold);
  c.rect(267, 17, 7, 1, s.lamp);
}

/**
 * One of our chairs (both the same): carved dark timber, a buttoned red velvet
 * back and cushion, seen side-on. x = the back of the seat; face = 1 if the
 * person sitting in it faces right, -1 if left.
 */
function chair(c, x, face) {
  const s = PAL;
  const at = (dx) => x + dx * face; // dx counts forwards from the back of the seat
  const span = (a, b, y, h, color) => c.rect(Math.min(at(a), at(b)), y, Math.abs(b - a) + 1, h, color);
  // the back legs + back post, leaning back a touch, up to a carved curl
  for (let y = SEAT - 34; y <= FEET; y++) {
    const lean = y < SEAT ? Math.round((SEAT - y) / 14) : Math.round((y - SEAT) / 12);
    c.px(at(-4 - lean), y, s.wood[2]);
    c.px(at(-5 - lean), y, s.wood[1]);
  }
  c.px(at(-6), SEAT - 35, s.wood[3]);
  c.px(at(-7), SEAT - 34, s.wood[3]);
  c.px(at(-4), SEAT - 35, s.woodHi);
  // the padded back: red velvet, with buttons
  for (let y = SEAT - 31; y < SEAT; y++) {
    const lean = Math.round((SEAT - y) / 14);
    span(-3 - lean, -1 - lean, y, 1, s.velvet[1]);
    c.px(at(-1 - lean), y, s.velvet[2]);
  }
  for (let y = SEAT - 27; y < SEAT - 3; y += 6) c.px(at(-2 - Math.round((SEAT - y) / 14)), y, s.velvet[0]);
  // the cushion, the seat rail with its carved apron, and the turned front leg
  span(-3, 22, SEAT, 3, s.velvet[1]);
  span(-3, 22, SEAT, 1, s.velvet[2]);
  span(-3, 22, SEAT + 3, 2, s.wood[2]);
  span(2, 18, SEAT + 5, 1, s.wood[1]);
  for (let y = SEAT + 5; y <= FEET; y++) {
    const bulb = y > SEAT + 9 && y < SEAT + 14 ? 1 : 0; // the turned bit
    span(20 - bulb, 21, y, 1, s.wood[2]);
    c.px(at(21), y, s.wood[1]);
  }
  span(19, 22, FEET, 1, s.wood[1]); // foot
}

function chairs(c) {
  chair(c, 104, 1); // hers
  chair(c, 216, -1); // his
}

function floor(c) {
  const s = PAL;
  // grey and cream tiles, getting bigger towards us (vanishing point above the table)
  const rows = [FLOOR_Y, 121, 125, 130, 136, 143, 151, 160, 170, 181];
  const vx = 160;
  const vy = 60;
  for (let ri = 0; ri < rows.length - 1; ri++) {
    for (let y = rows[ri]; y < rows[ri + 1]; y++) {
      const k = (y - vy) / (FLOOR_Y - vy); // how much wider tiles are at this row
      for (let x = 0; x < W; x++) {
        const col = Math.floor(((x - vx) / k + 1000) / 14);
        c.px(x, y, (col + ri) % 2 ? s.tileDark : s.tileLight);
      }
    }
    c.rect(0, rows[ri], W, 1, s.tileDark, 0.5);
  }
  // shadows under the chairs and the table
  softEllipse(c, 112, 143, 18, 3, s.outline, 0.4);
  softEllipse(c, 160, 143, 26, 3, s.outline, 0.4);
  softEllipse(c, 209, 143, 20, 3, s.outline, 0.4);
}

function drawRoom() {
  const c = new Canvas(W, H);
  panelling(c);
  gothicWindow(c);
  sign(c);
  cabinet(c);
  floor(c);
  chairs(c);
  return c;
}

// ---- 3b. guests.png — other people having high tea, faded into the room behind us -------------
/** Blend every opaque pixel towards `color` by `t` (pushes them into the background). */
function fade(c, color, t) {
  const [fr, fg, fb] = hexToRgb(color);
  for (let i = 0; i < c.data.length; i += 4) {
    if (!c.data[i + 3]) continue;
    c.data[i] = Math.round(c.data[i] + (fr - c.data[i]) * t);
    c.data[i + 1] = Math.round(c.data[i + 1] + (fg - c.data[i + 1]) * t);
    c.data[i + 2] = Math.round(c.data[i + 2] + (fb - c.data[i + 2]) * t);
  }
}

/** A little seated guest, side-on: (x, seat) = where they sit; face = 1 (right) or -1 (left). */
function guest(c, x, seat, face, look) {
  const s = PAL;
  c.rect(x - face * 6, seat - 14, 2, 24, s.wood[1]); // their chair
  c.rect(x - 4, seat, 9, 2, s.velvet[1]);
  c.rect(x - 3, seat - 15, 7, 15, look.top); // body
  c.rect(x + (face > 0 ? 0 : -8), seat - 3, 9, 3, look.legs); // lap
  c.rect(x + face * 7 - 1, seat - 1, 3, 11, look.legs); // shins
  c.circle(x, seat - 20, 4, look.skin); // head
  for (let dy = -5; dy <= 0; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (dx * dx + dy * dy <= 17 && (dy < -2 || dx * face < 0)) c.px(x + dx, seat - 20 + dy, look.hair);
  }
  c.rect(x - face * 1 - 1, seat - 16, 3, 2, look.skin); // neck
  thickLine(c, x + face * 2, seat - 12, x + face * 8, seat - 8, 2, look.top); // arm, out to their cup
}

function smallTable(c, x, top) {
  const s = PAL;
  c.rect(x - 1, top, 3, 22, s.table);
  c.rect(x - 5, top + 21, 11, 2, s.tableShade);
  c.ellipse(x, top, 14, 2, s.table);
  c.rect(x - 13, top + 1, 27, 1, s.tableShade);
  for (const dx of [-6, 6]) {
    c.rect(x + dx - 1, top - 3, 3, 2, s.china); // their cups
    c.px(x + dx, top - 1, s.chinaShade);
  }
  c.rect(x - 2, top - 8, 5, 6, s.cakes[0]); // a little stand of cakes
  c.rect(x - 3, top - 2, 7, 1, s.china);
}

function drawGuests() {
  const c = new Canvas(W, H);
  const look = (i) => ({
    top: PAL.guestTops[i % PAL.guestTops.length],
    hair: PAL.guestHair[(i * 3) % PAL.guestHair.length],
    skin: PAL.guestSkin[(i * 2) % PAL.guestSkin.length],
    legs: PAL.wood[0],
  });
  // a table in front of the window...
  guest(c, 32, 112, 1, look(0));
  guest(c, 68, 112, -1, look(1));
  smallTable(c, 50, 102);
  // ...and one in front of the cabinet
  guest(c, 256, 112, 1, look(2));
  guest(c, 292, 112, -1, look(3));
  smallTable(c, 274, 102);
  // a waiter between the tables, carrying a teapot on a tray
  const wx = 238;
  c.rect(wx - 3, 88, 7, 22, '#1e1a20'); // black waistcoat + trousers
  c.rect(wx - 2, 92, 5, 18, '#f4f1ea'); // long white apron
  c.rect(wx - 3, 110, 3, 14, '#1e1a20');
  c.rect(wx + 1, 110, 3, 14, '#1e1a20');
  c.circle(wx, 82, 4, PAL.guestSkin[0]);
  for (let dx = -4; dx <= 4; dx++) for (let dy = -5; dy <= -1; dy++) if (dx * dx + dy * dy <= 17) c.px(wx + dx, 82 + dy, PAL.guestHair[1]);
  thickLine(c, wx + 2, 90, wx + 9, 96, 2, '#1e1a20');
  c.rect(wx + 5, 95, 11, 1, PAL.silver); // the tray
  c.ellipse(wx + 10, 92, 3, 2.5, PAL.china);
  fade(c, PAL.guestFade, 0.55);
  return c;
}

// ---- 4. light.png — the sunbeam falling through the window (pulse) ------------------------------
const inBeam = (x, y) => {
  const t = (y - WINDOW.top) / 150; // the beam slants down to the right
  const left = WINDOW.cx - WINDOW.hw + t * 110;
  const right = WINDOW.cx + WINDOW.hw + t * 150;
  return y > WINDOW.top + 10 && y < FLOOR_Y && x >= left && x <= right;
};

function drawLight() {
  const c = new Canvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inBeam(x, y)) continue;
      const fade = 1 - (y - WINDOW.top) / (H - WINDOW.top);
      c.px(x, y, PAL.sun, 0.08 * fade + 0.03);
    }
  softEllipse(c, 150, 150, 60, 14, PAL.sun, 0.2); // the patch of sun on the floor
  return c;
}

// ---- 5. motes.png — dust drifting in the sunbeam (twinkle) ----------------------------------------
function drawMotes() {
  const c = new Canvas(W, H);
  let n = 0;
  while (n < 34) {
    const x = r.int(20, 200);
    const y = r.int(20, 150);
    if (!inBeam(x, y)) continue;
    c.px(x, y, PAL.sun, r.range(0.5, 0.9));
    n++;
  }
  // and a few glints on the silver stand + gold rims
  for (const [x, y] of [[150, 70], [174, 80], [162, 57], [152, 100]]) c.px(x, y, PAL.steam);
  return c;
}

// ---- 6. us.png — the two of us at high tea (8 frames: breathing + blinks) ------------------------
// Both seated side-on: her on the left facing right, pouring; him on the right
// facing left, holding his glass. Hands and things they hold stay put.
const HER_X = 112;
const HIM_X = 208;

function herHead(c, hx, hy, blink) {
  const s = PAL;
  c.circle(hx, hy, 6.6, s.herHair);
  c.rect(hx - 7, hy, 7, 8, s.herHair); // the back of the bob, down to her jaw
  c.rect(hx - 7, hy + 7, 7, 1, s.herHairShade);
  c.ellipse(hx + 3, hy + 2, 4.6, 5, s.herSkin); // face
  c.px(hx + 8, hy + 2, s.herSkin); // nose
  c.rect(hx, hy - 4, 8, 3, s.herHair); // fringe
  for (const x of [hx + 3, hx + 5, hx + 7]) c.px(x, hy - 1, s.herHair);
  c.rect(hx - 1, hy - 2, 2, 9, s.herHair); // hair over her ear
  c.px(hx - 1, hy + 6, s.herHairShade);
  for (let y = hy - 8; y <= hy - 4; y++)
    for (let x = hx - 8; x <= hx + 8; x++) {
      const [rr, g, b, a] = c.get(x, y);
      if (!a || `#${[rr, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}` !== s.herHair) continue;
      if (y < hy - 5 || (y === hy - 5 && (x + y) % 2 === 0) || (y === hy - 4 && (x + y) % 4 === 0)) c.px(x, y, s.herRoots);
    }
  for (const [x, y] of [[hx - 4, hy - 1], [hx - 3, hy - 2], [hx - 5, hy + 1], [hx + 1, hy - 3]]) c.px(x, y, s.herHairHi);
  // looking down at the cup she's pouring
  if (blink) c.px(hx + 6, hy + 2, s.herSkinShade);
  else {
    c.px(hx + 6, hy + 2, s.eye);
    c.px(hx + 7, hy + 2, s.eye);
  }
  c.px(hx + 7, hy, s.piercing);
  c.px(hx + 5, hy + 4, s.herBlush);
  c.px(hx + 6, hy + 4, s.herBlush, 0.6);
}

function drawHer(c, dy, blink) {
  const s = PAL;
  // legs (still). Her calves and ankles below the hem of her dress...
  for (let y = SEAT + 12; y <= FEET - 4; y++) {
    const calf = y < SEAT + 18 ? 1 : 0; // a little fuller up top, slimmer at the ankle
    c.rect(124 - calf, y, 3 + calf, 1, s.herSkin);
    c.px(124 - calf, y, s.herSkinShade);
  }
  // ...her white shoes, with a strap over the foot
  c.rect(123, FEET - 3, 7, 2, s.herShoes);
  c.px(130, FEET - 2, s.herShoes);
  c.rect(124, FEET - 4, 3, 1, s.herShoes); // strap
  c.rect(123, FEET - 1, 8, 1, '#cfd0d8'); // sole
  // ...and the dress over her thighs, falling from her knee to mid-calf
  c.rect(106, SEAT - 6, 21, 6, s.herDress);
  c.rect(108, SEAT - 6, 18, 1, s.herDressHi);
  c.rect(106, SEAT - 1, 15, 1, s.herDressShade);
  c.circle(125, SEAT - 3, 3, s.herDress); // her knee
  for (let y = SEAT; y <= SEAT + 11; y++) {
    const flare = y > SEAT + 7 ? 1 : 0;
    c.rect(121 - flare, y, 8 + flare, 1, s.herDress);
    c.px(121 - flare, y, s.herDressShade);
  }
  c.rect(124, SEAT + 2, 1, 8, s.herDressShade); // a fold
  c.rect(120, SEAT + 11, 9, 1, s.herDressShade); // hem
  // body: the blue dress
  c.rect(106, 90 + dy, 12, SEAT - 90 - dy, s.herDress);
  c.rect(106, 91 + dy, 2, SEAT - 91 - dy, s.herDressShade);
  c.clear(106, 90 + dy);
  c.clear(117, 90 + dy);
  c.rect(108, 105, 10, 1, s.herDressShade); // waist
  // sweetheart neckline with its little ribbon tie, and her gold necklace
  c.rect(115, 90 + dy, 3, 3, s.herSkin);
  c.px(117, 93 + dy, s.ribbon);
  c.px(118, 94 + dy, s.ribbon);
  c.px(116, 89 + dy, s.necklace);
  // neck + head
  c.rect(111, 86 + dy, 4, 5, s.herSkin);
  c.px(111, 89 + dy, s.herSkinShade);
  herHead(c, HER_X, 80 + dy, blink);
  // puff sleeve
  c.circle(113, 93 + dy, 3.2, s.herDress);
  c.px(112, 91 + dy, s.herDressHi);
  c.px(113, 91 + dy, s.herDressHi);
  c.rect(111, 96 + dy, 5, 1, s.herDressShade);
  // her arm, out to the teapot
  thickLine(c, 114, 96 + dy, 118, 100, 3, s.herSkin);
  thickLine(c, 118, 100, TEAPOT.x - 8, TEAPOT.y + 1, 3, s.herSkin);
}

/** The white-and-gold teapot, tipped forward to pour. */
function teapot(c) {
  const s = PAL;
  const { x: cx, y: cy } = TEAPOT;
  c.ellipse(cx, cy, 5, 4, s.china);
  c.ellipse(cx - 1, cy + 2, 4, 2, s.chinaShade, 0.5);
  for (let x = cx - 4; x <= cx + 4; x++) c.px(x, cy + Math.round((x - cx) * 0.25), s.chinaGold); // gold band (tipped)
  c.rect(cx - 1, cy - 5, 4, 2, s.china); // the lid...
  c.px(cx + 1, cy - 6, s.chinaGold); // ...and its knob
  c.rect(cx - 1, cy - 3, 4, 1, s.chinaGold);
  // the spout, down to the cup
  thickLine(c, cx + 4, cy + 1, SPOUT.x - 1, SPOUT.y - 1, 2, s.china);
  c.px(SPOUT.x, SPOUT.y, s.chinaGold);
  // the handle (gold), in her hand
  for (const [x, y] of [[cx - 6, cy - 3], [cx - 7, cy - 2], [cx - 7, cy - 1], [cx - 7, cy], [cx - 7, cy + 1], [cx - 6, cy + 2]]) c.px(x, y, s.chinaGold);
  c.rect(cx - 8, cy - 2, 3, 4, s.herSkin); // her hand round it
  c.px(cx - 5, cy, s.herSkin);
  c.px(cx - 8, cy + 1, s.herSkinShade);
}

function himHead(c, hx, hy, blink) {
  const s = PAL;
  c.circle(hx, hy, 6.6, s.himSkin);
  c.ellipse(hx - 2, hy + 2, 4.6, 4.6, s.himSkin);
  c.px(hx - 7, hy + 1, s.himSkin); // nose
  for (let y = hy - 8; y <= hy + 3; y++)
    for (let x = hx - 8; x <= hx + 8; x++) {
      if ((x - hx) ** 2 + (y - hy) ** 2 > 6.6 * 6.6 + 4) continue;
      if (y <= hy - 3 || (x >= hx + 2 && y <= hy + 1)) c.px(x, y, s.himHair);
    }
  c.rect(hx - 7, hy - 4, 6, 2, s.himHair); // fringe
  c.px(hx - 7, hy - 2, s.himHair);
  c.px(hx - 5, hy - 2, s.himHair);
  c.px(hx - 8, hy - 3, s.himHair);
  c.px(hx + 1, hy + 1, s.himSkinShade); // ear
  c.px(hx + 1, hy + 2, s.himSkinShade);
  for (const [x, y] of [[hx - 2, hy - 6], [hx + 1, hy - 7], [hx + 3, hy - 5], [hx - 5, hy - 5]]) c.px(x, y, s.himHairHi);
  if (blink) c.px(hx - 5, hy + 1, s.himSkinShade);
  else {
    c.px(hx - 5, hy, s.eye);
    c.px(hx - 5, hy + 1, s.eye);
  }
  c.px(hx - 4, hy + 3, s.himBlush);
}

function drawHim(c, dy, blink) {
  const s = PAL;
  // legs (still): wide black trousers along the seat to his knee...
  c.rect(190, SEAT - 7, 25, 7, s.trousers);
  c.rect(192, SEAT - 7, 20, 1, s.trousersHi);
  c.circle(191, SEAT - 3, 3.5, s.trousers); // his knee
  // ...falling straight and loose to the floor, a crease down the front
  for (let y = SEAT; y <= FEET - 4; y++) {
    const flare = y > FEET - 9 ? 1 : 0;
    c.rect(187 - flare, y, 8 + flare, 1, s.trousers);
    c.px(194, y, s.trousersShade);
  }
  c.rect(189, SEAT + 1, 1, FEET - SEAT - 5, s.trousersHi); // the crease
  // dark leather shoes, toes pointing at her
  c.rect(183, FEET - 3, 11, 2, s.himShoes);
  c.rect(182, FEET - 2, 1, 1, s.himShoes);
  c.rect(182, FEET - 1, 12, 1, s.sole);
  c.px(185, FEET - 3, s.shoeHi);
  // body: the dark plum button-up with fine stripes (front faces left)
  c.rect(202, 83 + dy, 13, SEAT - 6 - 83 - dy, s.himShirt);
  for (let x = 204; x < 214; x += 2) c.rect(x, 85 + dy, 1, SEAT - 6 - 85 - dy, s.himShirtHi, 0.45);
  c.rect(213, 84 + dy, 2, SEAT - 6 - 84 - dy, s.himShirtShade);
  c.rect(205, 83 + dy, 8, 1, s.himShirtHi); // light on the shoulders
  c.clear(214, 83 + dy);
  // the button placket down the front
  c.rect(203, 86 + dy, 1, SEAT - 6 - 86 - dy, s.himShirtShade);
  for (let y = 88 + dy; y < SEAT - 7; y += 4) c.px(203, y, s.button);
  // the trousers' waistband over his hips
  c.rect(202, SEAT - 7, 13, 2, s.trousers);
  c.rect(202, SEAT - 7, 13, 1, s.trousersHi);
  // neck, then the collar standing up round it, points down at the front
  c.rect(205, 78 + dy, 4, 6, s.himSkin);
  c.px(208, 80 + dy, s.himSkinShade);
  c.rect(204, 82 + dy, 6, 2, s.himShirtHi);
  c.rect(209, 81 + dy, 2, 3, s.himShirt);
  c.px(203, 83 + dy, s.himSkin); // open at the neck
  c.px(202, 84 + dy, s.himShirtHi); // collar point
  c.px(204, 84 + dy, s.himShirtHi);
  c.px(203, 85 + dy, s.himShirtHi);
  himHead(c, HIM_X - 1, 73 + dy, blink);
  // his arm, out to his glass: striped sleeve, buttoned cuff
  thickLine(c, 205, 85 + dy, 199, 96, 3, s.himShirt);
  thickLine(c, 199, 96, 193, 90, 3, s.himShirt);
  c.line(205, 86 + dy, 200, 95, s.himShirtHi, 0.45);
  c.line(198, 95, 194, 91, s.himShirtHi, 0.45);
  c.rect(193, 88, 2, 3, s.himShirtHi); // cuff
  c.px(194, 89, s.button);
}

/** His coupe glass of chocolate (in his hand). */
function coupe(c, x, y) {
  const s = PAL;
  // a wide, shallow bowl on a thin stem: (x, y) = the middle of the rim
  c.rect(x - 5, y, 11, 1, s.glass);
  c.rect(x - 4, y + 1, 9, 1, s.chocolateFoam);
  c.rect(x - 3, y + 2, 7, 1, s.chocolate);
  c.rect(x - 2, y + 3, 5, 1, s.chocolate);
  c.px(x - 5, y + 1, s.glass);
  c.px(x + 5, y + 1, s.glass);
  c.px(x - 4, y + 2, s.glass);
  c.px(x + 4, y + 2, s.glass);
  c.rect(x, y + 4, 1, 6, s.glass);
  c.rect(x - 3, y + 10, 7, 1, s.glassShade);
}

function drawUsFrame(herDy, himDy, herBlink, himBlink) {
  const c = new Canvas(W, H);
  drawHer(c, herDy, herBlink);
  teapot(c);
  drawHim(c, himDy, himBlink);
  coupe(c, 189, 83);
  c.rect(190, 88, 3, 3, PAL.himSkin); // his fingers round the stem
  c.px(190, 91, PAL.himSkinShade);
  rimLight(c, PAL.warmLight, 0.25);
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

// ---- 7. table.png — the round table, the three-tier stand, china, flowers -----------------------
function plate(c, cx, y, rx) {
  const s = PAL;
  c.ellipse(cx, y, rx, 2, s.china);
  c.rect(cx - rx + 1, y + 1, rx * 2 - 1, 1, s.chinaShade);
  c.rect(cx - rx + 2, y + 2, rx * 2 - 3, 1, s.chinaGold); // gold rim along the front
}

function food(c) {
  const s = PAL;
  const x = STAND.x; // everything is placed from the middle of the stand
  const [top, mid, low] = STAND.plates;
  // top: a pink-iced éclair, a matcha slice, a cupcake with a blueberry, a choux puff
  c.rect(x - 9, top - 3, 6, 2, s.pastry);
  c.rect(x - 9, top - 4, 6, 1, s.pinkIcing);
  c.rect(x - 2, top - 6, 4, 5, s.matcha);
  c.rect(x - 2, top - 4, 4, 1, s.cream);
  c.rect(x - 2, top - 6, 4, 1, '#6f9a52');
  c.rect(x + 3, top - 3, 4, 2, s.chinaShade);
  c.ellipse(x + 5, top - 5, 2.5, 1.5, s.cream);
  c.px(x + 5, top - 7, s.blueberry);
  c.circle(x + 9, top - 3, 1.6, s.pastry);
  c.px(x + 8, top - 4, s.cream);
  c.px(x - 5, top - 5, s.blueberry);
  // middle: finger sandwiches (white bread, cucumber) and buttered rolls
  for (const dx of [-9, -5]) {
    c.rect(x + dx, mid - 6, 3, 5, s.bread);
    c.rect(x + dx, mid - 4, 3, 1, s.cucumber);
    c.px(x + dx, mid - 6, s.crust);
  }
  c.ellipse(x + 3, mid - 3, 3.5, 2, s.pastry);
  c.rect(x, mid - 3, 7, 1, s.cucumber);
  c.ellipse(x + 9, mid - 3, 2, 1.6, s.pastryShade);
  // bottom: little quiches, a pastry, cherry tomatoes
  for (const dx of [-8, 6]) {
    c.rect(x + dx - 2, low - 3, 5, 2, s.pastryShade);
    c.rect(x + dx - 1, low - 4, 3, 1, s.quiche);
  }
  for (let i = 0; i < 4; i++) c.rect(x - 3 + i, low - 2 - i, 5 - i * 2 + 2, 1, s.pastry);
  c.px(x + 2, low - 3, s.tomato);
  c.px(x - 5, low - 3, s.tomato);
}

function stand(c) {
  const s = PAL;
  // the silver frame: two posts and an arched handle over the top
  const l = STAND.x - STAND.rx - 1;
  const rgt = STAND.x + STAND.rx + 1;
  c.rect(l, 64, 1, 41, s.silverShade);
  c.rect(rgt, 64, 1, 41, s.silver);
  for (let a = 0; a <= 40; a++) {
    const t = (a / 40) * PI;
    c.px(Math.round(STAND.x - Math.cos(t) * (STAND.rx + 1)), Math.round(64 - Math.sin(t) * 8), a < 20 ? s.silverShade : s.silver);
  }
  c.rect(l - 1, 104, 3, 1, s.silverShade); // feet
  c.rect(rgt - 1, 104, 3, 1, s.silverShade);
  for (const y of STAND.plates) plate(c, STAND.x, y, STAND.rx);
  food(c);
}

function teacup(c, x, y) {
  const s = PAL;
  // (x, y) = middle of the rim; a saucer under it
  c.ellipse(x, y + 5, 7, 1.5, s.china);
  c.rect(x - 6, y + 6, 13, 1, s.chinaGold);
  c.rect(x - 4, y, 9, 4, s.china);
  c.rect(x - 3, y + 4, 7, 1, s.chinaShade);
  c.rect(x - 4, y, 9, 1, s.chinaGold);
  c.rect(x - 3, y, 7, 1, s.tea); // the tea, filling up
  c.px(x - 2, y + 2, s.floral[0]);
  c.px(x + 1, y + 2, s.floral[1]);
  c.px(x + 5, y + 1, s.china); // handle
  c.px(x + 6, y + 2, s.china);
  c.px(x + 5, y + 3, s.china);
}

function drawTable() {
  const c = new Canvas(W, H);
  const s = PAL;
  // the pedestal and its three splayed feet
  c.rect(156, 112, 8, 26, s.table);
  c.rect(156, 112, 2, 26, s.tableHi);
  c.rect(162, 112, 2, 26, s.tableShade);
  c.ellipse(160, 125, 6, 3, s.table);
  thickLine(c, 158, 137, 142, 143, 3, s.tableShade);
  thickLine(c, 162, 137, 178, 143, 3, s.tableShade);
  c.rect(158, 138, 4, 5, s.table);
  // the round top: its edge, then the polished surface with the window reflected in it
  c.ellipse(TABLE.x, TABLE.y + 3, TABLE.rx, TABLE.ry + 1, s.tableShade);
  c.ellipse(TABLE.x, TABLE.y, TABLE.rx, TABLE.ry, s.table);
  c.rect(TABLE.x - 30, TABLE.y - 1, 20, 1, s.tableHi);
  c.rect(TABLE.x - 6, TABLE.y - 2, 8, 1, s.tableHi);
  stand(c);
  teacup(c, HER_CUP.x, HER_CUP.y);
  // a little vase of blue and white flowers
  const vx = 179;
  c.rect(vx - 2, 99, 5, 6, s.glass);
  c.rect(vx - 1, 100, 3, 4, s.glassShade);
  c.rect(vx - 2, 99, 5, 1, s.chinaGold);
  for (const [x, y] of [[vx - 1, 97], [vx + 1, 96], [vx, 98]]) c.line(x, y, vx, 99, s.stem);
  for (const [x, y, col] of [[vx - 3, 94, s.flowerBlue[0]], [vx, 92, s.flowerBlue[1]], [vx + 2, 95, s.flowerBlue[0]], [vx - 1, 96, s.flowerWhite], [vx + 2, 91, s.flowerWhite], [vx - 3, 91, s.flowerBlue[1]]]) {
    c.px(x, y, col);
    c.px(x + 1, y, col);
    c.px(x, y + 1, col);
  }
  c.outline(s.outline);
  return c;
}

// ---- 8. tea.png — tea pouring into her cup, steam rising (6 frames) -----------------------------
function drawTea() {
  const FR = 6;
  const sheet = new Canvas(W * FR, H);
  for (let f = 0; f < FR; f++) {
    const c = new Canvas(W, H);
    // the stream: a curve from the spout into the cup, ripples running down it
    for (let y = SPOUT.y + 1; y < HER_CUP.y; y++) {
      const t = (y - SPOUT.y) / (HER_CUP.y - SPOUT.y);
      const x = Math.round(SPOUT.x + t * t * 2);
      c.px(x, y, (y + f) % 3 === 0 ? PAL.teaHi : PAL.tea);
    }
    c.px(HER_CUP.x + (f % 2 ? 1 : -1), HER_CUP.y - 1, PAL.teaHi); // a splash
    // steam curling up out of the cup and off the spout
    for (const [sx, sy, n] of [[HER_CUP.x - 2, HER_CUP.y - 2, 5], [SPOUT.x - 6, SPOUT.y - 12, 3]]) {
      for (let k = 0; k < n; k++) {
        const age = ((k * 4 + f * 2) % (n * 4)) / (n * 4); // 0 = just risen, 1 = gone
        const x = Math.round(sx + Math.sin(age * 8 + k) * 2 - age * 3);
        const y = Math.round(sy - age * 16);
        c.px(x, y, PAL.steam, (1 - age) * 0.5);
      }
    }
    sheet.blit(c, f * W, 0);
  }
  return sheet;
}

// ---- 9. vignette.png — soft dark edges ---------------------------------------------------------
function drawVignette() {
  const c = new Canvas(W, H);
  const levels = [0, 0.14, 0.28, 0.42, 0.56];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 160) / 178, (y - 92) / 120);
      const t = Math.max(0, Math.min(1, (d - 0.62) / 0.42));
      const lv = t * 4;
      const i = Math.min(4, Math.floor(lv) + (lv % 1 > bayer(x, y) ? 1 : 0));
      if (i) c.px(x, y, PAL.vignette, levels[i]);
    }
  return c;
}

// ---- The building for the map: collins.png (8 x 6 tiles) -----------------------------------------
// Sandstone Gothic: a slate roof, pointed gables either side, the corner tower
// in the middle with its spire, pointed-arch windows, a granite base and the
// arched entrance under a gold sign.
const BUILDING = { cols: 8, rows: 6, at: { x: 19, y: 0 } }; // where the house was (+ the hedge behind it)
const DOOR_TILES = { x: 3, w: 2 }; // the doors are on tiles 3–4 of the bottom row

function drawBuilding() {
  const c = new Canvas(BUILDING.cols * 16, BUILDING.rows * 16);
  const w = c.width;
  const s = PAL;
  // the slate roof behind everything
  c.rect(0, 0, w, 16, s.slate);
  for (let y = 2; y < 16; y += 3) c.rect(0, y, w, 1, s.slateLine);
  // the sandstone front, laid in courses
  c.rect(0, 12, w, 81, s.stone);
  for (let y = 15; y < 86; y += 4) c.rect(0, y, w, 1, s.stoneShade, 0.35);
  // pointed gables over the outer bays, each with a deep arched recess
  for (const gx of [19, 108]) {
    for (let y = 2; y <= 14; y++) {
      const half = Math.round(((y - 2) / 12) * 17);
      c.rect(gx - half, y, half * 2 + 1, 1, s.stone);
      c.px(gx - half, y, s.stoneHi);
      c.px(gx + half, y, s.stoneShade);
    }
    arch(c, gx, 6, 7, 20, s.stoneShade);
    arch(c, gx, 3, 11, 19, s.glassDark);
    c.rect(gx - 1, 0, 3, 3, s.stoneShade); // finial
  }
  // the corner tower: sticking out a little, taller, with the spire on top
  c.rect(50, 8, 28, 85, s.stoneHi);
  c.rect(50, 8, 1, 85, s.stoneShade);
  c.rect(77, 8, 1, 85, s.stoneDark);
  for (let y = 11; y < 86; y += 4) c.rect(51, y, 26, 1, s.stoneShade, 0.3);
  for (let y = 0; y <= 9; y++) {
    const half = Math.round(y * 0.5);
    c.rect(64 - half, y, half * 2 + 1, 1, s.stoneShade);
    c.px(64 - half, y, s.stoneHi);
  }
  c.px(64, 0, s.stoneDark);
  for (const px of [52, 75]) c.rect(px, 3, 2, 6, s.stoneShade); // corner pinnacles
  arch(c, 64, 5, 8, 12, s.stoneShade); // the gable on the tower
  // three storeys of pointed windows, paired, with string courses between
  const pair = (cx, top, h) => {
    for (const dx of [-3, 3]) {
      arch(c, cx + dx, 2, top, top + h, s.glassDark);
      c.px(cx + dx - 1, top + 3, s.glassHi);
    }
    c.rect(cx - 6, top - 2, 13, 1, s.stoneDark, 0.6); // hood
    c.rect(cx - 6, top + h + 1, 13, 1, s.stoneDark); // sill
  };
  for (const [top, h] of [[22, 10], [42, 10]]) {
    for (const cx of [9, 30, 64, 98, 119]) pair(cx, top, h);
    c.rect(0, top + h + 4, w, 2, s.stoneDark);
    c.rect(0, top + h + 4, w, 1, s.stoneShade);
  }
  // the gold sign band
  c.rect(0, 60, w, 8, s.wood[1]);
  c.rect(0, 60, w, 1, s.gold);
  c.rect(0, 67, w, 1, s.gold);
  const name = 'COLLINS COFFEE HOUSE';
  miniText(c, name, Math.round(w / 2 - miniWidth(name) / 2), 62, s.goldHi);
  // ground floor: granite base, tall arched windows, the arched entrance in the tower
  c.rect(0, 84, w, 9, s.granite);
  c.rect(0, 84, w, 1, s.graniteDark);
  for (const cx of [10, 30, 98, 118]) {
    arch(c, cx, 6, 69, 88, s.stoneShade);
    arch(c, cx, 5, 70, 87, s.glassDark);
    c.rect(cx - 5, 80, 11, 1, s.stoneShade); // transom
    c.px(cx - 3, 74, s.glassHi);
  }
  arch(c, 64, 9, 68, 92, s.stoneDark);
  arch(c, 64, 8, 69, 92, s.litWindow);
  c.rect(64, 69, 1, 24, s.wood[2]); // between the doors: 1 px on the arch's centre line, right up to its top
  c.rect(56, 80, 17, 1, s.wood[2]);
  c.px(61, 86, s.wood[0]); // handles
  c.px(67, 86, s.wood[0]);
  // step + edges
  c.rect(0, 93, w, 3, s.step);
  c.rect(0, 12, 1, 81, s.stoneDark);
  c.rect(w - 1, 12, 1, 81, s.stoneDark);
  return c;
}

/** Swap the house left of the Oxford Scholar for Collins Coffee House, plus its trigger (first time only). */
function addToMap() {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (map.tilesets.some((t) => t.name === 'collins')) {
    console.log('  map      already has Collins Coffee House — left untouched');
    return;
  }
  stampBuilding(map, { name: 'collins', image: '../public/assets/tiles/collins.png', ...BUILDING });
  map.layers.find((l) => l.name === 'Triggers').objects.push({
    id: map.nextobjectid++, name: 'collins doors', type: '', visible: true, rotation: 0,
    x: (BUILDING.at.x + DOOR_TILES.x) * 16, y: (BUILDING.at.y + BUILDING.rows) * 16, width: DOOR_TILES.w * 16, height: 16,
    properties: [{ name: 'memoryId', type: 'string', value: 'collins-coffee-house' }],
  });
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  const { x, y } = BUILDING.at;
  console.log(`  map      the house is now Collins Coffee House (tiles x ${x}–${x + BUILDING.cols - 1}, y ${y}–${y + BUILDING.rows - 1}) + "collins doors" trigger`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing high tea at Collins Coffee House…');
const layers = {
  outside: drawOutside(),
  leaves: drawLeaves(),
  room: drawRoom(),
  guests: drawGuests(),
  light: drawLight(),
  us: drawUs(),
  table: drawTable(),
  tea: drawTea(),
  motes: drawMotes(),
  vignette: drawVignette(),
};
for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);
const building = drawBuilding();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'collins.png'), building);
addToMap();

// ---- Previews (3x) ----------------------------------------------------------------------------
const flat = new Canvas(W, H);
flat.rect(0, 0, W, H, '#000000');
for (const canvas of Object.values(layers)) flat.blit(canvas, 0, 0); // frame sheets: frame 1 sits at x 0..319
writePreview('collins-coffee-house.png', flat);
const street = new Canvas(12 * 16, 8 * 16);
street.rect(0, 0, street.width, street.height, '#8cc269');
street.rect(0, 6 * 16, street.width, 16, '#e6d3b0');
street.rect(0, 7 * 16, street.width, 16, '#a99886');
street.blit(building, 32, 0);
writePreview('collins-coffee-house-map.png', street);
console.log('  preview  tools/previews/collins-coffee-house.png, tools/previews/collins-coffee-house-map.png');
