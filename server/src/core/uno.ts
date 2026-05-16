// "UNO!" rule. A player must declare UNO when a play leaves them with a
// single card. If they did not declare, they take a draw penalty. Kept as a
// pure function so the rule is unit-tested independently of sockets/state.

export const UNO_PENALTY_CARDS = 2;

/** A declaration is only meaningful when the player is at/near one card. */
export function canDeclareUno(handLength: number): boolean {
  return handLength <= 2;
}

/**
 * Decides the outcome right after a card was played.
 * `handLengthAfterPlay` is the player's hand size once the card left it.
 */
export function resolveUnoAfterPlay(
  handLengthAfterPlay: number,
  hasDeclaredUno: boolean,
): { penalty: number; cleared: boolean } {
  if (handLengthAfterPlay !== 1) {
    // No longer in the UNO state — any previous declaration is cleared.
    return { penalty: 0, cleared: true };
  }
  if (hasDeclaredUno) {
    return { penalty: 0, cleared: false };
  }
  return { penalty: UNO_PENALTY_CARDS, cleared: true };
}
