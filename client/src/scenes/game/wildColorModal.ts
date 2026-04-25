import Phaser from 'phaser';
import {
  CARD_COLOR_HEX,
  COLOR_LABELS,
  SELECTABLE_WILD_COLORS,
  type SelectableColor,
} from '../../game/colors';
import { phaserTheme, theme } from '../../theme/tokens';

type WildColorModalOptions = {
  fontFamily: string;
  textResolution: number;
  onColorSelected: (color: SelectableColor) => void;
  onClose?: () => void;
};

export type WildColorModalHandle = {
  destroy: () => void;
};

export function createWildColorModal(
  scene: Phaser.Scene,
  options: WildColorModalOptions,
): WildColorModalHandle {
  const elements: Phaser.GameObjects.GameObject[] = [];
  let closed = false;

  const close = () => {
    if (closed) {
      return;
    }

    closed = true;
    elements.forEach((element) => element.destroy());
    options.onClose?.();
  };

  const width = scene.scale.width;
  const height = scene.scale.height;
  const panelWidth = Math.min(620, width - 80);
  const panelHeight = 220;
  const panelX = width / 2;
  const panelY = height / 2;

  const overlay = scene.add
    .rectangle(panelX, panelY, width, height, phaserTheme.colors.decor.overlay, 0.55)
    .setOrigin(0.5)
    .setDepth(2000)
    .setInteractive();

  const panel = scene.add
    .rectangle(panelX, panelY, panelWidth, panelHeight, phaserTheme.colors.bg.game, 0.96)
    .setOrigin(0.5)
    .setStrokeStyle(2, phaserTheme.colors.text.inverse, 0.35)
    .setDepth(2001);

  const title = scene.add
    .text(panelX, panelY - 70, 'Escolha a cor do curinga', {
      fontFamily: options.fontFamily,
      fontSize: '24px',
      color: theme.colors.text.primary,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setResolution(options.textResolution)
    .setDepth(2002);

  elements.push(overlay, panel, title);

  const buttonSize = 96;
  const buttonSpacing = 120;

  SELECTABLE_WILD_COLORS.forEach((color, buttonIndex) => {
    const x = panelX - ((SELECTABLE_WILD_COLORS.length - 1) * buttonSpacing) / 2 + buttonIndex * buttonSpacing;
    const y = panelY + 18;

    const button = scene.add
      .rectangle(x, y, buttonSize, buttonSize, CARD_COLOR_HEX[color])
      .setOrigin(0.5)
      .setStrokeStyle(3, phaserTheme.colors.text.inverse)
      .setDepth(2002)
      .setInteractive({ useHandCursor: true });

    const label = scene.add
      .text(x, y, COLOR_LABELS[color], {
        fontFamily: options.fontFamily,
        fontSize: '14px',
        color: theme.colors.text.inverse,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setResolution(options.textResolution)
      .setDepth(2003);

    button.on('pointerover', () => {
      button.setScale(1.06);
    });

    button.on('pointerout', () => {
      button.setScale(1);
    });

    button.on('pointerdown', () => {
      options.onColorSelected(color);
      close();
    });

    elements.push(button, label);
  });

  return {
    destroy: close,
  };
}
