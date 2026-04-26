import type { Card } from '../types';

export function isStackDrawCard(card: Card): boolean {
  return card.value === '+2' || card.value === '+4';
}

export function canStackOverPendingDraw(card: Card, pendingTopCardValue: '+2' | '+4'): boolean {
  if (card.value === '+4') {
    return true;
  }

  return card.value === '+2' && pendingTopCardValue === '+2';
}

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
  pendingStackTopCardValue?: '+2' | '+4',
): number {
  if (!hand.length) {
    return -1;
  }

  if (pendingStackTopCardValue) {
    return hand.findIndex((card) => isStackDrawCard(card) && canStackOverPendingDraw(card, pendingStackTopCardValue));
  }

  if (!topCard || !currentColor) {
    return 0;
  }

  return hand.findIndex((card) => isValidCardPlay(card, topCard, currentColor));
}
