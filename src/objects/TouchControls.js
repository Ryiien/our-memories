// -----------------------------------------------------------------------------
// TouchControls — on-screen joystick (bottom-left) and heart action button
// (bottom-right). Only shown on touch screens.
//
// The joystick "floats": put your thumb down anywhere on the left half of the
// screen and the stick appears under it. That's much easier on a phone than
// hunting for a small fixed stick.
// -----------------------------------------------------------------------------
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../config.js';

const STICK_RADIUS = 16; // how far the knob can travel (game pixels)
const REST = { x: 30, y: GAME_HEIGHT - 30 }; // where the stick sits when idle
const ACTION = { x: GAME_WIDTH - 26, y: GAME_HEIGHT - 28, radius: 22 };

export default class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.vector = { x: 0, y: 0 };
    this.actionQueued = false;
    this.stickPointer = null;

    const fixed = (obj) => obj.setScrollFactor(0).setDepth(DEPTH.touch);
    this.base = fixed(scene.add.image(REST.x, REST.y, 'joystick-base')).setAlpha(0.75);
    this.knob = fixed(scene.add.image(REST.x, REST.y, 'joystick-knob')).setAlpha(0.9);
    this.button = fixed(scene.add.image(ACTION.x, ACTION.y, 'action-button')).setAlpha(0.85);

    // Show only on touch devices, or as soon as a touch happens (hybrids).
    this.setVisible(scene.sys.game.device.input.touch);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.release, this);
  }

  setVisible(visible) {
    this.visible = visible;
    [this.base, this.knob, this.button].forEach((o) => o.setVisible(visible));
  }

  onDown(pointer) {
    if (pointer.wasTouch && !this.visible) this.setVisible(true);
    if (!this.visible) return;

    const nearButton = Phaser.Math.Distance.Between(pointer.x, pointer.y, ACTION.x, ACTION.y) < ACTION.radius;
    if (nearButton) {
      this.actionQueued = true;
      this.button.setScale(0.9);
      this.scene.time.delayedCall(120, () => this.button.setScale(1));
      return;
    }
    if (pointer.x < GAME_WIDTH / 2 && !this.stickPointer) {
      this.stickPointer = pointer;
      // keep the whole stick on screen
      const x = Phaser.Math.Clamp(pointer.x, 22, GAME_WIDTH / 2 - 22);
      const y = Phaser.Math.Clamp(pointer.y, 22, GAME_HEIGHT - 22);
      this.base.setPosition(x, y);
      this.knob.setPosition(x, y);
      this.onMove(pointer);
    }
  }

  onMove(pointer) {
    if (pointer !== this.stickPointer) return;
    const dx = pointer.x - this.base.x;
    const dy = pointer.y - this.base.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, STICK_RADIUS);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    this.knob.setPosition(this.base.x + nx * clamped, this.base.y + ny * clamped);
    // Full speed from about 60% of the way out.
    const strength = Math.min(1, clamped / (STICK_RADIUS * 0.6));
    this.vector.x = nx * strength;
    this.vector.y = ny * strength;
  }

  onUp(pointer) {
    if (pointer === this.stickPointer) this.release();
  }

  release() {
    this.stickPointer = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.base.setPosition(REST.x, REST.y);
    this.knob.setPosition(REST.x, REST.y);
  }

  /** True once per tap of the action button. */
  consumeAction() {
    const pressed = this.actionQueued;
    this.actionQueued = false;
    return pressed;
  }
}
