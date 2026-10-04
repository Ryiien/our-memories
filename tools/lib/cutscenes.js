// -----------------------------------------------------------------------------
// Layered 320x180 placeholder cutscenes. Each function returns
// { 'file.png': Canvas, ... } for one memory folder.
// Layers are designed to be stacked in order and animated by LayerAnimator.
// -----------------------------------------------------------------------------
import { Canvas, rng } from './canvas.js';
import { P } from './palette.js';

const W = 320;
const H = 180;
const PI = Math.PI;

// A few extra scene-only colours
const C = {
  nightSand1: '#8a7894',
  nightSand2: '#6f6080',
  nightSand3: '#574a66',
  headland: '#2a2547',
  seaLight: '#3d4682',
  cafeWall: '#ebcfa8',
  cafeWallShade: '#d9b88e',
  hazeBuilding: '#bcd3dc',
  hazeBuilding2: '#a9c4cf',
  farHill: '#b9dca0',
  nearHill: '#9cc98a',
  sunCore: '#fffbe6',
  sun: '#fff1b8',
  dusk2: '#d98a8a',
  dusk3: '#f2b38a',
  building1: '#3a2f52',
  building2: '#33294a',
  windowDark: '#2a2340',
  pavement: '#5a4a6a',
  pavementLight: '#6e5c80',
};

// ---- shared bits -------------------------------------------------------------

// The two of us. Scenes pass these into figure() (plus view/pose/flip/dim).
export const HER = {
  hair: 'bob', // ends at her jaw; a little neck shows from behind
  hairColor: P.herHair,
  hairHi: P.herHairHi,
  hairRoot: P.herRoots, // grown-out pink: dark roots on top
  skin: P.herSkin,
  blush: P.herBlush,
  top: P.herDress,
  topShade: P.herDressShade,
  dress: true, // short dress, so her legs show
  shoes: P.white,
  piercings: true, // eyebrow piercing
};
export const HIM = {
  hair: 'short', // short black hair with a fringe; neck shows from the back and side
  hairColor: P.himHair,
  hairHi: P.himHairHi,
  skin: P.himSkin,
  blush: P.himBlush,
  top: P.himJacket, // open brown jacket...
  topShade: P.himJacketShade,
  topHi: P.himJacketHi,
  jacket: true,
  inner: P.himShirt, // ...over a white shirt
  bottom: P.jeans,
  bottomShade: P.jeansShade,
  shoes: P.shoeDark,
  tall: true,
};

const FIG_W = 24;
const FIG_H = 48;

function sameColor(c, x, y, hex) {
  const [r, g, b, a] = c.get(x, y);
  const n = parseInt(hex.slice(1), 16);
  return a > 0 && r === ((n >> 16) & 255) && g === ((n >> 8) & 255) && b === (n & 255);
}

/** A little chibi person, 24x48, anchored at bottom-centre (12, 47). */
export function figure({
  view = 'front', // 'front' | 'back' | 'side' (side faces right)
  pose = 'stand', // 'stand' | 'sit'
  hair = 'long', // 'long' | 'bob' | 'short'
  hairColor = P.hair,
  hairHi = P.hairHi,
  hairRoot = null, // darker colour for the top of the head (grown-out dye)
  skin = P.skin,
  blush = P.blush,
  top = P.rose,
  topShade = P.roseDark,
  topHi = null, // highlight colour for the top (jacket shoulders)
  jacket = false, // open jacket: shows `inner` down the middle
  inner = P.white,
  bottom = P.blueDark,
  bottomShade = null,
  dress = false,
  shoes = P.woodDeep,
  tall = false,
  piercings = false,
  flip = false,
  dim = 0, // 0..1: blend towards night blue for dark scenes
} = {}) {
  const c = new Canvas(FIG_W, FIG_H);
  const cx = 12;
  const base = FIG_H - 1; // feet line
  const sit = pose === 'sit';
  const legLen = sit ? 0 : 11 + (tall ? 2 : 0);
  const bodyBottom = sit ? base - 10 : base - 2 - legLen;
  const bodyTop = bodyBottom - (sit ? 9 + (tall ? 2 : 0) : 14 + (tall ? 1 : 0));
  const headY = bodyTop - 6;
  const legColor = dress ? skin : bottom;
  const legShade = bottomShade ?? legColor;

  // hair that hangs behind the body
  // (a bob ends at the jaw; from the side its back sticks out past the body)
  const hang = hair === 'long' ? (view === 'side' ? 14 : 13) : hair === 'bob' ? (view === 'side' ? 5 : 6) : 0;
  if (hang && view === 'front') c.rect(cx - 6, headY, 13, hang, hairColor);
  if (hang && view === 'side') c.rect(cx - 6, headY, hair === 'long' ? 8 : 6, hang, hairColor);

  // legs
  if (!sit) {
    if (view === 'side') {
      c.rect(cx - 2, bodyBottom, 3, legLen, legColor);
      c.rect(cx - 2, base - 1, 5, 2, shoes);
    } else if (dress) {
      c.rect(cx - 3, bodyBottom, 2, legLen, skin);
      c.rect(cx + 1, bodyBottom, 2, legLen, skin);
      c.rect(cx - 4, base - 1, 3, 2, shoes);
      c.rect(cx + 1, base - 1, 3, 2, shoes);
    } else {
      c.rect(cx - 4, bodyBottom, 3, legLen, legColor);
      c.rect(cx + 1, bodyBottom, 3, legLen, legColor);
      c.rect(cx - 1, bodyBottom, 2, 2, legColor);
      c.rect(cx - 4, bodyBottom + legLen - 2, 3, 1, legShade);
      c.rect(cx + 1, bodyBottom + legLen - 2, 3, 1, legShade);
      c.rect(cx - 5, base - 1, 4, 2, shoes);
      c.rect(cx + 1, base - 1, 4, 2, shoes);
    }
  } else if (view === 'back') {
    c.ellipse(cx, bodyBottom + 2, 7, 3, dress ? topShade : bottom);
  } else if (view === 'front') {
    c.rect(cx - 5, bodyBottom, 10, 4, legColor); // knees towards us
    if (dress) c.rect(cx - 6, bodyBottom - 1, 12, 2, top);
    c.rect(cx - 5, bodyBottom + 4, 4, 2, shoes);
    c.rect(cx + 1, bodyBottom + 4, 4, 2, shoes);
  } else {
    c.rect(cx - 3, bodyBottom - 3, 10, 4, legColor); // thigh
    if (dress) c.rect(cx - 3, bodyBottom - 3, 6, 4, top);
    c.rect(cx + 5, bodyBottom, 3, 8, legColor); // shin
    c.rect(cx + 5, bodyBottom + 8, 5, 2, shoes);
  }

  // body
  const bw = view === 'side' ? 8 : 10;
  const bx = view === 'side' ? cx - 4 : cx - 5;
  c.rect(bx, bodyTop, bw, bodyBottom - bodyTop, top);
  c.rect(bx, bodyBottom - 3, bw, 3, topShade);
  c.clear(bx, bodyTop);
  c.clear(bx + bw - 1, bodyTop);
  if (dress && !sit) {
    // short skirt flare at the hips
    c.rect(bx - 1, bodyBottom - 4, bw + 2, 4, top);
    c.rect(bx - 1, bodyBottom - 1, bw + 2, 1, topShade);
  } else if (!dress) {
    c.rect(bx, bodyBottom - 2, bw, 2, bottom); // jeans waistband
  }

  // open jacket details: shirt down the middle, lapels, shoulders, pockets
  if (jacket) {
    const hi = topHi ?? top;
    const len = bodyBottom - 2 - bodyTop; // down to the waistband
    if (view === 'front') {
      c.rect(cx - 1, bodyTop, 2, len, inner);
      c.rect(cx - 2, bodyTop + 2, 1, len - 2, topShade); // jacket front edges
      c.rect(cx + 1, bodyTop + 2, 1, len - 2, topShade);
      c.px(cx - 2, bodyTop, inner); // shirt collar points
      c.px(cx + 1, bodyTop, inner);
      c.px(cx - 3, bodyTop + 1, topShade); // lapels
      c.px(cx + 2, bodyTop + 1, topShade);
      c.rect(bx + 1, bodyTop, 2, 1, hi);
      c.rect(bx + bw - 3, bodyTop, 2, 1, hi);
      c.rect(bx + 1, bodyBottom - 5, 2, 1, topShade); // pockets
      c.rect(bx + bw - 3, bodyBottom - 5, 2, 1, topShade);
    } else if (view === 'side') {
      c.rect(bx + bw - 1, bodyTop + 1, 1, len - 1, inner);
      c.rect(bx + bw - 2, bodyTop + 1, 1, len - 1, topShade);
      c.rect(bx + 1, bodyTop, 3, 1, hi);
    } else {
      c.rect(cx - 3, bodyTop, 6, 1, topShade); // collar
      c.rect(bx + 1, bodyTop + 1, 2, 1, hi);
      c.rect(bx + bw - 3, bodyTop + 1, 2, 1, hi);
      c.rect(cx - 1, bodyTop + 3, 1, Math.max(1, len - 4), topShade); // back seam
    }
  }

  // arms
  if (view === 'side') {
    // dress: bare arm with a little sleeve; otherwise a full sleeve
    c.rect(cx - 1, bodyTop + 1, 3, dress ? 2 : 8, topShade);
    if (dress) c.rect(cx - 1, bodyTop + 3, 2, 6, skin);
    c.rect(cx, bodyTop + 9, 2, 2, skin);
  } else {
    const sleeve = view === 'back' ? topShade : top;
    // her dress is sleeveless-ish: show skin arms; shirts have sleeves
    const upper = dress ? skin : sleeve;
    c.rect(bx - 2, bodyTop + 1, 2, 7, upper);
    c.rect(bx + bw, bodyTop + 1, 2, 7, upper);
    if (dress) {
      c.rect(bx - 2, bodyTop + 1, 2, 2, sleeve);
      c.rect(bx + bw, bodyTop + 1, 2, 2, sleeve);
    }
    if (jacket) {
      c.rect(bx - 2, bodyTop + 7, 2, 1, topShade); // cuffs
      c.rect(bx + bw, bodyTop + 7, 2, 1, topShade);
    }
    c.rect(bx - 2, bodyTop + 8, 2, 2, skin);
    c.rect(bx + bw, bodyTop + 8, 2, 2, skin);
  }

  // head
  if (view === 'back') {
    c.circle(cx, headY, 5.5, hairColor);
    if (hair === 'long') c.rect(cx - 6, headY, 13, sit ? 12 : 14, hairColor);
    if (hair === 'bob') {
      c.rect(cx - 6, headY, 13, 4, hairColor);
      c.rect(cx - 2, headY + 4, 4, 2, skin); // a little neck below the bob
    }
    c.px(cx - 2, headY - 4, hairHi);
    c.px(cx - 1, headY - 4, hairHi);
    c.px(cx - 3, headY - 3, hairHi);
  } else {
    const fx = view === 'side' ? cx + 2 : cx;
    c.circle(cx, headY - 1, 5.5, hairColor);
    c.ellipse(fx, headY + 1.5, view === 'side' ? 3.5 : 4, 3.5, skin);
    c.rect(fx - 4, headY - 3, 8, 2, hairColor); // fringe
    if (hair === 'bob' && view === 'front') {
      // hair framing the face down to the jaw
      c.rect(cx - 6, headY - 1, 2, 6, hairColor);
      c.rect(cx + 5, headY - 1, 2, 6, hairColor);
    }
    if (view === 'side') {
      c.px(fx + 1, headY + 1, P.plum); // eye
      c.px(fx + 1, headY + 3, blush);
      c.px(fx + 4, headY + 2, skin); // nose
    } else {
      c.px(fx - 2, headY + 1, P.plum);
      c.px(fx + 2, headY + 1, P.plum);
      c.px(fx - 3, headY + 2, blush);
      c.px(fx + 3, headY + 2, blush);
      if (piercings) c.px(fx - 3, headY - 1, P.silver); // eyebrow piercing (her right)
    }
    c.px(cx - 2, headY - 5, hairHi);
    c.px(cx - 1, headY - 5, hairHi);
  }

  // Short hair: trim everything below the hairline so the neck shows (back and
  // side) and the head isn't framed by hair (front).
  if (hair === 'short') {
    const trimFrom = headY + 2;
    for (let y = trimFrom; y <= headY + 6; y++)
      for (let x = 0; x < FIG_W; x++) {
        if (!sameColor(c, x, y, hairColor)) continue;
        if (view !== 'front' && x >= cx - 2 && x <= cx + 1) c.px(x, y, skin); // neck
        else c.clear(x, y);
      }
  }

  // Grown-out roots: recolour the top of the hair dark, dithering into the
  // dye a couple of rows down (so the fringe is dark at the root, pink at the ends).
  if (hairRoot) {
    for (let y = headY - 7; y <= headY - 2; y++)
      for (let x = 0; x < FIG_W; x++) {
        if (!sameColor(c, x, y, hairColor) && !sameColor(c, x, y, hairHi)) continue;
        if (y < headY - 3 || (x + y) % 2 === 0) c.px(x, y, hairRoot);
      }
  }

  c.outline(P.plum);

  if (dim > 0) {
    const night = [38, 35, 71];
    for (let y = 0; y < FIG_H; y++)
      for (let x = 0; x < FIG_W; x++) {
        const [r, g, b, a] = c.get(x, y);
        if (!a) continue;
        c.clear(x, y);
        c.px(x, y, [r + (night[0] - r) * dim, g + (night[1] - g) * dim, b + (night[2] - b) * dim].map(Math.round), a / 255);
      }
  }

  if (!flip) return c;
  const m = new Canvas(c.width, c.height);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const [r, g, b, a] = c.get(x, y);
      if (a) m.px(c.width - 1 - x, y, [r, g, b], a / 255);
    }
  return m;
}

/** Place a figure so its feet land at (x, baseY). */
function place(c, fig, x, baseY) {
  c.blit(fig, Math.round(x - FIG_W / 2), Math.round(baseY - (fig.height - 1)));
}

function starField(c, r, count, { maxY = 100, avoid = () => false } = {}) {
  for (let i = 0; i < count; i++) {
    const x = r.int(2, W - 3);
    const y = r.int(2, maxY);
    if (avoid(x, y)) continue;
    const color = r.pick([P.cream, P.white, P.butter, P.lavender, P.cream]);
    c.px(x, y, color);
    if (r() < 0.14) {
      c.px(x - 1, y, color, 0.5);
      c.px(x + 1, y, color, 0.5);
      c.px(x, y - 1, color, 0.5);
      c.px(x, y + 1, color, 0.5);
    }
  }
}

/** Fluffy cloud; drawn three times (x-W, x, x+W) so the layer wraps seamlessly. */
function cloud(c, x, y, w, light = P.white, shade = P.skyPale) {
  for (const ox of [-W, 0, W]) {
    const cx = x + ox;
    c.ellipse(cx, y + 2, w * 0.5, 5, shade);
    c.ellipse(cx - w * 0.22, y, w * 0.25, 5, light);
    c.ellipse(cx + w * 0.12, y - 3, w * 0.24, 7, light);
    c.ellipse(cx + w * 0.32, y + 1, w * 0.18, 4, light);
    c.rect(cx - w * 0.45, y + 2, w * 0.9, 3, light);
  }
}

// Small hearts look best hand-pixelled; bigger ones use the maths heart curve.
const SMALL_HEARTS = {
  5: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  7: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
};
function heartShape(c, cx, cy, size, color, alpha = 1) {
  if (size <= 7) {
    const rows = size <= 5 ? SMALL_HEARTS[5] : SMALL_HEARTS[7];
    const ox = cx - Math.floor(rows[0].length / 2);
    const oy = cy - Math.floor(rows.length / 2);
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && c.px(ox + x, oy + y, color, alpha)));
    return;
  }
  const s = size / 2;
  for (let y = -size; y <= size; y++)
    for (let x = -size; x <= size; x++) {
      const nx = x / s;
      const ny = -y / s + 0.3;
      const a = nx * nx + ny * ny - 1;
      if (a * a * a - nx * nx * ny * ny * ny <= 0) c.px(cx + x, cy + y, color, alpha);
    }
}

// ---- 1. Apollo Bay: night on the beach ---------------------------------------
export function apolloBay() {
  const r = rng(11);
  const horizon = 90;
  const hill = (x) => (x < 196 ? horizon : Math.round(horizon - Math.min(16, (x - 196) * 0.22) + Math.sin(x * 0.15) * 1.2));
  const sandTop = (x) => 132 + Math.round(Math.sin(x * 0.05) * 1.5);

  const sky = new Canvas(W, H);
  sky.gradientV(0, 0, W, horizon, [P.night0, P.night1, P.night2, P.night3, P.night4, P.night5, P.dusk]);
  sky.rect(0, horizon, W, H - horizon, P.night1);
  for (let x = 196; x < W; x++) for (let y = hill(x); y < horizon; y++) sky.px(x, y, C.headland);
  sky.circle(252, 34, 10, P.cream);
  sky.circle(249, 31, 2, P.creamShade);
  sky.circle(255, 38, 1.5, P.creamShade);
  sky.px(256, 30, P.creamShade);

  const stars = new Canvas(W, H);
  starField(stars, r, 110, { maxY: 82, avoid: (x, y) => Math.hypot(x - 252, y - 34) < 22 || y > hill(x) - 3 });

  const glow = new Canvas(W, H);
  glow.glow(252, 34, 30, P.cream, 0.3);

  const lights = new Canvas(W, H);
  for (let i = 0; i < 14; i++) {
    const x = r.int(212, 316);
    const y = Math.min(horizon - 2, hill(x) + r.int(2, 9));
    lights.glow(x, y, 3, P.butter, 0.35);
    lights.px(x, y, r() < 0.5 ? P.butter : P.orange);
    if (r() < 0.3) lights.px(x + 1, y, P.butter);
  }

  const sea = new Canvas(W, H);
  sea.gradientV(0, horizon, W, 46, [C.seaLight, P.night3, P.night2, P.night2, P.night1]);
  for (let y = horizon + 2; y < 134; y += 2) {
    const half = 3 + (y - horizon) * 0.3;
    for (let x = Math.round(252 - half); x <= 252 + half; x++) {
      if (r() < 0.45) sea.px(x, y, r() < 0.5 ? P.cream : P.lavender, 0.9);
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(horizon + 3, 132);
    const len = r.int(2, 6);
    for (let k = 0; k < len; k++) sea.px((x + k) % W, y, P.lavender, 0.45);
  }

  const sand = new Canvas(W, H);
  for (let x = 0; x < W; x++) for (let y = sandTop(x); y < H; y++) sand.px(x, y, C.nightSand2);
  sand.gradientV(0, 140, W, 40, [C.nightSand2, C.nightSand3]);
  for (let i = 0; i < 90; i++) sand.px(r.int(0, W - 1), r.int(136, H - 1), r() < 0.5 ? C.nightSand1 : C.nightSand3);
  sand.ellipse(158, 146, 18, 3, P.berry); // blanket
  sand.ellipse(158, 145, 16, 2, P.roseDark);

  // three frames side by side (960x180) — the foam creeping up and back
  const foam = new Canvas(W * 3, H);
  [0, 2, 1].forEach((lift, f) => {
    for (let x = 0; x < W; x++) {
      const y0 = sandTop(x) - lift + Math.round(Math.sin(x * 0.07 + f * 2.1) * 1.4);
      for (let y = sandTop(x); y < y0 + 4; y++) foam.px(f * W + x, y, C.nightSand3, 0.5); // wet sand
      if (Math.sin(x * 0.31 + f * 1.7) > -0.4) foam.px(f * W + x, y0, P.foam, 0.9);
      if (Math.sin(x * 0.53 + f) > 0.3) foam.px(f * W + x, y0 + 1, P.lavender, 0.7);
      if ((x * 7 + f * 13) % 23 === 0) foam.px(f * W + x, y0 + 3, P.foam, 0.6);
    }
  });

  const us = new Canvas(W, H);
  // moonlit, so both figures are dimmed towards the night colours
  place(us, figure({ ...HER, view: 'back', pose: 'sit', dim: 0.35 }), 151, 148);
  place(us, figure({ ...HIM, view: 'back', pose: 'sit', dim: 0.35 }), 166, 148);

  return {
    'sky.png': sky, 'stars.png': stars, 'glow.png': glow, 'lights.png': lights,
    'sea.png': sea, 'sand.png': sand, 'foam.png': foam, 'us.png': us,
  };
}

// ---- 2. The café -------------------------------------------------------------
export function cafe() {
  const r = rng(22);
  const win = { x: 40, y: 22, w: 120, h: 74 };

  const sky = new Canvas(W, H);
  sky.gradientV(0, 0, W, 110, [P.sky, P.skyLight, P.skyPale]);
  sky.rect(0, 110, W, 70, P.skyPale);
  for (const [x, w, h, col] of [[38, 30, 26, C.hazeBuilding], [66, 22, 34, C.hazeBuilding2], [88, 40, 22, C.hazeBuilding], [126, 36, 30, C.hazeBuilding2]]) {
    sky.rect(x, 96 - h, w, h, col);
    for (let wy = 96 - h + 4; wy < 92; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) sky.rect(wx, wy, 3, 3, P.skyLight);
  }

  const clouds = new Canvas(W, H);
  cloud(clouds, 40, 34, 46, P.white, '#dfeef3');
  cloud(clouds, 150, 50, 38, P.white, '#dfeef3');
  cloud(clouds, 250, 28, 54, P.white, '#dfeef3');

  const interior = new Canvas(W, H);
  interior.rect(0, 0, W, H, C.cafeWall);
  for (let x = 4; x < W; x += 8) interior.rect(x, 0, 1, 118, C.cafeWallShade, 0.45);
  // cut the window out so the sky shows through
  for (let y = win.y; y < win.y + win.h; y++) for (let x = win.x; x < win.x + win.w; x++) interior.clear(x, y);
  const frame = (x, y, w, h) => interior.rect(x, y, w, h, P.woodDark);
  frame(win.x - 3, win.y - 3, win.w + 6, 3);
  frame(win.x - 3, win.y + win.h, win.w + 6, 3);
  frame(win.x - 3, win.y, 3, win.h);
  frame(win.x + win.w, win.y, 3, win.h);
  frame(win.x + win.w / 2 - 1, win.y, 2, win.h);
  frame(win.x, win.y + win.h / 2 - 1, win.w, 2);
  interior.rect(win.x - 6, win.y + win.h + 3, win.w + 12, 4, P.wood);
  interior.rect(win.x - 6, win.y + win.h + 3, win.w + 12, 1, P.peach);
  // shelves with jars
  for (const sy of [44, 76]) {
    interior.rect(206, sy, 96, 3, P.wood);
    interior.rect(206, sy + 3, 96, 1, P.woodDeep);
    for (let x = 210; x < 296; x += r.int(10, 14)) {
      const h = r.int(7, 12);
      const col = r.pick([P.butter, P.rose, P.lavender, P.cream, P.peach, P.grassMid]);
      interior.rect(x, sy - h, 7, h, col);
      interior.rect(x, sy - h, 7, 2, P.woodDark);
      interior.px(x + 1, sy - h + 3, P.white);
    }
  }
  // a little framed heart picture
  interior.rect(174, 30, 20, 18, P.woodDark);
  interior.rect(176, 32, 16, 14, P.cream);
  heartShape(interior, 184, 39, 7, P.rose);
  // wood panelling
  interior.rect(0, 118, W, 62, P.wood);
  for (let x = 6; x < W; x += 12) interior.rect(x, 120, 1, 60, P.woodDark);
  interior.rect(0, 118, W, 2, P.woodDeep);
  interior.rect(0, 120, W, 1, P.peach, 0.6);

  const fairy = new Canvas(W, H);
  const span = 320 / 3;
  const sag = (x) => 6 + Math.round(Math.sin(PI * ((x % span) / span)) * 9);
  for (let x = 0; x < W; x++) fairy.px(x, sag(x), P.plum);
  const bulbs = [P.butter, P.rose, P.skyLight, P.butter, P.lavender];
  for (let x = 5, i = 0; x < W; x += 13, i++) {
    const y = sag(x) + 2;
    fairy.glow(x, y, 4, bulbs[i % bulbs.length], 0.4);
    fairy.rect(x, y, 2, 2, bulbs[i % bulbs.length]);
    fairy.px(x, y, P.white);
  }

  const plant = new Canvas(W, H);
  plant.rect(16, 152, 22, 20, P.terracotta);
  plant.rect(14, 149, 26, 4, P.orange);
  plant.rect(16, 168, 22, 4, P.roseDark);
  for (let i = 0; i < 9; i++) {
    const a = PI * (0.15 + (i / 8) * 0.7); // fan of leaves
    const len = r.int(26, 44);
    for (let t = 0; t < len; t++) {
      const x = 27 - Math.cos(a) * t * 0.7;
      const y = 150 - Math.sin(a) * t;
      plant.px(x, y, t > len - 6 ? P.grassMid : P.grassDark);
      if (t % 4 === 0 && t > 6) {
        plant.ellipse(x + (i % 2 ? 2 : -2), y, 2, 1, i % 2 ? P.grass : P.grassMid);
      }
    }
  }

  const us = new Canvas(W, H);
  place(us, figure({ ...HER, view: 'side', pose: 'sit' }), 122, 140);
  place(us, figure({ ...HIM, view: 'side', pose: 'sit', flip: true }), 198, 140);

  const table = new Canvas(W, H);
  table.rect(152, 146, 16, 30, P.woodDark);
  table.rect(140, 174, 40, 4, P.woodDeep);
  table.rect(96, 134, 128, 7, P.wood);
  table.rect(96, 134, 128, 1, P.peach);
  table.rect(96, 141, 128, 4, P.woodDark);
  for (const cupX of [140, 172]) {
    table.ellipse(cupX + 4, 134, 7, 1.5, P.creamShade);
    table.rect(cupX, 126, 9, 8, P.cream);
    table.rect(cupX, 129, 9, 2, P.rose);
    table.rect(cupX + 9, 128, 2, 4, P.cream);
    table.rect(cupX + 1, 126, 7, 1, P.woodDeep);
  }
  table.rect(158, 120, 4, 14, P.skyLight); // vase
  table.px(160, 117, P.grassDark);
  table.px(160, 118, P.grassDark);
  heartShape(table, 160, 115, 5, P.rose);

  // 4 frames of rising steam (1280x180)
  const steam = new Canvas(W * 4, H);
  for (let f = 0; f < 4; f++)
    for (const cupX of [144, 176])
      for (let wisp = 0; wisp < 2; wisp++)
        for (let y = 124; y > 100; y--) {
          const t = (124 - y) / 24;
          const x = cupX + wisp * 3 - 1 + Math.sin((y + f * 5 + wisp * 9) * 0.3) * (1 + t * 2);
          if ((y + f + wisp) % 3 !== 0) steam.px(f * W + x, y, P.white, 0.75 * (1 - t));
        }

  return {
    'sky.png': sky, 'clouds.png': clouds, 'interior.png': interior, 'fairy-lights.png': fairy,
    'plant.png': plant, 'us.png': us, 'table.png': table, 'steam.png': steam,
  };
}

// ---- 3. Park picnic -----------------------------------------------------------
export function parkPicnic() {
  const r = rng(33);

  const sky = new Canvas(W, H);
  sky.gradientV(0, 0, W, 110, [P.sky, P.skyLight, P.skyPale]);
  sky.rect(0, 110, W, 70, P.grassMid);
  for (let x = 0; x < W; x++) {
    const far = Math.round(100 + Math.sin(x * 0.02) * 6);
    const near = Math.round(110 + Math.sin(x * 0.031 + 1) * 5);
    for (let y = far; y < 120; y++) sky.px(x, y, C.farHill);
    for (let y = near; y < 120; y++) sky.px(x, y, C.nearHill);
  }

  const sun = new Canvas(W, H);
  sun.glow(64, 32, 28, P.butter, 0.32);
  sun.circle(64, 32, 11, C.sun);
  sun.circle(62, 30, 6, C.sunCore);

  const clouds = new Canvas(W, H);
  cloud(clouds, 150, 30, 50, P.white, '#e3f1ef');
  cloud(clouds, 270, 52, 36, P.white, '#e3f1ef');

  const ground = new Canvas(W, H);
  ground.gradientV(0, 116, W, 64, [P.grassLight, P.grass, P.grassMid]);
  for (let i = 0; i < 220; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(118, H - 1);
    ground.px(x, y, r() < 0.5 ? P.grassDark : P.grassLight);
    if (r() < 0.12) {
      const col = r.pick([P.rose, P.cream, P.butter, P.lavender]);
      ground.px(x, y - 1, col);
      ground.px(x - 1, y, col);
      ground.px(x + 1, y, col);
    }
  }
  // gingham picnic blanket (a slightly squashed trapezoid for perspective)
  for (let y = 124; y < 144; y++) {
    const inset = Math.round((144 - y) * 0.4);
    for (let x = 122 + inset; x < 202 - inset; x++) {
      const check = (Math.floor((x - 122) / 5) + Math.floor((y - 124) / 4)) % 2;
      ground.px(x, y, check ? P.rose : P.cream);
    }
  }
  ground.rect(186, 118, 14, 10, P.woodDark); // basket
  ground.rect(187, 119, 12, 8, P.wood);
  ground.line(188, 118, 193, 112, P.woodDark);
  ground.line(193, 112, 198, 118, P.woodDark);

  const trees = new Canvas(W, H);
  const tree = (x, baseY, size) => {
    trees.ellipse(x, baseY, size * 0.6, 2, P.grassDark, 0.5);
    trees.rect(x - 3, baseY - size * 1.6, 6, size * 1.6, P.woodDark);
    trees.rect(x - 2, baseY - size * 1.6, 2, size * 1.6, P.wood);
    const cy = baseY - size * 1.9;
    trees.circle(x, cy, size, P.forest);
    trees.circle(x - 2, cy - 2, size * 0.85, P.grassDark);
    trees.circle(x - 4, cy - 4, size * 0.55, P.grassMid);
    trees.circle(x - 6, cy - 7, size * 0.25, P.grass);
  };
  tree(42, 126, 22);
  tree(276, 128, 26);
  tree(312, 124, 14);

  const us = new Canvas(W, H);
  place(us, figure({ ...HER, view: 'front', pose: 'sit' }), 152, 140);
  place(us, figure({ ...HIM, view: 'front', pose: 'sit' }), 172, 140);

  // 4 frames of two fluttering butterflies (1280x180)
  const butterflies = new Canvas(W * 4, H);
  for (let f = 0; f < 4; f++) {
    for (const [bx, by, col] of [[108, 92, P.butter], [228, 104, P.lavender]]) {
      const x = f * W + bx + Math.round(Math.cos((f * PI) / 2) * 5);
      const y = by + Math.round(Math.sin((f * PI) / 2) * 3);
      butterflies.px(x, y, P.plum);
      butterflies.px(x, y + 1, P.plum);
      if (f % 2 === 0) {
        butterflies.rect(x - 3, y - 1, 3, 3, col);
        butterflies.rect(x + 1, y - 1, 3, 3, col);
        butterflies.px(x - 2, y, P.white);
        butterflies.px(x + 2, y, P.white);
      } else {
        butterflies.rect(x - 1, y - 2, 1, 3, col);
        butterflies.rect(x + 1, y - 2, 1, 3, col);
      }
    }
  }

  return {
    'sky.png': sky, 'sun.png': sun, 'clouds.png': clouds, 'ground.png': ground,
    'trees.png': trees, 'us.png': us, 'butterflies.png': butterflies,
  };
}

// ---- 4. First date (hidden): a lamp-lit street at dusk ------------------------
export function firstDate() {
  const r = rng(44);
  const street = 140;
  const blocks = [[0, 60, 62], [60, 110, 48], [110, 152, 74], [152, 210, 40], [210, 262, 58], [262, 320, 46]];

  const sky = new Canvas(W, H);
  sky.gradientV(0, 0, W, street, [P.night2, P.night3, P.night4, P.night5, P.dusk, C.dusk2, C.dusk3]);
  sky.rect(0, street, W, H - street, C.pavement);

  const stars = new Canvas(W, H);
  starField(stars, r, 40, { maxY: 56 });

  const streetImg = new Canvas(W, H);
  const windows = new Canvas(W, H);
  blocks.forEach(([x0, x1, h], i) => {
    const top = street - h;
    streetImg.rect(x0, top, x1 - x0, h, i % 2 ? C.building2 : C.building1);
    streetImg.rect(x0, top, x1 - x0, 2, P.night4);
    if (i % 2 === 0) streetImg.rect(x0 + 8, top - 6, 5, 6, C.building1); // chimney
    for (let wy = top + 7; wy < street - 10; wy += 11)
      for (let wx = x0 + 6; wx < x1 - 8; wx += 10) {
        streetImg.rect(wx, wy, 5, 6, C.windowDark);
        if (r() < 0.45) {
          windows.rect(wx, wy, 5, 6, P.butter);
          windows.rect(wx, wy + 4, 5, 2, P.orange);
          windows.px(wx + 1, wy + 1, P.cream);
        }
      }
  });
  streetImg.rect(0, street, W, H - street, C.pavement);
  streetImg.rect(0, street, W, 2, C.pavementLight);
  for (let x = 0; x < W; x += 24) streetImg.line(x, street + 2, x - 10, H, C.pavementLight);
  streetImg.rect(231, 70, 3, 72, P.night1); // lamp post
  streetImg.rect(226, 140, 13, 3, P.night1);
  streetImg.rect(226, 62, 13, 3, P.night1);
  streetImg.rect(227, 65, 2, 8, P.night1);
  streetImg.rect(236, 65, 2, 8, P.night1);
  streetImg.rect(226, 73, 13, 2, P.night1);

  const glow = new Canvas(W, H);
  glow.glow(232, 69, 36, P.butter, 0.42);
  glow.ellipse(228, 148, 44, 9, P.butter, 0.14);
  glow.ellipse(228, 148, 30, 6, P.butter, 0.14);
  glow.rect(229, 65, 7, 8, P.butter);
  glow.rect(230, 66, 3, 4, P.cream);

  const us = new Canvas(W, H);
  place(us, figure({ ...HER, view: 'front' }), 204, 148);
  place(us, figure({ ...HIM, view: 'front' }), 218, 148);
  us.rect(209, 127, 4, 2, P.herSkin); // holding hands
  heartShape(us, 211, 96, 7, P.rose);

  return {
    'sky.png': sky, 'stars.png': stars, 'street.png': streetImg,
    'windows.png': windows, 'glow.png': glow, 'us.png': us,
  };
}

// ---- Finale background ---------------------------------------------------------
export function finale() {
  const r = rng(55);
  const sky = new Canvas(W, H);
  sky.gradientV(0, 0, W, H, [P.night0, P.night1, P.night2, P.night3, P.night4, P.night5, P.dusk]);

  const stars = new Canvas(W, H);
  starField(stars, r, 120, { maxY: 150 });

  const hearts = new Canvas(W, H);
  for (let i = 0; i < 14; i++) {
    const x = r.int(0, W - 1);
    const y = r.int(70, 172);
    const size = r.pick([5, 5, 7]);
    const col = r.pick([P.rose, P.lavender, P.peach, P.rose]);
    for (const ox of [-W, 0, W]) heartShape(hearts, x + ox, y, size, col, 0.75);
  }

  const heart = new Canvas(W, H);
  heart.glow(160, 32, 26, P.rose, 0.35);
  heartShape(heart, 160, 32, 10, P.roseDark);
  heartShape(heart, 160, 31, 9, P.rose);
  heart.rect(155, 26, 2, 2, P.cream);

  return { 'sky.png': sky, 'stars.png': stars, 'hearts.png': hearts, 'heart.png': heart };
}
