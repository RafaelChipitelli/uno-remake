import Phaser from 'phaser';
import { SCENE_KEYS } from './game/constants';
import { consumePendingLaunch } from '../game/boot';

// Auto-started first scene: immediately hands off to GameScene with the
// launch data captured by the DOM lobby.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start(SCENE_KEYS.game, consumePendingLaunch());
  }
}
