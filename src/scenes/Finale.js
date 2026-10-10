// -----------------------------------------------------------------------------
// Finale — plays once, after the last memory is found.
//
// Everything comes from data/finale.json: a layered background (same format
// as memory layers), a title, lines of text typed one after another, and a
// signature. Edit the JSON to change it; no code needed.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ASSET_ROOT, COLORS, TIMING } from '../config.js';
import LayerAnimator, { queueLayerLoads } from '../systems/LayerAnimator.js';
import { checkLayers } from '../systems/MemoryRegistry.js';
import SaveManager from '../systems/SaveManager.js';
import Music from '../systems/Music.js';
import Typewriter, { pixelText } from '../objects/Typewriter.js';
import ContinueHeart from '../objects/ContinueHeart.js';
import Sfx from '../systems/Sfx.js';
import finaleData from '../../data/finale.json';

const LINE_GAP = 4; // extra pixels between finale lines
const PAUSE_BETWEEN_LINES = 700;

export default class Finale extends Phaser.Scene {
  constructor() {
    super('Finale');
  }

  init() {
    this.leaving = false;
    this.layers = checkLayers(finaleData.layers ?? [], 'finale.json', (msg) => console.warn(`[finale.json] ${msg}`));
  }

  preload() {
    this.cameras.main.setBackgroundColor(COLORS.black);
    this.load.setPath(ASSET_ROOT);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file) => {
      console.warn(`[finale] Couldn't load ${file.url} — it will be skipped.`);
    });
    queueLayerLoads(this, this.layers);
    Music.load(this, finaleData.music);
  }

  create() {
    SaveManager.setFinaleSeen();
    const animator = (this.animator = new LayerAnimator(this, 'finale'));
    if (animator.addLayers(this.layers) === 0) {
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.night).setOrigin(0).setDepth(-1);
    }
    Music.play(this, finaleData.music ?? null); // (nothing = quiet; the world's music has faded out)
    this.cameras.main.fadeIn(TIMING.fadeIn * 2, 0, 0, 0);

    // Title
    const title = pixelText(this, 0, 58, finaleData.title ?? '', { color: COLORS.cream, shadow: COLORS.black });
    title.setX(Math.round((GAME_WIDTH - title.getTextBounds(false).local.width) / 2)).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, duration: 1200, delay: 600 });

    // Lines, typed one after another, centred
    let y = 76;
    this.typers = (finaleData.lines ?? []).map((line) => {
      const t = new Typewriter(this, {
        x: GAME_WIDTH / 2,
        y,
        text: line,
        maxWidth: GAME_WIDTH - 40,
        align: 'center',
        color: COLORS.cream,
        shadow: COLORS.black,
        cps: TIMING.typewriterCps * 0.8,
      });
      y += t.height + LINE_GAP;
      return t;
    });

    // Signature, bottom-right of the text
    this.signature = pixelText(this, 0, y + 6, finaleData.signature ?? '', { color: COLORS.rose, shadow: COLORS.black });
    this.signature.setX(GAME_WIDTH - 24 - this.signature.getTextBounds(false).local.width).setAlpha(0);

    this.continueButton = new ContinueHeart(this, GAME_WIDTH - 10, GAME_HEIGHT - 6, () => this.advance());
    this.continueButton.text.setTint(COLORS.cream);

    this.time.delayedCall(2000, () => this.typeLine(0));

    this.input.keyboard.on('keydown', (e) => {
      if (['Space', 'Enter', 'NumpadEnter', 'KeyE'].includes(e.code)) this.advance();
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.advance());
    // TODO: a "watch the finale again" option could be added to the title screen once finaleSeen is true.
  }

  typeLine(i) {
    this.current = i;
    if (i >= this.typers.length) {
      this.tweens.add({ targets: this.signature, alpha: 1, duration: 900 });
      this.time.delayedCall(1200, () => this.continueButton.show());
      this.finishedTyping = true;
      return;
    }
    this.typers[i].start(() => {
      this.pending = this.time.delayedCall(PAUSE_BETWEEN_LINES, () => this.typeLine(i + 1));
    });
  }

  /** Tap: finish the current line; once everything's shown, leave. */
  advance() {
    if (this.leaving) return;
    if (this.continueButton.visible) {
      this.close();
      return;
    }
    const typer = this.typers[this.current];
    if (typer && typer.timer && !typer.done) typer.finish();
  }

  close() {
    this.leaving = true;
    Sfx.play(this, 'continue');
    this.cameras.main.fadeOut(TIMING.fadeOut * 2, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop();
      this.scene.resume('World', { fromFinale: true });
    });
  }
}
