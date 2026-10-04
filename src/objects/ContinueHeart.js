// -----------------------------------------------------------------------------
// ContinueHeart — the bobbing heart "Continue" button used in cutscenes.
// Tapping it (or anywhere — scenes handle that) calls onPress.
// -----------------------------------------------------------------------------
import { COLORS } from '../config.js';
import { pixelText } from './Typewriter.js';

export default class ContinueHeart {
  /** (x, y) is the bottom-right corner the button sits against. */
  constructor(scene, x, y, onPress, label = 'Continue') {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setAlpha(0).setVisible(false);
    this.text = pixelText(scene, 0, 0, label, { color: COLORS.ink });
    const tw = this.text.getTextBounds(false).local.width;
    this.heart = scene.add.image(0, 0, 'continue-heart').setOrigin(0, 0.5);
    this.text.setPosition(x - tw, y - 8);
    this.heart.setPosition(x - tw - this.heart.width - 3, y - 4);
    this.container.add([this.heart, this.text]);

    this.heart.setInteractive({ useHandCursor: true });
    this.text.setInteractive({ useHandCursor: true });
    this.heart.on('pointerdown', () => onPress());
    this.text.on('pointerdown', () => onPress());
  }

  show() {
    this.container.setVisible(true);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 300 });
    this.scene.tweens.add({ targets: this.heart, scale: 1.15, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  get visible() {
    return this.container.visible;
  }
}
