#!/usr/bin/env node
// -----------------------------------------------------------------------------
// make-sfx.js — writes simple synthesised placeholder sound effects to
// public/assets/audio/sfx/, one per name in data/sounds.json.
//
//   npm run sfx               # only writes the ones that are missing
//   npm run sfx -- --force    # overwrite them all (careful: replaces your own sounds)
//
// To use your own sound instead, drop a .wav / .mp3 / .ogg in
// public/assets/audio/sfx/ and point its name at it in data/sounds.json.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { ROOT } from './lib/scene-kit.js';
import { sfxFound, sfxCast, sfxSplash, sfxLetter, sfxContinue } from './lib/audio.js';

const { values: args } = parseArgs({ options: { force: { type: 'boolean', default: false } } });
const OUT = path.join(ROOT, 'public', 'assets', 'audio', 'sfx');

// momo (minecraft-pop.mp3), step (walking.mp3), allMomos (powerup.wav) and
// allLetters (momo.wav) are real sounds now, so they're left out here: --force
// must never overwrite them.
// (sfxMomo in lib/audio.js is the old synthesised pop, kept in case it's wanted again.)
const SOUNDS = {
  'found.wav': sfxFound,
  'cast.wav': sfxCast,
  'splash.wav': sfxSplash,
  'letter.wav': sfxLetter,
  'continue.wav': sfxContinue,
};

fs.mkdirSync(OUT, { recursive: true });
for (const [file, make] of Object.entries(SOUNDS)) {
  const target = path.join(OUT, file);
  if (fs.existsSync(target) && !args.force) {
    console.log(`  kept     ${path.relative(ROOT, target)}`);
    continue;
  }
  fs.writeFileSync(target, make());
  console.log(`  wrote    ${path.relative(ROOT, target)}`);
}
