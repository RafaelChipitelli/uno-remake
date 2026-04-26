type CardDisplayParts = {
  label: string;
  symbol?: string;
};

const ACTION_CARD_DISPLAY_VALUES: Record<string, CardDisplayParts> = {
  reverse: { label: 'REV', symbol: '↺' },
  skip: { label: 'SKIP', symbol: '⊘' },
};

export function getCardDisplayParts(value: string): CardDisplayParts {
  return ACTION_CARD_DISPLAY_VALUES[value] ?? { label: value };
}

export function getCardDisplayValue(value: string): string {
  return getCardDisplayParts(value).label;
}

export function getCardDisplayScale(value: string): number {
  const { label, symbol } = getCardDisplayParts(value);
  const length = label.length;
  const hasSymbolLine = Boolean(symbol);

  if (length <= 2) {
    return hasSymbolLine ? 0.86 : 1;
  }

  if (length <= 4) {
    return hasSymbolLine ? 0.72 : 0.82;
  }

  return hasSymbolLine ? 0.62 : 0.68;
}
