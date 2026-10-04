// -----------------------------------------------------------------------------
// Title — "Happy 3 years, [HER NAME]" with Start / Continue.
//
// Text comes from data/game.json. Secret for testing: hold R for 3 seconds
// (or press and hold her name for 3 seconds on a phone) to wipe all progress.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TIMING } from '../config.js';
import { pixelText } from '../objects/Typewriter.js';
import MemoryRegistry from '../systems/MemoryRegistry.js';
import SaveManager from '../systems/SaveManager.js';
import gameData from '../../data/game.json';

// Night-sky colours for the dithered background
const SKY = ['#13152e', '#1b1d40', '#272a57', '#3a3a6e', '#5a4a7e', '#86628e'];

export default class Title extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    // (Phaser reuses scene objects, so reset state from any previous visit.)
    this.leaving = false;
    this.keysBound = false;
    this.menuItems = null;
    this.cursorHeart = null;

    this.drawBackground();
    this.cameras.main.fadeIn(TIMING.fadeIn, 0, 0, 0);

    // Heading
    const line1 = pixelText(this, 0, 34, gameData.titleLine ?? 'Happy 3 years,', { color: COLORS.cream, shadow: COLORS.black });
    this.centre(line1);
    this.nameText = pixelText(this, 0, 48, gameData.herName ?? '', { color: COLORS.rose, scale: 2, shadow: COLORS.black });
    this.centre(this.nameText);
    const sub = pixelText(this, 0, 74, gameData.subtitle ?? '', { color: COLORS.lavender });
    this.centre(sub);

    const heart = this.add.image(GAME_WIDTH / 2, 22, 'continue-heart');
    this.tweens.add({ targets: heart, y: 19, scale: 1.1, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.buildMenu();
    this.setupReset();
    this.showDataWarnings();
  }

  centre(text) {
    text.setX(Math.round((GAME_WIDTH - text.getTextBounds(false).local.width) / 2));
    return text;
  }

  /** Dithered night gradient + twinkling stars (drawn in code, no image needed). */
  drawBackground() {
    if (!this.textures.exists('title-sky')) {
      const tex = this.textures.createCanvas('title-sky', GAME_WIDTH, GAME_HEIGHT);
      const ctx = tex.getContext();
      const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 0; y < GAME_HEIGHT; y++) {
        const t = (y / (GAME_HEIGHT - 1)) * (SKY.length - 1);
        const i = Math.min(SKY.length - 2, Math.floor(t));
        for (let x = 0; x < GAME_WIDTH; x++) {
          const threshold = (bayer[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
          ctx.fillStyle = t - i > threshold ? SKY[i + 1] : SKY[i];
          ctx.fillRect(x, y, 1, 1);
        }
      }
      tex.refresh();
    }
    this.add.image(0, 0, 'title-sky').setOrigin(0);

    const rnd = new Phaser.Math.RandomDataGenerator(['stars']);
    for (let i = 0; i < 60; i++) {
      const star = this.add.rectangle(rnd.between(0, GAME_WIDTH), rnd.between(0, GAME_HEIGHT - 30), 1, 1, COLORS.cream);
      this.tweens.add({
        targets: star,
        alpha: 0.15,
        duration: rnd.between(900, 2600),
        delay: rnd.between(0, 2000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ---- Menu --------------------------------------------------------------------------
  buildMenu() {
    this.menuItems?.forEach((item) => item.text.destroy());
    this.cursorHeart?.destroy();

    const options = [];
    if (SaveManager.hasSave()) options.push({ label: 'Continue', action: () => this.begin(false) });
    options.push({ label: 'Start', action: () => this.startNew() });

    this.selected = 0;
    this.confirmingNew = false;
    this.menuItems = options.map((opt, i) => {
      const text = pixelText(this, 0, 110 + i * 16, opt.label, { color: COLORS.cream, shadow: COLORS.black });
      this.centre(text);
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => this.select(i));
      text.on('pointerdown', () => {
        this.select(i);
        opt.action();
      });
      return { ...opt, text };
    });
    this.cursorHeart = this.add.image(0, 0, 'heart');
    this.select(0);

    if (!this.keysBound) {
      this.keysBound = true;
      this.input.keyboard.on('keydown', (e) => {
        if (this.leaving) return;
        if (['ArrowUp', 'KeyW'].includes(e.code)) this.select(this.selected - 1);
        if (['ArrowDown', 'KeyS'].includes(e.code)) this.select(this.selected + 1);
        if (['Space', 'Enter', 'NumpadEnter', 'KeyE'].includes(e.code)) this.menuItems[this.selected].action();
      });
    }
  }

  select(i) {
    const n = this.menuItems.length;
    this.selected = (i + n) % n;
    this.menuItems.forEach((item, j) => item.text.setTint(j === this.selected ? COLORS.butter : COLORS.cream));
    const t = this.menuItems[this.selected].text;
    this.cursorHeart.setPosition(t.x - 8, t.y + 4);
  }

  startNew() {
    // Starting over wipes progress, so ask once if there's a save.
    if (SaveManager.hasSave() && !this.confirmingNew) {
      this.confirmingNew = true;
      const item = this.menuItems.find((m) => m.label === 'Start');
      item.text.setText('Start over? Press again');
      this.centre(item.text);
      this.select(this.menuItems.indexOf(item));
      this.time.delayedCall(3000, () => {
        if (!this.leaving && item.text.active) {
          this.confirmingNew = false;
          item.text.setText('Start');
          this.centre(item.text);
          this.select(this.selected);
        }
      });
      return;
    }
    SaveManager.reset();
    this.begin(true);
  }

  begin(newGame) {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(TIMING.fadeOut, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('World', { newGame });
    });
  }

  // ---- Hidden reset: hold R (or press and hold her name) for 3 seconds ------------------------
  setupReset() {
    this.resetText = pixelText(this, 0, GAME_HEIGHT - 14, '', { color: COLORS.peach }).setAlpha(0.9);
    this.resetHeldSince = null;
    const keyR = this.input.keyboard.addKey('R');
    keyR.on('down', () => this.beginReset());
    keyR.on('up', () => this.cancelReset());
    this.nameText.setInteractive();
    this.nameText.on('pointerdown', () => this.beginReset());
    this.input.on(Phaser.Input.Events.POINTER_UP, () => this.cancelReset());
  }

  beginReset() {
    if (this.resetHeldSince === null) this.resetHeldSince = this.time.now;
  }

  cancelReset() {
    if (this.resetHeldSince !== null && this.resetText.text.startsWith('Resetting')) this.resetText.setText('');
    this.resetHeldSince = null;
  }

  update(time) {
    if (this.resetHeldSince === null) return;
    const held = time - this.resetHeldSince;
    if (held >= TIMING.resetHold) {
      this.resetHeldSince = null;
      SaveManager.reset();
      this.resetText.setText('Progress reset ♥');
      this.centre(this.resetText);
      this.buildMenu();
      this.time.delayedCall(2000, () => this.resetText.setText(''));
      return;
    }
    if (held > 400) {
      const hearts = '♥'.repeat(1 + Math.floor((held / TIMING.resetHold) * 3));
      this.resetText.setText(`Resetting ${hearts}`);
      this.centre(this.resetText);
    }
  }

  /** While developing, show a hint if the data files have problems. */
  showDataWarnings() {
    if (!import.meta.env.DEV || MemoryRegistry.warnings.length === 0) return;
    const n = MemoryRegistry.warnings.length;
    const t = pixelText(this, 4, 4, `! ${n} data warning${n > 1 ? 's' : ''} - see console (F12)`, { color: 0xff8080 });
    t.setDepth(10);
  }
}
