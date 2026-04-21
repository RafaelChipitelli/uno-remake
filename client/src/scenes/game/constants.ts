import type { Card } from '../../types';

export const HUD_WIDTH = 360;
export const HUD_MARGIN = 32;
export const HUD_PADDING = 24;

export const PANEL_COLOR = 0x111b2f;
export const PANEL_BORDER = 0x1f2a44;
export const PANEL_ACCENT = '#fcd34d';

export const FONT_FAMILY = '"Space Mono", "Fira Code", monospace';
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
