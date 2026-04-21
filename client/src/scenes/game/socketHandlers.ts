import type { Socket } from 'socket.io-client';
import type {
  Card,
  CardActionEvent,
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
  const actor = event.playerId === myPlayerId ? 'Você' : event.nickname;
  const actionVerb = event.action === 'play' ? 'jogou' : 'comprou';
  const cardLabel = event.card ? `${colorLabels[event.card.color]} ${event.card.value}` : 'uma carta';

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
