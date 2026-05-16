// "UNO!" rule, challenge-based. A player reduced to a single card must
// declare UNO. They are "vulnerable" until they declare; any opponent may
// challenge a vulnerable player, who then draws a penalty. Pure helpers so
// the rule is unit-tested independently of sockets/state.

export const UNO_PENALTY_CARDS = 2;

/** A declaration is only meaningful when the player is at/near one card. */
export function canDeclareUno(handLength: number): boolean {
  return handLength <= 2;
}

/** A player with exactly one undeclared card can be caught by a challenge. */
export function isUnoVulnerable(handLength: number, hasDeclaredUno: boolean): boolean {
  return handLength === 1 && !hasDeclaredUno;
}

/** The UNO declaration only persists while the player still holds one card. */
export function shouldClearUnoFlag(handLength: number): boolean {
  return handLength !== 1;
}
