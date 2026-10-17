// -----------------------------------------------------------------------------
// Player — her little pixel self. Walks in 4 directions with a walk cycle and
// stands facing the last direction she moved.
//
// Spritesheet layout (sprites/player.png): see PLAYER / PLAYER_ROWS in
// config.js and "Sprite sheet layout" in CLAUDE.md. Once she's won her tiara
// she uses sprites/player-tiara.png (same layout) — see setTiara().
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { PLAYER, PLAYER_ROWS, PLAYER_FRAMES_PER_ROW, DEPTH, AUDIO } from '../config.js';
import Sfx from '../systems/Sfx.js';

// Where her feet are relative to the sprite's centre (the collision box
// sits at her feet, and positions in saves/maps are feet positions).
const FEET_DX = PLAYER.body.offsetX + PLAYER.body.width / 2 - PLAYER.frameWidth / 2;
const FEET_DY = PLAYER.body.offsetY + PLAYER.body.height / 2 - PLAYER.frameHeight / 2;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * Creates walk-<dir> and idle-<dir> animations (once per game), and
   * walk-<dir>-tiara / idle-<dir>-tiara from the tiara sheet if it loaded.
   */
  static createAnimations(scene) {
    const looks = [{ texture: 'player', suffix: '' }];
    if (scene.textures.exists('player-tiara')) looks.push({ texture: 'player-tiara', suffix: '-tiara' });
    for (const { texture, suffix } of looks) {
      PLAYER_ROWS.forEach((dir, row) => {
        const first = row * PLAYER_FRAMES_PER_ROW;
        if (!scene.anims.exists(`walk-${dir}${suffix}`)) {
          scene.anims.create({
            key: `walk-${dir}${suffix}`,
            frames: scene.anims.generateFrameNumbers(texture, { start: first, end: first + PLAYER_FRAMES_PER_ROW - 1 }),
            frameRate: PLAYER.walkFps,
            repeat: -1,
          });
        }
        if (!scene.anims.exists(`idle-${dir}${suffix}`)) {
          scene.anims.create({ key: `idle-${dir}${suffix}`, frames: [{ key: texture, frame: first }] });
        }
      });
    }
  }

  constructor(scene, feetX, feetY, facing = 'down') {
    super(scene, 0, 0, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    Player.createAnimations(scene);

    this.body.setSize(PLAYER.body.width, PLAYER.body.height);
    this.body.setOffset(PLAYER.body.offsetX, PLAYER.body.offsetY);
    this.setCollideWorldBounds(true);
    this.setDepth(DEPTH.player);

    this.facing = PLAYER_ROWS.includes(facing) ? facing : 'down';
    this.moving = false;
    this.speedMultiplier = 1; // see setSpeedMultiplier()
    this.look = ''; // '' or '-tiara': which sheet her animations use (see setTiara)
    this.setFeet(feetX, feetY);
    this.play(`idle-${this.facing}`);

    // A footstep each time a foot lands in the walk cycle. The animation speeds
    // up with setSpeedMultiplier, so the steps do too.
    this.stepSound = Sfx.add(scene, 'step');
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.stepSound?.destroy());
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim, frame) => {
      if (anim.key.startsWith('walk-') && PLAYER.stepFrames.includes(frame.index)) this.footstep();
    });
  }

  footstep() {
    this.stepSound?.play({ rate: PLAYER.stepRate, volume: AUDIO.sfxVolume * PLAYER.stepVolume });
  }

  /** Put her feet at (x, y) in map pixels. */
  setFeet(x, y) {
    this.setPosition(x - FEET_DX, y - FEET_DY);
    this.body.reset(this.x, this.y);
  }

  /** Her feet position (the middle of the collision box). */
  getFeet() {
    return { x: this.body.center.x, y: this.body.center.y };
  }

  /**
   * Move using an input direction. x/y are -1..1 (a joystick can give
   * in-between values for slower walking). Diagonals are normalised so she
   * isn't faster going diagonally.
   */
  move(x, y) {
    let len = Math.hypot(x, y);
    if (len < 0.15) {
      x = 0;
      y = 0;
      len = 0;
    } else if (len > 1) {
      x /= len;
      y /= len;
    }
    const speed = PLAYER.speed * this.speedMultiplier;
    this.body.setVelocity(x * speed, y * speed);

    this.moving = len > 0;
    if (this.moving) {
      // Face along the stronger axis. A small bias toward the current facing
      // stops her flipping back and forth when walking near-diagonally.
      const horizontal = Math.abs(x) > Math.abs(y) + (this.facingIsHorizontal() ? -0.1 : 0.1);
      this.facing = horizontal ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down';
    }
    this.play(`${this.moving ? 'walk' : 'idle'}-${this.facing}${this.look}`, true);
  }

  /** Wear her tiara (or not). Does nothing if sprites/player-tiara.png didn't load. */
  setTiara(on) {
    const look = on && this.scene.anims.exists('idle-down-tiara') ? '-tiara' : '';
    if (look === this.look) return;
    this.look = look;
    this.play(`${this.moving ? 'walk' : 'idle'}-${this.facing}${this.look}`, true);
  }

  /** Walk faster (or slower); her walk animation speeds up to match. */
  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = multiplier;
    this.anims.timeScale = multiplier;
  }

  facingIsHorizontal() {
    return this.facing === 'left' || this.facing === 'right';
  }

  stop() {
    this.move(0, 0);
  }
}
