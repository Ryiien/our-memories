// -----------------------------------------------------------------------------
// Fishing — the love-letter minigame off the end of the pier.
//
// She casts (E / Space / tap), the bobber floats, and after a little while
// bubbles appear around it: press again while they're bubbling to hook
// something. It's either a love letter (a random one she hasn't read yet,
// then any of them once she has them all) or a clump of seaweed to toss back.
// Missing the bubbles is fine — more come along. Esc / the little < arrow goes
// back to the world. There are no instructions on screen: the bubbles, the
// catch and the letter counter's hop say it all.
//
// Letters, the seaweed chance, the background layers and where her hand and
// the water are in the art all come from data/fishing.json (via
// systems/LoveLetters.js). Timings and colours are FISHING in config.js.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ASSET_ROOT, COLORS, TIMING, FISHING } from '../config.js';
import LayerAnimator, { queueLayerLoads } from '../systems/LayerAnimator.js';
import LoveLetters from '../systems/LoveLetters.js';
import SaveManager from '../systems/SaveManager.js';
import Music from '../systems/Music.js';
import Typewriter, { pixelText } from '../objects/Typewriter.js';
import ContinueHeart from '../objects/ContinueHeart.js';
import Sfx from '../systems/Sfx.js';

const S = LoveLetters.settings;
const ACTION_KEYS = ['Space', 'Enter', 'NumpadEnter', 'KeyE'];
const LEAVE_KEYS = ['Escape', 'Backspace', 'KeyQ'];
const BOBBER_SHOWN = 6; // rows of bobber.png above the water while it floats
const DANGLE = 12; // how far the bobber hangs below the rod tip before a cast
const LETTER = { width: 236, padX: 12, padTop: 9, padBottom: 6 };

export default class Fishing extends Phaser.Scene {
  constructor() {
    super('Fishing');
  }

  init() {
    this.state = 'ready'; // ready → casting → waiting ⇄ bite → reeling → (reading → closing) → ready
    this.leaving = false;
    this.castId = 0; // bumped on every cast/hook so old timers know to do nothing
    this.rod = { angle: FISHING.rodRest };
    this.line = { sag: 0 };
    this.bob = { x: 0, y: 0, mode: 'dangle', dip: 0 }; // where the line meets the bobber's top
    this.item = null; // { image, attached, swing } — what's on the hook
    this.seaweedStreak = 0;
    this.lastLetterId = null;
  }

  preload() {
    this.cameras.main.setBackgroundColor(COLORS.black);
    this.load.setPath(ASSET_ROOT);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file) => {
      console.warn(`[fishing] Couldn't load ${file.url} — it will be skipped.`);
    });
    queueLayerLoads(this, S.layers);
    const sheet = (key, file, frameWidth, frameHeight) => {
      if (!this.textures.exists(key)) this.load.spritesheet(key, file, { frameWidth, frameHeight });
    };
    const image = (key, file) => {
      if (!this.textures.exists(key)) this.load.image(key, file);
    };
    sheet('fishing-ripple', 'fishing/ripple.png', 17, 6);
    sheet('fishing-bubble', 'fishing/bubble.png', 5, 5);
    image('fishing-envelope', 'fishing/envelope.png');
    image('fishing-seaweed', 'fishing/seaweed.png');
    image('fishing-paper', 'fishing/paper.png');
    // (fishing/bobber.png is loaded by Boot: it also marks the spot in the world)
    Music.load(this, S.music);
  }

  create() {
    if (new LayerAnimator(this, 'fishing').addLayers(S.layers) === 0) {
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.night).setOrigin(0).setDepth(-1);
    }
    if (S.music.length) Music.play(this, S.music);
    this.cameras.main.fadeIn(TIMING.fadeIn, 0, 0, 0);

    if (!this.anims.exists('fishing-ripple')) {
      this.anims.create({ key: 'fishing-ripple', frames: this.anims.generateFrameNumbers('fishing-ripple'), frameRate: 8 });
    }

    this.gfx = this.add.graphics(); // the rod and line, redrawn every frame
    this.bobber = this.add.image(0, 0, 'bobber').setOrigin(0.5, 0);
    this.buildHud();
    this.showTitle();

    this.input.keyboard.on('keydown', (e) => {
      if (e.repeat) return;
      if (ACTION_KEYS.includes(e.code)) this.action();
      else if (LEAVE_KEYS.includes(e.code)) this.state === 'reading' ? this.action() : this.leave();
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (_pointer, over) => {
      if (over.includes(this.leaveBg) && this.state !== 'reading') this.leave();
      else this.action();
    });
  }

  // ---- On-screen bits: Leave button, letter counter, title ------------------------------------
  buildHud() {
    // Leave (top-left): just a small arrow in a box, the same height as the counter.
    // The font's "<" is 4x7 pixels, so a 16x15 box centres it exactly
    // (inside the panel's 1 px border: 5 px either side, 3 above and below).
    const leaveText = pixelText(this, 4 + 6, 4 + 4, '<', { color: COLORS.ink });
    this.leaveBg = this.add.nineslice(4, 4, 'panel', null, 16, 15, 4, 4, 4, 4).setOrigin(0).setAlpha(0.92);
    this.leaveBg.setInteractive({ useHandCursor: true });
    this.children.bringToTop(leaveText);

    // Letters found (top-right): [envelope] 3/20
    this.counterBg = this.add.nineslice(GAME_WIDTH - 4, 4, 'panel', null, 40, 15, 4, 4, 4, 4).setOrigin(1, 0).setAlpha(0.92);
    this.counterIcon = this.add.image(0, 11, 'fishing-envelope').setScale(1);
    this.counterText = pixelText(this, 0, 7, '', { color: COLORS.ink });
    this.refreshCounter();
  }

  refreshCounter() {
    const found = SaveManager.letterCount();
    this.counterText.setText(`${found}/${LoveLetters.count}`);
    this.counterText.setTint(found >= LoveLetters.count ? COLORS.roseDark : COLORS.ink);
    const w = this.counterText.getTextBounds(false).local.width;
    const boxW = w + 26; // 4 padding + 15 icon + 3 gap + text + 4 padding
    this.counterBg.setSize(boxW, 15);
    this.counterIcon.setX(GAME_WIDTH - 4 - boxW + 4 + 7.5);
    this.counterText.setX(GAME_WIDTH - 8 - w);
  }

  /** A hop of the envelope icon when a new letter comes in. */
  bumpCounter() {
    this.refreshCounter();
    this.tweens.killTweensOf(this.counterIcon);
    this.counterIcon.setScale(1);
    this.tweens.add({ targets: this.counterIcon, scale: 1.5, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
  }

  /** The title fades in at the top for a moment, like a memory's. */
  showTitle() {
    if (!S.title) return;
    const title = pixelText(this, 0, 22, S.title, { color: COLORS.cream, shadow: COLORS.black });
    const w = title.getTextBounds(false).local.width;
    title.setX(Math.round((GAME_WIDTH - w) / 2));
    const band = this.add.graphics();
    band.fillStyle(COLORS.black, 0.35).fillRoundedRect(Math.round((GAME_WIDTH - w) / 2) - 8, 19, w + 16, 15, 6);
    this.children.moveBelow(band, title);
    [band, title].forEach((o) => o.setAlpha(0));
    this.tweens.chain({
      targets: [band, title],
      tweens: [
        { alpha: 1, duration: 700, delay: 300 },
        { alpha: 1, duration: TIMING.titleAlone },
        { alpha: 0, duration: TIMING.titleFadeOut },
      ],
      onComplete: () => [band, title].forEach((o) => o.destroy()),
    });
  }

  // ---- What a press does, depending on what's happening ----------------------------------------
  action() {
    if (this.leaving) return;
    if (this.state === 'ready') this.cast();
    else if (this.state === 'bite') this.hook();
    else if (this.state === 'reading') this.advanceLetter();
  }

  // ---- Casting --------------------------------------------------------------------------------------
  cast() {
    this.state = 'casting';
    Sfx.play(this, 'cast');
    const id = ++this.castId;
    this.tweens.chain({
      targets: this.rod,
      tweens: [
        { angle: FISHING.rodBack, duration: FISHING.swingBackMs, ease: 'Sine.easeOut' },
        { angle: FISHING.rodForward, duration: FISHING.swingForwardMs, ease: 'Sine.easeIn' },
      ],
      onComplete: () => id === this.castId && this.throwBobber(id),
    });
  }

  /** The bobber flies out in an arc and plops into the sea. */
  throwBobber(id) {
    const from = { x: this.bob.x, y: this.bob.y };
    const to = { x: Phaser.Math.Between(S.castX[0], S.castX[1]), y: S.waterY - BOBBER_SHOWN };
    this.bob.mode = 'air';
    this.tweens.add({ targets: this.rod, angle: FISHING.rodRest, duration: FISHING.flightMs, ease: 'Sine.easeOut' });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: FISHING.flightMs,
      onUpdate: (tween) => {
        const t = tween.getValue();
        this.bob.x = Phaser.Math.Linear(from.x, to.x, t);
        this.bob.y = Phaser.Math.Linear(from.y, to.y, t) - Math.sin(t * Math.PI) * FISHING.flightHeight;
      },
      onComplete: () => {
        if (id !== this.castId) return;
        this.bob.mode = 'water';
        this.splash(this.bob.x, S.waterY);
        this.tweens.add({ targets: this.line, sag: 8, duration: 500, ease: 'Sine.easeOut' });
        this.state = 'waiting';
        this.waitForBite(id);
      },
    });
  }

  /** After a random little wait, bubbles. Maybe a nibble or two first. */
  waitForBite(id) {
    const wait = Phaser.Math.Between(FISHING.waitMs[0], FISHING.waitMs[1]);
    const nibbles = Phaser.Math.Between(0, FISHING.nibbles);
    for (let i = 0; i < nibbles; i++) {
      this.time.delayedCall(Phaser.Math.Between(400, Math.max(500, wait - 500)), () => {
        if (id === this.castId && this.state === 'waiting') this.nibble();
      });
    }
    this.time.delayedCall(wait, () => id === this.castId && this.state === 'waiting' && this.startBite(id));
  }

  nibble() {
    this.tweens.add({ targets: this.bob, dip: 1, duration: 110, yoyo: true, ease: 'Sine.easeInOut' });
    this.ripple(this.bob.x, S.waterY);
  }

  // ---- The bite: bubbles! -------------------------------------------------------------------------
  startBite(id) {
    this.state = 'bite';
    this.tweens.add({ targets: this.line, sag: 2, duration: 200 });
    this.bubbler = this.time.addEvent({ delay: FISHING.bubbleEveryMs, loop: true, callback: () => this.bubble() });
    this.dipTween = this.tweens.add({ targets: this.bob, dip: 2, duration: 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.delayedCall(FISHING.biteMs, () => id === this.castId && this.state === 'bite' && this.missed(id));
  }

  stopBite() {
    this.bubbler?.remove();
    this.bubbler = null;
    this.dipTween?.remove();
    this.dipTween = null;
    this.bob.dip = 0;
  }

  /** Too slow — no harm done; it'll bite again soon. */
  missed(id) {
    this.stopBite();
    this.state = 'waiting';
    this.tweens.add({ targets: this.line, sag: 8, duration: 400 });
    this.waitForBite(id);
  }

  // ---- Hooking and reeling in ----------------------------------------------------------------------
  hook() {
    this.stopBite();
    this.state = 'reeling';
    const id = ++this.castId;
    const letter = this.pickCatch();

    // What's on the hook hangs just under the bobber.
    if (this.item) this.tweens.killTweensOf(this.item.swing); // (the last catch's sway)
    const image = this.add.image(this.bob.x, S.waterY, letter ? 'fishing-envelope' : 'fishing-seaweed').setOrigin(0.5, 0);
    this.item = { image, attached: true, swing: { x: 0 } };
    this.tweens.add({ targets: this.item.swing, x: { from: -1, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.splash(this.bob.x, S.waterY);
    for (let i = 0; i < 5; i++) this.bubble();
    this.bob.mode = 'air';
    this.tweens.add({ targets: this.line, sag: 0, duration: 200 });
    this.tweens.add({ targets: this.rod, angle: FISHING.rodReel, duration: 300, ease: 'Sine.easeOut' });

    // Reel it up to hang in the air just past the rod tip.
    const from = { x: this.bob.x, y: this.bob.y };
    const tip = this.tipAt(FISHING.rodReel);
    const to = { x: tip.x + 22, y: tip.y + 4 };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: FISHING.reelMs,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue();
        this.bob.x = Phaser.Math.Linear(from.x, to.x, t);
        this.bob.y = Phaser.Math.Linear(from.y, to.y, t) - Math.sin(t * Math.PI) * 10;
      },
      onComplete: () => id === this.castId && (letter ? this.caughtLetter(letter) : this.caughtSeaweed(id)),
    });
  }

  /**
   * Seaweed, or a letter? A random letter she hasn't read yet (any letter once
   * she's read them all). Never more than maxSeaweedInARow seaweeds running.
   */
  pickCatch() {
    const letters = LoveLetters.all();
    const seaweed = this.seaweedStreak < S.maxSeaweedInARow && Math.random() < S.seaweedChance;
    if (seaweed || letters.length === 0) {
      this.seaweedStreak++;
      return null;
    }
    this.seaweedStreak = 0;
    const unread = letters.filter((l) => !SaveManager.hasLetter(l.id));
    const again = letters.filter((l) => l.id !== this.lastLetterId);
    const pool = unread.length ? unread : again.length ? again : letters;
    const letter = Phaser.Utils.Array.GetRandom(pool);
    this.lastLetterId = letter.id;
    return letter;
  }

  caughtSeaweed(id) {
    this.time.delayedCall(FISHING.seaweedShowMs, () => {
      if (id !== this.castId) return;
      // It drops off the hook back into the sea...
      const image = this.item.image;
      this.item.attached = false;
      this.tweens.add({
        targets: image,
        y: S.waterY - 6,
        duration: 420,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.splash(image.x, S.waterY);
          this.tweens.add({ targets: image, alpha: 0, y: '+=4', duration: 250, onComplete: () => image.destroy() });
        },
      });
      // ...and she winds the bobber back in, ready for another go.
      this.reelHome(() => (this.state = 'ready'));
    });
  }

  caughtLetter(letter) {
    const isNew = SaveManager.catchLetter(letter.id);
    Sfx.play(this, 'letter');
    const { image } = this.item;
    this.sparkles(image.x, image.y + 5);
    this.time.delayedCall(800, () => {
      // The envelope floats to the middle of the screen and opens into the letter.
      this.item.attached = false;
      this.tweens.killTweensOf(image);
      this.tweens.add({
        targets: image,
        x: GAME_WIDTH / 2,
        y: GAME_HEIGHT / 2 - 10,
        scale: 3,
        alpha: 0,
        duration: 420,
        ease: 'Sine.easeIn',
        onComplete: () => image.destroy(),
      });
      this.reelHome();
      this.openLetter(letter, isNew);
    });
  }

  /** Bring the bobber back to dangle from the rod tip. */
  reelHome(onDone) {
    const from = { x: this.bob.x, y: this.bob.y };
    this.tweens.add({ targets: this.rod, angle: FISHING.rodRest, duration: 400, ease: 'Sine.easeInOut' });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 400,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue();
        const home = this.danglePoint();
        this.bob.x = Phaser.Math.Linear(from.x, home.x, t);
        this.bob.y = Phaser.Math.Linear(from.y, home.y, t);
      },
      onComplete: () => {
        this.bob.mode = 'dangle';
        onDone?.();
      },
    });
  }

  // ---- Reading a letter ----------------------------------------------------------------------------
  openLetter(letter, isNew) {
    this.state = 'reading';
    this.letterIsNew = isNew;
    const x = Math.round((GAME_WIDTH - LETTER.width) / 2);
    const textW = LETTER.width - LETTER.padX * 2;

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.night, 0.55).setOrigin(0);
    const title = pixelText(this, 0, 0, letter.title, { color: COLORS.roseDark });
    const typer = new Typewriter(this, { x: x + LETTER.padX, y: 0, text: letter.text, maxWidth: textW, color: COLORS.ink });
    const signature = pixelText(this, 0, 0, S.signature, { color: COLORS.roseDark });

    // Work out the height: title, the letter, the signature, then a row for Continue.
    const titleH = letter.title ? 16 : 0;
    const signatureH = S.signature ? 14 : 0;
    const height = LETTER.padTop + titleH + typer.height + 4 + signatureH + 12 + LETTER.padBottom;
    if (height > GAME_HEIGHT - 8)
      console.warn(`[fishing.json] letter "${letter.id}" is a bit long for the paper — try shortening it.`);
    const top = Math.max(4, Math.round((GAME_HEIGHT - height) / 2));
    const paper = this.add.nineslice(x, top, 'fishing-paper', null, LETTER.width, height, 4, 4, 4, 4).setOrigin(0);

    const tw = title.getTextBounds(false).local.width;
    title.setPosition(Math.round(GAME_WIDTH / 2 - tw / 2), top + LETTER.padTop);
    const textTop = top + LETTER.padTop + titleH;
    typer.objects.forEach((o, i) => o.setY(textTop + i * typer.lineHeight));
    const sw = signature.getTextBounds(false).local.width;
    signature.setPosition(x + LETTER.width - LETTER.padX - sw, textTop + typer.height + 4).setAlpha(0);
    const cont = new ContinueHeart(this, x + LETTER.width - LETTER.padX, top + height - LETTER.padBottom, () => {});
    // (taps anywhere are handled by the scene, so the button itself needs no callback)

    const parts = [dim, paper, title, ...typer.objects];
    for (const o of [paper, title, ...typer.objects, signature]) this.children.bringToTop(o);
    this.children.bringToTop(cont.container);
    parts.forEach((p) => p.setAlpha(0));
    this.tweens.add({ targets: dim, alpha: 1, duration: 300 });
    this.tweens.add({
      targets: [paper, title],
      alpha: 1,
      duration: 350,
      delay: 200,
      onComplete: () => {
        typer.setAlpha(1);
        typer.start(() => {
          this.tweens.add({ targets: signature, alpha: 1, duration: 300 });
          this.time.delayedCall(TIMING.continueDelay, () => cont.show());
        });
      },
    });
    this.letterView = { parts: [...parts, signature, cont.container], typer, cont };
  }

  /** Press/tap while reading: finish typing first; once Continue shows, put the letter away. */
  advanceLetter() {
    const { typer, cont } = this.letterView;
    if (!typer.timer && !typer.done) return; // still fading in
    if (!typer.done) typer.finish();
    else if (cont.visible) this.closeLetter();
  }

  closeLetter() {
    this.state = 'closing';
    Sfx.play(this, 'continue');
    const { parts } = this.letterView;
    this.tweens.killTweensOf(parts);
    this.tweens.add({
      targets: parts,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        parts.forEach((p) => p.destroy());
        this.letterView = null;
        this.state = 'ready';
        if (this.letterIsNew) this.bumpCounter();
      },
    });
  }

  // ---- Little effects -----------------------------------------------------------------------------
  /** A ring spreading out on the water. */
  ripple(x, y) {
    const ring = this.add.sprite(Math.round(x), Math.round(y), 'fishing-ripple').setOrigin(0.5, 0.5);
    ring.play('fishing-ripple');
    ring.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => ring.destroy());
  }

  /** A ripple plus a few droplets hopping up. */
  splash(x, y) {
    Sfx.play(this, 'splash');
    this.ripple(x, y);
    for (let i = 0; i < 4; i++) {
      const drop = this.add.image(x + Phaser.Math.Between(-5, 5), y - 2, 'fishing-bubble', 0);
      this.tweens.add({
        targets: drop,
        y: { from: y - 2, to: y - Phaser.Math.Between(5, 10) },
        duration: 220,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => drop.destroy(),
      });
    }
  }

  /** One bubble rising and popping beside the bobber. */
  bubble() {
    const b = this.add.image(
      Math.round(this.bob.x + Phaser.Math.Between(-8, 8)),
      S.waterY + Phaser.Math.Between(-1, 2),
      'fishing-bubble',
      Phaser.Math.Between(0, 1)
    );
    this.tweens.add({
      targets: b,
      y: `-=${Phaser.Math.Between(3, 7)}`,
      alpha: { from: 1, to: 0 },
      duration: Phaser.Math.Between(450, 700),
      ease: 'Sine.easeOut',
      onComplete: () => b.destroy(),
    });
  }

  sparkles(x, y) {
    if (!this.anims.exists('sparkle')) return; // (World makes this animation)
    for (const [dx, dy] of [[-12, -4], [11, -6], [0, 10]]) {
      const s = this.add.sprite(x + dx, y + dy, 'sparkle').play('sparkle').setAlpha(0);
      this.tweens.add({ targets: s, alpha: 1, duration: 200, yoyo: true, hold: 400, onComplete: () => s.destroy() });
    }
  }

  // ---- Every frame: place the bobber and draw the rod + line ------------------------------------------
  tipAt(angle) {
    const a = Phaser.Math.DegToRad(angle);
    return { x: S.hand[0] + Math.cos(a) * S.rodLength, y: S.hand[1] + Math.sin(a) * S.rodLength };
  }

  danglePoint() {
    const tip = this.tipAt(this.rod.angle);
    return { x: tip.x, y: tip.y + DANGLE };
  }

  update(time) {
    const tip = this.tipAt(this.rod.angle);
    const bob = this.bob;

    if (bob.mode === 'dangle') ({ x: bob.x, y: bob.y } = this.danglePoint());
    if (bob.mode === 'water') {
      // a slow, gentle float (and the dips from nibbles and bites)
      const float = this.state === 'waiting' ? Math.round((Math.sin(time / 450) + 1) / 2) : 0;
      bob.y = S.waterY - BOBBER_SHOWN + float + Math.round(bob.dip);
      this.bobber.setCrop(0, 0, this.bobber.width, BOBBER_SHOWN - float - Math.round(bob.dip));
    } else {
      this.bobber.setCrop();
    }
    this.bobber.setPosition(Math.round(bob.x), Math.round(bob.y));

    if (this.item?.attached) {
      this.item.image.setPosition(Math.round(bob.x + this.item.swing.x), Math.round(bob.y) + this.bobber.height);
    }

    // Rod: a pixel line from her hand, cork handle first.
    const g = this.gfx.clear();
    const [hx, hy] = S.hand;
    const steps = Math.ceil(Math.max(Math.abs(tip.x - hx), Math.abs(tip.y - hy)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      g.fillStyle(i < 7 ? FISHING.rodHandleColor : FISHING.rodColor, 1);
      g.fillRect(Math.round(hx + (tip.x - hx) * t), Math.round(hy + (tip.y - hy) * t), 1, 1);
    }

    // Line: from the rod tip to the bobber, sagging a little in the middle.
    const end = { x: Math.round(bob.x), y: Math.round(bob.y) };
    const mid = { x: (tip.x + end.x) / 2, y: (tip.y + end.y) / 2 + this.line.sag * 2 };
    const n = Math.ceil(Phaser.Math.Distance.Between(tip.x, tip.y, end.x, end.y)) + 1;
    g.fillStyle(FISHING.lineColor, 0.8);
    let last = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const x = Math.round(u * u * tip.x + 2 * u * t * mid.x + t * t * end.x);
      const y = Math.round(u * u * tip.y + 2 * u * t * mid.y + t * t * end.y);
      if (last && last.x === x && last.y === y) continue;
      g.fillRect(x, y, 1, 1);
      last = { x, y };
    }
  }

  // ---- Leaving ---------------------------------------------------------------------------------------
  leave() {
    if (this.leaving || this.state === 'reading' || this.state === 'closing') return;
    this.leaving = true;
    this.cameras.main.fadeOut(TIMING.fadeOut, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop();
      this.scene.resume('World', {});
    });
  }
}
