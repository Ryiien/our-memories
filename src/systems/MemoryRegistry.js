// -----------------------------------------------------------------------------
// MemoryRegistry — reads data/memories.json, fills in defaults, and checks it
// for mistakes (with friendly console warnings instead of crashes).
//
// Everyone else asks the registry about memories; nobody reads the JSON
// directly.
// -----------------------------------------------------------------------------
import rawData from '../../data/memories.json';
import { PRESETS } from './LayerAnimator.js';
import Momos from './Momos.js';

const MEMORY_FIELDS = [
  'id', 'title', 'date', 'caption', 'hidden', 'requiresAction', 'unlockAfter', 'momosNeeded', 'revealOnUnlock',
  'music', 'layers',
];
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
  // unlockAfter: a number, or "all" = every other memory (worked out below,
  // once we know how many memories there are).
  const unlockAll = raw.unlockAfter === 'all';
  const unlockAfter = unlockAll ? 0 : Number(raw.unlockAfter ?? 0);
  if (!unlockAll && !Number.isFinite(unlockAfter))
    warn(`${where}: "unlockAfter" should be a number or "all", not "${raw.unlockAfter}".`);
  const momosNeeded = Number(raw.momosNeeded ?? 0);
  return {
    id: raw.id.trim(),
    title: String(raw.title ?? ''),
    date: String(raw.date ?? ''),
    caption: String(raw.caption ?? ''),
    hidden: Boolean(raw.hidden),
    requiresAction: Boolean(raw.requiresAction),
    unlockAfter: Number.isFinite(unlockAfter) ? Math.max(0, Math.floor(unlockAfter)) : 0,
    unlockAll,
    momosNeeded: Number.isFinite(momosNeeded) ? Math.max(0, Math.floor(momosNeeded)) : 0,
    revealOnUnlock: Boolean(raw.revealOnUnlock),
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
if (list.filter((m) => m.unlockAll).length > 1)
  warn('More than one memory has unlockAfter "all", so each waits for the other and none can unlock.');
list.forEach((m) => {
  if (m.unlockAll) m.unlockAfter = list.length - 1;
  if (m.momosNeeded > Momos.count)
    warn(`memory "${m.id}" needs ${m.momosNeeded} momos, but the map only has ${Momos.count} — it can never unlock.`);
  if (m.revealOnUnlock && !m.hidden) warn(`memory "${m.id}" has revealOnUnlock but isn't hidden, so there's nothing to reveal.`);

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

  /** Has she found enough other memories (and momos) for this one to be active? */
  isUnlocked(memory, foundCount, momoCount) {
    return foundCount >= memory.unlockAfter && momoCount >= memory.momosNeeded;
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
