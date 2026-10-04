// -----------------------------------------------------------------------------
// Music — plays one looping music track at a time and crossfades between them.
//
// Music.play(scene, 'audio/waves.wav')  -> fades the old track out, new one in
// Music.play(scene, null)               -> fades to silence
//
// Fades are driven by the game clock (not a scene), so they finish properly
// even if the scene that started them has closed.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { AUDIO } from '../config.js';

/** Cache key for a music file path (same path = same sound). */
export const musicKey = (path) => `music:${path}`;

let current = null; // { path, sound }
const fades = new Set(); // { sound, from, to, duration, elapsed, destroyAfter }
let hooked = false;

function hook(game) {
  if (hooked) return;
  hooked = true;
  game.events.on(Phaser.Core.Events.STEP, (_time, delta) => {
    for (const f of fades) {
      f.elapsed += delta;
      const k = Math.min(1, f.elapsed / f.duration);
      f.sound.setVolume(f.from + (f.to - f.from) * k);
      if (k >= 1) {
        fades.delete(f);
        if (f.destroyAfter) f.sound.destroy();
      }
    }
  });
}

function fade(sound, to, duration, destroyAfter = false) {
  for (const f of fades) if (f.sound === sound) fades.delete(f);
  fades.add({ sound, from: sound.volume, to, duration: Math.max(1, duration), elapsed: 0, destroyAfter });
}

const Music = {
  /** The path of the track playing now (or null). */
  get currentPath() {
    return current?.path ?? null;
  },

  play(scene, path, { volume = AUDIO.musicVolume, duration = AUDIO.crossfade } = {}) {
    hook(scene.game);
    if ((current?.path ?? null) === (path ?? null)) return;

    if (current) fade(current.sound, 0, duration, true);
    current = null;
    if (!path) return;

    const key = musicKey(path);
    if (!scene.cache.audio.exists(key)) {
      console.warn(`[music] "${path}" isn't loaded (missing file at public/assets/${path}?) — no music.`);
      return;
    }
    const sound = scene.sound.add(key, { loop: true, volume: 0 });
    sound.play();
    fade(sound, volume, duration);
    current = { path, sound };
  },
};

export default Music;
