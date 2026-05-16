import Phaser from 'phaser';
import { SCENE_KEYS } from './game/constants';
import { requestReturnToTitle } from '../game/boot';

// Registered under the legacy 'TitleScene' key so GameScene's existing
// `scene.start(SCENE_KEYS.title)` keeps working: instead of a Phaser title,
// it tears the game down and restores the DOM lobby.
export default class ReturnToTitleScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.title);
  }

  create(): void {
    requestReturnToTitle();
  }
}
