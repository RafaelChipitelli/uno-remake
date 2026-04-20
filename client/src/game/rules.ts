import type { Card } from '../types';

/**
 * Regras básicas de validação de jogada no UNO.
 */
export function isValidCardPlay(card: Card, topCard: Card, currentColor: Card['color']): boolean {
  if (card.color === 'wild') {
    return true;
  }

  if (card.color === currentColor) {
    return true;
  }

  return card.value === topCard.value;
}

/**
 * Retorna o índice da primeira carta jogável da mão.
 * Se não houver carta jogável, retorna -1.
 */
export function getFirstPlayableCardIndex(
  hand: Card[],
  topCard?: Card,
  currentColor?: Card['color'],
): number {
  if (!hand.length) {
    return -1;
  }

  if (!topCard || !currentColor) {
    return 0;
  }

  return hand.findIndex((card) => isValidCardPlay(card, topCard, currentColor));
}
