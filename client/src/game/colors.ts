import type { CardColor } from '../types';
import { phaserTheme } from '../theme/tokens';

export type SelectableColor = Exclude<CardColor, 'wild'>;

export const CARD_COLOR_HEX: Record<CardColor, number> = {
  red: phaserTheme.colors.card.red,
  green: phaserTheme.colors.card.green,
  blue: phaserTheme.colors.card.blue,
  yellow: phaserTheme.colors.card.yellow,
  wild: phaserTheme.colors.card.wild,
};

export const COLOR_LABELS: Record<CardColor, string> = {
  red: 'Vermelho',
  green: 'Verde',
  blue: 'Azul',
  yellow: 'Amarelo',
  wild: 'Curinga',
};

export const SELECTABLE_WILD_COLORS: SelectableColor[] = ['red', 'green', 'blue', 'yellow'];
