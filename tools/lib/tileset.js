// -----------------------------------------------------------------------------
// Placeholder 16x16 tileset: grass, sand, water, paths, buildings, trees...
// 8 columns wide. Tile IDs below are what Tiled calls "tile ID" (0-based).
// -----------------------------------------------------------------------------
import { Canvas, rng } from './canvas.js';
import { P } from './palette.js';

export const TS = 16;
export const COLUMNS = 8;

// Tile IDs by name (the map generator uses these too).
export const T = {
  GRASS: 0, GRASS2: 1, FLOWERS_PINK: 2, FLOWERS_YELLOW: 3, PATH: 4, COBBLE: 5, PLAZA: 6, HEDGE: 7,
  SAND: 8, SAND2: 9, SHORE: 10, WATER: 11, WATER_B: 12, WATER_C: 13, SHORE_B: 14, PIER: 15,
  WALL: 16, WALL_WINDOW: 17, DOOR: 18, AWNING: 19, ROOF_TL: 20, ROOF_T: 21, ROOF_TR: 22, CAFE_WINDOW: 23,
  ROOF_BL: 24, ROOF_B: 25, ROOF_BR: 26, FENCE: 27, BENCH_L: 28, BENCH_R: 29, LAMP_BASE: 30, LAMP_TOP: 31,
  CANOPY_TL: 32, CANOPY_TR: 33, CANOPY_BL: 34, CANOPY_BR: 35, TRUNK_L: 36, TRUNK_R: 37, ROCK: 38, SIGN: 39,
  BLANKET_L: 40, BLANKET_R: 41, FLOWER_POT: 42, TOWEL: 43, BLOCKER: 44, GRASS_EDGE: 45,
};
export const TILE_COUNT = 48;

// Tiles she can't walk through (get the Tiled property collides = true).
export const COLLIDES = [
  T.HEDGE, T.SHORE, T.WATER, T.WATER_B, T.WATER_C, T.SHORE_B,
  T.WALL, T.WALL_WINDOW, T.DOOR, T.AWNING, T.ROOF_TL, T.ROOF_T, T.ROOF_TR, T.CAFE_WINDOW,
  T.ROOF_BL, T.ROOF_B, T.ROOF_BR, T.FENCE, T.BENCH_L, T.BENCH_R, T.LAMP_BASE,
  T.TRUNK_L, T.TRUNK_R, T.ROCK, T.SIGN, T.FLOWER_POT, T.BLOCKER,
];

// Tiled tile animations (Phaser plays these automatically).
export const ANIMATIONS = {
  [T.WATER]: [T.WATER, T.WATER_B, T.WATER_C, T.WATER_B].map((id) => ({ tileid: id, duration: 450 })),
  [T.SHORE]: [T.SHORE, T.SHORE_B].map((id) => ({ tileid: id, duration: 700 })),
};

// ---- helpers ---------------------------------------------------------------
function speckle(c, ox, oy, seed, colors, count) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) c.px(ox + r.int(0, 15), oy + r.int(0, 15), r.pick(colors));
}

function grass(c, ox, oy, seed = 1, tufts = 6) {
  c.rect(ox, oy, TS, TS, P.grass);
  speckle(c, ox, oy, seed, [P.grassMid, P.grassLight], 10);
  const r = rng(seed + 99);
  for (let i = 0; i < tufts; i++) {
    const x = ox + r.int(1, 14);
    const y = oy + r.int(2, 14);
    c.px(x, y, P.grassDark);
    c.px(x - 1, y - 1, P.grassMid);
    c.px(x + 1, y - 1, P.grassMid);
  }
}

function flower(c, x, y, petal) {
  c.px(x, y - 1, petal);
  c.px(x - 1, y, petal);
  c.px(x + 1, y, petal);
  c.px(x, y + 1, petal);
  c.px(x, y, P.butter);
}

function water(c, ox, oy, phase) {
  c.rect(ox, oy, TS, TS, P.water);
  // Gentle wave marks that shift sideways each animation frame (wrapping so
  // tiles join seamlessly).
  const marks = [
    [2, 3], [10, 6], [5, 10], [13, 13], [0, 14],
  ];
  for (const [mx, my] of marks) {
    for (let i = 0; i < 4; i++) {
      const x = (mx + i + phase * 2) % TS;
      c.px(ox + x, oy + my + (i === 1 || i === 2 ? -1 : 0), P.waterMid);
    }
  }
  const sparkle = [[7, 2], [12, 9], [3, 7]][phase % 3];
  c.px(ox + sparkle[0], oy + sparkle[1], P.foam);
}

function shore(c, ox, oy, phase) {
  water(c, ox, oy, phase);
  for (let y = 0; y < TS; y++) {
    const wobble = Math.round(Math.sin((y + phase * 3) * 0.8) * 1.2);
    const edge = 12 + wobble; // where sand starts
    for (let x = edge; x < TS; x++) c.px(ox + x, oy + y, P.sand);
    c.px(ox + edge - 1, oy + y, P.foam);
    c.px(ox + edge - 2, oy + y, P.foam, 0.6);
    if ((y + phase) % 5 === 0) c.px(ox + edge - 3, oy + y, P.foam);
  }
}

function shingles(c, ox, oy) {
  c.rect(ox, oy, TS, TS, P.roof);
  for (let y = 3; y < TS; y += 4) c.rect(ox, oy + y, TS, 1, P.roofDark);
  for (let row = 0; row < 4; row++)
    for (let x = row % 2 ? 2 : 6; x < TS; x += 8) c.rect(ox + x, oy + row * 4, 1, 3, P.roofDark);
  for (let row = 0; row < 4; row++) c.rect(ox, oy + row * 4, TS, 1, P.roofHi, 0.35);
}

function wallBase(c, ox, oy) {
  c.rect(ox, oy, TS, TS, P.wall);
  for (let y = 4; y < TS; y += 5) c.rect(ox, oy + y, TS, 1, P.wallShade, 0.5);
  c.rect(ox, oy + 14, TS, 2, P.wallShade);
}

function windowPane(c, x, y, w, h, lit = false) {
  c.rect(x - 1, y - 1, w + 2, h + 2, P.woodDark);
  c.rect(x, y, w, h, lit ? P.butter : P.skyLight);
  if (!lit) c.line(x, y + h - 2, x + 2, y, P.white);
  c.rect(x + Math.floor(w / 2), y, 1, h, P.woodDark);
  c.rect(x - 1, y + h + 1, w + 2, 1, P.wood);
}

// A whole 32x48 tree drawn once, then cut into 6 tiles.
function drawTree() {
  const t = new Canvas(32, 48);
  t.ellipse(16, 45, 9, 2, P.forestDark, 0.35); // shadow
  t.rect(13, 28, 6, 17, P.woodDark);
  t.rect(14, 28, 2, 17, P.wood);
  t.px(12, 44, P.woodDark);
  t.px(19, 44, P.woodDark);
  t.circle(16, 17, 15, P.forest);
  t.circle(16, 16, 14, P.grassDark);
  t.circle(14, 14, 11, P.grassMid);
  t.circle(11, 11, 6, P.grass);
  t.circle(10, 9, 2, P.grassLight);
  // little leaf clusters for texture
  const r = rng(7);
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 13;
    const x = 16 + Math.cos(a) * d;
    const y = 16 + Math.sin(a) * d;
    t.px(x, y, d > 9 ? P.forest : P.grassDark);
  }
  t.outline(P.forestDark);
  return t;
}

function bench(c, ox, oy, half) {
  // Bench spans two tiles; `half` 0 = left, 1 = right.
  const b = new Canvas(32, 16);
  b.rect(2, 3, 28, 3, P.wood); // backrest
  b.rect(2, 3, 28, 1, P.peach, 0.5);
  b.rect(2, 8, 28, 3, P.wood); // seat
  b.rect(2, 10, 28, 1, P.woodDark);
  for (const x of [3, 27]) b.rect(x, 6, 2, 9, P.woodDeep);
  b.outline(P.woodDeep);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const [r2, g2, b2, a] = b.get(x + half * 16, y);
      if (a) c.px(ox + x, oy + y, [r2, g2, b2], a / 255);
    }
}

function blanket(c, ox, oy, half) {
  for (let y = 3; y < 15; y++)
    for (let x = 0; x < 16; x++) {
      const gx = x + half * 16;
      if ((half === 0 && x < 2) || (half === 1 && x > 13)) continue;
      const check = (Math.floor(gx / 3) + Math.floor(y / 3)) % 2;
      c.px(ox + x, oy + y, check ? P.rose : P.cream);
    }
}

// ---- the tileset -----------------------------------------------------------
export function buildTileset() {
  const rows = Math.ceil(TILE_COUNT / COLUMNS);
  const c = new Canvas(COLUMNS * TS, rows * TS);
  const at = (id) => [(id % COLUMNS) * TS, Math.floor(id / COLUMNS) * TS];
  const tree = drawTree();
  const cutTree = (id, tx, ty) => {
    const [ox, oy] = at(id);
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        const [r, g, b, a] = tree.get(tx * TS + x, ty * TS + y);
        if (a) c.px(ox + x, oy + y, [r, g, b], a / 255);
      }
  };

  let o;
  // Row 0 — grass & paths
  o = at(T.GRASS); grass(c, ...o, 1, 3);
  o = at(T.GRASS2); grass(c, ...o, 2, 8);
  o = at(T.FLOWERS_PINK); grass(c, ...o, 3, 2);
  flower(c, o[0] + 4, o[1] + 4, P.rose); flower(c, o[0] + 11, o[1] + 7, P.cream); flower(c, o[0] + 6, o[1] + 12, P.rose);
  o = at(T.FLOWERS_YELLOW); grass(c, ...o, 4, 2);
  flower(c, o[0] + 10, o[1] + 3, P.butter); flower(c, o[0] + 4, o[1] + 9, P.lavender); flower(c, o[0] + 12, o[1] + 12, P.butter);
  o = at(T.PATH); c.rect(...o, TS, TS, P.sandShade); speckle(c, ...o, 5, [P.sandDark, P.sand], 18);
  o = at(T.COBBLE); c.rect(...o, TS, TS, P.stoneShade);
  for (let row = 0; row < 4; row++)
    for (let col = -1; col < 3; col++) {
      const x = o[0] + col * 6 + (row % 2) * 3 + 1;
      const y = o[1] + row * 4 + 1;
      for (let yy = 0; yy < 3; yy++)
        for (let xx = 0; xx < 5; xx++) {
          const px = x + xx;
          if (px < o[0] || px >= o[0] + TS) continue;
          c.px(px, y + yy, yy === 0 ? P.cream : P.stone);
        }
    }
  o = at(T.PLAZA); c.rect(...o, TS, TS, P.stone);
  c.rect(o[0], o[1] + 7, TS, 1, P.stoneShade); c.rect(o[0] + 7, o[1], 1, TS, P.stoneShade);
  c.rect(o[0], o[1] + 15, TS, 1, P.stoneShade); c.rect(o[0] + 15, o[1], 1, TS, P.stoneShade);
  c.px(o[0] + 3, o[1] + 3, P.cream); c.px(o[0] + 11, o[1] + 11, P.cream);
  o = at(T.HEDGE); grass(c, ...o, 6, 0);
  c.ellipse(o[0] + 8, o[1] + 9, 7, 6, P.forest); c.ellipse(o[0] + 7, o[1] + 8, 6, 5, P.grassDark);
  c.ellipse(o[0] + 6, o[1] + 6, 3, 2, P.grassMid); c.px(o[0] + 5, o[1] + 5, P.grassLight);

  // Row 1 — beach & water
  o = at(T.SAND); c.rect(...o, TS, TS, P.sand); speckle(c, ...o, 8, [P.sandShade], 7);
  o = at(T.SAND2); c.rect(...o, TS, TS, P.sand); speckle(c, ...o, 9, [P.sandShade], 6);
  c.px(o[0] + 9, o[1] + 8, P.peach); c.px(o[0] + 10, o[1] + 8, P.cream); c.px(o[0] + 9, o[1] + 9, P.rose);
  o = at(T.SHORE); shore(c, ...o, 0);
  o = at(T.WATER); water(c, ...o, 0);
  o = at(T.WATER_B); water(c, ...o, 1);
  o = at(T.WATER_C); water(c, ...o, 2);
  o = at(T.SHORE_B); shore(c, ...o, 1);
  o = at(T.PIER); c.rect(...o, TS, TS, P.wood);
  for (let x = 3; x < TS; x += 4) c.rect(o[0] + x, o[1], 1, TS, P.woodDark);
  c.rect(o[0], o[1], TS, 1, P.peach, 0.6); c.rect(o[0], o[1] + 15, TS, 1, P.woodDeep);
  c.px(o[0] + 1, o[1] + 5, P.woodDeep); c.px(o[0] + 9, o[1] + 11, P.woodDeep);

  // Row 2 — buildings
  o = at(T.WALL); wallBase(c, ...o);
  o = at(T.WALL_WINDOW); wallBase(c, ...o); windowPane(c, o[0] + 4, o[1] + 3, 8, 7, true);
  o = at(T.DOOR); wallBase(c, ...o);
  c.rect(o[0] + 3, o[1] + 2, 10, 14, P.woodDeep); c.rect(o[0] + 4, o[1] + 3, 8, 13, P.wood);
  c.rect(o[0] + 4, o[1] + 3, 8, 1, P.peach, 0.5); c.px(o[0] + 10, o[1] + 10, P.butter);
  c.rect(o[0] + 5, o[1] + 5, 6, 3, P.woodDark);
  o = at(T.AWNING); wallBase(c, ...o);
  for (let x = 0; x < TS; x++) {
    const col = Math.floor(x / 4) % 2 ? P.cream : P.rose;
    c.rect(o[0] + x, o[1], 1, 10, col);
    if (x % 4 !== 0 && x % 4 !== 3) c.px(o[0] + x, o[1] + 10, col); // scalloped edge
  }
  c.rect(o[0], o[1], TS, 1, P.roseDark);
  c.rect(o[0], o[1] + 11, TS, 2, P.wallShade);
  o = at(T.ROOF_TL); shingles(c, ...o);
  for (let y = 0; y < TS; y++) for (let x = 0; x < Math.max(0, 3 - y); x++) c.clear(o[0] + x, o[1] + y);
  c.rect(o[0], o[1] + 2, 1, TS - 2, P.roofDark); c.rect(o[0], o[1], TS, 1, P.roofDark);
  o = at(T.ROOF_T); shingles(c, ...o); c.rect(o[0], o[1], TS, 1, P.roofDark);
  o = at(T.ROOF_TR); shingles(c, ...o);
  for (let y = 0; y < TS; y++) for (let x = 0; x < Math.max(0, 3 - y); x++) c.clear(o[0] + 15 - x, o[1] + y);
  c.rect(o[0] + 15, o[1] + 2, 1, TS - 2, P.roofDark); c.rect(o[0], o[1], TS, 1, P.roofDark);
  o = at(T.CAFE_WINDOW); wallBase(c, ...o); windowPane(c, o[0] + 2, o[1] + 2, 12, 10, true);
  c.rect(o[0] + 5, o[1] + 6, 4, 3, P.cream); c.px(o[0] + 9, o[1] + 7, P.cream); // a little cup
  c.px(o[0] + 6, o[1] + 4, P.white); c.px(o[0] + 7, o[1] + 3, P.white);

  // Row 3 — roof bottoms & street furniture
  for (const id of [T.ROOF_BL, T.ROOF_B, T.ROOF_BR]) {
    o = at(id); shingles(c, ...o);
    c.rect(o[0], o[1] + 13, TS, 3, P.woodDark); c.rect(o[0], o[1] + 13, TS, 1, P.roofHi);
  }
  o = at(T.ROOF_BL); c.rect(o[0], o[1], 1, 13, P.roofDark);
  o = at(T.ROOF_BR); c.rect(o[0] + 15, o[1], 1, 13, P.roofDark);
  o = at(T.FENCE);
  c.rect(o[0], o[1] + 6, TS, 2, P.wood); c.rect(o[0], o[1] + 11, TS, 2, P.wood);
  for (const x of [2, 12]) { c.rect(o[0] + x, o[1] + 3, 3, 12, P.woodDark); c.rect(o[0] + x, o[1] + 3, 3, 1, P.peach); }
  c.rect(o[0], o[1] + 15, TS, 1, P.forestDark, 0.25);
  o = at(T.BENCH_L); bench(c, ...o, 0);
  o = at(T.BENCH_R); bench(c, ...o, 1);
  o = at(T.LAMP_BASE);
  c.ellipse(o[0] + 8, o[1] + 14, 4, 1, P.forestDark, 0.3);
  c.rect(o[0] + 7, o[1], 2, 13, P.night2); c.rect(o[0] + 5, o[1] + 11, 6, 3, P.night2); c.px(o[0] + 7, o[1] + 2, P.lavender);
  o = at(T.LAMP_TOP);
  c.rect(o[0] + 7, o[1] + 9, 2, 7, P.night2);
  c.glow(o[0] + 8, o[1] + 5, 7, P.butter, 0.35);
  c.rect(o[0] + 5, o[1] + 2, 6, 6, P.night2); c.rect(o[0] + 6, o[1] + 3, 4, 4, P.butter); c.rect(o[0] + 6, o[1] + 3, 2, 2, P.cream);
  c.rect(o[0] + 4, o[1] + 1, 8, 1, P.night2);

  // Row 4 — trees & rocks
  cutTree(T.CANOPY_TL, 0, 0); cutTree(T.CANOPY_TR, 1, 0);
  cutTree(T.CANOPY_BL, 0, 1); cutTree(T.CANOPY_BR, 1, 1);
  cutTree(T.TRUNK_L, 0, 2); cutTree(T.TRUNK_R, 1, 2);
  o = at(T.ROCK);
  c.ellipse(o[0] + 8, o[1] + 13, 6, 2, P.forestDark, 0.25);
  c.ellipse(o[0] + 8, o[1] + 10, 6, 4, P.stoneDark); c.ellipse(o[0] + 7, o[1] + 9, 5, 3, P.stoneShade);
  c.ellipse(o[0] + 6, o[1] + 8, 2, 1, P.stone);
  o = at(T.SIGN);
  c.rect(o[0] + 7, o[1] + 8, 2, 8, P.woodDark);
  c.rect(o[0] + 2, o[1] + 2, 12, 7, P.woodDeep); c.rect(o[0] + 3, o[1] + 3, 10, 5, P.wood);
  c.rect(o[0] + 5, o[1] + 4, 6, 1, P.woodDeep); c.rect(o[0] + 5, o[1] + 6, 4, 1, P.woodDeep);

  // Row 5 — picnic, pots, beach towel, blocker, grass edge
  o = at(T.BLANKET_L); blanket(c, ...o, 0);
  o = at(T.BLANKET_R); blanket(c, ...o, 1);
  c.rect(o[0] + 3, o[1] + 5, 7, 5, P.woodDark); c.rect(o[0] + 4, o[1] + 6, 5, 3, P.wood); // basket
  c.line(o[0] + 4, o[1] + 5, o[0] + 6, o[1] + 2, P.woodDark); c.line(o[0] + 6, o[1] + 2, o[0] + 8, o[1] + 5, P.woodDark);
  o = at(T.FLOWER_POT);
  c.rect(o[0] + 4, o[1] + 9, 8, 6, P.terracotta); c.rect(o[0] + 3, o[1] + 8, 10, 2, P.orange);
  c.circle(o[0] + 8, o[1] + 5, 4, P.grassDark);
  flower(c, o[0] + 6, o[1] + 4, P.rose); flower(c, o[0] + 10, o[1] + 5, P.cream);
  o = at(T.TOWEL);
  for (let y = 2; y < 14; y++) for (let x = 3; x < 13; x++) c.px(o[0] + x, o[1] + y, Math.floor(y / 3) % 2 ? P.butter : P.rose);
  o = at(T.BLOCKER);
  c.rect(...o, TS, TS, '#e04040', 0.35); c.line(o[0], o[1], o[0] + 15, o[1] + 15, '#e04040'); c.line(o[0] + 15, o[1], o[0], o[1] + 15, '#e04040');
  o = at(T.GRASS_EDGE); grass(c, ...o, 10, 3);
  for (let y = 0; y < TS; y++) {
    const edge = 3 + Math.round(Math.sin(y * 0.9) * 1.5);
    for (let x = 0; x < edge; x++) c.px(o[0] + x, o[1] + y, P.sand);
    c.px(o[0] + edge, o[1] + y, P.grassMid);
  }

  return c;
}

/** The Tiled "tiles" array: per-tile properties and animations. */
export function tiledTileData() {
  const tiles = [];
  for (let id = 0; id < TILE_COUNT; id++) {
    const entry = { id };
    if (COLLIDES.includes(id)) entry.properties = [{ name: 'collides', type: 'bool', value: true }];
    if (ANIMATIONS[id]) entry.animation = ANIMATIONS[id];
    if (entry.properties || entry.animation) tiles.push(entry);
  }
  return tiles;
}

/**
 * The same tileset as a standalone Tiled .tsx file (with the collides
 * properties and water animations), for starting new maps in Tiled.
 * Remember to click "Embed Tileset" in the new map — Phaser needs it embedded.
 */
export function tiledTsx({ image, width, height }) {
  const tiles = tiledTileData()
    .map((t) => {
      const props = t.properties
        ? `  <properties>\n${t.properties.map((p) => `   <property name="${p.name}" type="${p.type}" value="${p.value}"/>`).join('\n')}\n  </properties>\n`
        : '';
      const anim = t.animation
        ? `  <animation>\n${t.animation.map((f) => `   <frame tileid="${f.tileid}" duration="${f.duration}"/>`).join('\n')}\n  </animation>\n`
        : '';
      return ` <tile id="${t.id}">\n${props}${anim} </tile>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.0" name="cosy" tilewidth="${TS}" tileheight="${TS}" tilecount="${TILE_COUNT}" columns="${COLUMNS}">
 <image source="${image}" width="${width}" height="${height}"/>
${tiles}
</tileset>
`;
}
