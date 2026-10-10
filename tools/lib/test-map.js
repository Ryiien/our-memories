// -----------------------------------------------------------------------------
// Builds the placeholder test map in Tiled JSON format (maps/world.json).
// Open it in Tiled to edit — this generator is only for the first version.
//
//   x:  0..7    sea + shoreline         (beach memory)
//   x:  8..17   sand
//   x: 18..42   town: houses, café, street, lamps   (pub memory: npm run scene:pub
//               turns the café into the Oxford Scholar)
//   x: 43..59   park with trees + picnic            (picnic memory)
//   top-right   a dense grove hiding a bench        (hidden memory; npm run scene:grove
//               replaces it with a winding trail up to a hedged nook)
// -----------------------------------------------------------------------------
import { T, TS, COLUMNS, TILE_COUNT, tiledTileData } from './tileset.js';
import { rng } from './canvas.js';

const W = 60;
const H = 40;

export function buildTestMap({ tilesetImage, tilesetImageWidth, tilesetImageHeight }) {
  const layer = () => new Array(W * H).fill(0);
  const ground = layer();
  const decor = layer();
  const above = layer();
  const collision = layer();
  const r = rng(2024);

  // gid = tile ID + 1 (0 means "no tile" in Tiled)
  const set = (l, x, y, id) => {
    if (x >= 0 && y >= 0 && x < W && y < H) l[y * W + x] = id + 1;
  };
  const fill = (l, x0, y0, x1, y1, id) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(l, x, y, typeof id === 'function' ? id(x, y) : id);
  };

  // A full tree: 2 tiles wide, 3 tall; (x, y) is its top-left tile.
  const tree = (x, y) => {
    set(above, x, y, T.CANOPY_TL); set(above, x + 1, y, T.CANOPY_TR);
    set(above, x, y + 1, T.CANOPY_BL); set(above, x + 1, y + 1, T.CANOPY_BR);
    set(decor, x, y + 2, T.TRUNK_L); set(decor, x + 1, y + 2, T.TRUNK_R);
  };

  // ---- Ground ---------------------------------------------------------------
  fill(ground, 0, 0, W - 1, H - 1, () => {
    const n = r();
    if (n < 0.04) return T.FLOWERS_PINK;
    if (n < 0.07) return T.FLOWERS_YELLOW;
    if (n < 0.35) return T.GRASS2;
    return T.GRASS;
  });
  fill(ground, 0, 0, 6, H - 1, T.WATER); // the sea
  fill(ground, 7, 0, 7, H - 1, T.SHORE);
  fill(ground, 8, 0, 16, H - 1, () => (r() < 0.12 ? T.SAND2 : T.SAND));
  fill(ground, 17, 0, 17, H - 1, T.GRASS_EDGE);
  fill(ground, 2, 13, 7, 14, T.PIER); // a little wooden pier

  // Town: plaza in front of the buildings + cobbled street
  fill(ground, 18, 6, 42, 6, T.PLAZA);
  fill(ground, 18, 7, 42, 8, T.COBBLE);
  // Paths: town -> main path, and the long main path from beach to park
  fill(ground, 30, 9, 31, 19, T.PATH);
  fill(ground, 12, 20, 57, 21, T.PATH);
  fill(ground, 49, 22, 50, 25, T.PATH); // down to the picnic spot

  // ---- Town buildings (Decor) -------------------------------------------------
  const house = (x0, width, doorX) => {
    for (let x = x0; x < x0 + width; x++) {
      const edge = x === x0 ? 'L' : x === x0 + width - 1 ? 'R' : '';
      set(decor, x, 2, edge === 'L' ? T.ROOF_TL : edge === 'R' ? T.ROOF_TR : T.ROOF_T);
      set(decor, x, 3, edge === 'L' ? T.ROOF_BL : edge === 'R' ? T.ROOF_BR : T.ROOF_B);
      set(decor, x, 4, (x - x0) % 2 ? T.WALL_WINDOW : T.WALL);
      set(decor, x, 5, x === doorX ? T.DOOR : (x - x0) % 2 ? T.WALL_WINDOW : T.WALL);
    }
  };
  house(20, 5, 22);
  house(37, 5, 39);
  // The café: striped awning and big windows
  house(27, 8, 30);
  fill(decor, 27, 4, 34, 4, T.AWNING);
  [27, 28, 32, 33].forEach((x) => set(decor, x, 5, T.CAFE_WINDOW));
  set(decor, 29, 5, T.WALL); set(decor, 31, 5, T.WALL); set(decor, 34, 5, T.WALL);
  set(decor, 28, 6, T.FLOWER_POT); set(decor, 33, 6, T.FLOWER_POT);
  // Hedges behind the town so she can't walk behind the roofs
  fill(decor, 18, 0, 43, 1, T.HEDGE);
  // Street lamps: base in Decor, lantern in Above (drawn over her head)
  [21, 27, 35, 41].forEach((x) => {
    set(decor, x, 9, T.LAMP_BASE);
    set(above, x, 8, T.LAMP_TOP);
  });
  fill(decor, 19, 11, 27, 11, T.FENCE);
  fill(decor, 34, 11, 41, 11, T.FENCE);
  set(decor, 18, 18, T.SIGN);

  // ---- Beach ----------------------------------------------------------------
  set(decor, 13, 9, T.ROCK);
  set(decor, 15, 33, T.ROCK);
  set(decor, 9, 37, T.ROCK);
  set(decor, 11, 27, T.TOWEL);
  set(decor, 12, 27, T.TOWEL);

  // ---- Park -------------------------------------------------------------------
  [
    [44, 11], [47, 14], [53, 12], [57, 13], [43, 23], [55, 23], [58, 28],
    [44, 31], [52, 32], [57, 35], [46, 36], [40, 27],
    // a few around the town's south side
    [20, 24], [26, 30], [36, 26], [22, 34], [38, 33], [32, 36],
  ].forEach(([x, y]) => tree(x, y));
  set(decor, 48, 27, T.BLANKET_L);
  set(decor, 49, 27, T.BLANKET_R);

  // ---- The hidden grove (top-right) -------------------------------------------
  // A solid block of treetops (Above layer) with trunks along its bottom edge.
  // A gap in the trunks at x 54–55 leads north under the leaves to a bench.
  // The Collision layer seals everything except that secret passage.
  for (let y = 0; y <= 9; y += 2)
    for (let x = 50; x <= 58; x += 2) {
      set(above, x, y, T.CANOPY_TL); set(above, x + 1, y, T.CANOPY_TR);
      set(above, x, y + 1, T.CANOPY_BL); set(above, x + 1, y + 1, T.CANOPY_BR);
    }
  for (let x = 50; x <= 58; x += 2) {
    if (x === 54) continue; // the gap
    set(decor, x, 10, T.TRUNK_L); set(decor, x + 1, 10, T.TRUNK_R);
  }
  set(decor, 54, 3, T.BENCH_L);
  set(decor, 55, 3, T.BENCH_R);
  fill(collision, 50, 0, 59, 9, (x, y) => {
    const passage = (x === 54 || x === 55) && y >= 3;
    return passage ? -1 : T.BLOCKER;
  });

  // ---- Objects ----------------------------------------------------------------
  let nextId = 1;
  const rect = (name, tx, ty, tw, th, memoryId) => ({
    id: nextId++,
    name,
    type: '',
    x: tx * TS,
    y: ty * TS,
    width: tw * TS,
    height: th * TS,
    rotation: 0,
    visible: true,
    properties: [{ name: 'memoryId', type: 'string', value: memoryId }],
  });
  const triggers = [
    rect('beach', 10, 25, 4, 4, 'apollo-bay'),
    rect('pub doors', 30, 6, 2, 1, 'oxford-scholar'),
    rect('picnic', 47, 26, 4, 3, 'park-picnic'),
    rect('secret bench', 54, 4, 2, 2, 'first-date'),
  ];
  const spawn = { id: nextId++, name: 'player', type: '', point: true, x: 31 * TS, y: 21 * TS, width: 0, height: 0, rotation: 0, visible: true };

  // ---- Assemble the Tiled JSON ---------------------------------------------
  const tileLayer = (id, name, data, extra = {}) => ({
    id, name, type: 'tilelayer', x: 0, y: 0, width: W, height: H, opacity: 1, visible: true, data, ...extra,
  });
  const objectLayer = (id, name, objects) => ({
    id, name, type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects,
  });

  return {
    compressionlevel: -1,
    width: W,
    height: H,
    tilewidth: TS,
    tileheight: TS,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.11.0',
    type: 'map',
    version: '1.10',
    nextlayerid: 7,
    nextobjectid: nextId,
    layers: [
      tileLayer(1, 'Ground', ground),
      tileLayer(2, 'Decor', decor),
      tileLayer(3, 'Above', above),
      tileLayer(4, 'Collision', collision, { opacity: 0.5 }),
      objectLayer(5, 'Triggers', triggers),
      objectLayer(6, 'Spawn', [spawn]),
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'cosy',
        image: tilesetImage, // path relative to the map file, so Tiled can show it
        imagewidth: tilesetImageWidth,
        imageheight: tilesetImageHeight,
        tilewidth: TS,
        tileheight: TS,
        columns: COLUMNS,
        tilecount: TILE_COUNT,
        margin: 0,
        spacing: 0,
        tiles: tiledTileData(),
      },
    ],
  };
}
