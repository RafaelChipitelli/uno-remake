import type { Card } from '../../types';

export const HUD_WIDTH = 360;
export const HUD_MARGIN = 32;
export const HUD_PADDING = 24;

export const PANEL_COLOR = 0x131b2c;
export const PANEL_BORDER = 0x2b3852;
export const PANEL_ACCENT = '#6c5ce7';
export const PANEL_TEXT = '#e5e7eb';
export const PANEL_MUTED_TEXT = '#9ca3af';
export const PANEL_SUCCESS = '#22c55e';
export const PANEL_DANGER = '#ff4d4d';
export const PANEL_SECONDARY = '#3a86ff';

export const FONT_FAMILY = '"Inter", system-ui, sans-serif';
export const TEXT_RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);

export const INSTRUCTION_TEXT = 'P • jogar carta\nD • comprar carta';

export const INITIAL_STATUS_MESSAGE = 'Conectando...';
export const EMPTY_PLAYER_LIST_MESSAGE = 'Nenhum jogador ainda.';
export const INITIAL_TURN_MESSAGE = 'Aguardando jogo começar';

export const DEFAULT_CARD_DRAW_COUNT = 10;

export const SCENE_KEYS = {
  title: 'TitleScene',
  game: 'GameScene',
} as const;

export type SceneLaunchData = {
  autoAction?: 'create' | 'join';
  nickname?: string;
  roomCode?: string;
};

export type GameStartedPayload = {
  message: string;
  firstCard: Card;
  currentColor: Card['color'];
  currentPlayerTurn?: string;
};
