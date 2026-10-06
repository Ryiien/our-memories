// -----------------------------------------------------------------------------
// The placeholder finale background, plus figure() — the little chibi person
// the first date scene still uses. (Every memory now has its own hand-drawn
// script in tools/scenes/.) finale() returns { 'file.png': Canvas, ... }.
// -----------------------------------------------------------------------------
import { Canvas, rng } from './canvas.js';
import { P } from './palette.js';

const W = 320;
const H = 180;

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
  partyDress: true, // her pink dress in detail (front/back, standing): see PARTY_DRESS below
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

// Her dress in detail, matching the walking sprite (tools/lib/sprites.js) and
// the fishing scene: puff sleeves with a crease under them, a lace scoop
// neckline, a berry sash (tied in a bow at the back, tails down the skirt),
// soft pleats and a lace hem with little scallops. 14 wide (arms included),
// drawn from the top of her body down to just above her legs; figure() puts it
// on when partyDress is set and she's standing, seen from the front or back.
const PARTY_DRESS = {
  front: [
    '.LLLdcsscdLLL.',
    'LLLLddddddLLLL',
    'EEEddddddddEEE',
    'sSddddddddddSs',
    'sSdLddddddLdSs',
    'sSRRRRRRRRRRSs',
    'sSdDdLddLdDdSs',
    'sSdDdLddLdDdSs',
    'ssdDdLddLdDdss',
    'ssdDdLddLdDdss',
    '.dDddLddLddDd.',
    '.dDddLddLddDd.',
    '.cCcCcCcCcCcC.',
    '..c.c.c.c.c.c.',
  ],
  back: [
    '.LLLddddddLLL.',
    'LLLLddddddLLLL',
    'EEEddddddddEEE',
    'sSddddddddddSs',
    'sSddbbddbbddSs',
    'sSRbrbRRbrbRSs',
    'sSdDbbRRbbDdSs',
    'sSdDdLRRLdDdSs',
    'ssdDdLRdLdDdss',
    'ssdDdLRdLdDdss',
    '.dDddLRdLddDd.',
    '.dDddLdRLddDd.',
    '.cCcCcCRcCcCC.',
    '..c.c.c.c.c.c.',
  ],
  colors: {
    d: P.herDress, D: P.herDressShade, L: P.herDressHi, E: P.herDressDeep,
    c: P.cream, C: P.creamShade, R: P.berry, b: P.roseDark, r: P.rose,
    s: P.herSkin, S: P.herSkinShade,
  },
};

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
  partyDress = false,
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
  } else if (jacket && sit && view === 'back') {
    // sitting, seen from behind: the jacket hangs down over the seat, so only a
    // sliver of jeans shows at the sides and bottom
    c.rect(bx, bodyBottom, bw, 3, topShade);
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

  // her detailed dress replaces the plain one (and redraws the arms to match)
  if (partyDress && dress && !sit && !tall && (view === 'front' || view === 'back')) {
    const rows = PARTY_DRESS[view];
    for (let y = bodyTop; y < bodyTop + rows.length; y++) for (let x = cx - 7; x < cx + 7; x++) c.clear(x, y);
    c.map(rows, PARTY_DRESS.colors, cx - 7, bodyTop);
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
  // From behind the hair comes further down (a low hairline, ears at the sides),
  // so only a short bit of neck shows above the collar.
  if (hair === 'short') {
    const trimFrom = headY + (view === 'back' ? 4 : 2);
    for (let y = trimFrom; y <= headY + 6; y++)
      for (let x = 0; x < FIG_W; x++) {
        if (!sameColor(c, x, y, hairColor)) continue;
        if (view !== 'front' && x >= cx - 2 && x <= cx + 1) c.px(x, y, skin); // neck
        else c.clear(x, y);
      }
    if (view === 'back') {
      c.rect(cx - 6, headY, 1, 2, skin); // ears
      c.rect(cx + 6, headY, 1, 2, skin);
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
