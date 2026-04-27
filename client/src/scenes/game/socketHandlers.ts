import type { Socket } from 'socket.io-client';
import type {
  Card,
  CardActionEvent,
  GameEndedPayload,
  Player,
  Room,
  RoomErrorPayload,
} from '../../types';
import { t } from '../../i18n';
import type { GameStartedPayload } from './constants';

export type GameSceneSocketCallbacks = {
  onLobbyWelcome: (player: Player) => void;
  onGameStarted: (payload: GameStartedPayload) => void;
  onCardPlayed: (event: CardActionEvent) => void;
  onCardDrawn: (event: CardActionEvent) => void;
  onGameEnded: (payload: GameEndedPayload) => void;
  onRoomCreated: (payload: { roomId: string }) => void;
  onRoomJoined: (payload: { roomId: string }) => void;
  onRoomState: (room: Room) => void;
  onRoomError: (payload: RoomErrorPayload) => void;
  onRoomLeft: () => void;
  onConnectError: (err: Error) => void;
};

export function registerGameSceneSocketHandlers(
  socket: Socket,
  callbacks: GameSceneSocketCallbacks,
): void {
  socket.on('lobby:welcome', callbacks.onLobbyWelcome);
  socket.on('game:started', callbacks.onGameStarted);
  socket.on('card:played', callbacks.onCardPlayed);
  socket.on('card:drawn', callbacks.onCardDrawn);
  socket.on('game:ended', callbacks.onGameEnded);
  socket.on('room:created', callbacks.onRoomCreated);
  socket.on('room:joined', callbacks.onRoomJoined);
  socket.on('room:state', callbacks.onRoomState);
  socket.on('room:error', callbacks.onRoomError);
  socket.on('room:left', callbacks.onRoomLeft);
  socket.on('connect_error', callbacks.onConnectError);
}

export function describeCardActionEvent(
  event: CardActionEvent,
  myPlayerId: string | undefined,
  colorLabels: Record<Card['color'], string>,
): string {
  if (event.action === 'draw' && event.drawReason === 'stack_penalty') {
    const actor = event.playerId === myPlayerId ? t('game.event.you') : event.nickname;
    const drawCount = event.drawCount ?? 0;
    const cards = drawCount === 1 ? t('common.card.single') : t('common.card.plural');
    return t('game.event.accumulatedPenaltyDraw', {
      actor,
      count: drawCount,
      cards,
    });
  }

  const actor = event.playerId === myPlayerId ? t('game.event.you') : event.nickname;
  const actionVerb = event.action === 'play' ? t('game.event.played') : t('game.event.drew');
  const cardLabel = event.card
    ? `${colorLabels[event.card.color]} ${event.card.value}`
    : event.action === 'draw' && typeof event.drawCount === 'number'
      ? `${event.drawCount} ${event.drawCount === 1 ? t('common.card.single') : t('common.card.plural')}`
      : t('game.event.oneCard');

  if (
    event.action === 'play' &&
    event.card?.color === 'wild' &&
    event.currentColor &&
    event.currentColor !== 'wild'
  ) {
    return `${actor} ${actionVerb} ${cardLabel} ${t('game.event.chose')} ${colorLabels[event.currentColor]}`;
  }

  return `${actor} ${actionVerb} ${cardLabel}`;
}
