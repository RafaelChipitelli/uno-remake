import type { Card } from '../types';

const STANDARD_COLORS: Array<Exclude<Card['color'], 'wild'>> = ['red', 'green', 'blue', 'yellow'];
const NUMBER_AND_ACTION_VALUES = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'skip',
  'reverse',
  '+2',
] as const;

function createCardId(parts: Array<string | number>): string {
  return ['card', ...parts, Date.now(), Math.random().toString(36).slice(2, 10)].join('-');
}

export function createUnoDeck(): Card[] {
  const deck: Card[] = [];

  for (const color of STANDARD_COLORS) {
    deck.push({ id: createCardId([color, '0']), color, value: '0' });

    for (const value of NUMBER_AND_ACTION_VALUES) {
      deck.push({ id: createCardId([color, value, 'A']), color, value });
      deck.push({ id: createCardId([color, value, 'B']), color, value });
    }
  }

  for (let index = 0; index < 4; index += 1) {
    deck.push({ id: createCardId(['wild', 'color', index]), color: 'wild', value: 'wild' });
    deck.push({ id: createCardId(['wild', '+4', index]), color: 'wild', value: '+4' });
  }

  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex]!, shuffled[index]!];
  }

  return shuffled;
}

export function isValidCardPlay(card: Card, topCard: Card, currentColor: Card['color']): boolean {
  if (card.color === 'wild') {
    return true;
  }

  if (card.color === currentColor) {
    return true;
  }

  return card.value === topCard.value;
}
