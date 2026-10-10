// -----------------------------------------------------------------------------
// Memory — the generic, data-driven cutscene player.
//
// Everything it shows comes from one entry in data/memories.json:
//   layers   -> stacked, animated images (see LayerAnimator.js)
//   title    -> shown briefly at the top, with the date
//   caption  -> types out in a cosy box at the bottom
//   music    -> optional, crossfades in and out
// It loops until she presses Continue, then fades back to the world.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ASSET_ROOT, COLORS, TIMING } from '../config.js';
import LayerAnimator, { queueLayerLoads } from '../systems/LayerAnimator.js';
import MemoryRegistry from '../systems/MemoryRegistry.js';
import Music from '../systems/Music.js';
import Typewriter, { pixelText } from '../objects/Typewriter.js';
import ContinueHeart from '../objects/ContinueHeart.js';
import Sfx from '../systems/Sfx.js';

const BOX = { margin: 8, padX: 8, padY: 6 };

export default class Memory extends Phaser.Scene {
  constructor() {
    super('Memory');
  }

  /** data: { id, newlyFound } (from World) */
  init(data) {
    this.memory = MemoryRegistry.get(data.id);
    this.newlyFound = Boolean(data.newlyFound);
    this.leaving = false;
  }

  preload() {
    this.cameras.main.setBackgroundColor(COLORS.black);
    this.load.setPath(ASSET_ROOT);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file) => {
      console.warn(`[memory "${this.memory?.id}"] Couldn't load ${file.url} — it will be skipped.`);
    });
    if (!this.memory) return;
    queueLayerLoads(this, this.memory.layers);
    Music.load(this, this.memory.music);

    // A tiny pulsing heart while loading (usually too quick to notice).
    const loading = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'heart').setAlpha(0.6);
    this.tweens.add({ targets: loading, scale: 1.3, duration: 400, yoyo: true, repeat: -1 });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => loading.destroy());
  }

  create() {
    if (!this.memory) {
      console.warn('[memory] Tried to open a memory that does not exist.');
      this.close();
      return;
    }
    const m = this.memory;

    // Layers
    const animator = (this.animator = new LayerAnimator(this, `memory "${m.id}"`));
    if (animator.addLayers(m.layers) === 0) {
      // Nothing to show: use a soft background rather than pure black.
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.night).setOrigin(0).setDepth(-1);
    }

    // The world's music has faded out; memories without their own music are quiet.
    Music.play(this, m.music);
    this.cameras.main.fadeIn(TIMING.fadeIn, 0, 0, 0);

    // The title + date show on their own first; the caption box comes up after
    // them, and once it's up the title fades away.
    const titleTime = this.showTitle(m);
    this.buildCaption(m, titleTime ? titleTime + TIMING.titleAlone : TIMING.captionDelay);

    // Input: any key/tap skips the typing, then continues.
    this.input.keyboard.on('keydown', (e) => {
      if (['Space', 'Enter', 'NumpadEnter', 'KeyE'].includes(e.code)) this.advance();
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.advance());
  }

  /**
   * Title + date at the top: fade in, and stay until hideTitle() (called once
   * the caption box is up). Returns how long the fade-in takes (0 = no title).
   */
  showTitle(m) {
    this.titleParts = [];
    if (!m.title && !m.date) return 0;
    const parts = [];
    const title = pixelText(this, 0, 8, m.title, { color: COLORS.cream, shadow: COLORS.black });
    title.setX(Math.round((GAME_WIDTH - title.getTextBounds(false).local.width) / 2));
    parts.push(title);
    if (m.date) {
      const date = pixelText(this, 0, 20, m.date, { color: COLORS.peach, shadow: COLORS.black });
      date.setX(Math.round((GAME_WIDTH - date.getTextBounds(false).local.width) / 2));
      parts.push(date);
    }
    // A soft dark band behind the text keeps it readable on bright scenes.
    const textWidth = Math.max(...parts.map((p) => p.getTextBounds(false).local.width));
    const band = this.add.graphics();
    band.fillStyle(COLORS.black, 0.35);
    band.fillRoundedRect(Math.round((GAME_WIDTH - textWidth) / 2) - 8, 5, textWidth + 16, m.date ? 27 : 15, 6);
    this.children.moveBelow(band, title);
    parts.unshift(band);

    parts.forEach((p) => p.setAlpha(0));
    this.titleParts = parts;
    const delay = 300;
    const duration = 700;
    this.tweens.add({ targets: parts, alpha: 1, duration, delay });
    return delay + duration;
  }

  hideTitle() {
    if (!this.titleParts.length) return;
    this.tweens.killTweensOf(this.titleParts);
    this.tweens.add({ targets: this.titleParts, alpha: 0, duration: TIMING.titleFadeOut });
  }

  /** The cosy caption box at the bottom, typed out; it comes up after `delay` ms. */
  buildCaption(m, delay) {
    const width = GAME_WIDTH - BOX.margin * 2;
    this.typer = new Typewriter(this, {
      x: BOX.margin + BOX.padX,
      y: 0, // positioned below once we know the height
      text: m.caption,
      maxWidth: width - BOX.padX * 2 - 4,
      color: COLORS.ink,
    });
    // Continue sits on the last caption line if there's room, otherwise on its own row.
    const continueWidth = 64;
    const lastLineWidth = this.typer.lastLineWidth;
    const continueRow = lastLineWidth + continueWidth < width - BOX.padX * 2 ? 0 : 12;
    const height = Math.max(this.typer.height, 10) + BOX.padY * 2 + continueRow;
    const top = GAME_HEIGHT - BOX.margin - height;
    this.box = this.add.nineslice(BOX.margin, top, 'panel', null, width, height, 4, 4, 4, 4).setOrigin(0);
    this.box.setAlpha(0.95);
    this.typer.objects.forEach((o, i) => {
      o.setY(top + BOX.padY + 1 + i * this.typer.lineHeight);
      this.children.bringToTop(o);
    });

    // On its own row it sits along the bottom; next to the text it's centred
    // up and down in the box (the label's middle is 4 px above its anchor).
    const continueY = continueRow ? top + height - 4 : Math.round(top + height / 2) + 4;
    this.continueButton = new ContinueHeart(this, BOX.margin + width - BOX.padX, continueY, () => this.advance());

    // Slide the box up, then start typing.
    const parts = [this.box, ...this.typer.objects];
    parts.forEach((p) => {
      p.y += 12;
      p.setAlpha(0);
    });
    this.tweens.add({
      targets: parts,
      y: '-=12',
      alpha: { from: 0, to: 0.95 },
      duration: 500,
      delay,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.hideTitle();
        this.typer.setAlpha(1);
        this.typer.start(() => this.time.delayedCall(TIMING.continueDelay, () => this.continueButton.show()));
      },
    });
  }

  /** Space / tap: finish typing first; once Continue is showing, leave. */
  advance() {
    if (this.leaving || !this.typer) return;
    if (!this.typer.timer && !this.typer.done) return; // box still sliding in
    if (!this.typer.done) {
      this.typer.finish();
      return;
    }
    if (this.continueButton.visible) {
      Sfx.play(this, 'continue');
      this.close();
    }
  }

  close() {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(TIMING.fadeOut, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const data = { memoryId: this.memory?.id, newlyFound: this.newlyFound };
      this.scene.stop();
      this.scene.resume('World', data);
    });
  }
}
