// -----------------------------------------------------------------------------
// HUD — the little "♥ 2/4" memory counter (top-left), the momo counter
// (top-right), and toasts like "Memory found!". Runs on top of the World scene.
//
// Hidden memories count toward the total, but nothing here says which ones
// are hidden.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_WIDTH, COLORS, TIMING } from '../config.js';
import { pixelText } from '../objects/Typewriter.js';
import MemoryRegistry from '../systems/MemoryRegistry.js';
import Momos from '../systems/Momos.js';
import SaveManager from '../systems/SaveManager.js';
import Sfx from '../systems/Sfx.js';

export default class HUD extends Phaser.Scene {
  constructor() {
    super('HUD');
  }

  create() {
    // Memory counter (top-left)
    this.counterBg = this.add.nineslice(4, 4, 'panel', null, 36, 15, 4, 4, 4, 4).setOrigin(0).setAlpha(0.92);
    this.heartIcon = this.add.image(8, 7, 'heart').setOrigin(0);
    this.counter = pixelText(this, 19, 7, '', { color: COLORS.ink });

    // Momo counter (top-right). Laid out from the right edge in refresh().
    // Only shown when the map has momos.
    this.momoBg = this.add.nineslice(GAME_WIDTH - 4, 4, 'panel', null, 36, 15, 4, 4, 4, 4).setOrigin(1, 0).setAlpha(0.92);
    this.momoIcon = this.add.image(0, 12, 'momo-hud'); // 17x10 (momo + dish of achar), centred so it can hop
    this.momoCounter = pixelText(this, 0, 7, '', { color: COLORS.ink });
    for (const o of [this.momoBg, this.momoIcon, this.momoCounter]) o.setVisible(Momos.count > 0);

    // Toast (top-centre, hidden until needed)
    this.toastBox = this.add.container(GAME_WIDTH / 2, -30);
    this.toastBg = this.add.nineslice(0, 0, 'panel', null, 120, 17, 4, 4, 4, 4).setOrigin(0.5, 0);
    this.toastText = pixelText(this, 0, 5, '', { color: COLORS.roseDark });
    this.toastBox.add([this.toastBg, this.toastText]);
    this.toastQueue = [];
    this.toastShowing = false;

    this.refresh();
  }

  refresh() {
    const text = `${SaveManager.foundCount()}/${MemoryRegistry.count}`;
    this.counter.setText(text);
    const w = this.counter.getTextBounds(false).local.width;
    this.counterBg.setSize(w + 21, 15);

    // Momo counter: [momo] 3/10, right-aligned. Turns rose once she has them all.
    const momos = SaveManager.momoCount();
    this.momoCounter.setText(`${momos}/${Momos.count}`);
    this.momoCounter.setTint(momos >= Momos.count ? COLORS.roseDark : COLORS.ink);
    const mw = this.momoCounter.getTextBounds(false).local.width;
    this.momoBg.setSize(mw + 27, 15); // 4 padding + 17 icon + 2 gap + text + 4 padding
    this.momoIcon.setX(GAME_WIDTH - 4 - (mw + 27) + 4 + 8.5);
    this.momoCounter.setX(GAME_WIDTH - 8 - mw);
  }

  /** A momo was just collected: update the count and give the icon a hop. */
  momoCollected() {
    this.refresh();
    this.tweens.killTweensOf(this.momoIcon);
    this.momoIcon.setScale(1);
    this.tweens.add({ targets: this.momoIcon, scale: 1.5, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
  }

  /**
   * A message slides down from the top, then back up. With no text it's the
   * usual "Memory found! ♥ 3/12". Several in a row wait their turn.
   */
  toast(text = null) {
    this.refresh();
    const message = text ?? `Memory found! ♥ ${SaveManager.foundCount()}/${MemoryRegistry.count}`;
    this.toastQueue.push(message);
    if (!this.toastShowing) this.showNextToast();
  }

  showNextToast() {
    const message = this.toastQueue.shift();
    if (message === undefined) {
      this.toastShowing = false;
      return;
    }
    this.toastShowing = true;
    this.toastText.setText(message);
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
      onComplete: () => this.showNextToast(),
    });
    this.tweens.add({ targets: this.heartIcon, scale: 1.4, duration: 180, yoyo: true, repeat: 2 });
    Sfx.play(this, 'found');
  }
}
