import type { Room } from '../types';

export function passTurnToNextPlayer(room: Room, steps = 1): void {
  if (room.players.length === 0) {
    return;
  }

  const currentPlayerIndex = room.players.findIndex((player) => player.isTurn);
  if (currentPlayerIndex !== -1 && room.players[currentPlayerIndex]) {
    room.players[currentPlayerIndex].isTurn = false;
  }

  const startIndex = currentPlayerIndex === -1 ? 0 : currentPlayerIndex;
  const nextPlayerIndex = getNextPlayerIndex(room, startIndex, steps);
  if (nextPlayerIndex !== -1 && room.players[nextPlayerIndex]) {
    room.players[nextPlayerIndex].isTurn = true;
  }
}

export function getNextPlayerIndex(room: Room, currentPlayerIndex: number, steps = 1): number {
  const playerCount = room.players.length;
  if (playerCount === 0) {
    return -1;
  }

  const normalizedSteps = ((steps % playerCount) + playerCount) % playerCount;
  const movement = room.turnDirection * normalizedSteps;

  return (((currentPlayerIndex + movement) % playerCount) + playerCount) % playerCount;
}
