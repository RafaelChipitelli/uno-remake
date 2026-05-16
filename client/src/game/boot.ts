import type { SceneLaunchData } from '../scenes/game/constants';

// Phaser is loaded lazily here so the lobby (DOM) ships without the ~460 KB
// engine in the initial bundle, and the canvas only exists during a match.

type GameLike = { destroy: (removeCanvas: boolean) => void };

let game: GameLike | null = null;
let pendingLaunch: SceneLaunchData = {};
let returnHandler: (() => void) | null = null;

export function setReturnHandler(handler: () => void): void {
  returnHandler = handler;
}

export function consumePendingLaunch(): SceneLaunchData {
  return pendingLaunch;
}

// Called from the Phaser ReturnToTitleScene. Deferred out of the scene
// lifecycle before tearing the game down and restoring the DOM lobby.
export function requestReturnToTitle(): void {
  requestAnimationFrame(() => {
    if (game) {
      game.destroy(true);
      game = null;
    }
    returnHandler?.();
  });
}

export async function bootGame(launch: SceneLaunchData): Promise<void> {
  pendingLaunch = launch;

  const [{ default: Phaser }, { theme }, { default: GameScene }, { default: BootScene }, { default: ReturnToTitleScene }] =
    await Promise.all([
      import('phaser'),
      import('../theme/tokens'),
      import('../scenes/GameScene'),
      import('../scenes/BootScene'),
      import('../scenes/ReturnToTitleScene'),
    ]);

  game = new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: theme.colors.bg.game,
    parent: 'app',
    physics: { default: 'arcade' },
    render: { antialias: true, pixelArt: false, powerPreference: 'high-performance' },
    scale: {
      parent: 'app',
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      fullscreenTarget: 'app',
      width: window.innerWidth,
      height: window.innerHeight,
      zoom: 1,
    },
    scene: [BootScene, GameScene, ReturnToTitleScene],
  });
}
