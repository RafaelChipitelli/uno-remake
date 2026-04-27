import Phaser from 'phaser';
import {
  CARD_COLOR_HEX,
  getColorLabel,
  SELECTABLE_WILD_COLORS,
  type SelectableColor,
} from '../../game/colors';
import { phaserTheme, theme } from '../../theme/tokens';
import { t } from '../../i18n';

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
  const isCompactLayout = width <= 560;
  const panelWidth = Math.min(620, width - (isCompactLayout ? 40 : 80));
  const panelX = width / 2;
  const panelY = height / 2;

  const buttonSize = isCompactLayout ? 80 : 96;
  const buttonsPerRow = isCompactLayout ? 2 : SELECTABLE_WILD_COLORS.length;
  const buttonHorizontalStep = isCompactLayout ? buttonSize + 18 : 120;
  const buttonVerticalStep = isCompactLayout ? buttonSize + 18 : 0;
  const totalRows = Math.ceil(SELECTABLE_WILD_COLORS.length / buttonsPerRow);
  const titleOffsetY = isCompactLayout ? 94 : 70;
  const firstRowY = panelY + (isCompactLayout ? -8 : 18);
  const lastRowY = firstRowY + (totalRows - 1) * buttonVerticalStep;
  const halfHeightFromTitle = titleOffsetY + 26;
  const halfHeightFromButtons = (lastRowY - panelY) + buttonSize / 2 + 24;
  const panelHeight = Math.max(isCompactLayout ? 280 : 220, Math.ceil(Math.max(halfHeightFromTitle, halfHeightFromButtons) * 2));

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
    .text(panelX, panelY - titleOffsetY, t('game.wild.title'), {
      fontFamily: options.fontFamily,
      fontSize: '24px',
      color: theme.colors.text.primary,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setResolution(options.textResolution)
    .setDepth(2002);

  elements.push(overlay, panel, title);

  SELECTABLE_WILD_COLORS.forEach((color, buttonIndex) => {
    const rowIndex = Math.floor(buttonIndex / buttonsPerRow);
    const columnIndex = buttonIndex % buttonsPerRow;
    const rowStart = rowIndex * buttonsPerRow;
    const rowItemCount = Math.min(buttonsPerRow, SELECTABLE_WILD_COLORS.length - rowStart);
    const rowFirstX = panelX - ((rowItemCount - 1) * buttonHorizontalStep) / 2;
    const x = rowFirstX + columnIndex * buttonHorizontalStep;
    const y = firstRowY + rowIndex * buttonVerticalStep;

    const button = scene.add
      .rectangle(x, y, buttonSize, buttonSize, CARD_COLOR_HEX[color])
      .setOrigin(0.5)
      .setStrokeStyle(3, phaserTheme.colors.text.inverse)
      .setDepth(2002)
      .setInteractive({ useHandCursor: true });

    const label = scene.add
      .text(x, y, getColorLabel(color), {
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
