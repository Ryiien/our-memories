#!/usr/bin/env node
// -----------------------------------------------------------------------------
// make-placeholders.js — generates all placeholder art, audio and the test map.
//
//   npm run placeholders              # create anything that's missing
//   npm run placeholders -- --force   # overwrite everything (careful!)
//
// By default it NEVER overwrites a file that already exists, so once you've
// dropped your real art in (or edited the map in Tiled) it's safe to re-run.
// -----------------------------------------------------------------------------
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeWriter, writeStats } from './lib/canvas.js';
import { P } from './lib/palette.js';
import { buildFont } from './lib/font.js';
import { buildTileset, tiledTsx } from './lib/tileset.js';
import { buildTestMap } from './lib/test-map.js';
import {
  buildPlayerSheet, buildHeartIcon, bigHeart, buildPanel, buildSparkle, buildJoystick, buildActionButton,
} from './lib/sprites.js';
import { apolloBay, parkPicnic, firstDate, finale } from './lib/cutscenes.js';
import { waves, musicBox } from './lib/audio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'public', 'assets');
const force = process.argv.includes('--force');
const write = makeWriter({ force });
const out = (...parts) => path.join(ASSETS, ...parts);

console.log(force ? 'Generating placeholders (overwriting existing files)…' : 'Generating missing placeholders…');

// ---- Tileset + map --------------------------------------------------------------
const tileset = buildTileset();
write(out('tiles', 'tileset.png'), tileset);
const map = buildTestMap({
  tilesetImage: '../public/assets/tiles/tileset.png',
  tilesetImageWidth: tileset.width,
  tilesetImageHeight: tileset.height,
});
write(path.join(ROOT, 'maps', 'world.json'), JSON.stringify(map, null, 1));
write(
  path.join(ROOT, 'maps', 'cosy.tsx'),
  tiledTsx({ image: '../public/assets/tiles/tileset.png', width: tileset.width, height: tileset.height })
);

// ---- Sprites & UI -------------------------------------------------------------------
write(out('sprites', 'player.png'), buildPlayerSheet());
const font = buildFont();
write(out('ui', 'font.png'), font.png);
write(out('ui', 'font.xml'), font.xml);
write(out('ui', 'heart.png'), buildHeartIcon());
write(out('ui', 'continue-heart.png'), bigHeart());
write(out('ui', 'panel.png'), buildPanel());
write(out('ui', 'sparkle.png'), buildSparkle());
const joystick = buildJoystick();
write(out('ui', 'joystick-base.png'), joystick.base);
write(out('ui', 'joystick-knob.png'), joystick.knob);
write(out('ui', 'action-button.png'), buildActionButton());

// ---- Cutscenes -----------------------------------------------------------------------
const scenes = {
  'apollo-bay': apolloBay(),
  'park-picnic': parkPicnic(),
  'first-date': firstDate(),
  finale: finale(),
};
for (const [folder, files] of Object.entries(scenes))
  for (const [name, canvas] of Object.entries(files)) write(out('memories', folder, name), canvas);

// ---- Audio --------------------------------------------------------------------------
write(out('audio', 'waves.wav'), waves());
write(out('audio', 'music-box.wav'), musicBox());

// ---- Palette file (for pixelate-photo.js --palette, Aseprite, etc.) -----------------
write(path.join(ROOT, 'tools', 'palettes', 'cosy.hex'), Object.values(P).map((c) => c.slice(1)).join('\n') + '\n');

console.log(`Done: ${writeStats.written} written, ${writeStats.skipped} skipped (already existed).`);
if (writeStats.skipped && !force) console.log('Use --force to regenerate files that already exist.');
