// Karma is a lightweight progression signal, not a balance economy: every
// finished match must always feel rewarding (so playing alone earns points),
// while winning is worth meaningfully more to keep the win incentive. Values
// are small integers so totals stay readable and the level curve below stays
// exact in floating point for any realistic play count.
export const KARMA_PER_GAME = 2;
export const KARMA_PER_WIN = 5;

export type KarmaLevel = {
  level: number;
  /** Karma accumulated within the current level (>= 0). */
  currentLevelKarma: number;
  /** Karma span required to clear the current level (> 0). */
  nextLevelKarma: number;
  /** 0..1 fraction toward the next level. */
  progress: number;
};

// Linear-growth curve: clearing level N costs LEVEL_STEP * N karma, so total
// karma to *reach* level L is LEVEL_STEP * (1 + 2 + ... + (L-1)) =
// LEVEL_STEP * L * (L - 1) / 2. Multiplying by a triangular number keeps every
// boundary an exact integer (no floating-point drift even at large totals),
// and the curve is strictly monotonic so more karma never lowers the level.
const LEVEL_STEP = 20;

/** Points earned for one finished match. Always >= KARMA_PER_GAME. */
export function karmaForMatch(didWin: boolean): number {
  return KARMA_PER_GAME + (didWin ? KARMA_PER_WIN : 0);
}

// Total karma required to have *reached* `level` (level 1 => 0).
function karmaToReachLevel(level: number): number {
  return (LEVEL_STEP * level * (level - 1)) / 2;
}

/**
 * Maps a lifetime karma total to a level and progress toward the next level.
 *
 * Edge contract (relied on by callers and QA):
 * - total <= 0  -> level 1, currentLevelKarma 0, progress 0.
 * - exact threshold (e.g. 20 with LEVEL_STEP 20) -> the *new* level, progress 0
 *   (boundary belongs to the level it unlocks, never the previous one).
 * - non-finite / negative input is clamped to 0 (level 1) instead of throwing.
 * - strictly monotonic: a larger total never yields a lower level.
 */
export function levelForKarma(total: number): KarmaLevel {
  const safeTotal =
    Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;

  // Invert karmaToReachLevel: find the largest L with LEVEL_STEP*L*(L-1)/2 <= total.
  // Closed-form sqrt gives a near-exact start; a tiny bounded loop corrects any
  // float rounding so the result is exact for every integer total.
  let level = Math.floor(
    (1 + Math.sqrt(1 + (8 * safeTotal) / LEVEL_STEP)) / 2,
  );
  if (level < 1) {
    level = 1;
  }
  while (karmaToReachLevel(level + 1) <= safeTotal) {
    level += 1;
  }
  while (level > 1 && karmaToReachLevel(level) > safeTotal) {
    level -= 1;
  }

  const levelStart = karmaToReachLevel(level);
  const nextLevelKarma = karmaToReachLevel(level + 1) - levelStart;
  const currentLevelKarma = safeTotal - levelStart;
  const progress =
    nextLevelKarma > 0 ? currentLevelKarma / nextLevelKarma : 0;

  return { level, currentLevelKarma, nextLevelKarma, progress };
}
