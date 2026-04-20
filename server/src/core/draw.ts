import type { Card, Player, Room } from '../types';

export function drawCardsForPlayer(
  serverDecks: Map<string, Card[]>,
  roomId: string,
  room: Room,
  player: Player,
  count: number,
): Card[] {
  const deck = serverDecks.get(roomId);
  if (!deck) {
    return [];
  }

  const drawnCards: Card[] = [];
  for (let index = 0; index < count; index += 1) {
    const drawnCard = deck.pop();
    if (!drawnCard) {
      break;
    }

    player.hand.push(drawnCard);
    drawnCards.push(drawnCard);
  }

  room.drawPileCount = deck.length;
  return drawnCards;
}
