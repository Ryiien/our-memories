// -----------------------------------------------------------------------------
// Sfx — short one-off sound effects (a momo pop, the "Memory found!" chime...).
//
// data/sounds.json maps each effect's name to a file in public/assets/
// (or null for silence). Boot loads them all at startup (they're tiny), then
//
// Sfx.play(scene, 'momo')   -> plays it once, at AUDIO.sfxVolume
//
// A missing or silenced sound just plays nothing; never a crash.
// -----------------------------------------------------------------------------
import { AUDIO } from '../config.js';
import MemoryRegistry from './MemoryRegistry.js';
import sounds from '../../data/sounds.json';

/** Every effect the game plays, and when. Keys in sounds.json must be one of these. */
export const SFX_NAMES = {
  momo: 'collecting a momo',
  found: 'a toast like "Memory found!" sliding in',
  cast: 'casting the fishing rod',
  splash: 'the bobber (or seaweed) hitting the water',
  letter: 'catching a love letter',
  continue: 'pressing Continue in a memory, the finale or a letter',
};

const sfxKey = (name) => `sfx:${name}`;

const Sfx = {
  /** Queue every sound file for loading (call from a scene's preload). */
  preload(scene) {
    for (const [name, path] of Object.entries(sounds)) {
      if (!path || !(name in SFX_NAMES)) continue;
      scene.load.audio(sfxKey(name), path);
    }
  },

  /** Friendly warnings for typos in sounds.json. */
  check() {
    for (const name of Object.keys(sounds)) {
      if (!(name in SFX_NAMES)) {
        MemoryRegistry.warn(`sounds.json has "${name}", which the game never plays (typo?). The names are: ${Object.keys(SFX_NAMES).join(', ')}.`);
      }
    }
  },

  /** Play one effect once. */
  play(scene, name, { volume = AUDIO.sfxVolume } = {}) {
    if (!sounds[name]) return; // left out or null: silence
    const key = sfxKey(name);
    if (!scene.cache.audio.exists(key)) return; // failed to load (Boot already warned)
    scene.sound.play(key, { volume });
  },
};

export default Sfx;
