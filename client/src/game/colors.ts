import type { CardColor } from '../types';

export type SelectableColor = Exclude<CardColor, 'wild'>;

export const CARD_COLOR_HEX: Record<CardColor, number> = {
  red: 0xdc2626,
  green: 0x16a34a,
  blue: 0x2563eb,
  yellow: 0xeab308,
  wild: 0x1f2937,
};

export const COLOR_LABELS: Record<CardColor, string> = {
  red: 'Vermelho',
  green: 'Verde',
  blue: 'Azul',
  yellow: 'Amarelo',
  wild: 'Curinga',
};

export const SELECTABLE_WILD_COLORS: SelectableColor[] = ['red', 'green', 'blue', 'yellow'];
