import type { Card } from '../../types';
import { phaserTheme, theme } from '../../theme/tokens';

export const HUD_WIDTH = 360;
export const HUD_MARGIN = 32;
export const HUD_PADDING = 24;

export const PANEL_COLOR = phaserTheme.colors.surface.panel;
export const PANEL_BORDER = phaserTheme.colors.surface.panelBorder;
export const PANEL_ACCENT = theme.colors.action.primary.base;
export const PANEL_TEXT = theme.colors.text.primary;
export const PANEL_MUTED_TEXT = theme.colors.text.muted;
export const PANEL_SUCCESS = theme.colors.status.success;
export const PANEL_DANGER = theme.colors.status.danger;
export const PANEL_SECONDARY = theme.colors.status.info;

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
  autoAction?: 'quick_play' | 'create_private' | 'join';
  nickname?: string;
  roomCode?: string;
};

export type GameStartedPayload = {
  message: string;
  firstCard: Card;
  currentColor: Card['color'];
  currentPlayerTurn?: string;
};
