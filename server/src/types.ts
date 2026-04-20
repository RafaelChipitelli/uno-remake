// Estruturas compartilhadas entre servidor e cliente
export type CardColor = 'red' | 'green' | 'blue' | 'yellow' | 'wild';

export interface Card {
  id: string;
  color: CardColor;
  value: string; // números ou ações customizadas
}

export interface Player {
  id: string;
  nickname: string;
  hand: Card[];
  isTurn: boolean;
  roomId?: string | undefined;
}

export interface Room {
  id: string;
  players: Player[];
  discardPile: Card[];
  drawPileCount: number;
  currentColor: CardColor;
  hostId: string;
}

export type CardActionType = 'play' | 'draw';

export interface PlayCardPayload {
  playerId: string;
  card: Card;
  selectedColor?: CardColor;
}

export interface DrawCardPayload {
  playerId: string;
}

export interface CardActionEvent {
  action: CardActionType;
  playerId: string;
  nickname: string;
  card?: Card;
  currentColor?: CardColor;
  timestamp: number;
}

export interface CreateRoomPayload {
  nickname?: string;
}

export interface JoinRoomPayload {
  roomId: string;
  nickname?: string;
}

export interface RoomCreatedPayload {
  roomId: string;
}

export interface RoomJoinedPayload {
  roomId: string;
}

export interface RoomErrorPayload {
  message: string;
}
