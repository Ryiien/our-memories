// -----------------------------------------------------------------------------
// Momos — the little glowing dumplings to collect around the map.
//
// They're points on the map's "Momos" object layer (npm run momos places
// them, or add points in Tiled). Each point's name is its id in the save, so
// a momo she's already eaten stays eaten even if the point moves.
// -----------------------------------------------------------------------------
import worldMap from '../../maps/world.json';

const layer = (worldMap.layers ?? []).find((l) => l.name === 'Momos');
const list = (layer?.objects ?? []).map((o) => ({
  // Unnamed points still work: they're remembered by their position.
  id: o.name || `momo@${Math.round(o.x)},${Math.round(o.y)}`,
  x: o.x,
  y: o.y,
}));
const ids = new Set(list.map((m) => m.id));

const Momos = {
  all: () => list,
  has: (id) => ids.has(id),
  get count() {
    return list.length;
  },
};

export default Momos;
