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
// Any tile whose tileset property collides = true blocks her, on any of
// Ground / Decor / Collision.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { DEPTH, CAMERA_LERP, TIMING, COLORS, TILE_SIZE } from '../config.js';
import Player from '../objects/Player.js';
import TouchControls from '../objects/TouchControls.js';
import { pixelText } from '../objects/Typewriter.js';
import MemoryRegistry from '../systems/MemoryRegistry.js';
import SaveManager from '../systems/SaveManager.js';
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
    return MemoryRegistry.isUnlocked(memory, SaveManager.foundCount()) || SaveManager.isFound(memory.id);
  }

  /**
   * Visible memories she hasn't found get a twinkling sparkle; found ones get
   * a small heart so she can find them again. Hidden ones show nothing until
   * found. Locked ones (unlockAfter) appear once they unlock.
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
  }

  refreshMarkers() {
    for (const m of this.markers) {
      const { memory } = m.trigger;
      const found = SaveManager.isFound(memory.id);
      m.sparkle.setVisible(!found && !memory.hidden && this.isActive(memory));
      m.heart.setVisible(found);
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

    const interact = this.consumeInteract();

    this.checkTriggers(interact);
    this.fadeCanopy();

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

    if (!zone) {
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
    const button = this.touch.visible ? 'Tap ♥' : 'Press E';
    this.showPrompt(found ? `${button} to revisit` : `${button} to look closer`);
    if (interact) this.openMemory(memory);
  }

  /**
   * Treetops (the Above layer) turn see-through when she walks behind them,
   * so she never gets lost under the leaves.
   */
  fadeCanopy() {
    const above = this.layers.Above;
    if (!above) return;
    const b = this.player.getBounds();
    const overlapping = above.getTilesWithinWorldXY(b.x, b.y, b.width, b.height, { isNotEmpty: true });
    const near = new Set();
    if (overlapping.length) {
      for (const tile of above.getTilesWithinWorldXY(b.x - 20, b.y - 20, b.width + 40, b.height + 40, { isNotEmpty: true }))
        near.add(tile);
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

    this.cameras.main.fadeOut(TIMING.fadeOut, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.hud.scene.setVisible(false);
      this.scene.pause();
      this.scene.launch('Memory', { id: memory.id, newlyFound });
    });
  }

  /** Called when the Memory (or Finale) scene hands control back. */
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
