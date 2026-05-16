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
    .rectangle(panelX, panelY, width, height, phaserTheme.colors.decor.overlay, 0.62)
    .setOrigin(0.5)
    .setDepth(2000)
    .setInteractive();

  const panelRadius = 22;
  const panelLeft = panelX - panelWidth / 2;
  const panelTop = panelY - panelHeight / 2;
  const panel = scene.add.graphics().setDepth(2001);
  panel.fillStyle(phaserTheme.colors.decor.shadowDeep, 0.5);
  panel.fillRoundedRect(panelLeft + 4, panelTop + 8, panelWidth, panelHeight, panelRadius);
  panel.fillStyle(phaserTheme.colors.surface.panel, 0.97);
  panel.fillRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, panelRadius);
  panel.lineStyle(1.5, phaserTheme.colors.surface.panelBorder, 0.9);
  panel.strokeRoundedRect(panelLeft, panelTop, panelWidth, panelHeight, panelRadius);
  panel.fillStyle(phaserTheme.colors.action.primary.base, 0.08);
  panel.fillRoundedRect(panelLeft, panelTop, panelWidth, 56, panelRadius);

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

    const cardRadius = Math.round(buttonSize * 0.2);
    const swatch = scene.add.container(x, y).setDepth(2002);
    const swatchShadow = scene.add.graphics();
    swatchShadow.fillStyle(phaserTheme.colors.decor.shadowDeep, 0.45);
    swatchShadow.fillRoundedRect(-buttonSize / 2, -buttonSize / 2 + 5, buttonSize, buttonSize, cardRadius);
    const swatchBody = scene.add.graphics();
    swatchBody.fillStyle(CARD_COLOR_HEX[color], 1);
    swatchBody.fillRoundedRect(-buttonSize / 2, -buttonSize / 2, buttonSize, buttonSize, cardRadius);
    swatchBody.lineStyle(3, phaserTheme.colors.text.inverse, 0.9);
    swatchBody.strokeRoundedRect(-buttonSize / 2, -buttonSize / 2, buttonSize, buttonSize, cardRadius);
    swatchBody.fillStyle(phaserTheme.colors.text.inverse, 0.14);
    swatchBody.fillRoundedRect(-buttonSize / 2 + 4, -buttonSize / 2 + 4, buttonSize - 8, buttonSize * 0.4, cardRadius * 0.7);

    const label = scene.add
      .text(0, 0, getColorLabel(color), {
        fontFamily: options.fontFamily,
        fontSize: '14px',
        color: theme.colors.text.inverse,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setResolution(options.textResolution);

    swatch.add([swatchShadow, swatchBody, label]);

    const zone = scene.add
      .zone(x, y, buttonSize, buttonSize)
      .setOrigin(0.5)
      .setDepth(2003)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      scene.tweens.add({ targets: swatch, scaleX: 1.07, scaleY: 1.07, y: y - 3, duration: 160, ease: 'Quad.easeOut' });
    });

    zone.on('pointerout', () => {
      scene.tweens.add({ targets: swatch, scaleX: 1, scaleY: 1, y, duration: 160, ease: 'Quad.easeOut' });
    });

    zone.on('pointerdown', () => {
      options.onColorSelected(color);
      close();
    });

    elements.push(swatch, zone);
  });

  return {
    destroy: close,
  };
}
