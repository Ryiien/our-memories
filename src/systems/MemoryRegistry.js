// -----------------------------------------------------------------------------
// MemoryRegistry — reads data/memories.json, fills in defaults, and checks it
// for mistakes (with friendly console warnings instead of crashes).
//
// Everyone else asks the registry about memories; nobody reads the JSON
// directly.
// -----------------------------------------------------------------------------
import rawData from '../../data/memories.json';
import { PRESETS } from './LayerAnimator.js';

const MEMORY_FIELDS = ['id', 'title', 'date', 'caption', 'hidden', 'requiresAction', 'unlockAfter', 'music', 'layers'];
const LAYER_FIELDS = ['src', 'anim', 'amount', 'speed', 'scale', 'groups', 'frameWidth', 'frameHeight', 'fps'];

const warnings = [];
function warn(message) {
  warnings.push(message);
  console.warn(`[memories.json] ${message}`);
}

/** Validate layers; shared with the finale (which uses the same layer format). */
export function checkLayers(layers, where, report = warn) {
  if (!Array.isArray(layers)) {
    report(`${where}: "layers" should be a list [ ... ].`);
    return [];
  }
  return layers.filter((layer, i) => {
    if (!layer || typeof layer.src !== 'string' || !layer.src) {
      report(`${where}: layer ${i + 1} needs a "src" (an image path inside public/assets/).`);
      return false;
    }
    if (layer.src.startsWith('/') || layer.src.startsWith('public/') || layer.src.startsWith('assets/')) {
      report(`${where}: "${layer.src}" — paths are relative to public/assets/, e.g. "memories/beach/sky.png".`);
    }
    if (layer.anim && !PRESETS[layer.anim]) {
      report(`${where}: unknown anim "${layer.anim}" on ${layer.src}. Use one of: ${Object.keys(PRESETS).join(', ')}.`);
    }
    for (const key of Object.keys(layer)) {
      if (!LAYER_FIELDS.includes(key)) report(`${where}: unknown layer setting "${key}" on ${layer.src} (typo?).`);
    }
    return true;
  });
}

function normalise(raw, index) {
  const where = raw?.id ? `memory "${raw.id}"` : `memory #${index + 1}`;
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) {
    warn(`${where} has no "id" — skipping it.`);
    return null;
  }
  for (const key of Object.keys(raw)) {
    if (!MEMORY_FIELDS.includes(key)) warn(`${where}: unknown setting "${key}" (typo?).`);
  }
  const unlockAfter = Number(raw.unlockAfter ?? 0);
  return {
    id: raw.id.trim(),
    title: String(raw.title ?? ''),
    date: String(raw.date ?? ''),
    caption: String(raw.caption ?? ''),
    hidden: Boolean(raw.hidden),
    requiresAction: Boolean(raw.requiresAction),
    unlockAfter: Number.isFinite(unlockAfter) ? Math.max(0, Math.floor(unlockAfter)) : 0,
    music: raw.music ? String(raw.music) : null,
    layers: checkLayers(raw.layers ?? [], where),
  };
}

const list = [];
const byId = new Map();
(rawData?.memories ?? []).forEach((raw, i) => {
  const memory = normalise(raw, i);
  if (!memory) return;
  if (byId.has(memory.id)) {
    warn(`Two memories share the id "${memory.id}" — ids must be unique. Ignoring the second one.`);
    return;
  }
  if (memory.layers.length === 0) warn(`memory "${memory.id}" has no layers, so its cutscene will be empty.`);
  list.push(memory);
  byId.set(memory.id, memory);
});
if (list.length === 0) warn('No memories found. Add some to data/memories.json!');
list.forEach((m) => {
  if (m.unlockAfter > list.length - 1)
    warn(`memory "${m.id}" has unlockAfter ${m.unlockAfter}, but there are only ${list.length - 1} other memories — it can never unlock.`);
});

const MemoryRegistry = {
  /** All memories, in the order they appear in memories.json. */
  all: () => list,
  get: (id) => byId.get(id),
  has: (id) => byId.has(id),
  get count() {
    return list.length;
  },
  /** Every problem found while reading the data (also printed to the console). */
  warnings,
  warn,

  /** Has she found enough other memories for this one to be active? */
  isUnlocked(memory, foundCount) {
    return foundCount >= memory.unlockAfter;
  },

  /** Every music file used by memories (so Boot can preload them). */
  musicFiles: () => [...new Set(list.map((m) => m.music).filter(Boolean))],

  /**
   * Cross-check against the map's trigger zones: every memory needs a zone
   * (or it can never be found) and every zone needs a real memory.
   */
  checkAgainstMap(triggerIds) {
    const inMap = new Set(triggerIds);
    for (const id of inMap) {
      if (!byId.has(id)) warn(`The map has a trigger for "${id}", but there's no memory with that id.`);
    }
    for (const m of list) {
      if (!inMap.has(m.id))
        warn(`memory "${m.id}" has no trigger zone in the map, so it can never be found (and the finale can't play).`);
    }
  },
};

export default MemoryRegistry;
