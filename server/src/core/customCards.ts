import type { Card, CustomPowerId } from '../types';

type CreateCardId = (parts: Array<string | number>) => string;

type CustomCardDefinition = {
  powerId: CustomPowerId;
  value: string;
  color: Card['color'];
  copies: number;
};

const CUSTOM_CARD_DEFINITIONS: CustomCardDefinition[] = [
  {
    powerId: 'draw-multiplier-x2',
    value: 'x2',
    color: 'wild',
    copies: 4,
  },
  {
    powerId: 'draw-shield',
    value: 'shield',
    color: 'wild',
    copies: 4,
  },
];

export function createCustomCards(createCardId: CreateCardId): Card[] {
  return CUSTOM_CARD_DEFINITIONS.flatMap((definition) =>
    Array.from({ length: definition.copies }, (_, index) => ({
      id: createCardId(['custom', definition.powerId, index]),
      color: definition.color,
      value: definition.value,
      kind: 'custom' as const,
      powerId: definition.powerId,
    })),
  );
}

export function isDrawMultiplierCard(card: Card): boolean {
  return card.powerId === 'draw-multiplier-x2' || card.value === 'x2';
}

export function isDrawShieldCard(card: Card): boolean {
  return card.powerId === 'draw-shield' || card.value === 'shield';
}

export function isCustomDrawReactionCard(card: Card): boolean {
  return isDrawMultiplierCard(card) || isDrawShieldCard(card);
}