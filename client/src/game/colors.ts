import type { CardColor } from '../types';
import { phaserTheme } from '../theme/tokens';
import { t } from '../i18n';

export type SelectableColor = Exclude<CardColor, 'wild'>;

export const CARD_COLOR_HEX: Record<CardColor, number> = {
  red: phaserTheme.colors.card.red,
  green: phaserTheme.colors.card.green,
  blue: phaserTheme.colors.card.blue,
  yellow: phaserTheme.colors.card.yellow,
  wild: phaserTheme.colors.card.wild,
};

export function getColorLabels(): Record<CardColor, string> {
  return {
    red: t('color.red'),
    green: t('color.green'),
    blue: t('color.blue'),
    yellow: t('color.yellow'),
    wild: t('color.wild'),
  };
}

export function getColorLabel(color: CardColor): string {
  return getColorLabels()[color];
}

export const SELECTABLE_WILD_COLORS: SelectableColor[] = ['red', 'green', 'blue', 'yellow'];
