// -----------------------------------------------------------------------------
// Boot — loads the shared assets (font, UI, player, map + tilesets) with a
// little progress bar, sanity-checks the data, then opens the title screen.
//
// Memory cutscene images are NOT loaded here; each memory loads its own
// layers when it opens (so adding memories never slows down startup).
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ASSET_ROOT, COLORS, FONT, PLAYER } from '../config.js';
import MemoryRegistry from '../systems/MemoryRegistry.js';
import Momos from '../systems/Momos.js';
import LoveLetters from '../systems/LoveLetters.js';
import Critters from '../systems/Critters.js';
import Music from '../systems/Music.js';
import Sfx from '../systems/Sfx.js';
import gameData from '../../data/game.json';
import finaleData from '../../data/finale.json';
import worldMap from '../../maps/world.json';

/** Texture key for a Tiled tileset (by its name in Tiled). */
export const tilesetKey = (name) => `tileset:${name}`;

export default class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.drawProgressBar();
    this.load.setPath(ASSET_ROOT);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file) => {
      console.warn(`[boot] Couldn't load ${file.url} — check the file exists in public/${file.url}`);
    });

    // UI
    this.load.bitmapFont(FONT.key, 'ui/font.png', 'ui/font.xml');
    this.load.image('heart', 'ui/heart.png');
    this.load.image('continue-heart', 'ui/continue-heart.png');
    this.load.image('panel', 'ui/panel.png');
    this.load.spritesheet('sparkle', 'ui/sparkle.png', { frameWidth: 16, frameHeight: 16 });
    this.load.image('joystick-base', 'ui/joystick-base.png');
    this.load.image('joystick-knob', 'ui/joystick-knob.png');
    this.load.image('action-button', 'ui/action-button.png');
    this.load.image('momo', 'ui/momo.png');
    this.load.image('momo-hud', 'ui/momo-hud.png');
    this.load.image('momo-glow', 'ui/momo-glow.png');
    this.load.image('bobber', 'fishing/bobber.png'); // marks the fishing spot (and is the bobber in Fishing)

    // Player
    this.load.spritesheet('player', 'sprites/player.png', {
      frameWidth: PLAYER.frameWidth,
      frameHeight: PLAYER.frameHeight,
    });

    // Critters (data/critters.json): one sprite sheet each
    for (const c of Critters.all()) {
      this.load.spritesheet(Critters.key(c), c.sprite, { frameWidth: c.frameWidth, frameHeight: c.frameHeight });
    }

    // Map (imported as data) + every tileset image it uses. The tileset's
    // image path in Tiled only matters for Tiled; here we take the file name
    // and look for it in public/assets/tiles/.
    this.load.tilemapTiledJSON('world-map', worldMap);
    for (const ts of worldMap.tilesets ?? []) {
      if (ts.source) {
        MemoryRegistry.warn(
          `The map uses an external tileset (${ts.source}). Phaser needs tilesets embedded in the map: ` +
            'in Tiled, select the tileset and click "Embed Tileset", then save the map.'
        );
        continue;
      }
      const file = String(ts.image ?? '').split(/[\\/]/).pop();
      this.load.image(tilesetKey(ts.name), `tiles/${file}`);
    }

    Music.load(this, gameData.worldMusic);
    Sfx.preload(this); // sound effects are tiny, so they all load up front
  }

  drawProgressBar() {
    const w = 120;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT / 2;
    const frame = this.add.graphics();
    frame.fillStyle(COLORS.inkSoft, 1).fillRect(x - 2, y - 2, w + 4, 8);
    frame.fillStyle(COLORS.night, 1).fillRect(x - 1, y - 1, w + 2, 6);
    const bar = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (p) => {
      bar.clear().fillStyle(COLORS.rose, 1).fillRect(x, y, Math.max(1, Math.round(w * p)), 4);
    });
  }

  create() {
    this.makeGoldPanel();
    this.checkData();
    this.scene.start('Title');
  }

  /**
   * 'panel-gold': a copy of ui/panel.png with its outline (every pixel at the
   * edge of the shape) painted gold. Counters switch to it once they're complete.
   */
  makeGoldPanel() {
    const src = this.textures.get('panel').getSourceImage();
    const { width: w, height: h } = src;
    const tex = this.textures.createCanvas('panel-gold', w, h);
    const ctx = tex.getContext();
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const edge = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (solid(x, y) && !(solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1))) edge.push((y * w + x) * 4);
      }
    }
    for (const i of edge) {
      d[i] = (COLORS.gold >> 16) & 0xff;
      d[i + 1] = (COLORS.gold >> 8) & 0xff;
      d[i + 2] = COLORS.gold & 0xff;
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
  }

  /** Friendly warnings for common mistakes (shown in the browser console). */
  checkData() {
    const layerNames = (worldMap.layers ?? []).map((l) => l.name);
    for (const name of ['Ground', 'Decor', 'Above', 'Collision', 'Triggers', 'Spawn']) {
      if (!layerNames.includes(name)) MemoryRegistry.warn(`The map has no "${name}" layer (layer names are case-sensitive).`);
    }
    const triggers = (worldMap.layers ?? []).find((l) => l.name === 'Triggers')?.objects ?? [];
    const ids = triggers.map((o) => (o.properties ?? []).find((p) => p.name === 'memoryId')?.value).filter(Boolean);
    if (ids.length < triggers.length) MemoryRegistry.warn('Some trigger zones in the map have no "memoryId" property.');
    MemoryRegistry.checkAgainstMap(ids);
    Sfx.check();

    // Momos are optional, but two with the same name would count as one.
    const momoIds = Momos.all().map((m) => m.id);
    const dupes = [...new Set(momoIds.filter((id, i) => momoIds.indexOf(id) !== i))];
    if (dupes.length) MemoryRegistry.warn(`Some momos on the map share a name (${dupes.join(', ')}) — each needs its own.`);

    // Characters the pixel font can't draw would silently disappear — say so.
    const font = this.cache.bitmapFont.get(FONT.key);
    if (!font) return;
    const chars = font.data.chars;
    const check = (text, where) => {
      const missing = [...new Set([...String(text ?? '')].filter((ch) => ch !== '\n' && !chars[ch.charCodeAt(0)]))];
      if (missing.length) MemoryRegistry.warn(`${where} uses characters the font doesn't have: ${missing.join(' ')}`);
    };
    for (const m of MemoryRegistry.all()) {
      check(m.title, `memory "${m.id}" title`);
      check(m.date, `memory "${m.id}" date`);
      check(m.caption, `memory "${m.id}" caption`);
    }
    check(finaleData.title, 'finale title');
    (finaleData.lines ?? []).forEach((l, i) => check(l, `finale line ${i + 1}`));
    check(finaleData.signature, 'finale signature');
    check(gameData.herName, 'game.json herName');
    check(gameData.titleLine, 'game.json titleLine');
    check(gameData.subtitle, 'game.json subtitle');
    check(LoveLetters.settings.title, 'fishing.json title');
    check(LoveLetters.settings.signature, 'fishing.json signature');
    for (const l of LoveLetters.all()) {
      check(l.title, `letter "${l.id}" title`);
      check(l.text, `letter "${l.id}" text`);
    }
    for (const c of Critters.all()) {
      check(c.name, `critter "${c.id}" name`);
      c.says.forEach((s) => check(s, `critter "${c.id}" says`));
    }
  }
}
