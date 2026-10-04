// -----------------------------------------------------------------------------
// LayerAnimator — turns a list of image layers (from memories.json or
// finale.json) into an animated, composited 320x180 scene.
//
// Each layer is a full-size 320x180 PNG with transparency, stacked in order
// (first = at the back). Each layer can have an animation preset:
//
//   { "src": "memories/x/sea.png", "anim": "slide", "amount": 3, "speed": 0.6 }
//
// "amount" and "speed" are optional; every preset has gentle defaults.
// "speed" is always a multiplier: 1 = normal, 0.5 = half speed, 2 = double.
// What "amount" means depends on the preset — see PRESETS below.
//
// To add a brand-new preset, add an entry to PRESETS (it's the only code
// change needed; memories.json can then use it by name).
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

const TAU = Math.PI * 2;

// ---- Loading -------------------------------------------------------------------

/** The texture key a layer's image is stored under. */
export function textureKeyFor(layer) {
  if (layer.anim === 'frames') {
    const fw = layer.frameWidth ?? GAME_WIDTH;
    const fh = layer.frameHeight ?? GAME_HEIGHT;
    return `layer:${layer.src}@${fw}x${fh}`;
  }
  return `layer:${layer.src}`;
}

/**
 * Queue every layer image that isn't loaded yet. Call from a scene's
 * preload(). Missing files are reported (not fatal) — see addLayers().
 */
export function queueLayerLoads(scene, layers) {
  for (const layer of layers) {
    if (!layer?.src) continue;
    const key = textureKeyFor(layer);
    if (scene.textures.exists(key)) continue;
    if (layer.anim === 'frames') {
      scene.load.spritesheet(key, layer.src, {
        frameWidth: layer.frameWidth ?? GAME_WIDTH,
        frameHeight: layer.frameHeight ?? GAME_HEIGHT,
      });
    } else {
      scene.load.image(key, layer.src);
    }
  }
}

// ---- Pixel analysis (cached per texture) ------------------------------------------
//
// Some presets need to know where the non-transparent pixels are:
//  - sway bends around the bottom of the drawing, not the bottom of the image
//  - pulse scales around the middle of the drawing
//  - flicker/twinkle split the drawing into separate "lights" so each one
//    flickers on its own instead of the whole layer blinking together.

const analysisCache = new Map();

function readPixels(scene, key) {
  const source = scene.textures.get(key).getSourceImage();
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  return { ctx, width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

/** Bounding box of the opaque pixels: { top, bottom, left, right, cx, cy }. */
function contentBounds(scene, key) {
  const cacheKey = `${key}#bounds`;
  if (analysisCache.has(cacheKey)) return analysisCache.get(cacheKey);
  const { width, height, data } = readPixels(scene, key);
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data.data[(y * width + x) * 4 + 3] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  const bounds =
    bottom < 0
      ? { top: 0, bottom: height - 1, left: 0, right: width - 1, cx: width / 2, cy: height / 2 }
      : { top, bottom, left, right, cx: (left + right + 1) / 2, cy: (top + bottom + 1) / 2 };
  analysisCache.set(cacheKey, bounds);
  return bounds;
}

/**
 * Split a layer into `groups` textures. Each separate blob of pixels (a star,
 * a window, a bulb) goes into one random group. Very large blobs (e.g. a
 * string of fairy lights joined by a wire) are split by area instead.
 * Returns the new texture keys.
 */
function splitIntoGroups(scene, key, groups) {
  const keys = Array.from({ length: groups }, (_, i) => `${key}#g${i}of${groups}`);
  if (keys.every((k) => scene.textures.exists(k))) return keys;

  const { width, height, data } = readPixels(scene, key);
  const px = data.data;
  const label = new Int32Array(width * height).fill(-1);
  const groupOf = [];
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const stack = [];
  let blobCount = 0;
  for (let start = 0; start < width * height; start++) {
    if (label[start] !== -1 || px[start * 4 + 3] === 0) continue;
    // flood fill this blob
    const blob = blobCount++;
    const members = [];
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    stack.push(start);
    label[start] = blob;
    while (stack.length) {
      const i = stack.pop();
      members.push(i);
      const x = i % width;
      const y = (i / width) | 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const n of [i - 1, i + 1, i - width, i + width]) {
        if (n < 0 || n >= width * height) continue;
        if ((n === i - 1 && x === 0) || (n === i + 1 && x === width - 1)) continue;
        if (label[n] !== -1 || px[n * 4 + 3] === 0) continue;
        label[n] = blob;
        stack.push(n);
      }
    }
    const big = maxX - minX > 24 || maxY - minY > 24;
    const blobGroup = Math.floor(rand() * groups);
    for (const i of members) {
      if (big) {
        // big blob: assign by 12px cells so neighbouring parts differ
        const cx = Math.floor((i % width) / 12);
        const cy = Math.floor(i / width / 12);
        groupOf[i] = (cx * 7 + cy * 13 + ((cx * cy) % 5)) % groups;
      } else {
        groupOf[i] = blobGroup;
      }
    }
  }

  keys.forEach((k, g) => {
    if (scene.textures.exists(k)) return;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const out = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      if (groupOf[i] !== g) continue;
      out.data.set(px.subarray(i * 4, i * 4 + 4), i * 4);
    }
    ctx.putImageData(out, 0, 0);
    scene.textures.addCanvas(k, canvas);
  });
  return keys;
}

// Small seeded random per layer so flicker/twinkle patterns differ per layer.
function layerRandom(src) {
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h >>>= 0) % 100000) / 100000;
  };
}

// ---- Presets -----------------------------------------------------------------------
//
// Each preset: { defaults, create(scene, key, opts) -> { objects, update(t, dt) } }
//   t  = seconds since the scene started, dt = seconds since last frame.

export const PRESETS = {
  /** Static image. */
  none: {
    defaults: {},
    create(scene, key) {
      return { objects: [scene.add.image(0, 0, key).setOrigin(0)] };
    },
  },

  /**
   * slide — gentle horizontal back-and-forth (waves, clouds).
   * amount: how far it moves each way, in pixels (default 4).
   * The image wraps around at the edges, so no gaps appear.
   */
  slide: {
    defaults: { amount: 4, speed: 1 },
    create(scene, key, o) {
      const ts = scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key).setOrigin(0);
      return {
        objects: [ts],
        update(t) {
          ts.tilePositionX = Math.round(Math.sin(t * TAU * 0.25 * o.speed) * o.amount);
        },
      };
    },
  },

  /**
   * drift — slow, continuous horizontal scroll that wraps seamlessly
   * (clouds, fog). Base speed is 6 px/second; negative speed drifts right.
   * Make the left and right edges of the image match for a seamless loop.
   */
  drift: {
    defaults: { speed: 1 },
    create(scene, key, o) {
      const ts = scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key).setOrigin(0);
      const width = scene.textures.get(key).getSourceImage().width;
      return {
        objects: [ts],
        update(t) {
          ts.tilePositionX = Math.round((t * 6 * o.speed) % width);
        },
      };
    },
  },

  /**
   * bob — vertical up-and-down (people breathing, boats).
   * amount: pixels up/down (default 1). One cycle every 3s at speed 1.
   */
  bob: {
    defaults: { amount: 1, speed: 1 },
    create(scene, key, o) {
      const img = scene.add.image(0, 0, key).setOrigin(0);
      return {
        objects: [img],
        update(t) {
          img.y = Math.round(Math.sin((t * TAU * o.speed) / 3) * o.amount);
        },
      };
    },
  },

  /**
   * sway — leans left and right around the bottom of the drawing, like grass
   * or trees in the wind (or someone swaying). The bottom stays put and the
   * top moves most. amount: how far the top moves, in pixels (default 2).
   * Done by sliding thin horizontal strips, so pixels stay perfectly crisp.
   */
  sway: {
    defaults: { amount: 2, speed: 1 },
    create(scene, key, o) {
      const b = contentBounds(scene, key);
      const tex = scene.textures.get(key);
      const span = Math.max(1, b.bottom - b.top);
      const strip = span > 120 ? 2 : 1;
      const strips = [];
      for (let y = b.top; y <= b.bottom; y += strip) {
        const name = `sway-strip-${y}-${strip}`;
        if (!tex.has(name)) tex.add(name, 0, 0, y, tex.source[0].width, Math.min(strip, b.bottom - y + 1));
        const img = scene.add.image(0, y, key, name).setOrigin(0);
        strips.push({ img, weight: (b.bottom - y) / span });
      }
      return {
        objects: strips.map((s) => s.img),
        update(t) {
          const lean = Math.sin((t * TAU * o.speed) / 4) * o.amount;
          for (const s of strips) s.img.x = Math.round(lean * s.weight);
        },
      };
    },
  },

  /**
   * flicker — quick random flickering (distant lights, candles, fairy lights).
   * amount: how much they dim, 0..1 (default 0.6). Each separate light in the
   * image flickers on its own. Optional "groups" (default 3): how many
   * independent flicker patterns to use.
   */
  flicker: {
    defaults: { amount: 0.6, speed: 1, groups: 3 },
    create(scene, key, o, src) {
      const rand = layerRandom(src);
      const keys = o.groups > 1 ? splitIntoGroups(scene, key, o.groups) : [key];
      const parts = keys.map((k) => ({ img: scene.add.image(0, 0, k).setOrigin(0), next: 0 }));
      return {
        objects: parts.map((p) => p.img),
        update(t) {
          for (const p of parts) {
            if (t < p.next) continue;
            const dip = rand() < 0.15 ? 1 : rand() * 0.5; // occasional deeper dips
            p.img.alpha = 1 - o.amount * dip;
            p.next = t + (0.06 + rand() * 0.22) / Math.max(0.05, o.speed);
          }
        },
      };
    },
  },

  /**
   * twinkle — like flicker but slow and soft (stars). Each star fades in and
   * out at its own pace. amount: how faint they get, 0..1 (default 0.75).
   * Optional "groups" (default 5).
   */
  twinkle: {
    defaults: { amount: 0.75, speed: 1, groups: 5 },
    create(scene, key, o, src) {
      const rand = layerRandom(src);
      const keys = o.groups > 1 ? splitIntoGroups(scene, key, o.groups) : [key];
      const parts = keys.map((k) => ({
        img: scene.add.image(0, 0, k).setOrigin(0),
        freq: 0.15 + rand() * 0.3,
        phase: rand() * TAU,
      }));
      return {
        objects: parts.map((p) => p.img),
        update(t) {
          for (const p of parts) {
            const wave = 0.5 + 0.5 * Math.sin(t * TAU * p.freq * o.speed + p.phase);
            p.img.alpha = 1 - o.amount * wave;
          }
        },
      };
    },
  },

  /**
   * pulse — slow breathing glow (moon, lamp glow, sun). Fades and grows a
   * touch around the middle of the drawing. amount: how much it fades, 0..1
   * (default 0.3). Optional "scale": how much it grows (default 0.03 = 3%).
   * One breath every 4s at speed 1.
   */
  pulse: {
    defaults: { amount: 0.3, speed: 1, scale: 0.03 },
    create(scene, key, o) {
      const b = contentBounds(scene, key);
      const src = scene.textures.get(key).getSourceImage();
      const img = scene.add
        .image(b.cx, b.cy, key)
        .setOrigin(b.cx / src.width, b.cy / src.height);
      return {
        objects: [img],
        update(t) {
          const breath = 0.5 - 0.5 * Math.cos((t * TAU * o.speed) / 4);
          img.alpha = 1 - o.amount * breath;
          img.setScale(1 + o.scale * breath);
        },
      };
    },
  },

  /**
   * frames — classic flip-book animation from a spritesheet: frames laid out
   * left-to-right (and top-to-bottom if you need more rows).
   * frameWidth / frameHeight: size of one frame (default 320x180).
   * fps: frames per second (default 6). speed multiplies fps.
   */
  frames: {
    defaults: { fps: 6, speed: 1 },
    create(scene, key, o) {
      const animKey = `anim:${key}:${o.fps * o.speed}`;
      if (!scene.anims.exists(animKey)) {
        scene.anims.create({
          key: animKey,
          frames: scene.anims.generateFrameNumbers(key),
          frameRate: o.fps * o.speed,
          repeat: -1,
        });
      }
      const sprite = scene.add.sprite(0, 0, key, 0).setOrigin(0);
      sprite.play(animKey);
      return { objects: [sprite] };
    },
  },
};

// ---- The animator -----------------------------------------------------------------

export default class LayerAnimator {
  /**
   * @param {Phaser.Scene} scene
   * @param {string} label  used in warnings, e.g. the memory id
   */
  constructor(scene, label = 'scene') {
    this.scene = scene;
    this.label = label;
    this.items = [];
    this.container = scene.add.container(0, 0);
    this.startTime = null;
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Build every layer, back to front. Returns how many were added. */
  addLayers(layers = []) {
    layers.forEach((layer, index) => {
      if (!layer?.src) {
        console.warn(`[${this.label}] Layer ${index + 1} has no "src" — skipping it.`);
        return;
      }
      const key = textureKeyFor(layer);
      if (!this.scene.textures.exists(key)) {
        console.warn(
          `[${this.label}] Missing layer image "${layer.src}" ` +
            `(expected at public/assets/${layer.src}) — skipping it.`
        );
        return;
      }
      let presetName = layer.anim ?? 'none';
      if (!PRESETS[presetName]) {
        console.warn(
          `[${this.label}] Unknown anim "${presetName}" on "${layer.src}" — showing it static. ` +
            `Known presets: ${Object.keys(PRESETS).join(', ')}.`
        );
        presetName = 'none';
      }
      const preset = PRESETS[presetName];
      const opts = { ...preset.defaults };
      for (const k of Object.keys(layer)) if (layer[k] !== undefined && k !== 'src' && k !== 'anim') opts[k] = layer[k];
      try {
        const item = preset.create(this.scene, key, opts, layer.src);
        this.container.add(item.objects);
        this.items.push(item);
      } catch (err) {
        console.warn(`[${this.label}] Couldn't animate "${layer.src}" with "${presetName}":`, err);
      }
    });
    this.update(this.scene.time.now, 0); // set first-frame positions straight away
    return this.items.length;
  }

  update(time) {
    if (this.startTime === null) this.startTime = time;
    const t = (time - this.startTime) / 1000;
    for (const item of this.items) item.update?.(t);
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.items = [];
  }
}
