import type { Player, Room } from '../types';
import { getNextPlayerIndex } from './turns';

export function getNextPlayer(room: Room, currentPlayerIndex: number): Player | undefined {
  const nextPlayerIndex = getNextPlayerIndex(room, currentPlayerIndex, 1);
  if (nextPlayerIndex === -1) {
    return undefined;
  }

  return room.players[nextPlayerIndex];
}
