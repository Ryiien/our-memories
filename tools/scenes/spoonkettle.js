#!/usr/bin/env node
// -----------------------------------------------------------------------------
// spoonkettle.js — draws Spoonkettle, the cat who sits on the grass just above
// San Remo, and puts him on the map.
//
// He's a spotted tabby (like an Egyptian Mau): silvery grey with dark spots
// and stripes, pale grey cheeks, chest and legs, yellow eyes, a pink nose, and
// a blue collar with a little gold tag. He sits side-on, looking back over his
// shoulder at her, his tail curled round on the ground.
//
//   npm run scene:spoonkettle
//
// Tweak colours in PAL or the pixels in the frames below, and re-run. Outputs:
//   public/assets/sprites/spoonkettle.png   5 frames of 18x18 (the 16x16 drawings in FRAMES + his shadow)
//   maps/world.json                         his point on the "Critters" layer (replaced each run)
//   tools/previews/spoonkettle.png          the frames side by side, on grass (6x size)
// His name, what he says and his animation are in data/critters.json.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas } from '../lib/canvas.js';
import { ROOT, makeSaver, upscale } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  o: '#46414e', // outline (soft, so he sits in the grass rather than on top of it)
  g: '#9c9ba0', // silver-grey fur
  G: '#c9c6c2', // light fur (top of the head, the back catching the light)
  d: '#45404c', // dark spots and stripes
  t: '#b8b6b8', // pale grey (cheeks, chest, legs)
  T: '#d9d7d6', // paler grey
  w: '#efe7dc', // white muzzle and chin
  e: '#f2d14a', // yellow eyes
  n: '#d9897e', // pink nose
  m: '#8a3a4a', // inside of his mouth (meowing)
  r: '#3f6fc4', // blue collar
  k: '#e8c04a', // the gold tag on his collar
  p: '#d99a9a', // pink inside his ears
};
// Grounding him in the grass: a soft shadow underneath, and a few tufts of
// grass (the same shape and colours as the grass tiles' tufts) in front of his
// paws and tail.
const GRASS = { shadow: '#234538', shadowAlpha: 0.3, tuft: '#4f8a50', tuftHi: '#6fae5f' };
const TUFTS = [[4, 16], [10, 16], [15, 16]]; // where each tuft's base pixel goes (in the 18x18 frame)

// ---- The frames (16x16 each; his feet sit on the bottom row) ------------------------
// 0 = sitting, 1 = tail tip flicked up, 2 = blinking, 3 = ears twitched,
// 4 = meowing (mouth open, head up a little). data/critters.json says which
// frames loop while he's idle ("idle") and which one shows while he talks ("sayFrame").
const SIT = [
  '................', // 0
  '.o.....o........', // 1  ear tips
  'opo...opo.......', // 2
  'oGgoooggo.......', // 3  top of his head
  'oGdGdGdgo.......', // 4  the "M" stripes on his forehead
  'ogedgdego.......', // 5  yellow eyes
  'otgwnwgto.......', // 6  pale cheeks, pink nose
  '.otwwwto.ooo....', // 7  white chin; the top of his back starts behind
  '..orrkroGGgoo...', // 8  blue collar and its gold tag
  '..ogtkgogGdggo..', // 9
  '..otgggodggdgo..', // 10
  '..otgdtoggggdgo.', // 11
  '..otTgtogdggggo.', // 12 front legs (pale grey), his round haunch behind
  '..otTdtoggdggdo.', // 13
  '..oTTtTodgdgddoo', // 14 the ringed tail curls round in front...
  '..owwowwoddgddgo', // 15 ...past his white paws
];

const FRAMES = [
  SIT,
  // tail tip flicked up
  patch(SIT, { 12: '..otTgtogdggggoo', 13: '..otTdtoggdggdod', 14: '..oTTtTodgdgddod', 15: '..owwowwoddgddoo' }),
  // blink
  patch(SIT, { 5: 'ogdogodgo.......' }),
  // ears twitch (the near ear flicks back)
  patch(SIT, { 1: '.......o........', 2: '.o....opo.......', 3: 'oogoooggo.......' }),
  // meow: chin up, mouth open
  patch(SIT, {
    6: 'otgwnwgto.......',
    7: '.otmmmto.ooo....',
    8: '..owmwroGGgoo...',
  }),
];

/** A copy of a frame with some rows replaced (rows are trimmed/padded to 16). */
function patch(rows, changes) {
  return rows.map((row, y) => (changes[y] ?? row).slice(0, 16).padEnd(16, '.'));
}

// ---- Where he sits on the map ---------------------------------------------------------
// A point on the "Critters" layer, named by his id in data/critters.json. The
// point is where his feet are: tile x 51, y 4 — in the secret grove, on the
// grass between the All Nations bench and the tree beside the nook (x 52–53).
const SPOT = { id: 'spoonkettle', x: 51, y: 4 };

// ---- Run --------------------------------------------------------------------------------------
// Each frame of the sheet is 18x18: the 16x16 drawing sits 1px in from the
// left, with a 1px margin either side and 2px below for his shadow on the grass.
// (frameWidth / frameHeight in data/critters.json must match.)
const W = 18;
const PAD = { x: 1, bottom: 2 };
const save = makeSaver();
console.log('Drawing Spoonkettle…');

const sheet = new Canvas(W * FRAMES.length, W);
FRAMES.forEach((rows, f) => {
  const x0 = f * W;
  sheet.ellipse(x0 + 9.5, 16, 8, 1.6, GRASS.shadow, GRASS.shadowAlpha); // shadow, behind him
  sheet.map(rows.map((r) => r.slice(0, 16)), PAL, x0 + PAD.x, 0);
  for (const [x, y] of TUFTS) {
    sheet.px(x0 + x, y, GRASS.tuft);
    sheet.px(x0 + x - 1, y - 1, GRASS.tuftHi);
    sheet.px(x0 + x + 1, y - 1, GRASS.tuftHi);
  }
});
save(path.join(ROOT, 'public', 'assets', 'sprites', 'spoonkettle.png'), sheet);

// his point on the map's Critters layer (replacing any old one with the same name)
const file = path.join(ROOT, 'maps', 'world.json');
const map = JSON.parse(fs.readFileSync(file, 'utf8'));
let layer = map.layers.find((l) => l.name === 'Critters');
if (!layer) {
  layer = {
    id: map.nextlayerid++, name: 'Critters', type: 'objectgroup', draworder: 'topdown',
    opacity: 1, visible: true, x: 0, y: 0, objects: [],
  };
  const at = map.layers.findIndex((l) => l.name === 'Momos'); // keep it next to the momos in Tiled
  map.layers.splice(at === -1 ? map.layers.length : at + 1, 0, layer);
}
layer.objects = layer.objects.filter((o) => o.name !== SPOT.id);
layer.objects.push({
  id: map.nextobjectid++, name: SPOT.id, type: '', point: true, visible: true, rotation: 0,
  x: SPOT.x * 16 + 8, y: SPOT.y * 16 + 13 + PAD.bottom, width: 0, height: 0, // (the sheet's bottom edge, below his paws)
});
fs.writeFileSync(file, JSON.stringify(map, null, 1));
console.log(`  map      "${SPOT.id}" on the Critters layer at tile ${SPOT.x},${SPOT.y}`);

// preview: every frame on a patch of grass
const preview = new Canvas(FRAMES.length * (W + 4) + 4, W + 8);
preview.rect(0, 0, preview.width, preview.height, '#8cc269');
FRAMES.forEach((_, f) => preview.blit(sheetFrame(f), 4 + f * (W + 4), 4));
fs.mkdirSync(path.join(ROOT, 'tools', 'previews'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'previews', 'spoonkettle.png'), upscale(preview, 6).toPNG());
console.log('  preview  tools/previews/spoonkettle.png');

function sheetFrame(f) {
  const c = new Canvas(W, W);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = sheet.get(f * W + x, y);
      if (a) c.px(x, y, [r, g, b], a / 255);
    }
  return c;
}
