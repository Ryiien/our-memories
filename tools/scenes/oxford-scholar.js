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
//   public/assets/memories/oxford-scholar/*.png   the 9 cutscene layers
//   public/assets/tiles/oxford-scholar.png        the pub (128x96 = 8x6 tiles)
//   public/assets/tiles/rmit.png                  RMIT next door (80x96 = 5x6 tiles)
//   tools/previews/oxford-scholar.png             flattened preview (3x size)
//   tools/previews/oxford-scholar-street.png      the two buildings on the map (3x)
//
// The scene: dusk, inside the pub at a high table by the big timber-framed
// windows. She has a Long Island iced tea, he has a pint, and they clink
// glasses over a basket of fries. Outside: Swanston Street, a tram going past
// and RMIT's Building 80 with its red sign.
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
  tram: '#e9ece6',
  tramShade: '#c3c9c2',
  tramGreen: '#3f9a6e',
  tramGreenDark: '#2d7553',
  tramWindow: '#f2d49a',
  tramWindowDark: '#3a3546',
  tramSkirt: '#4a4752',
  tramDest: '#ffb347',
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
  herDress: P.herDress,
  herDressShade: P.herDressShade,
  herShoes: P.white,
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
  jeans: P.jeans,
  jeansShade: P.jeansShade,
  himShoes: P.shoeDark,
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

// ---- 3. tram.png — a Melbourne tram gliding past (960 wide, "drift" scrolls it) ------------
function drawTram() {
  const c = new Canvas(W * 3, H);
  const x0 = 300; // enters the window about a second after the scene opens
  const len = 150;
  const top = 74;
  const bottom = 100;
  const x1 = x0 + len;
  // body + roof
  c.rect(x0 + 3, top, len - 3, bottom - top, PAL.tram);
  c.rect(x0, top + 3, 3, bottom - top - 3, PAL.tram);
  c.px(x0 + 1, top + 2, PAL.tram);
  c.px(x0 + 2, top + 1, PAL.tram);
  c.rect(x0 + 6, top - 2, len - 12, 2, PAL.tramShade);
  c.rect(x0 + 3, bottom - 8, len - 3, 3, PAL.tramGreen);
  c.rect(x0, bottom - 5, len, 1, PAL.tramGreenDark);
  c.rect(x0, bottom - 4, len, 4, PAL.tramSkirt);
  // windscreen, destination sign, headlight (the front is on the left: it's heading left)
  c.rect(x0, top + 4, 4, 11, PAL.tramWindowDark);
  c.rect(x0 + 5, top + 1, 12, 2, PAL.tramDest);
  c.px(x0 + 1, bottom - 7, PAL.lampHead);
  // three sections: lit windows, a door each, joints between them
  for (let s = 0; s < 3; s++) {
    const sx = x0 + 6 + s * 49;
    for (let wx = sx; wx < sx + 42; wx += 8) c.rect(wx, top + 4, 6, 9, PAL.tramWindow);
    c.rect(sx + 18, top + 4, 8, bottom - top - 8, PAL.tramShade); // door
    c.rect(sx + 19, top + 5, 6, 8, PAL.tramWindow);
    c.rect(sx + 21, top + 5, 1, bottom - top - 10, PAL.tramShade);
    if (s > 0) c.rect(sx - 4, top - 1, 2, bottom - top + 1, PAL.tramSkirt);
  }
  // pantograph up to the wire
  const px = x0 + 70;
  c.line(px - 6, top - 2, px, top - 14, PAL.wire);
  c.line(px + 6, top - 2, px, top - 14, PAL.wire);
  c.line(px, top - 14, px - 4, 36, PAL.wire);
  c.line(px - 7, 36, px - 1, 36, PAL.wire);
  c.rect(x1 - 4, top + 4, 4, 11, PAL.tramWindowDark); // back window
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
  // legs (still): lap under the skirt, shins, white shoes
  thickLine(c, 130, 117, 143, 119, 3, s.herSkin);
  thickLine(c, 143, 120, 142, 136, 3, s.herSkin);
  c.rect(141, 137, 6, 2, s.herShoes);
  c.rect(141, 139, 6, 1, '#cfd0d8');
  c.rect(126, 113, 14, 6, s.herDress); // short skirt over her lap
  c.rect(126, 118, 14, 1, s.herDressShade);
  // body
  c.rect(126, 95 + dy, 12, 119 - 95 - dy, s.herDress);
  c.rect(126, 96 + dy, 2, 119 - 96 - dy, s.herDressShade);
  c.clear(126, 95 + dy);
  c.clear(137, 95 + dy);
  c.rect(128, 111, 10, 1, s.herDressShade); // waist
  // neck
  c.rect(131, 91 + dy, 4, 5, s.herSkin);
  c.px(131, 94 + dy, s.herSkinShade);
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
  for (const [x, y] of [[hx - 4, hy - 1], [hx - 3, hy - 2], [hx - 5, hy + 1], [hx + 1, hy - 3]]) c.px(x, y, s.herHairHi);
  // eye, eyebrow piercing, blush
  if (blink) c.px(hx + 6, hy + 2, s.herSkinShade);
  else {
    c.px(hx + 6, hy + 1, s.eye);
    c.px(hx + 6, hy + 2, s.eye);
  }
  c.px(hx + 7, hy, s.piercing); // eyebrow piercing
  c.px(hx + 5, hy + 4, s.herBlush);
  c.px(hx + 6, hy + 4, s.herBlush, 0.6);
}

function drawHim(c, dy, blink) {
  const s = PAL;
  // legs (still): jeans across to the knee, down to his shoes
  thickLine(c, 188, 116, 174, 118, 4, s.jeans);
  c.rect(174, 121, 14, 1, s.jeansShade);
  thickLine(c, 175, 121, 176, 137, 3, s.jeans);
  c.rect(172, 138, 7, 2, s.himShoes);
  // body: open brown jacket over a white shirt (front faces left)
  c.rect(182, 88 + dy, 13, 119 - 88 - dy, s.jacket);
  c.rect(193, 89 + dy, 2, 119 - 89 - dy, s.jacketShade);
  c.rect(185, 88 + dy, 8, 1, s.jacketHi); // light on the shoulders
  c.rect(182, 88 + dy, 3, 26 - dy, s.shirt); // shirt down the front
  c.rect(185, 89 + dy, 1, 10, s.jacketShade); // lapel
  c.px(184, 88 + dy, s.shirt);
  c.clear(194, 88 + dy);
  c.rect(182, 114, 13, 5, s.jeans);
  c.rect(182, 114, 13, 1, s.jeansShade);
  // neck (his hair is short, so it shows)
  c.rect(185, 83 + dy, 4, 6, s.himSkin);
  c.px(188, 85 + dy, s.himSkinShade);
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
  c.px(hx + 1, hy + 1, s.himSkinShade); // ear
  c.px(hx + 1, hy + 2, s.himSkinShade);
  for (const [x, y] of [[hx - 2, hy - 5], [hx + 1, hy - 6], [hx + 3, hy - 4]]) c.px(x, y, s.himHairHi);
  if (blink) c.px(hx - 5, hy + 1, s.himSkinShade);
  else {
    c.px(hx - 5, hy, s.eye);
    c.px(hx - 5, hy + 1, s.eye);
  }
  c.px(hx - 4, hy + 3, s.himBlush);
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
  // her arm: shoulder -> elbow -> hand around her glass
  c.rect(133, 95 + herDy, 4, 3, PAL.herDress); // little sleeve
  thickLine(c, 134, 97 + herDy, 140, 103, 3, PAL.herSkin);
  thickLine(c, 140, 103, 146, 88, 3, PAL.herSkin);
  c.rect(145, 84, 3, 5, PAL.herSkin);
  c.rect(148, 85, 2, 3, PAL.herSkin); // fingers over the glass
  c.px(145, 88, PAL.herSkinShade);
  // his arm: shoulder -> elbow -> hand around his pint
  thickLine(c, 184, 90 + himDy, 178, 101, 3, PAL.jacket);
  thickLine(c, 178, 101, 167, 86, 3, PAL.jacket);
  c.rect(166, 85, 2, 3, PAL.jacketShade); // cuff
  c.rect(163, 81, 3, 5, PAL.himSkin);
  c.rect(162, 82, 2, 3, PAL.himSkin); // fingers over the glass
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
const RMIT = { cols: 5, rows: 6, at: { x: 37, y: 0 } }; // replaces the house east of the pub

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
  drawRmitLogo(c, 12, 63, 9);
  text(c, 'RMIT', 25, 64, s.signText);
  for (let x = 0; x < w; x++) c.rect(x, 74, 1, 2 + ((x >> 2) % 2), s.rmitRed);
  // glass shopfront + the red door
  c.rect(0, 77, w, 16, s.shopfront);
  for (let x = 2; x < w; x += 13) c.rect(x, 78, 10, 14, s.litWindow, 0.45);
  c.rect(32, 79, 16, 14, s.rmitRed);
  c.rect(39, 79, 1, 14, s.rmitRedDark);
  c.px(37, 86, s.signText);
  c.px(41, 86, s.signText);
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
street.blit(rmit, 16 + 10 * 16, 0);
writePreview('oxford-scholar-street.png', street);
console.log('  preview  tools/previews/oxford-scholar.png, tools/previews/oxford-scholar-street.png');
