#!/usr/bin/env node
// -----------------------------------------------------------------------------
// first-date.js — draws the "Where it all began" memory (our first date): a
// lamp-lit street at dusk, the two of us under the lamp, and the bus stop
// beside us (a glass shelter + a PT sign for the 513, 514 and 903).
//
//   npm run scene:first-date                       # (re)draw everything
//   npm run scene:first-date -- --keep us,street   # don't overwrite layers you've redrawn
//
// Tweak colours in PAL (or the routes in BUS_ROUTES) below and re-run. Outputs:
//   public/assets/memories/first-date/*.png   the 7 cutscene layers
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
  place(figure({ ...HIM, view: 'front' }), 218);
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

const flat = new Canvas(W, H);
for (const canvas of Object.values(layers)) flat.blit(canvas, 0, 0);
writePreview('first-date.png', flat);
console.log('  preview  tools/previews/first-date.png');
