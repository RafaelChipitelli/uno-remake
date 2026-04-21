import Phaser from 'phaser';
import GameScene from '../scenes/GameScene';
import TitleScene from '../scenes/TitleScene';

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    backgroundColor: '#0f172a',
    parent: 'app',
    physics: {
      default: 'arcade',
    },
    render: {
      antialias: true,
      pixelArt: false,
      powerPreference: 'high-performance',
    },
    scale: {
      parent: 'app',
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      fullscreenTarget: 'app',
      width: window.innerWidth,
      height: window.innerHeight,
      zoom: 1,
    },
    scene: [TitleScene, GameScene],
  };
}
