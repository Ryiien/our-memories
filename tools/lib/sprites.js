// -----------------------------------------------------------------------------
// Player spritesheet + UI images.
//
// sprites/player.png: 64x96 = 4 columns x 4 rows of 16x24 frames
//   row 0 = walking down (towards the camera)
//   row 1 = walking left
//   row 2 = walking right
//   row 3 = walking up (away from the camera)
//   column 0 is also the standing-still pose for that direction.
// -----------------------------------------------------------------------------
import { Canvas } from './canvas.js';
import { P } from './palette.js';

const SPR = {
  o: P.plum, // outline
  k: P.herRoots, // dark roots at the top of her head
  h: P.herHair, // pink lengths
  H: P.herHairHi,
  s: P.herSkin,
  S: P.herSkinShade,
  e: P.plum, // eyes
  b: P.herBlush,
  m: P.berry, // mouth
  p: P.silver, // eyebrow piercing
  d: P.herDress,
  D: P.herDressShade,
  W: P.white, // shoes
};

// Upper body (rows 0–17) for each facing. Legs (rows 18–23) are added per frame.
// Her hair: a grown-out pink bob — dark roots on top, pink lengths ending at
// her jaw, and a side-swept fringe that's dark at the root and pink at the
// ends. Eyebrow piercing is one silver pixel.
const FRONT = [
  '................',
  '.....oooooo.....',
  '....okkkkkko....',
  '...okkkkkkkko...',
  '...okkhkkhkko...',
  '..okhkhhkhhkho..',
  '..ohhpsssshhho..',
  '..ohsessssesho..',
  '..ohsbssssbsho..',
  '..ohhssmmsshho..',
  '..ohhhsssshhho..',
  '..oooossssoooo..',
  '...oddddddddo...',
  '..osddddddddso..',
  '..osddddddddso..',
  '..osDddddddDso..',
  '..oDddddddddDo..',
  '..oooooooooooo..',
];

// From behind, the bob ends at the nape so a little of her neck shows.
const BACK = [
  '................',
  '.....oooooo.....',
  '....okkkkkko....',
  '...okkkkkkkko...',
  '...okkhkkhkko...',
  '..okhkhhkhhkho..',
  '..ohhhhhhhhhho..',
  '..ohhhhHhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '..ohhhhhhhhhho..',
  '...ooossssooo...',
  '...oddddddddo...',
  '..osddddddddso..',
  '..osddddddddso..',
  '..osDddddddDso..',
  '..oDddddddddDo..',
  '..oooooooooooo..',
];

// Facing right (left is mirrored). The back of the bob sticks out one pixel
// further than the dress (hair edge in column 2, dress edge in column 3) so
// her head and body don't merge into one shape.
const SIDE = [
  '................',
  '.....ooooo......',
  '....okkkkko.....',
  '...okkkkkkko....',
  '..okkhkkhkkko...',
  '..ohkhhkhhhho...',
  '..ohhhhhhhsso...',
  '..ohhhhhhseso...',
  '..ohhhhhhsbsso..',
  '..ohhhhhhsmso...',
  '..ohhhhhhsso....',
  '..oooooosso.....',
  '...odddddddo....',
  '...oddddsddo....',
  '...oddddsddo....',
  '...odddDsDdo....',
  '...odddDdddo....',
  '...ooooooooo....',
];

// Legs for rows 18–23, per walk frame [stand, stepA, stand, stepB].
// The dress is short, so you see more leg; shoes are white.
const LEGS_FRONT = [
  ['.....os..so.....', '.....os..so.....', '.....os..so.....', '.....WW..WW.....', '.....oo..oo.....', '................'],
  ['.....os..so.....', '.....os..so.....', '.....WW..so.....', '.....oo..so.....', '.........WW.....', '.........oo.....'],
  ['.....os..so.....', '.....os..so.....', '.....os..so.....', '.....WW..WW.....', '.....oo..oo.....', '................'],
  ['.....os..so.....', '.....os..so.....', '.....os..WW.....', '.....os..oo.....', '.....WW.........', '.....oo.........'],
];
const LEGS_SIDE = [
  ['......s..s......', '......s..s......', '......s..s......', '......W..WW.....', '......o..oo.....', '................'],
  ['.....s....s.....', '....s......s....', '....s......s....', '...WW......WW...', '...oo......oo...', '................'],
  ['......s..s......', '......s..s......', '......s..s......', '......W..WW.....', '......o..oo.....', '................'],
  ['.......ss.......', '.......ss.......', '.......ss.......', '.......WWW......', '.......ooo......', '................'],
];

function frame(upper, legs, bob) {
  const rows = [...upper, ...legs];
  // "bob" lifts the upper body 1px on step frames for a bouncy walk.
  if (bob) return [...upper.slice(1), upper[upper.length - 1], ...legs];
  return rows;
}

export function buildPlayerSheet() {
  const fw = 16;
  const fh = 24;
  const sheet = new Canvas(fw * 4, fh * 4);
  const dirs = [
    { upper: FRONT, legs: LEGS_FRONT, flip: false }, // down
    { upper: SIDE, legs: LEGS_SIDE, flip: true }, // left (mirrored right)
    { upper: SIDE, legs: LEGS_SIDE, flip: false }, // right
    { upper: BACK, legs: LEGS_FRONT, flip: false }, // up
  ];
  dirs.forEach((dir, row) => {
    for (let col = 0; col < 4; col++) {
      const rows = frame(dir.upper, dir.legs[col], col % 2 === 1);
      rows.forEach((r, i) => {
        if (r.length !== 16) throw new Error(`player sprite row ${i} is ${r.length} wide`);
      });
      sheet.map(rows, SPR, col * fw, row * fh, { flipX: dir.flip });
      // soft shadow under her feet
      sheet.ellipse(col * fw + 8, row * fh + 23, 4, 1, P.forestDark, 0.25);
    }
  });
  return sheet;
}

// ---- UI ----------------------------------------------------------------------
const HEART = [
  '.oo.oo.',
  'orrorro',
  'orwrrro',
  'orrrrro',
  '.orrro.',
  '..oro..',
  '...o...',
];

export function buildHeartIcon() {
  const c = new Canvas(9, 9);
  c.map(HEART, { o: P.berry, r: P.rose, w: P.cream }, 1, 1);
  return c;
}

const BIG_HEART = [
  '..rrr...rrr..',
  '.rrrrr.rrrrr.',
  'rrwwrrrrrrrrr',
  'rrwrrrrrrrrrr',
  'rrrrrrrrrrrrr',
  '.rrrrrrrrrrr.',
  '..rrrrrrrrrd.',
  '...rrrrrrrd..',
  '....dddddd...',
  '.....dddd....',
  '......dd.....',
];

/** Big heart (15x13 with outline) for the Continue button / touch action button. */
export function bigHeart(fill = P.rose, shade = P.roseDark, line = P.berry) {
  const c = new Canvas(BIG_HEART[0].length + 2, BIG_HEART.length + 2);
  c.map(BIG_HEART, { r: fill, d: shade, w: P.cream }, 1, 1);
  c.outline(line);
  return c;
}

export function buildPanel() {
  // 16x16 nine-slice source: 4px corners. Cream box with a soft wooden edge.
  const c = new Canvas(16, 16);
  c.rect(1, 0, 14, 16, P.woodDark);
  c.rect(0, 1, 16, 14, P.woodDark);
  c.rect(1, 1, 14, 14, P.cream);
  c.rect(1, 14, 14, 1, P.creamShade);
  c.rect(2, 2, 12, 1, P.white, 0.6);
  return c;
}

export function buildSparkle() {
  // 4 frames, 16x16 each: a twinkling sparkle with a tiny heart.
  const c = new Canvas(64, 16);
  const shapes = [2, 3, 4, 3];
  shapes.forEach((len, f) => {
    const cx = f * 16 + 8;
    const cy = 7;
    c.glow(cx, cy, 6, P.butter, 0.35);
    for (let i = -len; i <= len; i++) {
      c.px(cx + i, cy, Math.abs(i) === len ? P.butter : P.cream);
      c.px(cx, cy + i, Math.abs(i) === len ? P.butter : P.cream);
    }
    c.px(cx, cy, P.white);
    if (f === 2) {
      c.px(cx - 2, cy - 2, P.cream);
      c.px(cx + 2, cy + 2, P.cream);
      c.px(cx + 2, cy - 2, P.cream);
      c.px(cx - 2, cy + 2, P.cream);
    }
  });
  return c;
}

/**
 * ui/momo.png: a tiny Nepali momo (steamed dumpling), 11x9, pleats twisted
 * up to a little knot on top. Used in the world and on the HUD counter.
 */
export function buildMomo() {
  const c = new Canvas(11, 9);
  c.map(
    [
      '.....o.....',
      '....oWo....',
      '...oCcCo...',
      '..oCcCcCo..',
      '.oCcCWCcCo.',
      'oCWCCCCCCSo',
      'oCCCCCCCSSo',
      '.oSSSSSSSo.',
      '..ooooooo..',
    ],
    { o: P.woodDark, W: P.white, C: P.cream, c: P.stoneShade, S: P.sandShade }
  );
  return c;
}

/**
 * ui/momo-hud.png: the momo with a little white dish of orange achar (the
 * dipping sauce) in front, 17x10, for the HUD counter — so it reads as momo,
 * not just any dumpling.
 */
export function buildMomoHud() {
  const c = new Canvas(17, 10);
  c.blit(buildMomo(), 0, 0);
  c.map(
    [
      '..ooooo..',
      '.oWAAAWo.',
      'oWAAhAAWo',
      '.oSWWWSo.',
      '..ooooo..',
    ],
    { o: P.woodDark, W: P.white, S: P.creamShade, A: P.orange, h: P.butter },
    8,
    5
  );
  return c;
}

/** ui/momo-glow.png: soft warm light drawn (additively) behind each momo. */
export function buildMomoGlow() {
  const c = new Canvas(25, 25);
  c.glow(12, 12, 12, P.butter, 0.7);
  c.glow(12, 12, 7, P.cream, 0.45);
  return c;
}

export function buildJoystick() {
  const base = new Canvas(40, 40);
  base.circle(19.5, 19.5, 19, P.plum, 0.35);
  base.circle(19.5, 19.5, 17, P.cream, 0.18);
  // little direction arrows
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const x = 19.5 + dx * 13;
    const y = 19.5 + dy * 13;
    base.px(x, y, P.cream, 0.7);
    base.px(x - dy, y - dx, P.cream, 0.5);
    base.px(x + dy, y + dx, P.cream, 0.5);
  }
  const knob = new Canvas(18, 18);
  knob.circle(8.5, 8.5, 8, P.plum, 0.5);
  knob.circle(8.5, 8.5, 7, P.cream, 0.85);
  knob.circle(7, 6.5, 2, P.white, 0.8);
  return { base, knob };
}

export function buildActionButton() {
  const c = new Canvas(30, 30);
  c.circle(14.5, 14.5, 14, P.plum, 0.35);
  c.circle(14.5, 14.5, 12, P.cream, 0.2);
  c.blit(bigHeart(), 7, 8);
  return c;
}
