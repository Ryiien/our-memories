// -----------------------------------------------------------------------------
// Typewriter — pixel text that types itself out, letter by letter.
//
// The text is word-wrapped up front (so words don't jump to the next line
// halfway through typing), and each line is its own BitmapText so centred
// lines stay put while they type.
// -----------------------------------------------------------------------------
import { FONT, TIMING } from '../config.js';

/** Plain pixel text helper used across scenes. */
export function pixelText(scene, x, y, text, { color = 0xffffff, scale = 1, shadow = null } = {}) {
  const t = scene.add.bitmapText(x, y, FONT.key, text, FONT.size * scale);
  t.setTint(color);
  if (shadow !== null) t.setDropShadow(scale, scale, shadow, 0.6);
  return t;
}

/** Split text into lines no wider than maxWidth (in pixels, at scale 1). */
export function wrapLines(scene, text, maxWidth) {
  const probe = scene.add.bitmapText(0, 0, FONT.key, '', FONT.size).setVisible(false);
  const width = (s) => {
    probe.setText(s);
    return probe.getTextBounds(false).local.width;
  };
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (line && width(test) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  const widths = lines.map(width);
  probe.destroy();
  return { lines, widths };
}

export default class Typewriter {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} o
   * @param {number} o.x        left edge (or centre if align = 'center')
   * @param {number} o.y        top
   * @param {string} o.text
   * @param {number} o.maxWidth wrap width in pixels
   * @param {'left'|'center'} [o.align]
   * @param {number} [o.color]
   * @param {number} [o.cps]    characters per second
   */
  constructor(scene, { x, y, text, maxWidth, align = 'left', color = 0xffffff, cps = TIMING.typewriterCps, shadow = null }) {
    this.scene = scene;
    this.cps = cps;
    this.done = false;
    const { lines, widths } = wrapLines(scene, text, maxWidth);
    this.lines = lines;
    this.lineHeight = scene.cache.bitmapFont.get(FONT.key).data.lineHeight + FONT.lineSpacing;
    this.height = lines.length * this.lineHeight;
    this.width = Math.max(0, ...widths);
    this.lastLineWidth = widths[widths.length - 1] ?? 0;
    this.objects = lines.map((_, i) => {
      const lx = align === 'center' ? Math.round(x - widths[i] / 2) : x;
      return pixelText(scene, lx, y + i * this.lineHeight, '', { color, shadow });
    });
    this.total = lines.reduce((n, l) => n + l.length, 0);
    this.shown = 0;
  }

  /** Start typing; onDone fires once everything is visible. */
  start(onDone) {
    this.onDone = onDone;
    if (this.total === 0) return this.finish();
    this.timer = this.scene.time.addEvent({
      delay: 1000 / this.cps,
      loop: true,
      callback: () => {
        this.shown++;
        this.render();
        if (this.shown >= this.total) this.finish();
      },
    });
  }

  render() {
    let left = this.shown;
    this.lines.forEach((line, i) => {
      const n = Math.max(0, Math.min(line.length, left));
      this.objects[i].setText(line.slice(0, n));
      left -= line.length;
    });
  }

  /** Skip to the end (e.g. when she taps while it's typing). */
  finish() {
    if (this.done) return;
    this.done = true;
    this.timer?.remove();
    this.shown = this.total;
    this.render();
    this.onDone?.();
  }

  setAlpha(a) {
    this.objects.forEach((o) => o.setAlpha(a));
  }
}
