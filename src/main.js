// -----------------------------------------------------------------------------
// main.js — creates the Phaser game and keeps it crisply scaled to the window.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';

import { GAME_WIDTH, GAME_HEIGHT, COLORS, INTEGER_ZOOM } from './config.js';
import Boot from './scenes/Boot.js';
import Title from './scenes/Title.js';
import World from './scenes/World.js';
import HUD from './scenes/HUD.js';
import Memory from './scenes/Memory.js';
import Finale from './scenes/Finale.js';

const game = new Phaser.Game({
  type: Phaser.AUTO, // WebGL where possible
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,

  // Pixel-art settings: nearest-neighbour scaling, snap to whole pixels.
  pixelArt: true,
  roundPixels: true,

  scale: {
    // We manage the zoom ourselves (see fitToWindow below) so we can keep
    // it to whole numbers. Phaser still centres the canvas for us.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 1,
  },

  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },

  // Allow the joystick and the action button to be pressed at the same time.
  input: { activePointers: 3 },

  // Scene order = draw order when several run at once (later = on top).
  scene: [Boot, Title, World, HUD, Memory, Finale],
});

// -----------------------------------------------------------------------------
// Integer zoom: scale the 320x180 game by 2x, 3x, 4x... whatever fits.
// (Phaser's own FIT mode allows fractional scales like 2.37x, which makes
// some pixels wider than others — not nice for pixel art.)
// -----------------------------------------------------------------------------
function fitToWindow() {
  const parent = document.getElementById('game');
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  if (!w || !h) return;

  const fit = Math.min(w / GAME_WIDTH, h / GAME_HEIGHT);
  // Whole-number zoom when at least 2x fits; otherwise use the exact fit so
  // the game is never tiny on small phones.
  const zoom = INTEGER_ZOOM && fit >= 2 ? Math.floor(fit) : fit;

  if (Math.abs(game.scale.zoom - zoom) > 0.001) {
    game.scale.setZoom(zoom);
  } else {
    game.scale.refresh(); // re-centre only
  }
}

game.events.once(Phaser.Core.Events.READY, fitToWindow);
window.addEventListener('resize', fitToWindow);
window.addEventListener('orientationchange', () => setTimeout(fitToWindow, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitToWindow);

// Handy for poking around in the browser console while developing
// (e.g. `game.scene.getScene('World')`). Not included in the built game.
if (import.meta.env.DEV) window.game = game;
