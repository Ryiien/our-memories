// -----------------------------------------------------------------------------
// HUD — the little "♥ 2/4" counter in the corner, and the "Memory found!"
// toast. Runs on top of the World scene.
//
// Hidden memories count toward the total, but nothing here says which ones
// are hidden.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_WIDTH, COLORS, TIMING } from '../config.js';
import { pixelText } from '../objects/Typewriter.js';
import MemoryRegistry from '../systems/MemoryRegistry.js';
import SaveManager from '../systems/SaveManager.js';

export default class HUD extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    // Counter (top-left)
    this.counterBg = this.add.nineslice(4, 4, 'panel', null, 36, 15, 4, 4, 4, 4).setOrigin(0).setAlpha(0.92);
    this.heartIcon = this.add.image(8, 7, 'heart').setOrigin(0);
    this.counter = pixelText(this, 19, 7, '', { color: COLORS.ink });

    // Toast (top-centre, hidden until needed)
    this.toastBox = this.add.container(GAME_WIDTH / 2, -30);
    this.toastBg = this.add.nineslice(0, 0, 'panel', null, 120, 17, 4, 4, 4, 4).setOrigin(0.5, 0);
    this.toastText = pixelText(this, 0, 5, '', { color: COLORS.roseDark });
    this.toastBox.add([this.toastBg, this.toastText]);

    this.refresh();
    // TODO: a small "found" sound effect could play in toast() (e.g. audio/sfx/found.wav).
  }

  refresh() {
    const text = `${SaveManager.foundCount()}/${MemoryRegistry.count}`;
    this.counter.setText(text);
    const w = this.counter.getTextBounds(false).local.width;
    this.counterBg.setSize(w + 21, 15);
  }

  /** "Memory found! ♥ 3/12" slides down from the top, then back up. */
  toast() {
    this.refresh();
    this.toastText.setText(`Memory found! ♥ ${SaveManager.foundCount()}/${MemoryRegistry.count}`);
    const w = this.toastText.getTextBounds(false).local.width;
    this.toastText.setX(-Math.round(w / 2));
    this.toastBg.setSize(w + 14, 17);

    this.tweens.killTweensOf(this.toastBox);
    this.toastBox.y = -30;
    this.tweens.chain({
      targets: this.toastBox,
      tweens: [
        { y: 22, duration: 420, ease: 'Back.easeOut' },
        { y: 22, duration: TIMING.toast - 800 },
        { y: -30, duration: 380, ease: 'Sine.easeIn' },
      ],
    });
    this.tweens.add({ targets: this.heartIcon, scale: 1.4, duration: 180, yoyo: true, repeat: 2 });
  }
}
