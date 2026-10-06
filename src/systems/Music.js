// -----------------------------------------------------------------------------
// Music — plays looping music (one track, or several layered together, like a
// pub's chatter plus a passing tram) and crossfades between places.
//
// Music.play(scene, 'audio/waves.wav')                   -> fades the old music out, this in
// Music.play(scene, ['audio/pub.wav', 'audio/tram.mp3']) -> both at once, faded in together
// Music.play(scene, null)                                -> fades to silence
// Music.load(scene, music)                               -> queues any files not loaded yet (call in preload)
//
// Fades are driven by the game clock (not a scene), so they finish properly
// even if the scene that started them has closed.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { AUDIO } from '../config.js';

/** Cache key for a music file path (same path = same sound). */
export const musicKey = (path) => `music:${path}`;

/** A "music" value from the data (a path, a list of paths, or nothing) as a list of paths. */
export const musicTracks = (music) => (Array.isArray(music) ? music : [music]).filter(Boolean).map(String);

let current = null; // { id, sounds }
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
  /** Queue the music's files for loading, skipping any already loaded. */
  load(scene, music) {
    for (const path of musicTracks(music)) {
      if (!scene.cache.audio.exists(musicKey(path))) scene.load.audio(musicKey(path), path);
    }
  },

  play(scene, music, { volume = AUDIO.musicVolume, duration = AUDIO.crossfade } = {}) {
    hook(scene.game);
    const paths = musicTracks(music);
    const id = paths.join('|');
    if ((current?.id ?? '') === id) return; // already playing exactly this

    for (const sound of current?.sounds ?? []) fade(sound, 0, duration, true);
    current = null;
    if (!paths.length) return;

    const sounds = [];
    for (const path of paths) {
      const key = musicKey(path);
      if (!scene.cache.audio.exists(key)) {
        console.warn(`[music] "${path}" isn't loaded (missing file at public/assets/${path}?) — skipped.`);
        continue;
      }
      const sound = scene.sound.add(key, { loop: true, volume: 0 });
      sound.play();
      fade(sound, volume, duration);
      sounds.push(sound);
    }
    current = { id, sounds };
  },
};

export default Music;
