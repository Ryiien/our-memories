#!/usr/bin/env node
// -----------------------------------------------------------------------------
// laufey-concert.js — draws the "Laufey at the Palais" memory as layered pixel
// art, plus the Palais Theatre for the map, and adds that building and its
// trigger to maps/world.json (only the first time).
//
//   npm run scene:laufey                      # (re)draw everything
//   npm run scene:laufey -- --keep us,hall    # don't overwrite layers you've redrawn
//
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/memories/laufey-concert/*.png   the 10 cutscene layers
//   public/assets/tiles/palais.png                the Palais Theatre (160x112 = 10x7 tiles)
//   tools/previews/laufey-concert.png             flattened preview (3x size)
//   tools/previews/palais.png                     the building on grass (3x size)
//
// Reference (photos from the night): the view from the balcony — a gilded,
// patterned proscenium arch, red velvet curtain, a lighting truss with four
// warm lamps, speakers hanging each side; the two of us in matching paper
// crowns (hers pink, his blue); and the Palais at night — cream art-deco
// towers, red "PALAIS THEATRE" lettering, three glowing purple arches.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas, rng, bayer } from '../lib/canvas.js';
import { ROOT, makeSaver, thickLine, rimLight, softEllipse, miniText, miniWidth, writePreview, stampBuilding, placeLamp } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  // the auditorium
  dark: '#120a0e',
  wall: '#24131a',
  wallWarm: '#3e1e1e',
  sconce: '#ffcf8a',
  // the gilded proscenium arch
  goldDark: '#5e3e1c',
  gold: '#9a6c34',
  goldLight: '#cf9c52',
  goldHi: '#f2d08a',
  // the red velvet curtain
  curtainDark: '#4e0c18',
  curtain: '#7e1626',
  curtainMid: '#a82234',
  curtainHi: '#d4485a',
  // stage, truss, speakers, piano
  stage: '#2a1a1e',
  stageEdge: '#5a3a30',
  truss: '#1a1418',
  lamp: '#fff2c4',
  lampGlow: '#ffd98a',
  speaker: '#141016',
  speakerHi: '#2e2834',
  piano: '#110e13',
  pianoHi: '#3e3846',
  keys: '#f4ecdc',
  // Laufey: cream dress, brown hair with a bow
  singerDress: '#f4ecdc',
  singerDressShade: '#d8ccb4',
  singerHair: '#5a3a2a',
  singerSkin: '#f0c8a8',
  micStand: '#2e2834',
  // the crowd in the stalls
  crowd: '#1c1218',
  crowdRim: '#6a3a2e',
  phone: '#b8cdf0',
  // music notes
  noteA: '#ffe3a8',
  noteB: '#f7a8cf',
  // the balcony ledge (red velvet, brass rail)
  velvet: '#6a1a22',
  velvetHi: '#9a2e34',
  velvetShade: '#46101a',
  brass: '#c9a25a',
  // our row of seats (in front of the camera, right behind us)
  seat: '#9e1e2c',
  seatHi: '#c43a44',
  seatShade: '#6a1220',
  seatGap: '#1a0a0e',
  // her (from behind): pink bob, black leather jacket, pink paper crown
  herHair: '#d6417f',
  herHairHi: '#ef6fa3',
  herHairShade: '#a82f63',
  herSkin: '#d9a47c',
  leather: '#241e2a',
  leatherHi: '#4e4458',
  leatherShine: '#7a7088',
  crownPink: '#f7a8cf',
  crownPinkShade: '#e07fb0',
  // him (from behind): short dark hair, dark navy jacket, blue paper crown
  himHair: '#231c24',
  himHairHi: '#4a3d4a',
  himSkin: '#ecbf9f',
  himSkinShade: '#d6a585',
  himJacket: '#1c2230',
  himJacketHi: '#3a4256',
  crownBlue: '#9fd8ee',
  crownBlueShade: '#6fb8d6',
  crownWhite: '#ffffff',
  crownDeco: '#f59ac4',
  outline: '#2a1f2a',
  vignette: '#0a0508',
  // the Palais Theatre for the map
  facade: '#ead6ae',
  facadeShade: '#cdb48a',
  facadeLight: '#f6e9cc',
  window: '#e8a24a',
  windowHi: '#f6c87a',
  windowBar: '#b8762e',
  neon: '#e8342c',
  neonGlow: '#ff7a5a',
  signBand: '#3a1f22',
  arch: '#9a4fd8',
  archHi: '#c48af0',
  archDark: '#6a2fa0',
  canopy: '#f2d36b',
  canopyShade: '#c9a845',
  lobby: '#3a2a2a',
  door: '#f2c27a',
  poster1: '#e86aa0',
  poster2: '#6f8fc9',
  pennant: '#d9302c',
  step: '#a99886',
  edge: '#6b5a4a',
};
const SIGN_TEXT = 'PALAIS THEATRE';

// ---- Setup ------------------------------------------------------------------------
const W = 320;
const H = 180;
const PI = Math.PI;
const OUT = path.join(ROOT, 'public', 'assets', 'memories', 'laufey-concert');
const save = makeSaver();

// The stage opening inside the gold arch (rounded top corners)
const OPEN = { left: 70, right: 250, top: 24, floor: 88, r: 26 };
const FRAME = { left: 42, right: 278, top: 8, r: 40 }; // outer edge of the gold arch
const SINGER = { x: 168, feet: 89 };
const LEDGE_TOP = 122;

/** Inside a rectangle whose top corners are rounded with radius r. */
const inRounded = (x, y, { left, right, top, r }, bottom) => {
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = x < left + r ? left + r : x > right - r ? right - r : x;
  return y >= top + r || Math.hypot(x - cx, y - (top + r)) <= r;
};

// ---- 1. hall.png — the auditorium, gilded arch, curtain, stage, truss, piano -------------
function drawHall() {
  const c = new Canvas(W, H);
  const r = rng(801);
  c.gradientV(0, 0, W, H, [PAL.dark, PAL.wall, PAL.wall, PAL.wallWarm, PAL.dark]);
  // warm wall sconces either side
  for (const [x, y] of [[16, 60], [304, 60], [22, 96], [298, 96]]) {
    c.glow(x, y, 9, PAL.sconce, 0.35);
    c.rect(x - 1, y - 1, 2, 3, PAL.sconce);
  }
  // the gilded arch: a diamond lattice glowing warm, with mouldings round both edges
  for (let y = FRAME.top; y <= OPEN.floor + 8; y++)
    for (let x = FRAME.left; x <= FRAME.right; x++) {
      if (!inRounded(x, y, FRAME, OPEN.floor + 8) || inRounded(x, y, OPEN, OPEN.floor)) continue;
      const lattice = (x + y) % 8 === 0 || (x - y + 800) % 8 === 0;
      const warm = 1 - Math.abs(x - 160) / 140; // brighter towards the middle
      const base = warm + (bayer(x, y) - 0.5) * 0.4 > 0.45 ? PAL.goldLight : PAL.gold;
      c.px(x, y, lattice ? PAL.goldDark : base);
      if (!lattice && (x * 7 + y * 3) % 23 === 0) c.px(x, y, PAL.goldHi);
    }
  for (let y = FRAME.top; y <= OPEN.floor + 8; y++)
    for (let x = FRAME.left - 1; x <= FRAME.right + 1; x++) {
      const inF = inRounded(x, y, FRAME, OPEN.floor + 8);
      const nearF = inF && (!inRounded(x - 2, y, FRAME, OPEN.floor + 8) || !inRounded(x + 2, y, FRAME, OPEN.floor + 8) || !inRounded(x, y - 2, FRAME, OPEN.floor + 8));
      if (nearF) c.px(x, y, PAL.goldDark);
      const inO = inRounded(x, y, OPEN, OPEN.floor);
      const nearO = !inO && inF && (inRounded(x - 2, y, OPEN, OPEN.floor) || inRounded(x + 2, y, OPEN, OPEN.floor) || inRounded(x, y + 2, OPEN, OPEN.floor));
      if (nearO) c.px(x, y, PAL.goldHi);
    }
  // the red velvet curtain behind the stage: deep folds
  for (let y = OPEN.top; y <= OPEN.floor; y++)
    for (let x = OPEN.left; x <= OPEN.right; x++) {
      if (!inRounded(x, y, OPEN, OPEN.floor)) continue;
      const fold = Math.sin(x * 0.55) + Math.sin(x * 0.13) * 0.5;
      const v = fold + (bayer(x, y) - 0.5) * 0.6;
      c.px(x, y, v > 0.9 ? PAL.curtainHi : v > 0.1 ? PAL.curtainMid : v > -0.7 ? PAL.curtain : PAL.curtainDark);
    }
  // a scalloped valance across the top, and the side drapes in shadow
  for (let x = OPEN.left; x <= OPEN.right; x++) {
    const swag = OPEN.top + 10 + Math.round(Math.abs(Math.sin((x - OPEN.left) * (PI / 30))) * -5);
    for (let y = OPEN.top; y < swag; y++) if (inRounded(x, y, OPEN, OPEN.floor)) c.px(x, y, (y + x) % 3 ? PAL.curtainDark : PAL.curtain);
    c.px(x, swag, PAL.goldLight);
  }
  for (const [x0, x1] of [[OPEN.left, OPEN.left + 12], [OPEN.right - 12, OPEN.right]])
    for (let y = OPEN.top + 8; y <= OPEN.floor; y++)
      for (let x = x0; x <= x1; x++) if (inRounded(x, y, OPEN, OPEN.floor)) c.px(x, y, PAL.curtainDark, 0.6);
  // the stage floor, its lit front edge, and the dark stalls in front
  c.rect(OPEN.left - 6, OPEN.floor, OPEN.right - OPEN.left + 12, 7, PAL.stage);
  c.rect(OPEN.left - 6, OPEN.floor + 7, OPEN.right - OPEN.left + 12, 1, PAL.stageEdge);
  c.rect(0, OPEN.floor + 8, W, H - OPEN.floor - 8, PAL.dark);
  // the lighting truss and its four lamp cans
  c.rect(OPEN.left + 6, 33, OPEN.right - OPEN.left - 12, 3, PAL.truss);
  for (let x = OPEN.left + 8; x < OPEN.right - 8; x += 6) c.line(x, 33, x + 3, 35, PAL.speakerHi);
  for (const x of LAMPS) c.rect(x - 3, 36, 6, 4, PAL.truss);
  // speakers hanging either side
  for (const x of [OPEN.left + 6, OPEN.right - 16]) {
    c.rect(x, 30, 10, 26, PAL.speaker);
    c.rect(x + 1, 31, 8, 1, PAL.speakerHi);
    for (let y = 34; y < 54; y += 4) c.rect(x + 2, y, 6, 1, PAL.speakerHi);
    c.line(x + 5, 22, x + 5, 30, PAL.truss);
  }
  // stage monitors / amps on the floor
  c.rect(OPEN.left + 2, OPEN.floor - 9, 12, 9, PAL.speaker);
  c.rect(OPEN.right - 14, OPEN.floor - 9, 12, 9, PAL.speaker);
  // a grand piano, side on, to the right of her
  const px = 200;
  const py = OPEN.floor + 3; // its feet on the stage floor
  c.rect(px, py - 9, 28, 4, PAL.piano); // body
  for (let i = 0; i < 6; i++) c.rect(px + 22 + Math.round(i * 0.6), py - 9 - i, 6 - i, 1, PAL.piano); // curved tail
  c.line(px + 2, py - 9, px + 18, py - 19, PAL.pianoHi); // the open lid
  c.line(px + 3, py - 9, px + 19, py - 19, PAL.piano);
  c.rect(px, py - 10, 28, 1, PAL.pianoHi);
  c.rect(px, py - 7, 4, 2, PAL.keys); // keyboard end
  for (const lx of [px + 2, px + 24]) c.rect(lx, py - 5, 2, 5, PAL.piano);
  c.rect(px - 6, py - 4, 4, 1, PAL.piano); // the bench
  c.rect(px - 6, py - 3, 1, 3, PAL.piano);
  c.rect(px - 3, py - 3, 1, 3, PAL.piano);
  // a little sparkle in the gold
  for (let i = 0; i < 30; i++) {
    const x = r.int(FRAME.left, FRAME.right);
    const y = r.int(FRAME.top, OPEN.floor);
    if (inRounded(x, y, FRAME, OPEN.floor + 8) && !inRounded(x, y, OPEN, OPEN.floor)) c.px(x, y, PAL.goldHi);
  }
  return c;
}
const LAMPS = [120, 146, 174, 200];

// ---- 2. lights.png — the lamps' glow, soft beams, the spotlight on her (pulse) ----------
function drawLights() {
  const c = new Canvas(W, H);
  for (const x of LAMPS) {
    // a soft dithered beam down to the stage
    for (let y = 40; y < OPEN.floor; y++) {
      const t = (y - 40) / (OPEN.floor - 40);
      const half = 2 + t * 10;
      const aim = x + (SINGER.x - x) * t * 0.6;
      for (let xx = Math.floor(aim - half); xx <= aim + half; xx++) if ((xx + y) % 2 === 0) c.px(xx, y, PAL.lampGlow, 0.09);
    }
    c.glow(x, 38, 9, PAL.lampGlow, 0.55);
    c.rect(x - 2, 38, 4, 2, PAL.lamp);
  }
  softEllipse(c, SINGER.x, SINGER.feet, 22, 3, PAL.lampGlow, 0.5);
  softEllipse(c, SINGER.x, SINGER.feet - 8, 10, 12, PAL.lampGlow, 0.18);
  return c;
}

// ---- 3. laufey.png — her at the mic in a cream dress (sway) -------------------------------
function drawSinger() {
  const c = new Canvas(W, H);
  const { x, feet } = SINGER;
  // mic stand + mic
  c.line(x - 4, feet, x - 4, feet - 13, PAL.micStand);
  c.rect(x - 6, feet, 5, 1, PAL.micStand);
  c.line(x - 4, feet - 13, x - 2, feet - 14, PAL.micStand);
  // long cream dress, flaring to the floor
  for (let y = feet - 11; y <= feet; y++) {
    const half = 1 + Math.round(((y - (feet - 11)) / 11) * 3);
    c.rect(x - half, y, half * 2 + 1, 1, PAL.singerDress);
    c.px(x + half, y, PAL.singerDressShade);
  }
  // arms up to the mic
  c.line(x - 1, feet - 10, x - 2, feet - 13, PAL.singerSkin);
  // head, brown hair down her back, a bow
  c.rect(x - 1, feet - 13, 3, 2, PAL.singerSkin);
  c.circle(x, feet - 15, 2, PAL.singerHair);
  c.rect(x - 1, feet - 15, 2, 2, PAL.singerSkin);
  c.rect(x + 1, feet - 15, 2, 5, PAL.singerHair);
  c.px(x + 2, feet - 18, PAL.singerDress); // the bow
  c.px(x + 3, feet - 17, PAL.singerDress);
  c.px(x + 1, feet - 17, PAL.singerDress);
  c.outline(PAL.outline);
  return c;
}

// ---- 4. notes.png — music notes floating up from the stage (frames) --------------------------
const NOTE_FRAMES = 16;
const NOTES = {
  single: ['..##', '..#.', '..#.', '###.', '##..'],
  pair: ['.####', '.#..#', '.#..#', '##.##', '##.##'],
};

function drawNotes() {
  const sheet = new Canvas(W * NOTE_FRAMES, H);
  const r = rng(831);
  const notes = Array.from({ length: 5 }, (_, i) => ({
    x: SINGER.x + r.int(-40, 40),
    phase: i / 5,
    shape: i % 2 ? NOTES.pair : NOTES.single,
    col: i % 2 ? PAL.noteB : PAL.noteA,
  }));
  for (let f = 0; f < NOTE_FRAMES; f++) {
    const c = new Canvas(W, H);
    for (const n of notes) {
      const t = (f / NOTE_FRAMES + n.phase) % 1;
      const x = Math.round(n.x + Math.sin(t * PI * 2) * 4);
      const y = Math.round(80 - t * 44);
      const a = Math.min(1, Math.sin(t * PI) * 1.8);
      n.shape.forEach((row, ry) => [...row].forEach((ch, rx) => ch === '#' && c.px(x + rx, y + ry, n.col, a)));
    }
    sheet.blit(c, f * W, 0);
  }
  return sheet;
}

// ---- 5 + 6. crowd.png + phones.png — heads in the stalls, phone screens (twinkle) ---------
function drawCrowd() {
  const crowd = new Canvas(W, H);
  const phones = new Canvas(W, H);
  const r = rng(841);
  for (const [rowY, size] of [[101, 3], [108, 3.6], [115, 4.2], [122, 4.8]]) {
    for (let x = r.int(-4, 4); x < W + 6; x += size * 2.4 + r.int(0, 3)) {
      const y = rowY + r.int(-1, 1);
      crowd.circle(x, y, size, PAL.crowd);
      crowd.rect(x - size - 1, y + 2, size * 2 + 3, 8, PAL.crowd); // shoulders
      if (r() < 0.05) {
        // someone filming
        const px = x + r.int(-2, 2);
        crowd.line(px + 1, y - 1, px + 1, y - 5, PAL.crowd);
        phones.rect(px, y - 8, 2, 3, PAL.phone);
      }
    }
  }
  rimLight(crowd, PAL.crowdRim, 1);
  return { crowd, phones };
}

// ---- 7. balcony.png — the red velvet balcony ledge with its brass rail ------------------------
function drawBalcony() {
  const c = new Canvas(W, H);
  c.rect(0, LEDGE_TOP, W, H - LEDGE_TOP, PAL.velvet);
  c.rect(0, LEDGE_TOP, W, 2, PAL.velvetHi);
  c.rect(0, LEDGE_TOP + 9, W, 2, PAL.velvetShade);
  for (let y = LEDGE_TOP + 2; y < H; y++)
    for (let x = 0; x < W; x++) if ((x * 3 + y * 7) % 29 === 0) c.px(x, y, PAL.velvetHi, 0.5); // worn velvet
  c.rect(0, LEDGE_TOP - 2, W, 1, PAL.brass);
  for (let x = 6; x < W; x += 40) c.rect(x, LEDGE_TOP - 3, 2, 3, PAL.brass);
  return c;
}

// ---- 8. us.png — the two of us from behind, crowns on, swaying a little (frames) ---------------
const US_HER = { x: 106, y: 106, r: 10.5 }; // centre of her head
const US_HIM = { x: 140, y: 100, r: 10 };

/** A paper crown wrapping the top of a head: a band with zig-zag points and decorations. */
function crown(c, cx, top, w, base, shade, decos) {
  const left = Math.round(cx - w / 2);
  const points = 5;
  for (let x = 0; x < w; x++) {
    const t = (x / (w - 1)) * points;
    const tip = Math.round(Math.abs((t % 1) - 0.5) * 2 * 4); // 0 at a point, 4 between
    const curve = Math.round(Math.abs(x - (w - 1) / 2) / ((w - 1) / 2) * 1.5); // the band curves round the head
    for (let y = top + tip + curve; y < top + 9 + curve; y++) c.px(left + x, y, y >= top + 7 + curve ? shade : base);
  }
  decos.forEach(([dx, dy, col]) => c.px(left + dx, top + dy, col));
}

function herFromBehind(c, dx) {
  const s = PAL;
  const { x, y, r } = US_HER;
  // leather jacket shoulders, with shine
  c.ellipse(x, y + 26, 16, 11, s.leather);
  c.rect(x - 16, y + 26, 33, H - y - 26, s.leather);
  c.line(x - 11, y + 18, x - 6, y + 40, s.leatherHi);
  c.line(x + 11, y + 18, x + 8, y + 40, s.leatherHi);
  c.px(x - 10, y + 18, s.leatherShine);
  c.px(x + 10, y + 18, s.leatherShine);
  c.rect(x - 5, y + 14, 11, 3, s.leatherHi); // collar
  // a little neck under the bob
  const hx = x + dx;
  c.rect(hx - 2, y + 8, 5, 8, s.herSkin);
  // the bob from behind: round on top, full to the jaw, curving under
  c.circle(hx, y, r, s.herHair);
  c.ellipse(hx, y + 3, r, r - 2, s.herHair);
  c.rect(hx - 7, y + r - 1, 15, 1, s.herHairShade);
  for (const [px, py] of [[-5, -2], [-3, 1], [4, -1], [6, 3], [-7, 5]]) c.px(hx + px, y + py, s.herHairHi);
  for (const i of [-4, 3]) c.line(hx + i, y + 3, hx + i + 1, y + r - 2, s.herHairShade); // a couple of strands
  // her pink paper crown
  crown(c, hx, y - r - 3, 2 * Math.ceil(r) + 1, s.crownPink, s.crownPinkShade,
    [[3, 6, s.crownWhite], [8, 7, s.crownWhite], [13, 7, s.crownWhite], [18, 6, s.crownWhite], [5, 3, s.crownWhite], [15, 3, s.crownDeco], [10, 4, s.crownDeco]]);
}

function himFromBehind(c, dx) {
  const s = PAL;
  const { x, y, r } = US_HIM;
  // dark jacket shoulders
  c.ellipse(x, y + 27, 18, 12, s.himJacket);
  c.rect(x - 18, y + 27, 37, H - y - 27, s.himJacket);
  c.line(x - 13, y + 19, x - 8, y + 42, s.himJacketHi);
  c.line(x + 13, y + 19, x + 9, y + 42, s.himJacketHi);
  c.rect(x - 6, y + 14, 13, 3, s.himJacketHi); // collar
  // neck (his hair is short, so it shows)
  const hx = x + dx;
  c.rect(hx - 3, y + 6, 7, 10, s.himSkin);
  c.rect(hx - 3, y + 13, 7, 1, s.himSkinShade);
  // head from behind: short dark hair, ears either side
  c.circle(hx, y, r, s.himHair);
  c.rect(hx - r - 1, y - 1, 2, 5, s.himSkin);
  c.rect(hx + r, y - 1, 2, 5, s.himSkin);
  c.px(hx - r, y + 1, s.himSkinShade);
  c.px(hx + r, y + 1, s.himSkinShade);
  c.rect(hx - 6, y + r - 2, 13, 1, s.himHair); // hairline at the nape
  for (const [px, py] of [[-3, -5], [0, -6], [4, -4], [-6, -1], [2, 2], [6, 1]]) c.px(hx + px, y + py, s.himHairHi);
  // his blue paper crown
  crown(c, hx, y - r - 3, 2 * Math.ceil(r) + 1, s.crownBlue, s.crownBlueShade,
    [[3, 6, s.crownDeco], [8, 7, s.crownWhite], [13, 7, s.crownDeco], [18, 6, s.crownWhite], [6, 3, s.crownWhite], [15, 4, s.crownDeco], [10, 3, s.crownWhite]]);
}

function drawUs() {
  // swaying to the music: our heads lean a pixel in turn
  const HER_DX = [0, 0, 1, 1, 1, 0, 0, 0];
  const HIM_DX = [0, 0, 0, 0, -1, -1, 0, 0];
  const sheet = new Canvas(W * 8, H);
  for (let f = 0; f < 8; f++) {
    const him = new Canvas(W, H);
    himFromBehind(him, HIM_DX[f]);
    rimLight(him, PAL.lampGlow, 0.3);
    him.outline(PAL.outline);
    const her = new Canvas(W, H);
    herFromBehind(her, HER_DX[f]);
    rimLight(her, PAL.lampGlow, 0.3);
    her.outline(PAL.outline);
    const frame = new Canvas(W, H);
    frame.blit(him, 0, 0);
    frame.blit(her, 0, 0);
    sheet.blit(frame, f * W, 0);
  }
  return sheet;
}

// ---- 9. seats.png — the backs of our row of red velvet seats, right behind us ---------------
const SEAT = { top: 128, w: 31, step: 34 }; // one seat each under her (x 106) and him (x 140)

function drawSeats() {
  const c = new Canvas(W, H);
  c.rect(0, SEAT.top + 6, W, H - SEAT.top - 6, PAL.seatGap); // the dark gaps between the seats
  for (let cx = US_HER.x - SEAT.step * 4; cx < W + SEAT.w; cx += SEAT.step) {
    const left = cx - Math.floor(SEAT.w / 2);
    const shape = { left, right: left + SEAT.w - 1, top: SEAT.top, r: 7 };
    for (let y = SEAT.top; y < H; y++)
      for (let x = left; x < left + SEAT.w; x++) {
        if (!inRounded(x, y, shape, H)) continue;
        const fromEdge = Math.min(x - left, left + SEAT.w - 1 - x);
        c.px(x, y, fromEdge < 2 ? PAL.seatShade : y - SEAT.top < 3 ? PAL.seatHi : PAL.seat);
      }
    for (const sx of [left + 10, left + 20]) c.line(sx, SEAT.top + 9, sx, H, PAL.seatShade); // tufted seams
    c.rect(cx - 2, SEAT.top + 4, 5, 2, PAL.brass); // seat number plate
  }
  rimLight(c, PAL.lampGlow, 0.25);
  return c;
}

// ---- 10. vignette.png ------------------------------------------------------------------------
function drawVignette() {
  const c = new Canvas(W, H);
  const levels = [0, 0.2, 0.4, 0.6, 0.78];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 160) / 175, (y - 80) / 118);
      const t = Math.max(0, Math.min(1, (d - 0.55) / 0.45));
      const lv = t * 4;
      const i = Math.min(4, Math.floor(lv) + (lv % 1 > bayer(x, y) ? 1 : 0));
      if (i) c.px(x, y, PAL.vignette, levels[i]);
    }
  return c;
}

// ---- The Palais Theatre for the map: palais.png (10 x 7 tiles) ------------------------------
const PALAIS = { cols: 10, rows: 7, at: { x: 19, y: 12 } }; // opposite San Remo, across the pub path

function drawPalais() {
  const c = new Canvas(PALAIS.cols * 16, PALAIS.rows * 16);
  const w = c.width;
  const s = PAL;
  // twin towers, each with a tall amber window strip and a red pennant on top
  for (const tx of [0, w - 28]) {
    c.rect(tx, 8, 28, 80, s.facade);
    c.rect(tx + 22, 8, 6, 80, s.facadeShade);
    c.rect(tx + 4, 5, 20, 4, s.facadeLight);
    c.rect(tx + 9, 3, 10, 2, s.facade);
    c.rect(tx + 13, 0, 1, 3, s.edge); // flagpole
    for (let y = 0; y < 3; y++) c.rect(tx + 14, y, 4 - y, 1, s.pennant); // red pennant
    c.rect(tx + 10, 14, 7, 58, s.window);
    c.rect(tx + 11, 14, 1, 58, s.windowHi);
    for (let y = 20; y < 72; y += 7) c.rect(tx + 10, y, 7, 1, s.windowBar);
  }
  // the central block: stepped top, the red lettering on a dark band
  c.rect(28, 12, w - 56, 76, s.facade);
  c.rect(44, 8, w - 88, 5, s.facadeLight);
  c.rect(30, 13, w - 60, 9, s.signBand);
  const tw = miniWidth(SIGN_TEXT);
  const tx = Math.round(w / 2 - tw / 2);
  miniText(c, SIGN_TEXT, tx + 1, 15, s.neonGlow, 0.5); // a soft neon halo
  miniText(c, SIGN_TEXT, tx, 15, s.neon);
  // tall amber windows across the middle
  for (let x = 38; x < w - 40; x += 12) {
    c.rect(x, 26, 6, 32, s.window);
    c.rect(x + 1, 26, 1, 32, s.windowHi);
    for (let y = 31; y < 58; y += 6) c.rect(x, y, 6, 1, s.windowBar);
  }
  // three glowing purple arches over a dark balcony band
  c.rect(28, 58, w - 56, 16, s.signBand);
  for (const ax of [56, 80, 104]) {
    for (let y = 61; y <= 72; y++)
      for (let x = ax - 11; x <= ax + 11; x++) {
        const d = Math.hypot(x - ax, y - 72);
        if (d > 11) continue;
        c.px(x, y, d > 9 ? s.archHi : y > 69 ? s.archDark : s.arch);
      }
  }
  c.rect(28, 72, w - 56, 2, s.signBand);
  // the canopy over the entrance, a small sign plate, lights underneath
  c.rect(0, 74, w, 8, s.canopy);
  c.rect(0, 74, w, 1, s.facadeLight);
  c.rect(0, 81, w, 1, s.canopyShade);
  c.rect(62, 75, 36, 6, s.facadeLight);
  miniText(c, 'PALAIS', 80 - Math.ceil(miniWidth('PALAIS') / 2), 75, s.neon);
  // the lobby under the canopy: lit doors, posters either side
  c.rect(0, 82, w, 28, s.lobby);
  for (let x = 4; x < w; x += 9) c.px(x, 83, s.windowHi);
  for (const dx of [50, 62, 86, 98]) {
    c.rect(dx, 88, 10, 22, s.door);
    c.rect(dx, 88, 10, 2, s.windowHi);
    c.rect(dx + 4, 92, 1, 14, s.windowBar);
  }
  c.rect(74, 88, 12, 22, s.lobby);
  for (const [px, col] of [[10, s.poster1], [24, s.poster2], [126, s.poster2], [140, s.poster1]]) {
    c.rect(px, 88, 9, 14, col);
    c.rect(px + 2, 91, 5, 1, s.facadeLight);
  }
  // step + edges
  c.rect(0, 110, w, 2, s.step);
  for (let y = 8; y < 110; y++) {
    c.px(0, y, s.edge);
    c.px(w - 1, y, s.edge);
  }
  return c;
}

// ---- Add the building + trigger to maps/world.json (first time only) ----------------------------
function addToMap() {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (map.tilesets.some((t) => t.name === 'palais')) {
    console.log('  map      already has the Palais — left untouched');
    return;
  }
  const { cols, rows, at } = PALAIS;
  stampBuilding(map, { name: 'palais', image: '../public/assets/tiles/palais.png', cols, rows, at });
  const layer = (name) => map.layers.find((l) => l.name === name);
  const set = (name, x, y, gid) => (layer(name).data[y * map.width + x] = gid);
  // clear the little fence that ran behind the building
  for (let x = at.x; x < at.x + cols; x++) set('Decor', x, at.y - 1, 0);
  // a short path from the main path up to the doors (cosy tile 4 = path, gid 5)
  const doorY = at.y + rows;
  for (let x = at.x + 3; x <= at.x + 6; x++) set('Ground', x, doorY, 5);
  // a street lamp either side of that path
  placeLamp(map, at.x + 2, doorY);
  placeLamp(map, at.x + 7, doorY);
  // trigger right in front of the doors
  layer('Triggers').objects.push({
    id: map.nextobjectid++,
    name: 'palais doors',
    type: '',
    x: (at.x + 4) * 16,
    y: doorY * 16,
    width: 32,
    height: 16,
    rotation: 0,
    visible: true,
    properties: [{ name: 'memoryId', type: 'string', value: 'laufey-concert' }],
  });
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  console.log(`  map      added the Palais at tiles x ${at.x}–${at.x + cols - 1}, y ${at.y}–${doorY - 1} + trigger`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Drawing the Laufey concert…');
const { crowd, phones } = drawCrowd();
const layers = {
  hall: drawHall(),
  lights: drawLights(),
  laufey: drawSinger(),
  notes: drawNotes(),
  crowd,
  phones,
  balcony: drawBalcony(),
  us: drawUs(),
  seats: drawSeats(),
  vignette: drawVignette(),
};
for (const [name, canvas] of Object.entries(layers)) save(path.join(OUT, `${name}.png`), canvas);
const palais = drawPalais();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'palais.png'), palais);
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
writePreview('laufey-concert.png', flat);
const palaisPreview = new Canvas(palais.width + 32, palais.height + 32);
palaisPreview.rect(0, 0, palaisPreview.width, palaisPreview.height, '#8cc269');
palaisPreview.rect(16 + 48, palais.height + 16, 64, 16, '#dcc08a');
palaisPreview.blit(palais, 16, 16);
writePreview('palais.png', palaisPreview);
console.log('  preview  tools/previews/laufey-concert.png, tools/previews/palais.png');
