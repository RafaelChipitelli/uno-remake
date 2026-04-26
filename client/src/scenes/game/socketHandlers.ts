import type { Socket } from 'socket.io-client';
import type {
  Card,
  CardActionEvent,
  GameEndedPayload,
  Player,
  Room,
  RoomErrorPayload,
} from '../../types';
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
    const actor = event.playerId === myPlayerId ? 'Você' : event.nickname;
    const drawCount = event.drawCount ?? 0;
    return `${actor} comprou ${drawCount} carta${drawCount === 1 ? '' : 's'} de penalidade acumulada`;
  }

  const actor = event.playerId === myPlayerId ? 'Você' : event.nickname;
  const actionVerb = event.action === 'play' ? 'jogou' : 'comprou';
  const cardLabel = event.card
    ? `${colorLabels[event.card.color]} ${event.card.value}`
    : event.action === 'draw' && typeof event.drawCount === 'number'
      ? `${event.drawCount} carta${event.drawCount === 1 ? '' : 's'}`
      : 'uma carta';

  if (
    event.action === 'play' &&
    event.card?.color === 'wild' &&
    event.currentColor &&
    event.currentColor !== 'wild'
  ) {
    return `${actor} ${actionVerb} ${cardLabel} e escolheu ${colorLabels[event.currentColor]}`;
  }

  return `${actor} ${actionVerb} ${cardLabel}`;
}
