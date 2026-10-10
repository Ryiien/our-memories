// -----------------------------------------------------------------------------
// Critters — little animals sitting around the map (data/critters.json) who
// say something when she presses E next to them (there's no prompt: it's a
// little surprise).
//
// Each critter in the JSON has an "id"; the map's "Critters" object layer has
// a point with that name where its feet go. Checks for mistakes (friendly
// console warnings, never crashes) and fills in defaults.
//
// Everyone else asks this module about critters; nobody reads the JSON directly.
// -----------------------------------------------------------------------------
import rawData from '../../data/critters.json';
import worldMap from '../../maps/world.json';
import MemoryRegistry from './MemoryRegistry.js';

const FIELDS = ['id', 'name', 'sprite', 'frameWidth', 'frameHeight', 'fps', 'idle', 'sayFrame', 'says', 'faces'];

function warn(message) {
  MemoryRegistry.warnings.push(message); // so the title screen's "N data warnings" counts these too
  console.warn(`[critters.json] ${message}`);
}

const points = new Map(
  ((worldMap.layers ?? []).find((l) => l.name === 'Critters')?.objects ?? []).map((o) => [o.name, o])
);

const list = [];
(Array.isArray(rawData?.critters) ? rawData.critters : []).forEach((c, i) => {
  const where = c?.id ? `critter "${c.id}"` : `critter #${i + 1}`;
  if (!c || typeof c.id !== 'string' || !c.id.trim()) return warn(`${where} has no "id" — skipping it.`);
  for (const key of Object.keys(c)) if (!FIELDS.includes(key)) warn(`${where}: unknown setting "${key}" (typo?).`);
  const id = c.id.trim();
  if (list.some((other) => other.id === id)) return warn(`Two critters share the id "${id}" — ids must be unique.`);
  const point = points.get(id);
  if (!point) return warn(`${where} has no point named "${id}" on the map's "Critters" layer — it won't appear.`);
  if (!c.sprite) return warn(`${where} has no "sprite" — skipping it.`);

  const frames = Array.isArray(c.idle) && c.idle.length && c.idle.every(Number.isInteger) ? c.idle : [0];
  if (c.idle !== undefined && frames !== c.idle) warn(`${where}: "idle" should be a list of frame numbers, like [0, 1, 0, 2].`);
  // "says" can be one line or a list (one is picked at random each time).
  const says = (Array.isArray(c.says) ? c.says : [c.says]).filter((s) => typeof s === 'string' && s.trim());
  if (!says.length) warn(`${where} has nothing to say (add "says").`);

  list.push({
    id,
    name: String(c.name ?? id),
    sprite: String(c.sprite),
    frameWidth: Number(c.frameWidth) || 16,
    frameHeight: Number(c.frameHeight) || 16,
    fps: Number(c.fps) || 3,
    idle: frames,
    sayFrame: Number.isInteger(c.sayFrame) ? c.sayFrame : null,
    faces: c.faces === 'right' ? 'right' : 'left', // which way the drawing looks (it turns to face her when it talks)
    says,
    x: point.x,
    y: point.y,
  });
});
for (const name of points.keys()) {
  if (!list.some((c) => c.id === name) && !(rawData?.critters ?? []).some((c) => c?.id === name))
    warn(`The map's "Critters" layer has a point "${name}" but no critter with that id.`);
}

const Critters = {
  all: () => list,
  /** Texture key for a critter's sprite sheet. */
  key: (critter) => `critter:${critter.id}`,
};

export default Critters;
