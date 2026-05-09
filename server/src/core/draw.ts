import type { Card, Player, Room } from '../types';
import { shuffleDeck } from './cards';

export function refillDrawPileFromDiscard(deck: Card[], room: Room): boolean {
  if (deck.length > 0 || room.discardPile.length <= 1) {
    room.drawPileCount = deck.length;
    return deck.length > 0;
  }

  const topDiscardCard = room.discardPile[room.discardPile.length - 1];
  const cardsToRecycle = room.discardPile.slice(0, -1);

  if (!topDiscardCard || cardsToRecycle.length === 0) {
    room.drawPileCount = deck.length;
    return false;
  }

  deck.push(...shuffleDeck(cardsToRecycle));
  room.discardPile = [topDiscardCard];
  room.drawPileCount = deck.length;

  return deck.length > 0;
}

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
    refillDrawPileFromDiscard(deck, room);

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
