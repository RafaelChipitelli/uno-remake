import Phaser from 'phaser';

import { phaserTheme, theme } from '../../theme/tokens';
import { t } from '../../i18n';
import { FONT_FAMILY, TEXT_RESOLUTION } from './constants';

export type GameOverBannerHandle = {
  resize: () => void;
  destroy: () => void;
};

type GameOverBannerOptions = {
  didWin: boolean;
  winnerNickname: string;
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Cinematic end-of-match result screen. PlayStation "result band" vocabulary:
 * a full-bleed dark scrim with an airy light-weight headline, a clear
 * win/loss verdict (icon + label so color is never the sole signal), and a
 * single confident pill to return to the lobby. Entry is Framer-style
 * motion-first (transform/opacity only), skipped under reduced-motion.
 */
export function showGameOverBanner(
  scene: Phaser.Scene,
  options: GameOverBannerOptions,
  onLeave: () => void,
): GameOverBannerHandle {
  const layer = scene.add.container(0, 0).setDepth(60);
  const reduceMotion = prefersReducedMotion();

  let scrim!: Phaser.GameObjects.Rectangle;
  let panel!: Phaser.GameObjects.Graphics;
  let accentBar!: Phaser.GameObjects.Graphics;
  let verdictMark!: Phaser.GameObjects.Text;
  let verdictText!: Phaser.GameObjects.Text;
  let detailText!: Phaser.GameObjects.Text;
  let button!: Phaser.GameObjects.Container;
  let buttonBody!: Phaser.GameObjects.Graphics;
  let buttonLabel!: Phaser.GameObjects.Text;
  let buttonZone!: Phaser.GameObjects.Zone;

  const accent = options.didWin
    ? phaserTheme.colors.status.success
    : phaserTheme.colors.status.danger;

  const layout = () => {
    const { width, height } = scene.scale;
    const panelWidth = Math.min(560, width - 48);
    const panelHeight = Math.min(360, height - 48);
    const panelX = width / 2;
    const panelY = height / 2;
    const left = panelX - panelWidth / 2;
    const top = panelY - panelHeight / 2;
    const radius = 18;

    scrim.setPosition(width / 2, height / 2).setSize(width, height);
    if (scrim.input) {
      scrim.input.hitArea.setTo(0, 0, width, height);
    }

    panel.clear();
    panel.fillStyle(phaserTheme.colors.decor.overlay, 0.55);
    panel.fillRoundedRect(left + 4, top + 8, panelWidth, panelHeight, radius);
    panel.fillStyle(phaserTheme.colors.bg.game, 0.98);
    panel.fillRoundedRect(left, top, panelWidth, panelHeight, radius);
    panel.lineStyle(1, phaserTheme.colors.surface.panelBorder, 0.9);
    panel.strokeRoundedRect(left, top, panelWidth, panelHeight, radius);

    accentBar.clear();
    accentBar.fillStyle(accent, 0.9);
    accentBar.fillRoundedRect(left, top, panelWidth, 5, { tl: radius, tr: radius, bl: 0, br: 0 });

    verdictMark.setPosition(panelX, top + panelHeight * 0.26);
    verdictText.setPosition(panelX, top + panelHeight * 0.46);
    detailText.setPosition(panelX, top + panelHeight * 0.6);
    detailText.setWordWrapWidth(panelWidth - 64);

    const btnW = Math.min(260, panelWidth - 64);
    const btnH = 52;
    const btnY = top + panelHeight - btnH / 2 - 28;
    button.setPosition(panelX, btnY);
    buttonBody.clear();
    buttonBody.fillStyle(phaserTheme.colors.action.primary.shadow, 0.5);
    buttonBody.fillRoundedRect(-btnW / 2, -btnH / 2 + 4, btnW, btnH, btnH / 2);
    buttonBody.fillStyle(phaserTheme.colors.action.primary.base, 1);
    buttonBody.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
    buttonBody.lineStyle(1, phaserTheme.colors.action.primary.border, 0.85);
    buttonBody.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
    buttonZone.setPosition(panelX, btnY).setSize(btnW, btnH);
    if (buttonZone.input) {
      buttonZone.input.hitArea.setTo(0, 0, btnW, btnH);
    }
  };

  scrim = scene.add
    .rectangle(0, 0, 10, 10, phaserTheme.colors.decor.overlay, 0.66)
    .setInteractive({ useHandCursor: false });

  panel = scene.add.graphics();
  accentBar = scene.add.graphics();

  // Icon + word so the verdict never relies on color alone.
  verdictMark = scene.add
    .text(0, 0, options.didWin ? '★' : '◆', {
      fontFamily: FONT_FAMILY,
      fontSize: '52px',
      color: accentColorHex(options.didWin),
    })
    .setOrigin(0.5)
    .setResolution(TEXT_RESOLUTION);

  verdictText = scene.add
    .text(0, 0, options.didWin ? t('game.over.win') : t('game.over.loss'), {
      fontFamily: FONT_FAMILY,
      fontSize: '40px',
      color: theme.colors.text.primary,
      fontStyle: '300',
    })
    .setOrigin(0.5)
    .setResolution(TEXT_RESOLUTION);

  detailText = scene.add
    .text(0, 0, options.didWin ? t('game.over.detailWin') : t('game.over.detail', { nickname: options.winnerNickname }), {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: theme.colors.text.secondary,
      align: 'center',
      wordWrap: { width: 480, useAdvancedWrap: true },
    })
    .setOrigin(0.5)
    .setResolution(TEXT_RESOLUTION);

  button = scene.add.container(0, 0);
  buttonBody = scene.add.graphics();
  buttonLabel = scene.add
    .text(0, 0, t('game.over.backToLobby'), {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: theme.colors.text.inverse,
      fontStyle: '700',
    })
    .setOrigin(0.5)
    .setResolution(TEXT_RESOLUTION);
  button.add([buttonBody, buttonLabel]);

  buttonZone = scene.add
    .zone(0, 0, 10, 10)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  buttonZone.on('pointerover', () => {
    if (reduceMotion) return;
    scene.tweens.add({ targets: button, scaleX: 1.03, scaleY: 1.03, duration: 120, ease: 'Quad.easeOut' });
  });
  buttonZone.on('pointerout', () => {
    if (reduceMotion) return;
    scene.tweens.add({ targets: button, scaleX: 1, scaleY: 1, duration: 120, ease: 'Quad.easeOut' });
  });
  buttonZone.on('pointerup', () => onLeave());

  layer.add([scrim, panel, accentBar, verdictMark, verdictText, detailText, button, buttonZone]);
  layout();

  if (reduceMotion) {
    layer.setAlpha(1);
  } else {
    layer.setAlpha(0);
    scene.tweens.add({ targets: layer, alpha: 1, duration: 220, ease: 'Sine.easeOut' });
    [verdictMark, verdictText, detailText, button].forEach((target, index) => {
      target.setScale(0.9);
      target.setAlpha(0);
      scene.tweens.add({
        targets: target,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 320,
        delay: 80 + index * 80,
        ease: 'Back.easeOut',
      });
    });
  }

  return {
    resize: layout,
    destroy: () => {
      scene.tweens.killTweensOf([layer, button, verdictMark, verdictText, detailText]);
      layer.destroy(true);
    },
  };
}

function accentColorHex(didWin: boolean): string {
  return didWin ? theme.colors.status.success : theme.colors.status.danger;
}
