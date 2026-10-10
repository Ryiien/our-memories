// -----------------------------------------------------------------------------
// World — walking around the map.
//
// Map layers (see CLAUDE.md, "Map conventions"):
//   Ground, Decor  — tile layers under her
//   Above          — tile layer drawn over her (treetops, lamp tops)
//   Collision      — tile layer, invisible in game: paint the red X tile
//                    wherever she shouldn't walk
//   Triggers       — object layer: rectangles with a "memoryId" property
//   Spawn          — object layer: a point named "player"
//   Momos          — object layer (optional): one point per momo to collect
//   Fishing        — object layer (optional): rectangles where she can fish
//                    for love letters (see scenes/Fishing.js)
//   Critters       — object layer (optional): a point per animal in
//                    data/critters.json (named by its id) where it sits
// Any tile whose tileset property collides = true blocks her, on any of
// Ground / Decor / Collision.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { DEPTH, CAMERA_LERP, TIMING, COLORS, TILE_SIZE, MOMO, CRITTER } from '../config.js';
import Player from '../objects/Player.js';
import TouchControls from '../objects/TouchControls.js';
import { pixelText } from '../objects/Typewriter.js';
import MemoryRegistry from '../systems/MemoryRegistry.js';
import Momos from '../systems/Momos.js';
import LoveLetters from '../systems/LoveLetters.js';
import Critters from '../systems/Critters.js';
import SaveManager from '../systems/SaveManager.js';
import Sfx from '../systems/Sfx.js';
import Music from '../systems/Music.js';
import { tilesetKey } from './Boot.js';
import gameData from '../../data/game.json';

const COLLIDING_LAYERS = ['Ground', 'Decor', 'Collision'];
const INTERACT_KEYS = ['Space', 'Enter', 'NumpadEnter', 'KeyE'];

export default class World extends Phaser.Scene {
  constructor() {
    super('World');
  }

  /** data.newGame: true = start at the spawn point, false = where she left off. */
  create(data = {}) {
    this.busy = false; // true while a memory is opening/closing
    this.currentZone = null;
    this.lastSaveAt = 0;
    this.fadedTiles = new Map();

    this.buildMap();
    this.spawnPlayer(data.newGame);
    this.readTriggers();
    this.createMarkers();
    this.createMomos();
    this.updateMomoSpeed();
    this.createFishingSpots();
    this.createCritters();
    this.createPrompt();

    // Camera: follow her smoothly, never showing outside the map.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    cam.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);
    cam.setRoundPixels(true);
    cam.fadeIn(TIMING.fadeIn, 0, 0, 0);

    // Controls
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER,E');
    // Interact presses are caught from the keydown event itself, so even a
    // very quick tap (pressed and released between two frames) counts.
    this.interactQueued = false;
    this.input.keyboard.on('keydown', (e) => {
      if (INTERACT_KEYS.includes(e.code) && !e.repeat) this.interactQueued = true;
    });
    this.touch = new TouchControls(this);

    // HUD runs on top as its own scene.
    this.scene.launch('HUD');
    this.hud = this.scene.get('HUD');

    Music.play(this, gameData.worldMusic ?? null);

    // Coming back from a memory / the finale.
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);

    // Save her position when the tab is hidden or closed.
    const saveNow = () => this.savePosition();
    document.addEventListener('visibilitychange', saveNow);
    window.addEventListener('pagehide', saveNow);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', saveNow);
      window.removeEventListener('pagehide', saveNow);
      this.scene.stop('HUD');
    });
  }

  // ---- Map -----------------------------------------------------------------------------
  buildMap() {
    this.map = this.make.tilemap({ key: 'world-map' });
    const tilesets = this.map.tilesets
      .map((ts) => this.map.addTilesetImage(ts.name, tilesetKey(ts.name)))
      .filter(Boolean);

    const layer = (name, depth) => {
      if (!this.map.getLayer(name)) return null;
      return this.map.createLayer(name, tilesets, 0, 0).setDepth(depth);
    };
    this.layers = {
      Ground: layer('Ground', DEPTH.ground),
      Decor: layer('Decor', DEPTH.decor),
      Above: layer('Above', DEPTH.above),
      Collision: layer('Collision', DEPTH.decor),
    };
    this.layers.Collision?.setVisible(false);
    for (const name of COLLIDING_LAYERS) this.layers[name]?.setCollisionByProperty({ collides: true });

    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
  }

  /** Is there a blocking tile at this map pixel? */
  isBlocked(x, y) {
    return COLLIDING_LAYERS.some((name) => this.layers[name]?.getTileAtWorldXY(x, y)?.collides);
  }

  spawnPlayer(newGame) {
    const spawnLayer = this.map.getObjectLayer('Spawn');
    const spawn = spawnLayer?.objects.find((o) => o.name === 'player') ?? spawnLayer?.objects[0];
    let x = spawn?.x ?? this.map.widthInPixels / 2;
    let y = spawn?.y ?? this.map.heightInPixels / 2;
    let facing = 'down';

    const saved = newGame ? null : SaveManager.getPosition();
    // Only trust a saved spot if it's still inside the map and not in a wall
    // (the map may have been edited since).
    if (
      saved &&
      saved.x > 0 && saved.y > 0 &&
      saved.x < this.map.widthInPixels && saved.y < this.map.heightInPixels &&
      !this.isBlocked(saved.x, saved.y)
    ) {
      ({ x, y } = saved);
      facing = saved.facing ?? 'down';
    }

    this.player = new Player(this, x, y, facing);
    for (const name of COLLIDING_LAYERS) {
      if (this.layers[name]) this.physics.add.collider(this.player, this.layers[name]);
    }
  }

  // ---- Triggers & markers ------------------------------------------------------------
  readTriggers() {
    const objects = this.map.getObjectLayer('Triggers')?.objects ?? [];
    this.triggers = objects
      .map((o) => {
        const props = Array.isArray(o.properties) ? o.properties : [];
        const memoryId = props.find((p) => p.name === 'memoryId')?.value;
        const memory = MemoryRegistry.get(memoryId);
        if (!memory) return null; // (Boot already warned about this)
        return { memory, rect: new Phaser.Geom.Rectangle(o.x, o.y, o.width || TILE_SIZE, o.height || TILE_SIZE) };
      })
      .filter(Boolean);
  }

  isActive(memory) {
    return (
      MemoryRegistry.isUnlocked(memory, SaveManager.foundCount(), SaveManager.momoCount()) ||
      SaveManager.isFound(memory.id)
    );
  }

  /**
   * Visible memories she hasn't found get a twinkling sparkle; found ones get
   * a small heart so she can find them again. Hidden ones show nothing until
   * found, unless they have revealOnUnlock. Locked ones (unlockAfter,
   * momosNeeded) appear once they unlock.
   */
  createMarkers() {
    if (!this.anims.exists('sparkle')) {
      this.anims.create({ key: 'sparkle', frames: this.anims.generateFrameNumbers('sparkle'), frameRate: 6, repeat: -1 });
    }
    this.markers = this.triggers.map((t) => {
      const x = t.rect.centerX;
      const y = t.rect.centerY - 6;
      const sparkle = this.add.sprite(x, y, 'sparkle').setDepth(DEPTH.markers).play('sparkle');
      const heart = this.add.image(x, y + 2, 'heart').setDepth(DEPTH.markers).setAlpha(0.7);
      this.tweens.add({ targets: [sparkle, heart], y: '-=2', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return { trigger: t, sparkle, heart };
    });
    this.refreshMarkers();
    // revealOnUnlock memories that are already showing (so we only
    // announce the ones that appear from now on).
    this.revealed = new Set(this.triggers.filter((t) => this.isRevealed(t.memory)).map((t) => t.memory.id));
  }

  /** A hidden memory with revealOnUnlock shows its sparkle once it unlocks. */
  isRevealed(memory) {
    return memory.revealOnUnlock && this.isActive(memory);
  }

  refreshMarkers() {
    for (const m of this.markers) {
      const { memory } = m.trigger;
      const found = SaveManager.isFound(memory.id);
      const visible = !memory.hidden || this.isRevealed(memory);
      m.sparkle.setVisible(!found && visible && this.isActive(memory));
      // A revealed secret shines through the treetops so she can spot it.
      if (memory.revealOnUnlock) m.sparkle.setDepth(DEPTH.above + 1);
      m.heart.setVisible(found);
    }
  }

  /**
   * Has a hidden memory just appeared (she found the last momo or memory it
   * was waiting for)? Show its sparkle and say so.
   */
  checkReveals() {
    let appeared = false;
    for (const { memory } of this.triggers) {
      if (this.revealed.has(memory.id) || !this.isRevealed(memory) || SaveManager.isFound(memory.id)) continue;
      this.revealed.add(memory.id);
      appeared = true;
    }
    if (!appeared) return;
    this.refreshMarkers();
    this.hud.toast('A hidden memory appeared... ♥');
  }

  // ---- Momos ---------------------------------------------------------------------------
  /** A small glowing momo on every spot of the Momos layer she hasn't collected yet. */
  createMomos() {
    this.momos = Momos.all()
      .filter((m) => !SaveManager.hasMomo(m.id))
      .map((m) => {
        const glow = this.add.image(m.x, m.y - 4, 'momo-glow').setDepth(DEPTH.markers);
        const sprite = this.add.image(m.x, m.y - 4, 'momo').setDepth(DEPTH.markers);
        // Start each one at a random point in its float/glow so they don't all move together.
        const offset = Math.random();
        this.tweens.add({
          targets: [sprite, glow], y: `-=${MOMO.bob}`, duration: MOMO.bobMs, yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut', delay: offset * MOMO.bobMs,
        });
        glow.setAlpha(MOMO.glowAlpha[0]);
        this.tweens.add({
          targets: glow, alpha: MOMO.glowAlpha[1], duration: MOMO.glowMs, yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut', delay: offset * MOMO.glowMs,
        });
        return { ...m, sprite, glow };
      });
  }

  /** Collect any momo her feet are touching. */
  checkMomos() {
    if (!this.momos.length) return;
    const feet = this.player.getFeet();
    for (const momo of this.momos) {
      if (Phaser.Math.Distance.Between(feet.x, feet.y, momo.x, momo.y) > MOMO.pickupRadius) continue;
      this.momos = this.momos.filter((m) => m !== momo);
      SaveManager.collectMomo(momo.id);
      Sfx.play(this, 'momo');

      // Pop up and fade away.
      this.tweens.killTweensOf([momo.sprite, momo.glow]);
      this.tweens.add({
        targets: momo.sprite, y: momo.sprite.y - 12, scale: 1.4, alpha: 0, duration: 450, ease: 'Sine.easeOut',
        onComplete: () => momo.sprite.destroy(),
      });
      this.tweens.add({
        targets: momo.glow, scale: 2, alpha: 0, duration: 450, ease: 'Sine.easeOut',
        onComplete: () => momo.glow.destroy(),
      });
      this.hud.momoCollected();
      this.updateMomoSpeed();
      this.checkReveals();
      return; // one per frame is plenty
    }
  }

  /** With every momo eaten she's full of energy: she walks MOMO.allFoundSpeed times faster. */
  updateMomoSpeed() {
    const allEaten = Momos.count > 0 && SaveManager.momoCount() >= Momos.count;
    this.player.setSpeedMultiplier(allEaten ? MOMO.allFoundSpeed : 1);
  }

  // ---- Fishing spots ----------------------------------------------------------------------
  /**
   * Places on the map's "Fishing" layer where she can fish for love letters.
   * A little bobber floats in the water just off the sea-side (left) edge of
   * each one, so she knows to go there.
   */
  createFishingSpots() {
    this.fishingSpots = LoveLetters.spots().map((s) => {
      const rect = new Phaser.Geom.Rectangle(s.x, s.y, s.width, s.height);
      const marker = this.add.image(rect.x - 6, rect.centerY - 4, 'bobber').setOrigin(0.5, 0).setDepth(DEPTH.markers);
      marker.setCrop(0, 0, marker.width, 6); // only the top shows above the water
      this.tweens.add({ targets: marker, y: '+=1', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return rect;
    });
  }

  inFishingSpot(feet) {
    return this.fishingSpots.some((rect) => rect.contains(feet.x, feet.y));
  }

  // ---- Critters ---------------------------------------------------------------------------
  /**
   * The animals from data/critters.json, each sitting on its point of the
   * "Critters" layer, playing its idle frames. A little solid box round its
   * feet stops her walking through it.
   */
  createCritters() {
    this.critters = Critters.all().map((c) => {
      const key = Critters.key(c);
      if (!this.textures.exists(key)) return null; // (Boot already warned)
      const animKey = `${key}:idle`;
      if (!this.anims.exists(animKey)) {
        this.anims.create({ key: animKey, frames: c.idle.map((frame) => ({ key, frame })), frameRate: c.fps, repeat: -1 });
      }
      const sprite = this.add.sprite(c.x, c.y, key).setOrigin(0.5, 1).play(animKey);
      const feet = this.add.zone(c.x, c.y - CRITTER.body.height / 2, CRITTER.body.width, CRITTER.body.height);
      this.physics.add.existing(feet, true);
      this.physics.add.collider(this.player, feet);
      return { ...c, sprite, animKey, bubble: null };
    }).filter(Boolean);
    this.sortCritters();
  }

  /** In front of her when it's lower on the screen, behind her when it's higher. */
  sortCritters() {
    const feet = this.player.getFeet();
    for (const c of this.critters) c.sprite.setDepth(c.y > feet.y ? DEPTH.player + 1 : DEPTH.player - 1);
  }

  /** The critter her feet are close enough to say hi to, if any. */
  nearestCritter(feet) {
    let best = null;
    let bestD = CRITTER.talkRadius;
    for (const c of this.critters) {
      const d = Phaser.Math.Distance.Between(feet.x, feet.y, c.x, c.y);
      if (d <= bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  /** A speech bubble over the critter for a moment; it shows its "sayFrame" while it talks. */
  critterSays(c) {
    c.bubble?.destroy();
    const line = Phaser.Utils.Array.GetRandom(c.says);
    const text = pixelText(this, 0, 0, line, { color: COLORS.ink });
    const w = text.getTextBounds(false).local.width;
    const bg = this.add.nineslice(0, 0, 'panel', null, w + 10, 15, 4, 4, 4, 4).setOrigin(0.5, 1);
    text.setPosition(-Math.round(w / 2), -12);
    const bubble = this.add.container(Math.round(c.x), Math.round(c.y - c.frameHeight - 1), [bg, text]).setDepth(DEPTH.prompt);
    c.bubble = bubble;
    // a little pop in, then float up and fade
    bubble.setScale(0.6);
    this.tweens.add({ targets: bubble, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: bubble, alpha: 0, y: bubble.y - 4, delay: CRITTER.sayMs, duration: 300,
      onComplete: () => {
        bubble.destroy();
        if (c.bubble === bubble) c.bubble = null;
      },
    });
    // face her, and open its mouth while the bubble is up
    c.sprite.setFlipX(this.player.x > c.x === (c.faces === 'left'));
    if (c.sayFrame !== null) {
      c.sprite.stop().setFrame(c.sayFrame);
      this.time.delayedCall(CRITTER.sayMs, () => c.sprite.play(c.animKey));
    }
  }

  // ---- "Press E" prompt ----------------------------------------------------------------
  createPrompt() {
    this.prompt = this.add.container(0, 0).setDepth(DEPTH.prompt).setVisible(false);
    this.promptBg = this.add.nineslice(0, 0, 'panel', null, 40, 14, 4, 4, 4, 4).setOrigin(0.5, 1);
    this.promptText = pixelText(this, 0, 0, '', { color: COLORS.ink });
    this.prompt.add([this.promptBg, this.promptText]);
  }

  showPrompt(text) {
    if (this.promptText.text !== text) {
      this.promptText.setText(text);
      const w = this.promptText.getTextBounds(false).local.width;
      this.promptBg.setSize(w + 10, 15);
      this.promptText.setPosition(-Math.round(w / 2), -12);
    }
    // float above her head
    this.prompt.setPosition(Math.round(this.player.x), Math.round(this.player.y - 14));
    this.prompt.setVisible(true);
  }

  /** True once per press of Space / Enter / E or the touch heart button. */
  consumeInteract() {
    const pressed = this.interactQueued;
    this.interactQueued = false;
    return this.touch.consumeAction() || pressed;
  }

  // ---- Every frame ----------------------------------------------------------------------
  update(time) {
    if (this.busy) {
      this.consumeInteract(); // ignore presses while fading
      return;
    }

    // Movement: keyboard + touch joystick
    const k = this.keys;
    let x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (x === 0 && y === 0) ({ x, y } = this.touch.vector);
    this.player.move(x, y);
    this.checkMomos();

    const interact = this.consumeInteract();

    this.checkTriggers(interact);
    this.fadeCanopy();
    this.sortCritters();

    if (this.player.moving && time - this.lastSaveAt > TIMING.savePositionEvery) {
      this.lastSaveAt = time;
      this.savePosition();
    }
  }

  checkTriggers(interact) {
    const feet = this.player.getFeet();
    const zone = this.triggers.find((t) => t.rect.contains(feet.x, feet.y) && this.isActive(t.memory)) ?? null;
    const entered = zone && zone !== this.currentZone;
    this.currentZone = zone;

    const button = this.touch.visible ? 'Tap ♥' : 'Press E';

    if (!zone) {
      // Not on a memory: maybe at the end of the pier?
      if (this.inFishingSpot(feet)) {
        this.showPrompt(`${button} to fish`);
        if (interact) this.openFishing();
        return;
      }
      // ...or next to a critter? (no prompt — pressing E just makes it talk)
      const critter = this.nearestCritter(feet);
      if (critter && interact) this.critterSays(critter);
      this.prompt.setVisible(false);
      return;
    }
    const { memory } = zone;
    const found = SaveManager.isFound(memory.id);

    // New memory, no button needed: walking in starts it.
    if (!found && !memory.requiresAction) {
      if (entered) this.openMemory(memory);
      return;
    }

    // Revisit, or a memory that needs a button press.
    this.showPrompt(found ? `${button} to revisit` : `${button} to look closer`);
    if (interact) this.openMemory(memory);
  }

  /**
   * Treetops (the Above layer) turn see-through when she walks behind them,
   * so she never gets lost under the leaves. Tiles whose tileset property
   * `noFade` is true stay as they are (e.g. a glass bus shelter: she shows
   * through the glass by itself, and the roof should still hide her).
   */
  fadeCanopy() {
    const above = this.layers.Above;
    if (!above) return;
    const b = this.player.getBounds();
    const fadeable = (tile) => !tile.properties?.noFade;
    const overlapping = above.getTilesWithinWorldXY(b.x, b.y, b.width, b.height, { isNotEmpty: true }).filter(fadeable);
    const near = new Set();
    if (overlapping.length) {
      for (const tile of above.getTilesWithinWorldXY(b.x - 20, b.y - 20, b.width + 40, b.height + 40, { isNotEmpty: true }))
        if (fadeable(tile)) near.add(tile);
    }
    for (const tile of near) if (!this.fadedTiles.has(tile)) this.fadedTiles.set(tile, tile.alpha);
    for (const [tile] of this.fadedTiles) {
      const target = near.has(tile) ? 0.4 : 1;
      tile.alpha += (target - tile.alpha) * 0.2;
      if (target === 1 && tile.alpha > 0.98) {
        tile.alpha = 1;
        this.fadedTiles.delete(tile);
      }
    }
  }

  savePosition() {
    if (!this.player?.body) return;
    const feet = this.player.getFeet();
    SaveManager.savePosition(feet.x, feet.y, this.player.facing);
  }

  // ---- Opening / closing memories ---------------------------------------------------------
  openMemory(memory) {
    if (this.busy) return;
    this.busy = true;
    this.player.stop();
    this.prompt.setVisible(false);
    this.savePosition();
    const newlyFound = SaveManager.markFound(memory.id);
    this.fadeToScene('Memory', { id: memory.id, newlyFound });
  }

  /** The love-letter fishing minigame (comes back through onResume, like a memory). */
  openFishing() {
    if (this.busy) return;
    this.busy = true;
    this.player.stop();
    this.prompt.setVisible(false);
    this.savePosition();
    this.fadeToScene('Fishing');
  }

  /** Fade out, pause the world (and hide the HUD), and open another scene on top. */
  fadeToScene(key, data) {
    this.cameras.main.fadeOut(TIMING.fadeOut, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.hud.scene.setVisible(false);
      this.scene.pause();
      this.scene.launch(key, data);
    });
  }

  /** Called when the Memory (or Finale, or Fishing) scene hands control back. */
  onResume(_sys, data = {}) {
    this.input.keyboard.resetKeys();
    this.touch.release();
    this.hud.scene.setVisible(true);
    this.hud.refresh();
    this.refreshMarkers();
    Music.play(this, gameData.worldMusic ?? null);
    this.cameras.main.fadeIn(TIMING.fadeIn, 0, 0, 0);

    if (data.newlyFound) {
      this.hud.toast();
      this.checkReveals(); // (its toast waits for "Memory found!" to finish)
      // The last one! Give the toast a moment, then play the finale.
      if (SaveManager.allFound() && !SaveManager.finaleSeen) {
        this.time.delayedCall(TIMING.toast, () => this.openFinale());
        return; // stay busy until the finale opens
      }
    }
    // Ignore input until the fade-in finishes, so a quick double-press of
    // Continue doesn't instantly reopen the memory she's standing on.
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.input.keyboard.resetKeys();
      this.consumeInteract();
      this.busy = false;
    });
  }

  openFinale() {
    this.player.stop();
    this.cameras.main.fadeOut(TIMING.fadeOut * 2, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.hud.scene.setVisible(false);
      this.scene.pause();
      this.scene.launch('Finale');
    });
  }
}
