import { theme } from '../theme/tokens';

// Card-back skin catalog. Pure data + rules only — no Firebase, no DOM, no
// Phaser. The colors are plain hex strings; callers (DOM previews via CSS,
// CardStage via hexToNumber) adapt them to their medium. Level 1 is the
// default skin and is always unlocked; its colors MUST equal the values
// CardStage already hardcodes for the face-down placeholder so swapping in
// the default produces zero visual change.

export type CosmeticColors = {
  /** Card body fill. */
  fill: string;
  /** Card border stroke. */
  stroke: string;
};

export type Cosmetic = {
  id: string;
  /** i18n key resolved by the UI via t(); never shown raw. */
  nameKey:
    | 'store.skin.classic.name'
    | 'store.skin.amethyst.name'
    | 'store.skin.emerald.name'
    | 'store.skin.crimson.name';
  /** Minimum karma level (levelForKarma().level) required to equip. */
  unlockLevel: number;
  colors: CosmeticColors;
};

const DEFAULT_COSMETIC_ID = 'classic';

// `classic` reproduces the existing placeholder exactly: fill = card.wild,
// stroke = surface.disabled (see CardStage.createStaticObjects).
const CATALOG: readonly Cosmetic[] = [
  {
    id: 'classic',
    nameKey: 'store.skin.classic.name',
    unlockLevel: 1,
    colors: { fill: theme.colors.card.wild, stroke: theme.colors.surface.disabled },
  },
  {
    id: 'amethyst',
    nameKey: 'store.skin.amethyst.name',
    unlockLevel: 2,
    colors: { fill: theme.colors.action.primary.base, stroke: theme.colors.action.primary.border },
  },
  {
    id: 'emerald',
    nameKey: 'store.skin.emerald.name',
    unlockLevel: 4,
    colors: { fill: theme.colors.card.green, stroke: theme.colors.status.success },
  },
  {
    id: 'crimson',
    nameKey: 'store.skin.crimson.name',
    unlockLevel: 7,
    colors: { fill: theme.colors.card.red, stroke: theme.colors.action.danger.border },
  },
];

export function getCatalog(): readonly Cosmetic[] {
  return CATALOG;
}

export function getDefaultCosmeticId(): string {
  return DEFAULT_COSMETIC_ID;
}

export function getDefaultCosmetic(): Cosmetic {
  // CATALOG is a non-empty literal with `classic` first; the find never fails,
  // but the fallback keeps the return type non-optional for callers.
  return CATALOG.find((item) => item.id === DEFAULT_COSMETIC_ID) ?? CATALOG[0];
}

export function findCosmetic(id: string): Cosmetic | undefined {
  return CATALOG.find((item) => item.id === id);
}

export function isUnlocked(item: Cosmetic, level: number): boolean {
  const safeLevel = Number.isFinite(level) ? level : 1;
  return safeLevel >= item.unlockLevel;
}

/**
 * Maps a stored equipped id to the cosmetic that should actually apply.
 * Unknown ids, locked ids (level regression / corruption), and non-finite
 * levels all fall back to the default — never returns something invalid.
 */
export function resolveEquipped(id: string | null | undefined, level: number): Cosmetic {
  if (!id) {
    return getDefaultCosmetic();
  }
  const found = findCosmetic(id);
  if (!found || !isUnlocked(found, level)) {
    return getDefaultCosmetic();
  }
  return found;
}
