export type CardColor = 'red' | 'green' | 'blue' | 'yellow' | 'wild';
export type GameStatus = 'waiting' | 'in_progress' | 'finished';
export type RoomVisibility = 'public' | 'private';

export interface Card {
  id: string;
  color: CardColor;
  value: string;
}

export interface Player {
  id: string;
  nickname: string;
  hand: Card[];
  handCount?: number;
  isTurn: boolean;
  roomId?: string | undefined;
}

export interface Room {
  id: string;
  visibility: RoomVisibility;
  players: Player[];
  discardPile: Card[];
  drawPileCount: number;
  currentColor: CardColor;
  hostId: string;
  turnDirection: 1 | -1;
  gameStatus: GameStatus;
  pendingDrawDecision?: {
    playerId: string;
    cardId: string;
  };
  winnerId?: string | undefined;
  winnerNickname?: string | undefined;
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

export type DrawDecisionChoice = 'play' | 'keep';

export interface DrawDecisionPayload {
  playerId: string;
  choice: DrawDecisionChoice;
  selectedColor?: CardColor;
}

export interface CardActionEvent {
  action: CardActionType;
  playerId: string;
  nickname: string;
  card?: Card;
  currentColor?: CardColor;
  drawnCardPlayable?: boolean;
  drawDecisionPending?: boolean;
  timestamp: number;
}

export interface CreateRoomPayload {
  nickname?: string;
  visibility?: RoomVisibility;
}

export interface QuickPlayPayload {
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

export interface GameEndedPayload {
  winnerId: string;
  winnerNickname: string;
  message: string;
}
