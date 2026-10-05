// -----------------------------------------------------------------------------
// config.js — every tweakable number in one place.
//
// Content (memory text, titles, names) does NOT live here: that's in /data.
// This file is for "feel": sizes, speeds, timings, colours, volumes.
// -----------------------------------------------------------------------------

// The game is drawn at this tiny resolution, then scaled up (crisp, no blur).
export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;

// When true, the game scales by whole numbers only (2x, 3x, 4x...) so every
// pixel is the same size. On very small screens (where 2x won't fit) it falls
// back to "as big as fits" so the game is never tiny.
export const INTEGER_ZOOM = true;

// Map tiles are 16x16 pixels.
export const TILE_SIZE = 16;

// Every asset path in the data files (memories.json, finale.json, the map's
// tileset image) is relative to this folder, i.e. public/assets/.
export const ASSET_ROOT = 'assets/';

// ---- Player ----------------------------------------------------------------
export const PLAYER = {
  speed: 72, // pixels per second
  frameWidth: 16, // one frame of sprites/player.png
  frameHeight: 24,
  walkFps: 8, // walk animation speed
  // The collision box is just her feet, so she can walk "in front of" things.
  // Measured in pixels from the top-left of a 16x24 frame.
  body: { width: 10, height: 6, offsetX: 3, offsetY: 17 },
};

// Rows of sprites/player.png, top to bottom. Each row has 4 walk frames;
// the first frame of each row is also used as the standing-still pose.
export const PLAYER_ROWS = ['down', 'left', 'right', 'up'];
export const PLAYER_FRAMES_PER_ROW = 4;

// ---- Camera ----------------------------------------------------------------
// 0..1 — lower = floatier camera, 1 = locked exactly to the player.
export const CAMERA_LERP = 0.12;

// ---- Timings (milliseconds unless noted) ----------------------------------
export const TIMING = {
  fadeOut: 450, // world -> black before a memory
  fadeIn: 650, // black -> memory / back to world
  titleAlone: 2000, // how long the memory title + date show on their own before the caption box comes up
  titleFadeOut: 900, // the title + date fade away once the caption box is up
  captionDelay: 900, // pause before the caption box comes up when a memory has no title or date
  typewriterCps: 32, // caption typing speed, characters per second
  continueDelay: 350, // pause after typing finishes before Continue appears
  toast: 2800, // "Memory found!" toast duration
  resetHold: 3000, // hold R on the title screen this long to wipe the save
  savePositionEvery: 2000, // how often her position is saved while walking
};

// ---- Audio -----------------------------------------------------------------
export const AUDIO = {
  musicVolume: 0.6, // 0..1
  crossfade: 1200, // ms to fade music in/out
};

// ---- Colours ---------------------------------------------------------------
// Soft, cosy palette. Numbers are 0xRRGGBB. tools/palettes/cosy.hex has the
// full palette the placeholder art uses.
export const COLORS = {
  background: 0x16121d, // behind everything / letterbox
  night: 0x1d1b33,
  cream: 0xfff3dc,
  ink: 0x3b2a35, // dark text on light boxes
  inkSoft: 0x7a5a6a,
  rose: 0xe58f9e,
  roseDark: 0xc46a80,
  butter: 0xf6d983,
  peach: 0xf2c6a0,
  lavender: 0xb8a6d9,
  white: 0xffffff,
  black: 0x000000,
};

// ---- Bitmap font -----------------------------------------------------------
// ui/font.png + ui/font.xml (BMFont format). Glyphs are white so they can be
// tinted to any colour.
export const FONT = {
  key: 'cosy-font',
  size: 9, // the font's native size; draw at this (or 2x, 3x) to stay crisp
  lineSpacing: 2,
};

// ---- Draw order inside the World scene (higher = on top) -------------------
export const DEPTH = {
  ground: 0,
  decor: 10,
  markers: 15,
  player: 20,
  above: 30, // treetops, lamp tops: drawn over the player
  prompt: 40,
  touch: 100,
};

// ---- Saving ----------------------------------------------------------------
// Bump the version if the save format ever changes in an incompatible way.
export const SAVE_KEY = 'our-memories-save-v1';
