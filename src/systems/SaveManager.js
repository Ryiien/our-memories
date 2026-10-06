// -----------------------------------------------------------------------------
// SaveManager — remembers which memories, momos and love letters she's found
// and where she was standing, using the browser's localStorage.
//
// Everything is wrapped in try/catch: if storage is unavailable (private
// browsing, blocked cookies…), the game still works, it just won't remember
// progress after a refresh.
// -----------------------------------------------------------------------------
import { SAVE_KEY } from '../config.js';
import MemoryRegistry from './MemoryRegistry.js';
import Momos from './Momos.js';
import LoveLetters from './LoveLetters.js';

function emptySave() {
  return {
    found: [], // memory ids, in the order she found them
    momos: [], // momo ids she's collected
    letters: [], // love letter ids she's fished up
    position: null, // { x, y, facing } — her feet, in map pixels
    finaleSeen: false,
  };
}

function readStorage() {
  try {
    const text = window.localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    const parsed = JSON.parse(text);
    return {
      ...emptySave(),
      ...parsed,
      found: Array.isArray(parsed.found) ? parsed.found.filter((id) => typeof id === 'string') : [],
      momos: Array.isArray(parsed.momos) ? parsed.momos.filter((id) => typeof id === 'string') : [],
      letters: Array.isArray(parsed.letters) ? parsed.letters.filter((id) => typeof id === 'string') : [],
    };
  } catch (err) {
    console.warn('[save] Could not read saved progress:', err);
    return null;
  }
}

let data = readStorage() ?? emptySave();
let hadSave = readStorage() !== null;

function persist() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    hadSave = true;
  } catch (err) {
    // Storage full / disabled — keep playing without saving.
    console.warn('[save] Could not save progress:', err);
  }
}

const SaveManager = {
  /** Is there saved progress to "Continue"? */
  hasSave() {
    return hadSave && (data.found.length > 0 || data.position !== null);
  },

  isFound(id) {
    return data.found.includes(id);
  },

  /** Only counts ids that still exist in memories.json. */
  foundCount() {
    return data.found.filter((id) => MemoryRegistry.has(id)).length;
  },

  allFound() {
    return MemoryRegistry.count > 0 && this.foundCount() >= MemoryRegistry.count;
  },

  /** Returns true if this memory was newly found (not a revisit). */
  markFound(id) {
    if (data.found.includes(id)) return false;
    data.found.push(id);
    persist();
    return true;
  },

  hasMomo(id) {
    return data.momos.includes(id);
  },

  /** Only counts momos that are still on the map. */
  momoCount() {
    return data.momos.filter((id) => Momos.has(id)).length;
  },

  /** Returns true if this momo was newly collected. */
  collectMomo(id) {
    if (data.momos.includes(id)) return false;
    data.momos.push(id);
    persist();
    return true;
  },

  hasLetter(id) {
    return data.letters.includes(id);
  },

  /** Only counts letters that are still in fishing.json. */
  letterCount() {
    return data.letters.filter((id) => LoveLetters.has(id)).length;
  },

  /** Returns true if this letter is new (not one she's caught before). */
  catchLetter(id) {
    if (data.letters.includes(id)) return false;
    data.letters.push(id);
    persist();
    return true;
  },

  getPosition() {
    return data.position;
  },

  savePosition(x, y, facing) {
    data.position = { x: Math.round(x), y: Math.round(y), facing };
    persist();
  },

  get finaleSeen() {
    return data.finaleSeen;
  },

  setFinaleSeen() {
    data.finaleSeen = true;
    persist();
  },

  /** Wipe everything (new game / the hidden reset on the title screen). */
  reset() {
    data = emptySave();
    hadSave = false;
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch (err) {
      console.warn('[save] Could not clear saved progress:', err);
    }
  },
};

export default SaveManager;
