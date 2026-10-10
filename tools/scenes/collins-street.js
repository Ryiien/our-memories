#!/usr/bin/env node
// -----------------------------------------------------------------------------
// collins-street.js — little things along the main strip (Collins Coffee
// House, the Oxford Scholar, RMIT) on the map: bay trees in planters and a
// high-tea chalkboard by the coffee house, a bistro table with red velvet
// chairs, a barrel table and a chalkboard by the pub, a bike rack and a bin by
// RMIT, plus plane trees and benches on the grass across the road.
//
//   npm run scene:street        # redraws the props + puts them on the map (first time only)
//
// Run it after scene:collins and scene:pub (it decorates their pavement).
// Tweak colours in PAL below and re-run. Outputs:
//   public/assets/tiles/street-props.png   the props (one row of 16x16 tiles)
//   public/assets/tiles/bush.png           a see-through bush, for the grass edge by the beach
//   tools/previews/collins-street.png      the props on a strip of pavement (3x size)
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

import { Canvas } from '../lib/canvas.js';
import { ROOT, makeSaver, ring, softEllipse, writePreview, addTileset } from '../lib/scene-kit.js';

// ---- Palette: change colours here -----------------------------------------------
const PAL = {
  shadow: '#8f9aa6',
  // bay trees, clipped into balls, in dark square planters
  leaves: ['#2f5a34', '#3f7a40', '#5a9a4c', '#7fbf5a'],
  stem: '#6a4a32',
  planter: '#3a3a44',
  planterHi: '#5a5a6a',
  // chalkboards in timber A-frames
  frame: '#8a5a38',
  frameShade: '#64402a',
  board: '#2e3a34',
  chalk: '#f4f1ea',
  chalkPink: '#f2a7c3',
  chalkGold: '#e8c45a',
  // the bistro table: marble top, black iron, red velvet cushions
  marble: '#f2eee8',
  marbleShade: '#cfc8c4',
  iron: '#2e2a30',
  ironHi: '#55505a',
  velvet: '#a3343e',
  velvetHi: '#c4505a',
  china: '#ffffff',
  cake: '#f2a7c3',
  // the pub's barrel table and a pint
  barrel: '#8a5a38',
  barrelHi: '#ab7a52',
  barrelShade: '#64402a',
  hoop: '#4a4450',
  beer: '#e8a838',
  foam: '#fff4dc',
  // bikes on a silver rack (one RMIT red)
  rack: '#c8ccd6',
  rackShade: '#8a8e9a',
  tyre: '#2a2730',
  bikeRed: '#e60028',
  bikeBlue: '#3a6ab4',
  seat: '#2a2730',
  // a city bin
  bin: '#3a3d44',
  binHi: '#54585f',
  binLid: '#8a8e9a',
};

// ---- Setup ------------------------------------------------------------------------
const T = 16;
const save = makeSaver();

// The props, in the order they sit in the image. `w` = how many tiles wide.
const PROPS = [
  { name: 'bay-tree', w: 1 },
  { name: 'tea-board', w: 1 },
  { name: 'bistro', w: 2 },
  { name: 'barrel', w: 1 },
  { name: 'pub-board', w: 1 },
  { name: 'bikes', w: 2 },
  { name: 'bin', w: 1 },
];
const tileOf = {}; // name -> its first tile id in the image
PROPS.reduce((n, p) => ((tileOf[p.name] = n), n + p.w), 0);
const SHEET_COLS = PROPS.reduce((n, p) => n + p.w, 0);

// Where they go (map tiles). Doors stay clear: Collins x 22–23, the pub x 30–31,
// RMIT x 38. The road (y 7–8) stays clear to walk along.
const PLACES = [
  { prop: 'tea-board', x: 19, y: 6 },
  { prop: 'bay-tree', x: 21, y: 6 },
  { prop: 'bay-tree', x: 24, y: 6 },
  { prop: 'bistro', x: 25, y: 6 },
  { prop: 'barrel', x: 27, y: 6 },
  { prop: 'pub-board', x: 32, y: 6 },
  { prop: 'bikes', x: 35, y: 6 },
  { prop: 'bin', x: 41, y: 6 },
];
// From the cosy tileset: plane trees (2x3) and benches (2x1) on the grass across the road
const COSY = { canopy: [33, 34, 35, 36], trunk: [37, 38], bench: [29, 30], bush: 8 }; // gids
const HEDGE_ID = 7; // the bush's tile id in the cosy tileset (gid 8)
const GRASS_EDGE_GID = 46; // the grass-to-sand edge tile by the beach
const TREES = [
  { x: 24, y: 9 }, { x: 37, y: 9 }, // top-left of the canopy (mirrored across the path)
  { x: 42, y: 2 }, // right of RMIT, just under the bushes
];
const BENCHES = [{ x: 22, y: 9 }, { x: 39, y: 9 }]; // just inside the outer lamps (x 21 and x 41)
// Round bushes (cosy HEDGE) closing off both ends of the street, mirrored: at the
// east end under the plane tree right of RMIT, past the ends of the pavement and the
// cobbles, and right of the last lamp; the same shape at the west end by Collins
// Coffee House. A gap at y 7 is left open at each end (to the clearing / the beach).
const EAST_BUSHES = [{ x: 42, y: 5 }, { x: 43, y: 5 }, { x: 43, y: 6 }, { x: 43, y: 8 }, { x: 42, y: 9 }, { x: 43, y: 9 }];
const BUSHES = [...EAST_BUSHES, ...EAST_BUSHES.map(({ x, y }) => ({ x: 60 - x, y }))]; // the street runs x 18–42

// ---- The props ----------------------------------------------------------------------
const shadow = (c, cx, rx) => softEllipse(c, cx, 14, rx, 1.5, PAL.shadow, 0.5);

function bayTree(c, ox) {
  const s = PAL;
  shadow(c, ox + 8, 5);
  c.rect(ox + 4, 10, 8, 5, s.planter);
  c.rect(ox + 3, 9, 10, 2, s.planterHi);
  c.rect(ox + 11, 11, 1, 4, '#2a2a32');
  c.rect(ox + 7, 6, 2, 3, s.stem);
  c.circle(ox + 8, 4.5, 4.4, s.leaves[0]);
  c.circle(ox + 7.5, 4, 3.6, s.leaves[1]);
  c.circle(ox + 6.5, 3, 2, s.leaves[2]);
  for (const [x, y] of [[5, 2], [7, 1], [9, 3], [6, 5], [10, 5]]) c.px(ox + x, y, s.leaves[3]);
}

/** A timber A-frame chalkboard; `drawing` adds what's chalked on it. */
function board(c, ox, drawing) {
  const s = PAL;
  shadow(c, ox + 8, 5);
  c.rect(ox + 3, 1, 10, 13, s.frame);
  c.rect(ox + 12, 1, 1, 13, s.frameShade);
  c.rect(ox + 4, 2, 8, 10, s.board);
  c.rect(ox + 3, 13, 1, 2, s.frameShade); // legs
  c.rect(ox + 12, 13, 1, 2, s.frameShade);
  drawing(c, ox);
}

function teaBoard(c, ox) {
  board(c, ox, () => {
    const s = PAL;
    c.rect(ox + 5, 3, 6, 1, s.chalkGold); // a heading
    c.rect(ox + 6, 6, 4, 3, s.chalk); // a teacup...
    c.px(ox + 10, 7, s.chalk); // ...its handle
    c.rect(ox + 5, 9, 6, 1, s.chalkPink); // ...its saucer
    c.px(ox + 7, 5, s.chalk, 0.6); // steam
    c.px(ox + 8, 4, s.chalk, 0.6);
    c.rect(ox + 5, 11, 2, 1, s.chalk, 0.7); // the menu, scribbled
    c.rect(ox + 8, 11, 3, 1, s.chalk, 0.7);
  });
}

function pubBoard(c, ox) {
  board(c, ox, () => {
    const s = PAL;
    c.rect(ox + 5, 3, 6, 1, s.chalk);
    c.rect(ox + 6, 5, 4, 5, s.chalkGold); // a pint...
    c.rect(ox + 6, 5, 4, 1, s.chalk); // ...with its head
    c.rect(ox + 5, 11, 3, 1, s.chalk, 0.7);
    c.rect(ox + 9, 11, 2, 1, s.chalk, 0.7);
  });
}

function bistro(c, ox) {
  const s = PAL;
  shadow(c, ox + 16, 13);
  // two iron chairs with red velvet cushions, facing the table
  for (const [bx, dir] of [[ox + 3, 1], [ox + 28, -1]]) {
    c.rect(bx, 3, 1, 11, s.iron); // back
    c.px(bx + dir, 3, s.ironHi); // its curl
    c.rect(Math.min(bx, bx + dir * 6), 9, 7, 2, s.velvet); // cushion
    c.rect(Math.min(bx, bx + dir * 6), 9, 7, 1, s.velvetHi);
    c.rect(bx + dir, 11, 1, 3, s.iron); // legs
    c.rect(bx + dir * 5, 11, 1, 3, s.iron);
  }
  // the little round marble table
  c.rect(ox + 15, 8, 2, 5, s.iron);
  c.rect(ox + 13, 13, 6, 1, s.iron);
  c.ellipse(ox + 16, 7, 6, 2, s.marble);
  c.rect(ox + 11, 8, 11, 1, s.marbleShade);
  // teacups and a slice of cake
  for (const x of [12, 19]) {
    c.rect(ox + x, 5, 2, 2, s.china);
    c.px(ox + x + (x < 16 ? -1 : 2), 6, s.china);
  }
  c.rect(ox + 16, 5, 2, 1, s.cake);
}

function barrel(c, ox) {
  const s = PAL;
  shadow(c, ox + 8, 5);
  c.rect(ox + 4, 5, 8, 9, s.barrel);
  c.rect(ox + 3, 7, 10, 5, s.barrel); // its belly
  for (const x of [5, 8, 10]) c.rect(ox + x, 5, 1, 9, s.barrelShade); // staves
  c.rect(ox + 4, 5, 1, 9, s.barrelHi);
  c.rect(ox + 3, 7, 10, 1, s.hoop);
  c.rect(ox + 3, 11, 10, 1, s.hoop);
  c.ellipse(ox + 8, 4.5, 4, 1.5, s.barrelHi); // the top
  // a pint on it
  c.rect(ox + 9, 0, 3, 4, s.beer);
  c.rect(ox + 9, 0, 3, 1, s.foam);
}

function bikes(c, ox) {
  const s = PAL;
  shadow(c, ox + 16, 14);
  // two silver hoops of the rack, behind the bikes
  for (const hx of [ox + 6, ox + 22]) {
    c.rect(hx, 5, 1, 9, s.rackShade);
    c.rect(hx + 5, 5, 1, 9, s.rack);
    c.rect(hx, 4, 6, 1, s.rack);
  }
  // a bike leaning on each: wheels, a frame, seat and handlebars
  for (const [bx, col] of [[ox + 1, s.bikeRed], [ox + 17, s.bikeBlue]]) {
    ring(c, bx + 3, 11, 2.6, 2.6, s.tyre);
    ring(c, bx + 11, 11, 2.6, 2.6, s.tyre);
    c.line(bx + 3, 11, bx + 6, 7, col); // seat stay
    c.line(bx + 6, 7, bx + 10, 7, col); // top tube
    c.line(bx + 6, 7, bx + 7, 11, col); // seat tube
    c.line(bx + 7, 11, bx + 10, 7, col); // down tube
    c.line(bx + 10, 7, bx + 11, 11, col); // fork
    c.line(bx + 3, 11, bx + 7, 11, col); // chain stay
    c.rect(bx + 5, 5, 3, 1, s.seat);
    c.rect(bx + 10, 5, 1, 2, s.seat); // handlebars
    c.rect(bx + 9, 5, 3, 1, s.seat);
  }
}

function bin(c, ox) {
  const s = PAL;
  shadow(c, ox + 8, 5);
  c.rect(ox + 4, 4, 8, 10, s.bin);
  c.rect(ox + 4, 4, 2, 10, s.binHi);
  c.rect(ox + 3, 2, 10, 3, s.binLid);
  c.rect(ox + 3, 4, 10, 1, s.bin);
  c.rect(ox + 6, 6, 4, 1, '#1e2024'); // the slot
}

const DRAW = { 'bay-tree': bayTree, 'tea-board': teaBoard, bistro, barrel, 'pub-board': pubBoard, bikes, bin };

function drawProps() {
  const c = new Canvas(SHEET_COLS * T, T);
  for (const p of PROPS) DRAW[p.name](c, tileOf[p.name] * T);
  return c;
}

// ---- A see-through bush: bush.png (1 tile) ------------------------------------------------
// The cosy HEDGE tile has its own square of grass behind the bush, which looks
// wrong on the grass edge by the beach (it hides the sandy strip). This is the
// same bush cut out of the tileset with nothing behind it, so the ground shows.
function drawSeeThroughBush() {
  const png = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'tiles', 'tileset.png')));
  const shape = new Canvas(T, T);
  shape.ellipse(8, 9, 7, 6, '#000000'); // the bush's outline in tools/lib/tileset.js
  const bush = new Canvas(T, T);
  const cols = png.width / T;
  const sx = (HEDGE_ID % cols) * T;
  const sy = Math.floor(HEDGE_ID / cols) * T;
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      if (!shape.get(x, y)[3]) continue;
      const i = ((sy + y) * png.width + sx + x) * 4;
      bush.px(x, y, [png.data[i], png.data[i + 1], png.data[i + 2]], png.data[i + 3] / 255);
    }
  return bush;
}

/** Bushes standing on the grass edge get the see-through bush (adds its tileset once). */
function useSeeThroughBushes(map) {
  const layer = (name) => map.layers.find((l) => l.name === name).data;
  const onEdge = BUSHES.filter(({ x, y }) => layer('Ground')[y * map.width + x] === GRASS_EDGE_GID);
  if (!onEdge.length) return 0;
  let ts = map.tilesets.find((t) => t.name === 'bush');
  const gid = ts ? ts.firstgid : addTileset(map, { name: 'bush', image: '../public/assets/tiles/bush.png', cols: 1, rows: 1 });
  for (const { x, y } of onEdge) layer('Decor')[y * map.width + x] = gid;
  return onEdge.length;
}

// ---- Put them on the map (first time only) ------------------------------------------------
function addToMap() {
  const file = path.join(ROOT, 'maps', 'world.json');
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (map.tilesets.some((t) => t.name === 'street-props')) {
    // (the see-through bushes came later, so they're added to an existing street too)
    const n = useSeeThroughBushes(map);
    if (n) fs.writeFileSync(file, JSON.stringify(map, null, 1));
    console.log(`  map      already has the street props — left untouched${n ? ` (${n} bushes on the grass edge made see-through)` : ''}`);
    return;
  }
  const layer = (name) => map.layers.find((l) => l.name === name).data;
  const at = (x, y) => y * map.width + x;
  const firstgid = addTileset(map, { name: 'street-props', image: '../public/assets/tiles/street-props.png', cols: SHEET_COLS, rows: 1 });
  for (const { prop, x, y } of PLACES) {
    const p = PROPS.find((q) => q.name === prop);
    for (let i = 0; i < p.w; i++) layer('Decor')[at(x + i, y)] = firstgid + tileOf[prop] + i;
  }
  for (const { x, y } of TREES) {
    layer('Above')[at(x, y)] = COSY.canopy[0];
    layer('Above')[at(x + 1, y)] = COSY.canopy[1];
    layer('Above')[at(x, y + 1)] = COSY.canopy[2];
    layer('Above')[at(x + 1, y + 1)] = COSY.canopy[3];
    layer('Decor')[at(x, y + 2)] = COSY.trunk[0];
    layer('Decor')[at(x + 1, y + 2)] = COSY.trunk[1];
  }
  for (const { x, y } of BENCHES) {
    layer('Decor')[at(x, y)] = COSY.bench[0];
    layer('Decor')[at(x + 1, y)] = COSY.bench[1];
  }
  for (const { x, y } of BUSHES) layer('Decor')[at(x, y)] = COSY.bush;
  useSeeThroughBushes(map);
  fs.writeFileSync(file, JSON.stringify(map, null, 1));
  console.log(`  map      put ${PLACES.length} props on the pavement, ${TREES.length} plane trees, ${BENCHES.length} benches and ${BUSHES.length} bushes`);
}

// ---- Run --------------------------------------------------------------------------------------
console.log('Decorating Collins Street…');
const props = drawProps();
save(path.join(ROOT, 'public', 'assets', 'tiles', 'street-props.png'), props);
save(path.join(ROOT, 'public', 'assets', 'tiles', 'bush.png'), drawSeeThroughBush());
addToMap();

const preview = new Canvas(SHEET_COLS * T + 2 * T, 2 * T);
preview.rect(0, 0, preview.width, preview.height, '#d6cfc6');
preview.blit(props, T, T / 2);
writePreview('collins-street.png', preview);
console.log('  preview  tools/previews/collins-street.png');
