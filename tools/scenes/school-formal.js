#!/usr/bin/env node
// -----------------------------------------------------------------------------
// school-formal.js — draws the "Our school formal" memory as layered pixel art,
// plus the outside of the ballroom for the map, and adds that building and its
// trigger to maps/world.json (only the first time).
//
//   npm run scene:formal                      # (re)draw everything
//   npm run scene:formal -- --keep us,bg      # don't overwrite layers you've redrawn
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/memories/school-formal/*.png   the 8 cutscene layers
//   public/assets/tiles/hall.png                 the ballroom building (160x112 = 10x7 tiles)
//   tools/previews/school-formal.png             flattened preview (3x size)
//   tools/previews/school-hall.png               the building on grass (3x size)
//
// Reference: the San Remo Ballroom — dark ceiling with round recesses and
// lighting trusses, a huge tiered crystal chandelier, cream walls, a glossy
// black dance floor, round tables with tall white flower centrepieces.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas, rng, bayer } from '../lib/canvas.js';
import { ROOT, makeSaver, ring, thickLine, rimLight, softEllipse, text, textWidth, writePreview, stampBuilding, placeLamp } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // the room
  ceiling: '#120d16',
  ceilingLow: '#1b141f',
  ceilingRing: '#2a2130',
  truss: '#2f2635',
  wallLit: '#b8a491',
  wallMid: '#8c7a72',
  wallShadow: '#4d3f4a',
  wallTrim: '#d9c7b0',
  drape: '#5b4566',
  drapeShade: '#3f2f4a',
  drapeHi: '#7a5f86',
  fairyWire: '#3a2c34',
  stage: '#2a2030',
  headTable: '#a8998a',
  carpet: '#150f19',
  carpetPattern: '#1c1421',
  floor: '#211824',
  floorShine: '#3a2c3c',
  floorReflect: '#a8804f',
  tableCloth: '#a89a8e',
  tableClothShade: '#6e6260',
  tableClothHi: '#c7b9aa',
  chair: '#0c090e',
  flowers: '#d8cfc4',
  flowersShade: '#a89c94',
  goldStand: '#a8844a',
  // light
  warmCore: '#fff4d6',
  warmLight: '#ffd98a',
  warmGlow: '#f2b45c',
  crystal: '#f6e7c4',
  crystalShade: '#c9a46a',
  fairy: '#ffdca0',
  // us — the navy of her dress and his tie is the SAME colour on purpose
  navy: '#24337a',
  navyLight: '#3d52a6',
  navyDark: '#162050',
  herSkin: '#d9a47c',
  herSkinShade: '#b9845e',
  herHair: '#2e1f1c', // dark brown bob that night (her pink: '#e0607e')
  herHairHi: '#5a3e36',
  necklace: '#eef1f8',
  himSkin: '#f0c8ab',
  himSkinShade: '#d6a585',
  himHair: '#3a2620', // dark brown curls
  himHairHi: '#6a4636',
  shirtBlack: '#1e1b24',
  shirtBlackHi: '#3a3442',
  pantsBlack: '#151219',
  shoes: '#0d0b10',
  blush: '#e0877a',
  eye: '#1a1214',
  outline: '#100b14',
  // the crowd (dusky, low contrast)
  dancerBack: '#231e35',
  dancerBackRim: '#3d3456',
  dancerMid: '#2b2541',
  dancerMidRim: '#4f4470',
  // edges
  vignette: '#0a070d',
  // outside of the ballroom (map tiles)
  render: '#b9b5aa',
  renderShade: '#a29e94',
  renderDark: '#8f8b82',
  renderLight: '#cfcbc0',
  roof: '#8d929e',
  roofLine: '#7c818e',
  vent: '#dcdcd6',
  ventShade: '#b4b4ae',
  glass: '#5d6a80',
  glassHi: '#9fb4c8',
  frame: '#6b675f',
  signNavy: '#2b3a67',
  signNavyHi: '#3e5088',
  signText: '#f2ead8',
  groundFloor: '#3d4255',
  groundFloorDark: '#2a2e3c',
  doorGlow: '#d9b070',
};
const SIGN_TEXT = 'SAN REMO';

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const PI = Math.PI;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'school-formal');
const save = makeSaver();

// ---- 1. bg.png — ceiling, walls, drapes, floor, tables ---------------------------------
const FLOOR_TOP = 112;
// dance floor trapezoid: narrow at the back, wide at the front
const floorEdge = (y) => {
  const t = (y - FLOOR_TOP) / (H - FLOOR_TOP);
  return { left: Math.round(96 - t * 76), right: Math.round(224 + t * 76) };
};

function table(c, x, y, r) {
  // chairs behind
  for (const dx of [-r + 2, -r / 3, r / 3, r - 2]) {
    c.rect(Math.round(x + dx - 2), y - 7, 4, 6, PAL.chair);
    c.rect(Math.round(x + dx - 1), y - 9, 2, 2, PAL.chair);
  }
  // cloth skirt + top
  c.rect(x - r, y, r * 2 + 1, Math.round(r * 0.7), PAL.tableClothShade);
  for (let i = 0; i < r * 2; i += 5) c.rect(x - r + i, y + 1, 1, Math.round(r * 0.7) - 1, PAL.tableCloth, 0.35);
  c.ellipse(x, y, r, Math.max(2, r * 0.32), PAL.tableCloth);
  c.ellipse(x - 1, y - 1, r * 0.75, Math.max(1, r * 0.2), PAL.tableClothHi);
  // tall flower centrepiece on a gold stand (like the real venue)
  c.rect(x, y - 18, 1, 18, PAL.goldStand);
  c.rect(x - 2, y - 3, 5, 1, PAL.goldStand);
  c.circle(x, y - 21, 4.5, PAL.flowersShade);
  c.circle(x - 1, y - 22, 3.5, PAL.flowers);
  c.px(x - 2, y - 24, '#efe6da');
  // chairs in front
  for (const dx of [-r * 0.6, 0, r * 0.6]) {
    const cx = Math.round(x + dx);
    const cy = y + Math.round(r * 0.7) - 2;
    c.rect(cx - 2, cy - 6, 5, 9, PAL.chair);
    for (let s = -1; s <= 1; s++) c.rect(cx + s, cy - 5, 1, 3, s === 0 ? '#1a1520' : PAL.chair);
  }
}

function drawBg() {
  const c = new Canvas(W, H);
  const r = rng(301);

  // Ceiling: dark, with round recesses and lighting trusses
  c.gradientV(0, 0, W, 62, [PAL.ceiling, PAL.ceiling, PAL.ceilingLow]);
  for (const [x, rx] of [[160, 52], [62, 40], [258, 40]]) {
    ring(c, x, 6, rx, 10, PAL.ceilingRing);
    ring(c, x, 6, rx - 7, 7, PAL.ceilingRing);
    ring(c, x, 6, rx - 14, 4, PAL.ceilingRing, 0.7);
  }
  for (const [x0, x1] of [[96, 134], [224, 186]]) {
    for (const off of [0, 3]) c.line(x0 + off, 0, x1 + off, 60, PAL.truss);
    for (let t = 0.05; t < 1; t += 0.08) {
      const x = Math.round(x0 + (x1 - x0) * t);
      c.line(x, Math.round(60 * t), x + 3, Math.round(60 * t) + 2, PAL.truss);
    }
  }

  // Back wall: cream, lit from above, falling into shadow behind the crowd
  c.gradientV(0, 60, W, 52, [PAL.wallLit, PAL.wallLit, PAL.wallMid, PAL.wallShadow, PAL.wallShadow]);
  c.rect(0, 60, W, 2, PAL.wallTrim);
  c.rect(0, 62, W, 1, PAL.wallMid);
  // tall drapes
  for (const x of [8, 90, 222, 300]) {
    c.rect(x, 63, 14, 49, PAL.drape);
    for (let i = 0; i < 14; i += 3) c.rect(x + i, 63, 1, 49, PAL.drapeShade);
    for (let i = 1; i < 14; i += 3) c.rect(x + i, 63, 1, 49, PAL.drapeHi, 0.5);
    c.rect(x - 1, 63, 16, 2, PAL.drapeShade);
  }
  // wall sconces with a little glow
  for (const x of [40, 72, 128, 192, 248, 280]) {
    c.glow(x, 76, 6, PAL.warmLight, 0.3);
    c.rect(x - 1, 75, 2, 3, PAL.warmLight);
    c.px(x, 75, PAL.warmCore);
  }
  // fairy-light wire across the top of the wall (bulbs are in sparkles.png)
  for (let x = 0; x < W; x++) c.px(x, fairyY(x), PAL.fairyWire);
  // stage and head table at the back
  c.rect(112, 100, 96, 12, PAL.stage);
  c.rect(122, 102, 76, 5, PAL.headTable);
  c.rect(122, 107, 76, 2, PAL.tableClothShade);

  // Floor: dark carpet everywhere, glossy dance floor in the middle
  c.rect(0, FLOOR_TOP, W, H - FLOOR_TOP, PAL.carpet);
  for (let y = FLOOR_TOP; y < H; y++)
    for (let x = 0; x < W; x++) if ((x + y * 2) % 7 === 0 && (x * 3 + y) % 5 === 0) c.px(x, y, PAL.carpetPattern);
  for (let y = FLOOR_TOP; y < H; y++) {
    const { left, right } = floorEdge(y);
    c.rect(left, y, right - left, 1, PAL.floor);
    c.px(left, y, PAL.floorShine);
    c.px(right - 1, y, PAL.floorShine);
  }
  // shine: faint horizontal streaks and reflections of the sconces
  for (let y = FLOOR_TOP + 3; y < H; y += 6) {
    const { left, right } = floorEdge(y);
    for (let x = left + 4; x < right - 4; x++) if ((x + y) % 9 < 4) c.px(x, y, PAL.floorShine, 0.5);
  }
  for (const x of [128, 192]) for (let y = FLOOR_TOP + 2; y < FLOOR_TOP + 22; y += 2) c.px(x, y, PAL.floorReflect, 0.35);
  // the chandelier's reflection, a warm blur on the glossy floor (like the photo)
  softEllipse(c, 160, 166, 30, 9, PAL.floorReflect, 0.45);
  for (let i = 0; i < 40; i++) c.px(r.int(136, 184), r.int(160, 174), PAL.warmLight, 0.3);

  // Round tables at the edges, in shadow
  table(c, 22, 150, 18);
  table(c, 54, 128, 15);
  table(c, 298, 150, 18);
  table(c, 266, 128, 15);
  return c;
}

const fairyY = (x) => 66 + Math.round(Math.sin(PI * ((x % 80) / 80)) * 5);

// ---- 2. chandeliers.png — tiered crystal chandeliers + glow ----------------------------
function chandelier(c, cx, top, widths, tierH, glowR) {
  const height = widths.length * tierH;
  softEllipse(c, cx, top + height / 2, glowR, glowR * 0.75, PAL.warmGlow, 0.5);
  c.line(cx, 0, cx, top, PAL.crystalShade, 0.35); // hanging rod
  widths.forEach((w, i) => {
    const y = top + i * tierH;
    const x0 = Math.round(cx - w / 2);
    for (let x = x0; x < x0 + w; x++) {
      const edge = x === x0 || x === x0 + w - 1;
      for (let yy = edge ? 1 : 0; yy < tierH - 1; yy++) {
        c.px(x, y + yy, (x + yy + i) % 2 ? PAL.crystal : PAL.crystalShade);
      }
      if ((x + i) % 2 === 0) c.px(x, y + tierH - 1, PAL.warmLight); // drips
    }
    c.rect(x0 + 1, y, w - 2, 1, PAL.warmCore, 0.8);
  });
  c.px(cx, top + height, PAL.warmLight);
}

function drawChandeliers() {
  const c = new Canvas(W, H);
  // big centre chandelier with its ring frame (above us)
  ring(c, 160, 16, 40, 6, PAL.crystalShade, 0.8);
  chandelier(c, 160, 14, [64, 56, 46, 36, 26, 16, 8], 5, 52);
  // smaller ones along the walls
  for (const x of [64, 256]) chandelier(c, x, 50, [16, 13, 10, 7, 4], 4, 16);
  for (const x of [112, 208]) chandelier(c, x, 60, [9, 7, 5, 3], 3, 9);
  return c;
}

// ---- 3. sparkles.png — glints on the crystals + fairy-light bulbs ----------------------
function drawSparkles() {
  const c = new Canvas(W, H);
  const r = rng(303);
  const glint = (x, y, big) => {
    c.px(x, y, PAL.warmCore);
    if (big) {
      c.px(x - 1, y, PAL.warmLight, 0.7);
      c.px(x + 1, y, PAL.warmLight, 0.7);
      c.px(x, y - 1, PAL.warmLight, 0.7);
      c.px(x, y + 1, PAL.warmLight, 0.7);
    }
  };
  for (let i = 0; i < 26; i++) {
    const tier = r.int(0, 6);
    const w = [64, 56, 46, 36, 26, 16, 8][tier];
    glint(160 + r.int(-w / 2 + 2, w / 2 - 2), 14 + tier * 5 + r.int(0, 3), r() < 0.3);
  }
  for (const [x, top, w] of [[64, 50, 14], [256, 50, 14], [112, 60, 8], [208, 60, 8]])
    for (let i = 0; i < 4; i++) glint(x + r.int(-w / 2 + 1, w / 2 - 1), top + r.int(0, 14), false);
  // fairy lights along the wall
  for (let x = 4; x < W; x += 9) {
    const y = fairyY(x) + 1;
    c.glow(x, y, 3, PAL.fairy, 0.35);
    c.px(x, y, PAL.fairy);
  }
  return c;
}

// ---- 4 & 5. dancers — dusky silhouettes of other couples --------------------------------
const US_BOX = { left: 140, right: 180, top: 92, bottom: 142 }; // keep everyone else out of this

// A slow-dancing couple as a 19x24 silhouette: her (bell-shaped gown) on the
// left, him (suit) on the right, arms around each other, heads apart so they
// still read as two people. 'h' marks optional long hair down her back.
const COUPLE = [
  '.............####..',
  '...###......######.',
  '..#####.....######.',
  '..#####.....######.',
  '..#####......####..',
  '...###........##...',
  '....#...#..######..',
  '..######..########.',
  '.########.########.',
  '.#################.',
  '..#######.########.',
  '..h####...#######..',
  '..h###.#####.####..',
  '..h####.....######.',
  '..#####......####..',
  '.#######.....##.##.',
  '.#######.....##.##.',
  '########.....##.##.',
  '#########....##.##.',
  '#########....##.##.',
  '##########...##.##.',
  '##########...##.##.',
  '##########...##.##.',
  '##########..###.###',
];

function dancerCouple(c, x, footY, h, color, { flip = false, longHair = false } = {}) {
  const scale = h / COUPLE.length;
  const w = Math.round(COUPLE[0].length * scale);
  const hh = Math.round(COUPLE.length * scale);
  const left = Math.round(x - w / 2);
  const top = footY - hh + 1;
  for (let y = 0; y < hh; y++)
    for (let xx = 0; xx < w; xx++) {
      const row = COUPLE[Math.min(COUPLE.length - 1, Math.floor(y / scale))];
      const col = Math.min(row.length - 1, Math.floor(xx / scale));
      const ch = row[flip ? row.length - 1 - col : col];
      if (ch === '#' || (ch === 'h' && longHair)) c.px(left + xx, top + y, color);
    }
  return { left, right: left + w, top, bottom: footY };
}

function checkClear(box, label) {
  const overlap = box.right > US_BOX.left && box.left < US_BOX.right && box.bottom > US_BOX.top && box.top < US_BOX.bottom;
  if (overlap) console.warn(`  ! ${label} overlaps the two of us — move it.`);
}

function drawDancers(list, h, color, rim, label) {
  const c = new Canvas(W, H);
  list.forEach(([x, foot, opts], i) => checkClear(dancerCouple(c, x, foot, h, color, opts), `${label} couple ${i + 1}`));
  rimLight(c, rim, 1);
  return c;
}

// ---- 6. spotlight.png — warm cone + pool of light around us -----------------------------
function drawSpotlight() {
  const c = new Canvas(W, H);
  for (let y = 50; y <= 140; y++) {
    const t = (y - 50) / 90;
    const half = 12 + t * 34;
    for (let x = Math.floor(160 - half); x <= 160 + half; x++) {
      const edge = 1 - Math.abs(x - 160) / half;
      const a = edge > 0.35 ? 0.15 : edge > 0.12 ? 0.08 : (x + y) % 2 ? 0.05 : 0;
      if (a) c.px(x, y, PAL.warmLight, a);
    }
  }
  softEllipse(c, 160, 142, 54, 10, PAL.warmLight, 0.32);
  softEllipse(c, 160, 142, 30, 6, PAL.warmCore, 0.3);
  return c;
}

// ---- 7. us.png — the two of us slow dancing (4-frame flip-book) -------------------------
const FEET = 142;

function drawUs() {
  const c = new Canvas(W, H);

  // ---- him (right, facing left), tall ----
  // legs + shoes
  c.rect(166, 124, 4, 16, PAL.pantsBlack);
  c.rect(170, 124, 4, 16, PAL.pantsBlack);
  c.rect(170, 124, 1, 16, PAL.shirtBlackHi, 0.4);
  c.rect(163, 140, 7, 2, PAL.shoes);
  c.rect(170, 140, 5, 2, PAL.shoes);
  // black collared shirt
  c.rect(164, 110, 11, 15, PAL.shirtBlack);
  c.rect(165, 110, 2, 13, PAL.shirtBlackHi, 0.6); // light catching the front
  c.rect(164, 123, 11, 2, PAL.pantsBlack); // belt
  // navy tie (same navy as her dress)
  c.rect(164, 110, 2, 2, PAL.navy);
  c.px(164, 110, PAL.navyLight);
  c.rect(164, 112, 2, 9, PAL.navy);
  c.px(164, 121, PAL.navyDark);
  c.px(166, 109, PAL.shirtBlackHi); // collar points
  c.px(163, 109, PAL.shirtBlackHi);
  // neck
  c.rect(167, 105, 3, 5, PAL.himSkin);
  c.px(169, 107, PAL.himSkinShade);
  // head tilted towards her
  c.circle(168, 101, 5.6, PAL.himHair);
  c.ellipse(165, 103, 3.6, 4, PAL.himSkin);
  // curly hair: bumps on top and at the back, curls falling on the forehead
  for (const [x, y, rad] of [[164, 96, 2.2], [168, 94.5, 2.4], [172, 96, 2.2], [174, 99.5, 2], [173, 103, 1.8], [162, 98, 1.8]])
    c.circle(x, y, rad, PAL.himHair);
  for (const [x, y] of [[163, 95], [167, 93], [171, 95], [174, 98], [161, 97], [169, 96]]) c.px(x, y, PAL.himHairHi);
  c.px(162, 100, PAL.himHair);
  c.px(163, 101, PAL.himHair);
  c.px(165, 100, PAL.himHair);
  c.px(163, 104, PAL.eye); // eye (looking down at her)
  c.px(164, 105, PAL.blush, 0.6);

  // ---- her (left, facing right) ----
  // floor-length navy gown, fitted, flaring a little at the hem
  for (let y = 118; y <= FEET; y++) {
    let left;
    let right;
    if (y < 126) {
      left = 148;
      right = y < 123 ? 157 : 156; // bodice, chest towards him
    } else {
      const t = (y - 126) / (FEET - 126);
      left = Math.round(149 - t * 4);
      right = Math.round(155 + t * 3);
    }
    c.rect(left, y, right - left + 1, 1, PAL.navy);
    c.px(left, y, PAL.navyDark);
    c.px(left + 1, y, PAL.navyDark);
    if (y > 127) c.px(right - 2, y, PAL.navyLight); // light down the front of the skirt
  }
  c.rect(146, FEET, 12, 1, PAL.navyDark); // hem
  // off-the-shoulder draped neckline
  c.rect(149, 118, 8, 1, PAL.navyLight);
  c.px(151, 119, PAL.navyLight);
  c.px(153, 120, PAL.navyLight);
  c.px(155, 121, PAL.navyLight);
  // shoulders + neck
  c.rect(149, 115, 7, 3, PAL.herSkin);
  c.rect(150, 112, 3, 3, PAL.herSkin);
  c.px(149, 117, PAL.herSkinShade);
  // necklace
  for (const [x, y] of [[151, 116], [152, 117], [153, 117], [154, 116]]) c.px(x, y, PAL.necklace);
  // head, tilted towards him: dark bob ending at the jaw, side fringe
  c.circle(151, 108, 5.4, PAL.herHair);
  c.ellipse(154, 109, 3.4, 3.8, PAL.herSkin);
  c.rect(147, 108, 4, 5, PAL.herHair); // bob at the back
  c.rect(152, 103, 5, 2, PAL.herHair); // fringe
  c.px(157, 105, PAL.herHair);
  c.px(156, 105, PAL.herHair);
  for (const [x, y] of [[149, 104], [150, 103], [152, 103]]) c.px(x, y, PAL.herHairHi);
  c.px(156, 108, PAL.eye);
  c.px(156, 110, PAL.blush);
  c.px(158, 109, PAL.herSkin); // nose

  // ---- his arm at her waist (drawn over her dress) ----
  thickLine(c, 170, 112, 165, 120, 3, PAL.shirtBlack);
  thickLine(c, 165, 120, 156, 125, 2, PAL.shirtBlack);
  c.rect(154, 124, 3, 2, PAL.himSkin); // his hand on her waist

  // ---- her arm up to his shoulder (drawn over him) ----
  thickLine(c, 155, 116, 160, 112, 2, PAL.herSkin);
  thickLine(c, 160, 112, 165, 110, 2, PAL.herSkin);
  c.rect(165, 109, 2, 2, PAL.herSkin); // her hand on his shoulder
  c.px(158, 114, PAL.herSkinShade);

  // light from above, then a dark outline so we read against anything
  rimLight(c, PAL.warmLight, 0.35);
  c.outline(PAL.outline);
  return c;
}

/**
 * Four frames of a tiny slow-dance step: lean one way (top of us shifts a
 * pixel), back to centre, lean the other way. Her hem swings the opposite way.
 */
function usFrames(base) {
  const LEAN = [0, 1, 0, -1];
  const sheet = new Canvas(W * 4, H);
  const top = US_BOX.top;
  LEAN.forEach((lean, f) => {
    const frame = new Canvas(W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const [r, g, b, a] = base.get(x, y);
        if (!a) continue;
        let dx = y < FEET ? Math.round((lean * (FEET - y)) / (FEET - top)) : 0;
        if (y >= FEET - 4 && x < 160) dx -= lean; // her hem swings the other way
        frame.px(x + dx, y, [r, g, b], a / 255);
      }
    // soft reflection on the polished floor
    for (let i = 1; i <= 12; i++)
      for (let x = 140; x < 182; x++) {
        const [r, g, b, a] = frame.get(x, FEET - i * 2);
        if (a) frame.px(x, FEET + i, [r, g, b], 0.22 * (1 - i / 13));
      }
    sheet.blit(frame, f * W, 0);
  });
  return sheet;
}

// ---- 8. vignette.png ---------------------------------------------------------------------
function drawVignette() {
  const c = new Canvas(W, H);
  const levels = [0, 0.22, 0.42, 0.62, 0.8];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 160) / 175, (y - 100) / 118);
      const t = Math.max(0, Math.min(1, (d - 0.55) / 0.45));
      const lv = t * 4;
      const i = Math.min(4, Math.floor(lv) + (lv % 1 > bayer(x, y) ? 1 : 0));
      if (i) c.px(x, y, PAL.vignette, levels[i]);
    }
  return c;
}

// ---- The building for the map: hall.png (10 x 7 tiles) ---------------------------------
const HALL_COLS = 10;
const HALL_ROWS = 7;

function drawHall() {
  const c = new Canvas(HALL_COLS * 16, HALL_ROWS * 16);
  const w = c.width;
  // flat roof with vents
  c.rect(0, 4, w, 28, PAL.roof);
  for (let y = 8; y < 28; y += 4) c.rect(1, y, w - 2, 1, PAL.roofLine);
  c.rect(0, 4, w, 1, '#a7acb6');
  c.rect(0, 28, w, 4, PAL.renderLight); // parapet
  c.rect(0, 31, w, 1, PAL.renderDark);
  for (const x of [22, 52, 102, 132]) {
    c.ellipse(x + 4, 22, 6, 2, '#5e6270', 0.5);
    c.rect(x, 12, 9, 10, PAL.vent);
    c.rect(x + 6, 12, 3, 10, PAL.ventShade);
    c.ellipse(x + 4, 12, 4.5, 1.5, '#eeeeea');
  }
  // upper floor: grey render
  c.rect(0, 32, w, 42, PAL.render);
  c.rect(0, 32, w, 3, PAL.renderLight);
  c.rect(0, 35, w, 1, PAL.renderDark);
  c.rect(0, 72, w, 2, PAL.renderShade);
  // round porthole windows on both wings
  for (const x of [12, 28, 44, 116, 132, 148]) {
    c.circle(x, 54, 5, PAL.renderDark);
    c.circle(x, 54, 4, PAL.glass);
    c.px(x - 2, 52, PAL.glassHi);
    c.px(x - 1, 51, PAL.glassHi);
  }
  // raised centre with a big arched window
  c.rect(56, 32, 48, 42, PAL.renderShade);
  c.rect(56, 32, 48, 3, PAL.renderLight);
  for (let x = 60; x < 100; x++) {
    const archTop = Math.round(40 + (1 - Math.sin((PI * (x - 60)) / 40)) * 6);
    c.rect(x, archTop, 1, 72 - archTop, PAL.renderDark);
  }
  for (let x = 64; x < 96; x++) {
    const archTop = Math.round(44 + (1 - Math.sin((PI * (x - 64)) / 32)) * 6);
    for (let y = archTop; y < 70; y++) c.px(x, y, (x - 64) % 4 === 0 || (y - 44) % 5 === 0 ? PAL.frame : PAL.glass);
  }
  c.line(66, 66, 72, 52, PAL.glassHi, 0.6);
  // navy awning band with an arched sign over the doors
  c.rect(0, 74, w, 6, PAL.signNavy);
  c.rect(0, 74, w, 1, PAL.signNavyHi);
  for (let x = 44; x < 116; x++) {
    const top = Math.round(74 - Math.sin((PI * (x - 44)) / 72) * 12);
    c.rect(x, top, 1, 80 - top, PAL.signNavy);
    c.px(x, top, PAL.signNavyHi);
  }
  const tw = textWidth(SIGN_TEXT);
  text(c, SIGN_TEXT, Math.round(w / 2 - tw / 2), 66, PAL.signText);
  // ground floor: dark slate with arched windows and glass doors
  c.rect(0, 80, w, 32, PAL.groundFloor);
  for (const x0 of [6, 30, 110, 134]) {
    for (let x = x0; x < x0 + 20; x++) {
      const top = Math.round(86 + (1 - Math.sin((PI * (x - x0)) / 20)) * 4);
      c.rect(x, top, 1, 108 - top, PAL.groundFloorDark);
    }
    c.line(x0 + 4, 104, x0 + 12, 92, '#56607a');
  }
  // doors: lit from inside
  c.rect(62, 84, 36, 26, PAL.groundFloorDark);
  for (const x of [64, 73, 82, 91]) {
    c.rect(x, 86, 7, 24, PAL.doorGlow);
    c.rect(x, 86, 7, 5, '#e8c890');
    c.rect(x, 91, 7, 1, PAL.groundFloorDark);
  }
  c.px(78, 100, '#e4e8f2'); // handles
  c.px(81, 100, '#e4e8f2');
  // step + outline of the building
  c.rect(0, 110, w, 2, PAL.renderDark);
  for (let y = 4; y < c.height; y++) {
    c.px(0, y, PAL.frame);
    c.px(w - 1, y, PAL.frame);
  }
  return c;
}

// ---- Add the building + trigger to maps/world.json (first time only) ----------------------
const HALL_AT = { x: 33, y: 12 }; // top-left tile, town area east of the café path

function addToMap() {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (map.tilesets.some((t) => t.name === 'hall')) {
    console.log('  map      already has the ballroom — left untouched');
    return;
  }
  stampBuilding(map, { name: 'hall', image: '../public/assets/tiles/hall.png', cols: HALL_COLS, rows: HALL_ROWS, at: HALL_AT });
  const layer = (name) => map.layers.find((l) => l.name === name);
  const set = (name, x, y, gid) => (layer(name).data[y * map.width + x] = gid);
  // clear the fence that ran behind the building
  for (let x = HALL_AT.x; x < HALL_AT.x + HALL_COLS; x++) set('Decor', x, HALL_AT.y - 1, 0);
  // a short path from the main path up to the doors (cosy tile 4 = path, gid 5)
  const doorY = HALL_AT.y + HALL_ROWS;
  for (let x = HALL_AT.x + 3; x <= HALL_AT.x + 6; x++) set('Ground', x, doorY, 5);
  // a street lamp either side of that path
  placeLamp(map, HALL_AT.x + 2, doorY);
  placeLamp(map, HALL_AT.x + 7, doorY);
  // trigger right in front of the doors
  layer('Triggers').objects.push({
    id: map.nextobjectid++,
    name: 'ballroom doors',
    type: '',
    x: (HALL_AT.x + 4) * 16,
    y: doorY * 16,
    width: 32,
    height: 16,
    rotation: 0,
    visible: true,
    properties: [{ name: 'memoryId', type: 'string', value: 'school-formal' }],
  });
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  console.log(`  map      added the ballroom at tiles x ${HALL_AT.x}–${HALL_AT.x + HALL_COLS - 1}, y ${HALL_AT.y}–${doorY - 1} + trigger`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing the school formal…');
const layers = {
  bg: drawBg(),
  chandeliers: drawChandeliers(),
  sparkles: drawSparkles(),
  'dancers-back': drawDancers(
    [[58, 120, { longHair: true }], [92, 120, { flip: true }], [122, 119, {}], [198, 119, { flip: true, longHair: true }], [232, 120, {}], [264, 120, { flip: true }]],
    24, PAL.dancerBack, PAL.dancerBackRim, 'back'
  ),
  'dancers-mid': drawDancers(
    [[86, 132, { flip: true, longHair: true }], [116, 133, {}], [208, 133, { flip: true }], [238, 132, { longHair: true }]],
    30, PAL.dancerMid, PAL.dancerMidRim, 'mid'
  ),
  spotlight: drawSpotlight(),
};
const usBase = drawUs();
const us = usFrames(usBase);
const vignette = drawVignette();

for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);
save(path.join(OUT, 'us.png'), us);
save(path.join(OUT, 'vignette.png'), vignette);
const hall = drawHall();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'hall.png'), hall);
addToMap();

// ---- Previews (3x) ----------------------------------------------------------------------------
const flat = new Canvas(W, H);
flat.rect(0, 0, W, H, '#000000');
for (const name of ['bg', 'chandeliers', 'sparkles', 'dancers-back', 'dancers-mid', 'spotlight']) flat.blit(layers[name], 0, 0);
flat.blit(usFrames(usBase), 0, 0); // frame 1 sits at x 0..319
flat.blit(vignette, 0, 0);
writePreview('school-formal.png', flat);
const hallPreview = new Canvas(hall.width + 32, hall.height + 32);
hallPreview.rect(0, 0, hallPreview.width, hallPreview.height, '#8cc269');
hallPreview.rect(16 + 48, hall.height + 16, 64, 16, '#dcc08a');
hallPreview.blit(hall, 16, 16);
writePreview('school-hall.png', hallPreview);
console.log('  preview  tools/previews/school-formal.png, tools/previews/school-hall.png');
