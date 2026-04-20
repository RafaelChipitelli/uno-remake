import type { Card, Player, Room } from '../types';

export type GameStore = {
  players: Map<string, Player>;
  rooms: Map<string, Room>;
  serverDecks: Map<string, Card[]>;
};

export function createGameStore(): GameStore {
  return {
    players: new Map<string, Player>(),
    rooms: new Map<string, Room>(),
    serverDecks: new Map<string, Card[]>(),
  };
}
