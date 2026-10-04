// -----------------------------------------------------------------------------
// SaveManager — remembers which memories she's found and where she was
// standing, using the browser's localStorage.
//
// Everything is wrapped in try/catch: if storage is unavailable (private
// browsing, blocked cookies…), the game still works, it just won't remember
// progress after a refresh.
// -----------------------------------------------------------------------------
import { SAVE_KEY } from '../config.js';
import MemoryRegistry from './MemoryRegistry.js';

function emptySave() {
  return {
    found: [], // memory ids, in the order she found them
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
