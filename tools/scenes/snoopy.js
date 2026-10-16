#!/usr/bin/env node
// -----------------------------------------------------------------------------
// snoopy.js — draws Snoopy and his kennel
// and puts them on the map, in the clearing west of the botanic garden,
// between the trees at (40,29), (44,33) and (38,35).
//
// Snoopy is a critter (data/critters.json): he stands just left of his kennel
// and says something when she presses E next to him. The kennel is its own
// little tileset: the roof in Above, so she can walk behind
// it like a tree's canopy; the walls and door in Decor, solid.
//
//   npm run scene:snoopy
//
// Tweak colours in PAL or the pixels below, and re-run. Outputs:
//   public/assets/sprites/snoopy.png   3 frames of 19x26 (the 17x24 drawing + his shadow)
//   public/assets/tiles/kennel.png     the kennel, 2x2 tiles
//   maps/world.json                    the kennel (moved to KENNEL) + Snoopy's point on the Critters layer (replaced each run)
//   tools/previews/snoopy.png          Snoopy's frames + the kennel, on grass (6x size)
// His name, what he says and his animation are in data/critters.json.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas } from '../lib/canvas.js';
import { ROOT, makeSaver, upscale, addTileset } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  k: '#2e2a33', // outline, his ear (near-black)
  w: '#fbf8f0', // white
  r: '#b8332e', // red collar
  // the kennel (as in the Peanuts pixel art: a big red roof over white walls)
  roof: '#cf6150',
  roofShade: '#b04f42',
  roofLine: '#8a3a32', // the dashed lines between the roof boards
  eave: '#9c4438',
  wall: '#f4f0e8',
  wallShade: '#d8d2cc',
  wallLine: '#7d7684', // the dashed lines between the wall boards
};
const GRASS = { shadow: '#234538', shadowAlpha: 0.3 };

// ---- Snoopy (17x24, from the reference pixel art; facing left) ----------------------
const STAND = [
  '........kkkkk....',
  '.......kwwwwwk...',
  '......kwwwwwwwk..',
  '...kkkwwwwwwwwwk.',
  '..kwwwwkwwwwkwkk.',
  'kkwwwwwkwwwkwkkwk',
  'kkwwwwwwwwwkwkkkk',
  '.kwwwwwwwwwkwkkkk',
  '..kwwwwwwwwkwkkkk',
  '...kkwwwwwwkwkkkk',
  '.....kkkwwk.kwkk.',
  '.......rrr...kk..',
  '......kwwwk......',
  '.....kwwkwk......',
  '.....kwwkwk......',
  '....kwwwkwwk.....',
  '....kwwwkwwk.....',
  '....kwwwwkk......',
  '.....kwwwwkk.....',
  '......kwwwwwk....',
  '.......kwkkk.....',
  '.....kkwwwk......',
  '....kwwwwwwk.....',
  '....kkkkkkkk.....',
];

// 0 = standing, 1 = blinking, 2 = eye shut, happy (while he talks; the same as a blink for now).
// data/critters.json says which frames loop while he's idle ("idle") and which
// one shows while he talks ("sayFrame").
const BLINK = patch(STAND, { 4: '..kwwwwwwwwwkwkk.', 5: 'kkwwwwwkkwwkwkkwk' }); // eye shut: a 2px line
const FRAMES = [
  { rows: STAND, lift: 0 },
  { rows: BLINK, lift: 0 },
  { rows: BLINK, lift: 0 },
];

/** A copy of a drawing with some rows replaced. */
function patch(rows, changes) {
  return rows.map((row, y) => changes[y] ?? row);
}

// ---- The kennel (32x32 = 2x2 tiles) ------------------------------------------------------
function drawKennel() {
  // Seen from the side, like the Peanuts pixel art: a big red roof with a
  // rounded ridge and dashed lines between its boards, flaring out to dark
  // eaves, over narrower white walls with dashed board lines. Black outline.
  const c = new Canvas(32, 32);
  const s = PAL;
  const dashes = (y, x0, x1, color, on, period, shift) => {
    for (let x = x0; x <= x1; x++) if ((x + shift) % period < on) c.px(x, y, color);
  };
  // the walls
  const wall = { top: 20, bottom: 30, left: 7, right: 24 };
  c.rect(wall.left, wall.top, wall.right - wall.left + 1, wall.bottom - wall.top + 1, s.wall);
  c.rect(wall.right - 1, wall.top, 2, wall.bottom - wall.top + 1, s.wallShade);
  dashes(23, wall.left + 2, wall.right - 2, s.wallLine, 3, 5, 0);
  dashes(27, wall.left + 2, wall.right - 2, s.wallLine, 3, 5, 3);
  // the roof: a flat ridge with rounded corners, straight sides sloping out to the eaves
  const roofTop = 7;
  const halfAt = (y) => (y === roofTop ? 8 : Math.floor(9 + (y - roofTop - 1) * 0.5));
  for (let y = roofTop; y <= 17; y++) {
    const half = halfAt(y);
    c.rect(16 - half, y, half * 2, 1, s.roof);
    c.rect(16 + half - 2, y, 2, 1, s.roofShade);
  }
  dashes(11, 16 - halfAt(11) + 1, 16 + halfAt(11) - 2, s.roofLine, 5, 7, 2);
  dashes(15, 16 - halfAt(15) + 1, 16 + halfAt(15) - 2, s.roofLine, 5, 7, 5);
  // the eaves, sticking out past the walls
  c.rect(1, 18, 30, 2, s.eave);
  c.rect(1, 18, 30, 1, s.roofShade);
  c.outline(PAL.k);
  // all of it on a soft shadow on the grass
  const out = new Canvas(32, 32);
  out.ellipse(16, 30, 14, 2, GRASS.shadow, GRASS.shadowAlpha);
  out.blit(c, 0, 0);
  return out;
}

// ---- Where they go on the map ----------------------------------------------------------
// The kennel's top-left tile; its top row (roof) goes in Above
// (walkable, she shows behind it), its bottom row (walls) in Decor (solid).
// Near the bottom of the clearing, between the trees at x 38 and x 46.
const KENNEL = { x: 42, y: 37 };
// Snoopy's point on the "Critters" layer, named by his id in data/critters.json:
// his feet, just left of the kennel (in pixels).
const SPOT = { id: 'snoopy', x: KENNEL.x * 16 - 9, y: (KENNEL.y + 1) * 16 + 14 };

// ---- Run --------------------------------------------------------------------------------------
// Each frame of Snoopy's sheet is 19x26: the 17x24 drawing 1px in from the left,
// with 2px below for his shadow. (frameWidth / frameHeight in data/critters.json must match.)
const FW = 19;
const FH = 26;
const PAD = { x: 1, bottom: 2 };
const save = makeSaver();
console.log('Drawing Snoopy and his kennel…');

const sheet = new Canvas(FW * FRAMES.length, FH);
FRAMES.forEach(({ rows, lift }, f) => {
  const x0 = f * FW;
  sheet.ellipse(x0 + 9, FH - 3, 7, 1.6, GRASS.shadow, GRASS.shadowAlpha); // shadow, behind him
  sheet.map(rows, PAL, x0 + PAD.x, FH - PAD.bottom - rows.length - lift);
});
save(path.join(ROOT, 'public', 'assets', 'sprites', 'snoopy.png'), sheet);

const kennel = drawKennel();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'kennel.png'), kennel);

const file = path.join(ROOT, 'maps', 'world.json');
const map = JSON.parse(fs.readFileSync(file, 'utf8'));
const layer = (name) => map.layers.find((l) => l.name === name);

// the kennel: its tileset is added the first time; each run lifts the kennel
// from wherever it was and puts it at KENNEL (so moving it = change KENNEL, re-run)
const gid =
  map.tilesets.find((t) => t.name === 'kennel')?.firstgid ??
  addTileset(map, { name: 'kennel', image: '../public/assets/tiles/kennel.png', cols: 2, rows: 2, walkable: [0, 1] });
for (const name of ['Above', 'Decor']) {
  const data = layer(name).data;
  data.forEach((v, i) => {
    if (v >= gid && v < gid + 4) data[i] = 0;
  });
}
for (let tx = 0; tx < 2; tx++) {
  layer('Above').data[KENNEL.y * map.width + KENNEL.x + tx] = gid + tx;
  layer('Decor').data[(KENNEL.y + 1) * map.width + KENNEL.x + tx] = gid + 2 + tx;
}
console.log(`  map      kennel at tiles ${KENNEL.x}–${KENNEL.x + 1}, ${KENNEL.y}–${KENNEL.y + 1}`);

// Snoopy's point on the Critters layer (replacing any old one with the same name)
let critters = layer('Critters');
if (!critters) {
  critters = {
    id: map.nextlayerid++, name: 'Critters', type: 'objectgroup', draworder: 'topdown',
    opacity: 1, visible: true, x: 0, y: 0, objects: [],
  };
  const at = map.layers.findIndex((l) => l.name === 'Momos'); // keep it next to the momos in Tiled
  map.layers.splice(at === -1 ? map.layers.length : at + 1, 0, critters);
}
critters.objects = critters.objects.filter((o) => o.name !== SPOT.id);
critters.objects.push({
  id: map.nextobjectid++, name: SPOT.id, type: '', point: true, visible: true, rotation: 0,
  x: SPOT.x, y: SPOT.y, width: 0, height: 0, // (the sheet's bottom edge, below his feet)
});
fs.writeFileSync(file, JSON.stringify(map, null, 1));
console.log(`  map      "${SPOT.id}" on the Critters layer, left of the kennel`);

// preview: his frames, then the kennel with him beside it, on grass
const preview = new Canvas(FRAMES.length * (FW + 4) + 4 + 50, 40);
preview.rect(0, 0, preview.width, preview.height, '#8cc269');
FRAMES.forEach((_, f) => preview.blit(sheetFrame(f), 4 + f * (FW + 4), 40 - FH - 4));
const kx = FRAMES.length * (FW + 4) + 18;
preview.blit(kennel, kx, 40 - 32 - 4);
preview.blit(sheetFrame(0), kx - 17, 40 - FH - 4);
fs.mkdirSync(path.join(ROOT, 'tools', 'previews'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'previews', 'snoopy.png'), upscale(preview, 6).toPNG());
console.log('  preview  tools/previews/snoopy.png');

function sheetFrame(f) {
  const c = new Canvas(FW, FH);
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++) {
      const [r, g, b, a] = sheet.get(f * FW + x, y);
      if (a) c.px(x, y, [r, g, b], a / 255);
    }
  return c;
}
