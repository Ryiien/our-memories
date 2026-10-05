#!/usr/bin/env node
// -----------------------------------------------------------------------------
// place-momos.js — puts the collectable momos into maps/world.json.
//
//   npm run momos
//
// Writes (or replaces) the "Momos" object layer: one point per spot below,
// named momo-1, momo-2… (the names are what her save remembers, so keep a
// spot's name if you move it). You can also move/add points in Tiled instead.
// Re-run this after `npm run placeholders -- --force`, which rebuilds the map.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_FILE = path.join(ROOT, 'maps', 'world.json');

// Tile coordinates (x, y) of each momo. Every spot must be walkable.
const SPOTS = [
  { x: 3, y: 13, note: 'end of the pier' },
  { x: 10, y: 37, note: 'down the beach, by the pebbles' },
  { x: 17, y: 1, note: 'top-left corner, past the red house' },
  { x: 36, y: 4, note: 'the alley between the pub and RMIT' },
  { x: 17, y: 15, note: 'beside the Palais' },
  { x: 55, y: 11, note: 'where the forest path to the secret bench begins' },
  { x: 58, y: 17, note: 'the far east edge' },
  { x: 22, y: 35, note: 'peeking out from under a tree' },
  { x: 40, y: 31, note: 'the open meadow' },
  { x: 59, y: 38, note: 'the bottom corner by the garden flowers' },
];

const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const T = map.tilewidth;

let layer = map.layers.find((l) => l.name === 'Momos');
if (!layer) {
  layer = {
    id: map.nextlayerid++,
    name: 'Momos',
    type: 'objectgroup',
    draworder: 'topdown',
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
    objects: [],
  };
  // Keep it just above Triggers so it's easy to find in Tiled.
  const at = map.layers.findIndex((l) => l.name === 'Triggers');
  map.layers.splice(at === -1 ? map.layers.length : at + 1, 0, layer);
}

layer.objects = SPOTS.map((spot, i) => ({
  id: map.nextobjectid++,
  name: `momo-${i + 1}`,
  type: '',
  point: true,
  // Centre of the tile, a little low so it sits "on the ground".
  x: spot.x * T + T / 2,
  y: spot.y * T + T / 2 + 2,
  width: 0,
  height: 0,
  rotation: 0,
  visible: true,
}));

fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1));
console.log(`Placed ${SPOTS.length} momos in maps/world.json:`);
for (const [i, s] of SPOTS.entries()) console.log(`  momo-${i + 1}  tile ${s.x},${s.y}  (${s.note})`);
