import { findCosmetic, getDefaultCosmeticId } from './cosmetics';
import { resolveEquipped, type Cosmetic } from './cosmetics';
import { levelForKarma } from './karma';
import {
  getCurrentAuthSession,
  setEquippedCosmetic,
  subscribeAuthSession,
  type AuthSession,
} from './playerAccount';

// Single source of truth for "which card-back skin is effectively equipped"
// for the current user. Authed users persist on the Firestore profile
// (playerAccount); guests / Firebase-unavailable fall back to localStorage.
// The effective id is always run through resolveEquipped against the current
// karma level so a locked/unknown/corrupt value degrades to the default.

const STORAGE_KEY = 'uno:cosmetic';

type EquippedListener = (cosmetic: Cosmetic) => void;

const listeners = new Set<EquippedListener>();

let authSession: AuthSession = getCurrentAuthSession();

function loadGuestId(): string {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || typeof raw !== 'string') {
      return getDefaultCosmeticId();
    }
    // Run through the catalog so a corrupt localStorage value can't be
    // compared as an equipped id in the store grid (consistent with how the
    // Firestore path normalizes via normalizeEquippedCosmetic).
    return findCosmetic(raw)?.id ?? getDefaultCosmeticId();
  } catch {
    return getDefaultCosmeticId();
  }
}

function persistGuestId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Persistence is best-effort; the choice still applies for this session.
  }
}

function currentLevel(): number {
  return levelForKarma(authSession.profile?.stats?.karma ?? 0).level;
}

function currentSourceId(): string {
  // An authed profile is authoritative once loaded; before that (or as a
  // guest) the localStorage value applies.
  const profileId = authSession.profile?.equippedCosmetic;
  if (authSession.user && profileId) {
    return profileId;
  }
  return loadGuestId();
}

/** The cosmetic the game/UI should actually render for the current user. */
export function getEffectiveCosmetic(): Cosmetic {
  return resolveEquipped(currentSourceId(), currentLevel());
}

function emit(): void {
  const effective = getEffectiveCosmetic();
  listeners.forEach((listener) => listener(effective));
}

/**
 * Equips a skin: writes to Firestore for authed users (best-effort, never
 * throws into the UI) and always mirrors to localStorage so the choice
 * survives sign-out / Firebase being unavailable. Returns the cosmetic that
 * is now effective (may differ from `id` if it was unknown/locked).
 */
export function equipCosmetic(id: string): Cosmetic {
  persistGuestId(id);
  if (authSession.user) {
    void setEquippedCosmetic(id).catch((e) => console.error('[firebase] Falha ao equipar cosmético.', e));
  }
  emit();
  return getEffectiveCosmetic();
}

export function subscribeEquippedCosmetic(listener: EquippedListener): () => void {
  listeners.add(listener);
  listener(getEffectiveCosmetic());
  return () => {
    listeners.delete(listener);
  };
}

subscribeAuthSession((session) => {
  authSession = session;
  emit();
});
