// -----------------------------------------------------------------------------
// LoveLetters — reads data/fishing.json (the fishing minigame's letters,
// settings and background layers) and the map's "Fishing" spots, fills in
// defaults, and checks for mistakes (friendly console warnings, never crashes).
//
// Everyone else asks this module about letters; nobody reads the JSON directly.
// -----------------------------------------------------------------------------
import rawData from '../../data/fishing.json';
import worldMap from '../../maps/world.json';
import MemoryRegistry, { checkLayers } from './MemoryRegistry.js';

const FIELDS = ['title', 'music', 'seaweedChance', 'maxSeaweedInARow', 'signature', 'scene', 'layers', 'letters'];
const LETTER_FIELDS = ['id', 'title', 'text'];

function warn(message) {
  MemoryRegistry.warnings.push(message); // so the title screen's "N data warnings" counts these too
  console.warn(`[fishing.json] ${message}`);
}

const raw = rawData ?? {};
for (const key of Object.keys(raw)) if (!FIELDS.includes(key)) warn(`unknown setting "${key}" (typo?).`);

// ---- Letters ----------------------------------------------------------------------
const letters = [];
const byId = new Map();
(Array.isArray(raw.letters) ? raw.letters : []).forEach((l, i) => {
  const where = l?.id ? `letter "${l.id}"` : `letter #${i + 1}`;
  if (!l || typeof l.id !== 'string' || !l.id.trim()) return warn(`${where} has no "id" — skipping it.`);
  for (const key of Object.keys(l)) if (!LETTER_FIELDS.includes(key)) warn(`${where}: unknown setting "${key}" (typo?).`);
  const letter = { id: l.id.trim(), title: String(l.title ?? ''), text: String(l.text ?? '') };
  if (byId.has(letter.id)) return warn(`Two letters share the id "${letter.id}" — ids must be unique.`);
  if (!letter.text) warn(`${where} has no "text".`);
  letters.push(letter);
  byId.set(letter.id, letter);
});

// ---- Settings -----------------------------------------------------------------------
const number = (value, fallback, name) => {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  warn(`"${name}" should be a number, not "${value}".`);
  return fallback;
};
const scene = raw.scene ?? {};
const pair = (value, fallback, name) => {
  if (value === undefined) return fallback;
  if (Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)) return value;
  warn(`"scene.${name}" should be two numbers, like [${fallback.join(', ')}].`);
  return fallback;
};

const settings = {
  title: String(raw.title ?? ''),
  music: raw.music ? String(raw.music) : null,
  seaweedChance: Math.min(1, Math.max(0, number(raw.seaweedChance, 0.3, 'seaweedChance'))),
  maxSeaweedInARow: Math.max(0, Math.floor(number(raw.maxSeaweedInARow, 2, 'maxSeaweedInARow'))),
  signature: String(raw.signature ?? ''),
  // Where things are in the background art (see tools/scenes/fishing.js).
  hand: pair(scene.hand, [97, 104], 'hand'), // where her hand holds the rod
  rodLength: number(scene.rodLength, 44, 'scene.rodLength'),
  waterY: number(scene.waterY, 133, 'scene.waterY'), // the sea's surface where the bobber floats
  castX: pair(scene.castX, [165, 212], 'castX'), // the bobber lands somewhere between these x's
  layers: checkLayers(raw.layers ?? [], 'fishing.json', warn),
};

// ---- The map's "Fishing" spots --------------------------------------------------------
const layer = (worldMap.layers ?? []).find((l) => l.name === 'Fishing');
const spots = (layer?.objects ?? [])
  .filter((o) => o.width > 0 && o.height > 0)
  .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
if (layer && spots.length === 0) warn('The map\'s "Fishing" layer has no rectangles, so there\'s nowhere to fish.');
if (spots.length && letters.length === 0) warn('There are no letters to catch — add some to "letters".');

const LoveLetters = {
  /** All letters, in the order they appear in fishing.json. */
  all: () => letters,
  get: (id) => byId.get(id),
  has: (id) => byId.has(id),
  get count() {
    return letters.length;
  },
  settings,
  /** Rectangles (map pixels) where she can fish. Empty if fishing is off. */
  spots: () => (letters.length ? spots : []),
};

export default LoveLetters;
