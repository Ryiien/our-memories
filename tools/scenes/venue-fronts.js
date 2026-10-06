#!/usr/bin/env node
// -----------------------------------------------------------------------------
// venue-fronts.js — dresses up the fronts of the Palais Theatre and San Remo
// on the map: poster easels (pink and blue, like the posters on the Palais)
// and art-deco urns of flowers outside the Palais; a red carpet up to San
// Remo's doors, brass posts with a red velvet rope either side of it, and
// spiral topiaries in white stone urns.
//
//   npm run scene:venues        # redraws the props + puts them on the map (first time only)
//
// Run it after scene:laufey and scene:formal (it decorates their fronts).
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/tiles/venue-props.png   the props (one row of 16x16 tiles)
//   tools/previews/venue-fronts.png       the props in a row (3x size)
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

import { Canvas } from '../lib/canvas.js';
import { ROOT, makeSaver, softEllipse, writePreview, addTileset } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  shadow: '#8f9aa6',
  // poster easels: gold frames on dark stands
  gold: '#e8c45a',
  goldShade: '#b08a2a',
  easel: '#3a2a2a',
  posterPink: '#f08aa8',
  posterBlue: '#7a9ae0',
  posterInk: '#2e2440',
  posterCream: '#fff4dc',
  // art-deco urns (the Palais's cream), with flowers
  urn: '#efe0c2',
  urnShade: '#cdb994',
  urnHi: '#fff8e8',
  flowers: ['#f08aa8', '#f6d36a', '#ffffff', '#c78ae0'],
  leaves: ['#2f5a34', '#3f7a40', '#5a9a4c', '#7fbf5a'],
  // white stone urns for the topiaries
  stone: '#e8e6e2',
  stoneShade: '#b8b4b0',
  // the red carpet and the velvet rope
  carpet: '#b0303c',
  carpetShade: '#8a2430',
  carpetHi: '#c84450',
  brass: '#e0b048',
  brassShade: '#a87c24',
  rope: '#a3343e',
  ropeHi: '#c4505a',
};

// ---- Setup ------------------------------------------------------------------------
const T = 16;
const save = makeSaver();

// The props, in the order they sit in the image (one tile each).
const PROPS = ['poster-pink', 'poster-blue', 'urn', 'topiary', 'rope', 'carpet-l', 'carpet-r'];
const tileOf = Object.fromEntries(PROPS.map((name, i) => [name, i]));
const WALKABLE = ['carpet-l', 'carpet-r']; // she can walk up the carpet; everything else is solid

// Where they go (map tiles), all on the row in front of each building (y 19).
// The door paths stay clear: the Palais's x 22–25, San Remo's x 37–38 (the carpet).
const PLACES = [
  // the Palais Theatre (x 19–28, lamps at x 21 and 26)
  { prop: 'urn', x: 19, y: 19 },
  { prop: 'poster-pink', x: 20, y: 19 },
  { prop: 'poster-blue', x: 27, y: 19 },
  { prop: 'urn', x: 28, y: 19 },
  // San Remo (x 33–42, lamps at x 35 and 40)
  { prop: 'topiary', x: 34, y: 19 },
  { prop: 'rope', x: 36, y: 19 },
  { prop: 'carpet-l', x: 37, y: 19 },
  { prop: 'carpet-r', x: 38, y: 19 },
  { prop: 'rope', x: 39, y: 19 },
  { prop: 'topiary', x: 41, y: 19 },
];

// ---- The props ----------------------------------------------------------------------
const shadow = (c, cx, rx) => softEllipse(c, cx, 14, rx, 1.5, PAL.shadow, 0.5);

/** A gold-framed poster on a little easel; `art` draws what's on it. */
function poster(c, ox, paper, art) {
  const s = PAL;
  shadow(c, ox + 8, 5);
  c.rect(ox + 4, 11, 1, 4, s.easel); // legs
  c.rect(ox + 11, 11, 1, 4, s.easel);
  c.rect(ox + 7, 12, 2, 3, s.easel);
  c.rect(ox + 3, 0, 10, 13, s.gold);
  c.rect(ox + 12, 0, 1, 13, s.goldShade);
  c.rect(ox + 3, 12, 10, 1, s.goldShade);
  c.rect(ox + 4, 1, 8, 11, paper);
  art(c, ox);
}

function posterPink(c, ox) {
  poster(c, ox, PAL.posterPink, () => {
    const s = PAL;
    c.rect(ox + 5, 2, 6, 6, s.posterCream); // a spotlight...
    c.rect(ox + 7, 3, 2, 2, s.posterInk); // ...on a singer: head,
    c.rect(ox + 6, 5, 4, 3, s.posterInk); // shoulders and dress
    c.rect(ox + 5, 9, 6, 1, s.posterCream); // the name
    c.rect(ox + 6, 10, 4, 1, s.posterInk);
  });
}

function posterBlue(c, ox) {
  poster(c, ox, PAL.posterBlue, () => {
    const s = PAL;
    // a couple of music notes
    c.rect(ox + 6, 3, 1, 4, s.posterCream);
    c.rect(ox + 5, 6, 2, 1, s.posterCream);
    c.rect(ox + 9, 2, 1, 4, s.posterCream);
    c.rect(ox + 8, 5, 2, 1, s.posterCream);
    c.rect(ox + 6, 2, 4, 1, s.posterCream);
    c.rect(ox + 5, 9, 6, 1, s.posterCream);
    c.rect(ox + 6, 10, 4, 1, s.posterInk);
  });
}

function urn(c, ox) {
  const s = PAL;
  shadow(c, ox + 8, 5);
  // a stepped art-deco urn on a little plinth
  c.rect(ox + 5, 12, 6, 2, s.urnShade);
  c.rect(ox + 6, 10, 4, 2, s.urn);
  c.rect(ox + 4, 6, 8, 4, s.urn);
  c.rect(ox + 3, 6, 10, 1, s.urnHi);
  c.rect(ox + 11, 7, 1, 3, s.urnShade);
  c.rect(ox + 4, 8, 8, 1, s.urnShade); // its band
  // flowers spilling over the top
  c.circle(ox + 8, 4, 3.6, s.leaves[1]);
  c.px(ox + 5, 5, s.leaves[2]);
  c.px(ox + 10, 3, s.leaves[2]);
  for (const [x, y, i] of [[6, 3, 0], [9, 2, 1], [8, 5, 2], [11, 5, 0], [5, 2, 3], [10, 4, 2], [7, 1, 0]]) c.px(ox + x, y, s.flowers[i]);
}

function topiary(c, ox) {
  const s = PAL;
  shadow(c, ox + 8, 5);
  c.rect(ox + 5, 11, 6, 3, s.stone); // the urn
  c.rect(ox + 4, 10, 8, 1, s.stone);
  c.rect(ox + 10, 11, 1, 3, s.stoneShade);
  c.rect(ox + 6, 13, 4, 1, s.stoneShade);
  // a cone clipped into a spiral
  for (let y = 0; y < 10; y++) {
    const half = Math.round((y + 1) * 0.42);
    c.rect(ox + 8 - half, y, half * 2 + 1, 1, s.leaves[1]);
    c.px(ox + 8 - half, y, s.leaves[2]);
    c.px(ox + 8 + half, y, s.leaves[0]);
  }
  for (let y = 1; y < 10; y += 3) {
    const half = Math.round((y + 1) * 0.42);
    c.rect(ox + 8 - half, y, half * 2 + 1, 1, s.leaves[0]); // the spiral's grooves
    c.px(ox + 8 - half + 1, y - 1, s.leaves[3]);
  }
}

function rope(c, ox) {
  const s = PAL;
  shadow(c, ox + 8, 6);
  // two brass posts with a red velvet rope swagged between them
  for (const px of [ox + 2, ox + 12]) {
    c.rect(px, 3, 2, 10, s.brass);
    c.rect(px + 1, 3, 1, 10, s.brassShade);
    c.rect(px - 1, 2, 4, 2, s.brass); // knob
    c.rect(px - 1, 13, 4, 1, s.brassShade); // base
  }
  for (let x = ox + 4; x <= ox + 11; x++) {
    const sag = Math.round(Math.sin(((x - ox - 4) / 7) * Math.PI) * 3);
    c.px(x, 4 + sag, s.rope);
    c.px(x, 5 + sag, s.ropeHi);
  }
}

/** Half of the red carpet, its gold edge on the `side` (-1 left, 1 right). */
function carpet(c, ox, side) {
  const s = PAL;
  const x0 = side < 0 ? ox + 2 : ox;
  const x1 = side < 0 ? ox + 15 : ox + 13;
  c.rect(x0, 0, x1 - x0 + 1, T, s.carpet);
  for (let y = 0; y < T; y += 4) c.rect(x0, y, x1 - x0 + 1, 1, s.carpetShade, 0.35); // the pile
  const edge = side < 0 ? x0 : x1;
  c.rect(edge, 0, 1, T, s.gold);
  c.rect(edge - side, 0, 1, T, s.carpetHi);
}

const DRAW = {
  'poster-pink': posterPink,
  'poster-blue': posterBlue,
  urn,
  topiary,
  rope,
  'carpet-l': (c, ox) => carpet(c, ox, -1),
  'carpet-r': (c, ox) => carpet(c, ox, 1),
};

function drawProps() {
  const c = new Canvas(PROPS.length * T, T);
  PROPS.forEach((name, i) => DRAW[name](c, i * T));
  return c;
}

// ---- Put them on the map (first time only) ------------------------------------------------
function addToMap() {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (map.tilesets.some((t) => t.name === 'venue-props')) {
    console.log('  map      already has the Palais + San Remo props — left untouched');
    return;
  }
  const decor = map.layers.find((l) => l.name === 'Decor').data;
  const firstgid = addTileset(map, {
    name: 'venue-props', image: '../public/assets/tiles/venue-props.png', cols: PROPS.length, rows: 1,
    walkable: WALKABLE.map((name) => tileOf[name]),
  });
  for (const { prop, x, y } of PLACES) decor[y * map.width + x] = firstgid + tileOf[prop];
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  console.log(`  map      put ${PLACES.length} props in front of the Palais Theatre and San Remo`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Dressing up the Palais and San Remo…');
const props = drawProps();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'venue-props.png'), props);
addToMap();

const preview = new Canvas(PROPS.length * T + 2 * T, 2 * T);
preview.rect(0, 0, preview.width, preview.height, '#8cc269');
preview.blit(props, T, T / 2);
writePreview('venue-fronts.png', preview);
console.log('  preview  tools/previews/venue-fronts.png');
