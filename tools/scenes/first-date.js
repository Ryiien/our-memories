#!/usr/bin/env node
// -----------------------------------------------------------------------------
// first-date.js — draws the "Where it all began" memory (our first date): a
// lamp-lit street at dusk, the two of us under the lamp, and the bus stop
// beside us (a glass shelter + a PT sign for the 513, 514 and 903). Behind the
// buildings, a Metro train glides along the elevated line (pink pillars, as at Bell).
//
//   npm run scene:first-date                       # (re)draw everything
//   npm run scene:first-date -- --keep us,street   # don't overwrite layers you've redrawn
//
// Tweak colours in PAL (or the routes in BUS_ROUTES) below and re-run. Outputs:
//   public/assets/memories/first-date/*.png   the 11 cutscene layers (shooting-stars.png is a
//                                             sprite sheet: 320x60 frames, 4 per row;
//                                             train.png is 1280 wide for "drift")
//   tools/previews/first-date.png             flattened preview (3x size)
// -----------------------------------------------------------------------------
import path from 'node:path';

import { Canvas, rng } from '../lib/canvas.js';
import { ROOT, makeSaver, softEllipse, miniText, miniWidth, writePreview } from '../lib/scene-kit.js';
import { figure, HER, HIM } from '../lib/cutscenes.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // dusk sky, top to bottom
  sky: ['#272a57', '#3a3a6e', '#5a4a7e', '#86628e', '#b07a9a', '#d98a8a', '#f2b38a'],
  stars: ['#fff3dc', '#ffffff', '#f6d983', '#b8a6d9', '#fff3dc'],
  // the street
  building1: '#3a2f52',
  building2: '#33294a',
  roofline: '#5a4a7e',
  windowDark: '#2a2340',
  windowLit: '#f6d983',
  windowWarm: '#e9a35b',
  windowHi: '#fff3dc',
  pavement: '#5a4a6a',
  pavementLight: '#6e5c80',
  lampPost: '#1b1d40',
  lampLight: '#f6d983',
  lampCore: '#fff3dc',
  heart: '#e58f9e',
  // the bus shelter (silver frame, glass, orange roof edge), dimmed for dusk
  frame: '#7d8296',
  frameHi: '#a9adc0',
  frameDark: '#4e5266',
  roof: '#5b5f73',
  roofHi: '#7a7f94',
  roofEdge: '#d9733a',
  glass: '#a9c0e6',
  glassGlint: '#e8f0ff',
  stripe: '#d9bd4c', // the yellow strip on the glass
  bench: '#9aa0b0',
  benchShade: '#6b7084',
  shelterLight: '#dfe8ff',
  // the PT sign
  signFace: '#c5cad6',
  signFaceShade: '#a3a9b8',
  ptRed: '#d9452b',
  signOrange: '#e07a3e',
  signNavy: '#202a46',
  signPanel: '#3c4252',
  signRule: '#4d5466',
  signText: '#eef0f4',
  pole: '#8d93a3',
  poleShade: '#5d6273',
  // the railway behind the street: a concrete viaduct on pink pillars with a
  // patterned parapet, overhead wires, all darkened against the sunset
  wire: '#1b1d40',
  deck: '#4a4064',
  deckShade: '#3b3254',
  parapet: '#6e6488',
  parapetLattice: '#574d74',
  parapetTop: '#8a80a4',
  pillar: '#9c4a8e',
  pillarShade: '#7a3a70',
  pillarHi: '#b85aa6',
  pinkLight: '#e070c0', // the pink light strip under the deck
  // the train: a Metro X'Trapolis (white with blue doors and swooshes, yellow cab ends)
  trainWhite: '#a6a2c0',
  trainWhiteShade: '#857fa3',
  trainRoof: '#6f6a86',
  trainRoofDark: '#4d4866',
  trainBlue: '#3460a8',
  trainBlueDark: '#264a86',
  trainYellow: '#d4a73c',
  trainYellowShade: '#a8822c',
  trainGlass: '#2a2340',
  trainUnder: '#2a2340',
  trainPassenger: '#4a3a52',
  headlight: '#fff3dc',
  tailLight: '#e04040',
};
const BUS_ROUTES = ['513', '514', '903'];

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'first-date');
const save = makeSaver();

const STREET = 140; // where the buildings meet the pavement
const FEET = 147; // where people (and the shelter) stand on the pavement
const BLOCKS = [[0, 60, 62], [60, 110, 48], [110, 152, 74], [152, 210, 40], [210, 262, 58], [262, 320, 46]];
const r = rng(44); // one generator for the whole street, so it comes out the same every run

// ---- 1. sky.png — dusk gradient + pavement -------------------------------------------
function drawSky() {
  const c = new Canvas(W, H);
  c.gradientV(0, 0, W, STREET, PAL.sky);
  c.rect(0, STREET, W, H - STREET, PAL.pavement);
  return c;
}

// ---- 2. stars.png — the first few stars (twinkle) ---------------------------------------
function drawStars() {
  const c = new Canvas(W, H);
  for (let i = 0; i < 40; i++) {
    const x = r.int(2, W - 3);
    const y = r.int(2, 56);
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

// ---- shooting-stars.png — a few tiny shooting stars (a "frames" flip-book) -------------
// A sprite sheet of SHOOT.frames frames, each SHOOT.w x SHOOT.h (the top of the
// sky), SHOOT.cols per row. Most frames are empty; each star streaks across for
// SHOOT.life frames. At 10 fps the loop is ~10 seconds.
const SHOOT = { w: W, h: 60, cols: 4, frames: 96, life: 6 };
const SHOOTING_STARS = [
  // first frame, where it starts, and which way it falls (1 = right, -1 = left)
  { at: 6, x: 100, y: 8, dir: 1 },
  { at: 40, x: 28, y: 22, dir: 1 },
  { at: 72, x: 300, y: 10, dir: -1 },
];

function drawShootingStars() {
  const rows = Math.ceil(SHOOT.frames / SHOOT.cols);
  const sheet = new Canvas(SHOOT.w * SHOOT.cols, SHOOT.h * rows);
  const tail = [1, 0.6, 0.35, 0.15]; // head, then a short fading tail
  for (const star of SHOOTING_STARS)
    for (let i = 0; i < SHOOT.life; i++) {
      const f = star.at + i;
      const ox = (f % SHOOT.cols) * SHOOT.w;
      const oy = Math.floor(f / SHOOT.cols) * SHOOT.h;
      const fade = i === 0 || i === SHOOT.life - 1 ? 0.5 : 1; // fades in and out
      const hx = star.x + star.dir * 4 * i;
      const hy = star.y + 2 * i;
      tail.forEach((a, k) => {
        const color = k === 0 ? PAL.stars[1] : PAL.stars[0];
        sheet.px(ox + hx - star.dir * k, oy + hy - Math.round(k / 2), color, a * fade);
      });
    }
  return sheet;
}

/** One frame of the sheet, placed on a full-size canvas (for the preview). */
function shootingStarsFrame(sheet, f) {
  const c = new Canvas(W, H);
  const ox = (f % SHOOT.cols) * SHOOT.w;
  const oy = Math.floor(f / SHOOT.cols) * SHOOT.h;
  for (let y = 0; y < SHOOT.h; y++)
    for (let x = 0; x < SHOOT.w; x++) {
      const [r, g, b, a] = sheet.get(ox + x, oy + y);
      if (a) c.px(x, y, [r, g, b], a / 255);
    }
  return c;
}

// ---- railway.png, train.png, viaduct.png — a train going past behind the buildings ----------
// The elevated line from the photos: a concrete viaduct on pink pillars with a
// patterned parapet, and overhead wires on masts. It sits behind the street, so
// the rooftops hide most of it and the train ducks behind the taller buildings.
// Back to front: railway.png (masts + wires), train.png (the train; 4x wide,
// "drift" scrolls it right to left like the tram at the Oxford Scholar), then
// viaduct.png (parapet in front of the train's wheels, deck, pillars).
const RAIL = {
  wire: 57, // the contact wire the pantograph touches
  mastTop: 52,
  parapet: 76, // top of the parapet (the train's lower body hides behind it)
  deck: 82, // top of the concrete deck
  deckBottom: 87,
  mastEvery: 80,
  pillarEvery: 72, // (spaced so they show over the low rooftops, clear of the sign and the heart)
};

function drawRailway() {
  const c = new Canvas(W, H);
  const masts = [];
  for (let x = 36 - RAIL.mastEvery; x < W + RAIL.mastEvery; x += RAIL.mastEvery) masts.push(x);
  for (const x of masts) {
    c.rect(x, RAIL.mastTop, 2, RAIL.parapet - RAIL.mastTop, PAL.wire);
    c.rect(x - 2, RAIL.mastTop + 1, 6, 1, PAL.wire); // the bracket holding the wires
    c.rect(x - 1, RAIL.wire, 4, 1, PAL.wire);
  }
  // the contact wire, and the catenary wire sagging between masts above it, with droppers
  c.rect(0, RAIL.wire, W, 1, PAL.wire, 0.85);
  for (let m = 0; m < masts.length - 1; m++) {
    const a = masts[m] + 1;
    const b = masts[m + 1] + 1;
    for (let x = a; x <= b; x++) {
      const t = (x - a) / (b - a);
      const y = RAIL.mastTop + 1 + Math.round(Math.sin(t * Math.PI) * 2.5);
      c.px(x, y, PAL.wire, 0.85);
      if ((x - a) % 10 === 5) c.rect(x, y + 1, 1, RAIL.wire - y - 1, PAL.wire, 0.45);
    }
  }
  return c;
}

const TRAIN = { x0: 340, cars: 3, car: 64, gap: 2, pod: 62, roof: 64, body: 66, win: 68, bottom: 80 };

function drawTrain() {
  const c = new Canvas(W * 4, H);
  const s = PAL;
  const T = TRAIN;
  const length = T.cars * T.car + (T.cars - 1) * T.gap;
  const front = T.x0; // heading left, so the front is on the left
  const back = T.x0 + length - 1;

  for (let i = 0; i < T.cars; i++) {
    const l = T.x0 + i * (T.car + T.gap);
    const r = l + T.car - 1;
    // roof, with two air-conditioning pods on top
    c.rect(l + 2, T.roof, T.car - 4, 1, s.trainRoofDark);
    c.rect(l + 1, T.roof + 1, T.car - 2, 1, s.trainRoof);
    for (const px of [l + 8, r - 21]) {
      c.rect(px, T.pod, 14, 2, s.trainRoof);
      c.rect(px + 1, T.pod, 12, 1, s.trainWhiteShade);
    }
    // white body, a gutter line along the top, dark underframe along the bottom
    c.rect(l, T.body, T.car, T.bottom - T.body + 1, s.trainWhite);
    c.rect(l, T.body, T.car, 1, s.trainWhiteShade);
    c.rect(l, T.bottom, T.car, 1, s.trainUnder);
    // the window band: lit panes in a dark band, a few people inside
    c.rect(l + 2, T.win, T.car - 4, 5, s.trainGlass);
    for (let wx = l + 3; wx + 3 <= r - 2; wx += 5) {
      c.rect(wx, T.win, 4, 4, s.windowLit);
      c.rect(wx, T.win + 3, 4, 1, s.windowWarm);
      if ((wx * 7 + i) % 3 === 0) {
        c.px(wx + 1, T.win + 1, s.trainPassenger); // a head...
        c.rect(wx + 1, T.win + 2, 2, 2, s.trainPassenger); // ...and shoulders
      }
    }
    // two blue doors on this side, each with a window and the split down the middle
    for (const dx of [l + 17, l + 42]) {
      c.rect(dx, T.body + 1, 5, T.bottom - T.body - 1, s.trainBlue);
      c.rect(dx + 1, T.win, 3, 4, s.windowLit, 0.8);
      c.rect(dx + 2, T.body + 1, 1, T.bottom - T.body - 1, s.trainBlueDark);
    }
    // the gangway to the next car
    if (i < T.cars - 1) c.rect(r + 1, T.win - 1, T.gap, T.bottom - T.win + 1, s.trainUnder);
  }

  // blue swooshes on the lower body behind each cab, rising towards the end
  for (let y = T.win + 5; y < T.bottom; y++) {
    const reach = 6 + (y - T.win - 5) * 3;
    c.rect(front + 6, y, reach, 1, s.trainBlue);
    c.rect(back - 5 - reach, y, reach, 1, s.trainBlue);
  }

  // the cab at each end: a thin yellow edge (the front face), blue side, driver's window
  const cab = (x, dir) => {
    // x = the very end of the train, dir = -1 at the front (left), 1 at the back (right).
    // As in the photos, the yellow is on the front face, so side-on it's just a
    // thin edge; the cab's side is blue, with the driver's window.
    const inner = (n) => x - dir * n; // n pixels in from the end
    for (let n = 1; n < 7; n++) c.rect(inner(n), T.body, 1, T.bottom - T.body, n === 6 ? s.trainBlueDark : s.trainBlue);
    c.rect(inner(0), T.body, 1, T.bottom - T.body, s.trainYellowShade); // the yellow wrapping round...
    c.rect(inner(0) + dir, T.win - 1, 1, T.bottom - T.win + 1, s.trainYellow); // ...to the front face, bulging out a pixel
    c.clear(inner(0), T.roof); // rounded roof at the end
    c.clear(inner(1), T.roof);
    c.clear(inner(0), T.roof + 1);
    for (let n = 0; n < 4; n++) c.px(inner(n), T.body, s.trainRoof);
    c.rect(Math.min(inner(2), inner(4)), T.win, 3, 3, s.trainGlass); // the driver's side window
    c.px(inner(3), T.win + 1, s.windowLit, 0.5); // the cab lights on
  };
  cab(front, -1);
  cab(back, 1);
  // headlight at the front (with a soft beam ahead), red tail light at the back
  c.px(front - 1, T.win + 7, s.headlight);
  c.px(front, T.win + 7, s.headlight);
  c.glow(front - 4, T.win + 7, 9, s.lampLight, 0.3);
  c.px(back + 1, T.win + 7, s.tailLight);

  // a single-arm pantograph on the middle car, reaching up to the wire
  const p = T.x0 + Math.floor(T.cars / 2) * (T.car + T.gap) + Math.round(T.car / 2);
  c.rect(p - 1, T.pod + 1, 3, 1, s.wire); // its base on the roof
  c.line(p, T.pod, p + 3, T.pod - 2, s.wire); // lower arm, up and back to the knee...
  c.line(p + 3, T.pod - 2, p - 1, RAIL.wire + 1, s.wire); // ...upper arm, forward to the head
  c.rect(p - 3, RAIL.wire + 1, 5, 1, s.wire); // the head, riding the wire
  return c;
}

function drawViaduct() {
  const c = new Canvas(W, H);
  const s = PAL;
  // pink pillars (mostly hidden behind the buildings; their flared tops peek out)
  for (let cx = 13; cx < W + 8; cx += RAIL.pillarEvery) {
    for (let y = RAIL.deckBottom + 1; y < STREET; y++) {
      const half = y < RAIL.deckBottom + 5 ? 6 - (y - RAIL.deckBottom - 1) : 3; // the flare under the deck
      c.rect(cx - half, y, half * 2, 1, s.pillar);
      c.rect(cx + half - 2, y, 2, 1, s.pillarShade);
      c.px(cx - half, y, s.pillarHi);
    }
  }
  // the deck, with its pink light strip underneath
  c.rect(0, RAIL.deck, W, RAIL.deckBottom - RAIL.deck, s.deck);
  c.rect(0, RAIL.deckBottom - 1, W, 1, s.deckShade);
  c.rect(0, RAIL.deckBottom, W, 1, s.pinkLight, 0.85);
  c.rect(0, RAIL.deckBottom + 1, W, 1, s.pinkLight, 0.25);
  // the parapet: a light top rail over a criss-cross lattice screen
  c.rect(0, RAIL.parapet, W, RAIL.deck - RAIL.parapet, s.parapet);
  c.rect(0, RAIL.parapet, W, 1, s.parapetTop);
  for (let y = RAIL.parapet + 1; y < RAIL.deck - 1; y++)
    for (let x = 0; x < W; x++) {
      const k = y - RAIL.parapet;
      if ((x + k) % 6 === 0 || (x - k + 600) % 6 === 0) c.px(x, y, s.parapetLattice);
    }
  c.rect(0, RAIL.deck - 1, W, 1, s.parapetLattice);
  return c;
}

// ---- 3 + 4. street.png + windows.png — buildings, pavement, lamp post; lit windows (flicker)
function drawStreet() {
  const street = new Canvas(W, H);
  const windows = new Canvas(W, H);
  BLOCKS.forEach(([x0, x1, h], i) => {
    const top = STREET - h;
    street.rect(x0, top, x1 - x0, h, i % 2 ? PAL.building2 : PAL.building1);
    street.rect(x0, top, x1 - x0, 2, PAL.roofline);
    if (i % 2 === 0) street.rect(x0 + 8, top - 6, 5, 6, PAL.building1); // chimney
    for (let wy = top + 7; wy < STREET - 10; wy += 11)
      for (let wx = x0 + 6; wx < x1 - 8; wx += 10) {
        street.rect(wx, wy, 5, 6, PAL.windowDark);
        if (r() < 0.45) {
          windows.rect(wx, wy, 5, 6, PAL.windowLit);
          windows.rect(wx, wy + 4, 5, 2, PAL.windowWarm);
          windows.px(wx + 1, wy + 1, PAL.windowHi);
        }
      }
  });
  street.rect(0, STREET, W, H - STREET, PAL.pavement);
  street.rect(0, STREET, W, 2, PAL.pavementLight);
  for (let x = 0; x < W; x += 24) street.line(x, STREET + 2, x - 10, H, PAL.pavementLight);
  // the lamp post
  street.rect(231, 70, 3, 72, PAL.lampPost);
  street.rect(226, 140, 13, 3, PAL.lampPost);
  street.rect(226, 62, 13, 3, PAL.lampPost);
  street.rect(227, 65, 2, 8, PAL.lampPost);
  street.rect(236, 65, 2, 8, PAL.lampPost);
  street.rect(226, 73, 13, 2, PAL.lampPost);
  return { street, windows };
}

// ---- 5. bus-stop.png — the shelter and the PT sign, left of us ---------------------------
const SHELTER = { left: 142, right: 197, roof: 87 };
const SIGN = { x: 112, top: 64, w: 20 }; // the sign hangs on the left of its pole

function drawBusStop() {
  const c = new Canvas(W, H);
  const s = PAL;
  const { left, right, roof } = SHELTER;
  const inL = left + 4; // inside faces of the two end posts
  const inR = right - 5;

  // light from under the roof, falling on the pavement
  softEllipse(c, (left + right) / 2, FEET, 34, 4, s.shelterLight, 0.2);
  // the back glass: see-through, with glints and the yellow strip
  for (let y = roof + 6; y < FEET - 6; y++) c.rect(inL, y, inR - inL, 1, s.glass, 0.18);
  for (const gx of [inL + 6, inL + 30]) c.line(gx, roof + 30, gx + 10, roof + 14, s.glassGlint, 0.35);
  c.rect(inL, roof + 24, inR - inL, 2, s.stripe, 0.85);
  c.rect(inL, FEET - 7, inR - inL, 1, s.frame); // bottom rail of the glass
  c.rect((left + right) / 2 - 1, roof + 5, 1, FEET - roof - 11, s.frame, 0.6); // middle mullion
  // the bench: slatted seat on one pedestal
  const benchY = FEET - 17;
  c.rect(inL + 6, benchY, inR - inL - 12, 3, s.bench);
  c.rect(inL + 6, benchY + 1, inR - inL - 12, 1, s.benchShade);
  c.rect(inL + 6, benchY + 3, inR - inL - 12, 1, s.benchShade);
  c.rect((left + right) / 2 - 2, benchY + 4, 3, FEET - benchY - 4, s.frameDark);
  c.rect((left + right) / 2 - 5, FEET - 1, 9, 1, s.frameDark);
  // the two end posts
  for (const px of [left + 2, right - 5]) {
    c.rect(px, roof + 4, 3, FEET - roof - 3, s.frame);
    c.rect(px, roof + 4, 1, FEET - roof - 3, s.frameHi);
    c.rect(px + 2, roof + 4, 1, FEET - roof - 3, s.frameDark);
  }
  // the flat roof with its orange edge, and a light strip underneath
  c.rect(left, roof, right - left, 3, s.roof);
  c.rect(left, roof, right - left, 1, s.roofHi);
  c.rect(left - 1, roof + 3, right - left + 2, 2, s.roofEdge);
  c.rect(inL + 4, roof + 5, inR - inL - 8, 1, s.shelterLight, 0.9);

  // the sign pole
  const poleX = SIGN.x + SIGN.w + 1;
  c.rect(poleX, SIGN.top - 3, 2, FEET - SIGN.top + 4, s.pole);
  c.rect(poleX + 1, SIGN.top - 3, 1, FEET - SIGN.top + 4, s.poleShade);
  c.rect(poleX - 1, FEET, 4, 1, s.poleShade);
  // the sign: PT header, orange name band, route panel, "Hail Bus Here" strip
  const { x, top, w } = SIGN;
  const rowH = 6;
  const panelTop = top + 15;
  const bottom = panelTop + BUS_ROUTES.length * rowH + 1;
  c.rect(x - 1, top - 1, w + 2, bottom - top + 6, s.frameDark); // edge
  c.rect(x, top, w, 8, s.signFace);
  for (let i = 0; i < 6; i++) c.px(x + 1 + (i % 3) * 2, top + 1 + Math.floor(i / 3) * 2, s.signFaceShade); // dotted pattern
  miniText(c, 'PT>', x + w - miniWidth('PT>') - 2, top + 2, s.ptRed);
  c.rect(x, top + 8, w, 5, s.signOrange);
  c.rect(x + 2, top + 10, 10, 1, s.signText, 0.7); // the stop's name, too small to read
  c.rect(x, top + 13, w, 2, s.signNavy); // "Route  To"
  c.rect(x + 1, top + 13, 4, 1, s.signText, 0.45);
  c.rect(x + 14, top + 13, 3, 1, s.signText, 0.45);
  c.rect(x, panelTop, w, bottom - panelTop, s.signPanel);
  BUS_ROUTES.forEach((route, i) => {
    const y = panelTop + 1 + i * rowH;
    miniText(c, route, x + 1, y, s.signText);
    c.rect(x + 14, y + 1, 5, 1, s.signText, 0.55); // where it goes
    c.rect(x + 14, y + 3, 3, 1, s.signText, 0.55);
    if (i > 0) c.rect(x, y - 1, w, 1, s.signRule);
  });
  c.rect(x, bottom, w, 4, s.signFace);
  c.rect(x + 2, bottom + 1, 9, 1, s.frameDark, 0.6); // "Hail Bus Here"
  for (const by of [top + 3, panelTop + 4, bottom - 3]) c.rect(poleX - 1, by, 2, 2, s.frameHi); // clamps
  return c;
}

// ---- 6. glow.png — the lamp's light (pulse) --------------------------------------------
function drawGlow() {
  const c = new Canvas(W, H);
  c.glow(232, 69, 36, PAL.lampLight, 0.42);
  c.ellipse(228, 148, 44, 9, PAL.lampLight, 0.14);
  c.ellipse(228, 148, 30, 6, PAL.lampLight, 0.14);
  c.rect(229, 65, 7, 8, PAL.lampLight);
  c.rect(230, 66, 3, 4, PAL.lampCore);
  return c;
}

// ---- 7. us.png — the two of us, holding hands, a little heart (sway) ----------------------
const SMALL_HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

function drawUs() {
  const c = new Canvas(W, H);
  const place = (fig, x) => c.blit(fig, Math.round(x - fig.width / 2), FEET + 1 - (fig.height - 1));
  place(figure({ ...HER, view: 'front' }), 204);
  place(figure({ ...HIM, view: 'front', jacketDrop: 2 }), 218);
  c.rect(209, 127, 4, 2, HER.skin); // holding hands
  SMALL_HEART.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && c.px(208 + x, 93 + y, PAL.heart)));
  return c;
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing our first date…');
const sky = drawSky();
const stars = drawStars();
const { street, windows } = drawStreet();
const layers = { sky, stars, street, windows, 'bus-stop': drawBusStop(), glow: drawGlow(), us: drawUs() };
for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);
const shooting = drawShootingStars();
save(path.join(OUT, 'shooting-stars.png'), shooting);
const railway = { railway: drawRailway(), train: drawTrain(), viaduct: drawViaduct() };
for (const [name, canvas] of Object.entries(railway)) save(path.join(OUT, `${name}.png`), canvas);

// the preview catches the first shooting star mid-streak, and the train passing behind the street
const PREVIEW_TRAIN_AT = 70; // where the front of the train is in the preview
const flat = new Canvas(W, H);
for (const [name, canvas] of Object.entries(layers)) {
  flat.blit(canvas, 0, 0);
  if (name === 'stars') {
    flat.blit(shootingStarsFrame(shooting, SHOOTING_STARS[0].at + 2), 0, 0);
    flat.blit(railway.railway, 0, 0);
    flat.blit(railway.train, PREVIEW_TRAIN_AT - TRAIN.x0, 0);
    flat.blit(railway.viaduct, 0, 0);
  }
}
writePreview('first-date.png', flat);
console.log('  preview  tools/previews/first-date.png');
