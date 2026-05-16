import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { getFirebaseProjectId, isFirebaseConfigured } from '../config/firebase';
import { getFirebaseAuth, getFirestoreDb } from '../config/firebaseClient';
import { getDefaultCosmeticId } from './cosmetics';
import { karmaForMatch } from './karma';
import type {
  AuthSession,
  MatchSummary,
  UserProfile,
  UserStats,
} from './playerAccountTypes';
import { DEFAULT_STATS } from './playerAccountTypes';

// All firebase/* SDK usage lives here. This module is only ever reached via
// a dynamic import() from playerAccount, so it (and firebase/*) is emitted
// as a separate chunk kept out of the initial bundle. The facade owns the
// session state + listeners and passes setSession/getSession in so the
// observer's async profile sync can resolve against the live session.

type FirebaseLikeError = {
  code?: string;
  message?: string;
};

type SessionAccess = {
  setSession: (next: Partial<AuthSession>) => void;
  getSession: () => AuthSession;
};

function sanitizeNickname(rawNickname: string | null | undefined): string {
  const nickname = rawNickname?.trim();
  if (!nickname) {
    return '';
  }

  return nickname.slice(0, 20);
}

function getDefaultNickname(user: User): string {
  return sanitizeNickname(user.displayName) || `Player-${user.uid.slice(0, 4)}`;
}

function getAuthProviderIds(user: User): string[] {
  const providers = user.providerData
    .map((provider) => provider.providerId)
    .filter((providerId): providerId is string => Boolean(providerId));

  return providers.length > 0 ? providers : ['unknown'];
}

function getPrimaryAuthProvider(user: User): string {
  const providerIds = getAuthProviderIds(user);

  if (providerIds.includes('google.com')) {
    return 'google.com';
  }

  return providerIds[0] ?? 'unknown';
}

function normalizeStats(rawStats: unknown): UserStats {
  if (!rawStats || typeof rawStats !== 'object') {
    return { ...DEFAULT_STATS };
  }

  const statsRecord = rawStats as Record<string, unknown>;
  const gamesPlayed = Number(statsRecord.gamesPlayed);
  const gamesWon = Number(statsRecord.gamesWon);
  const gamesLost = Number(statsRecord.gamesLost);
  // Old users predate the karma field; missing/garbage normalizes to 0.
  const karma = Number(statsRecord.karma);

  return {
    gamesPlayed: Number.isFinite(gamesPlayed) && gamesPlayed >= 0 ? gamesPlayed : 0,
    gamesWon: Number.isFinite(gamesWon) && gamesWon >= 0 ? gamesWon : 0,
    gamesLost: Number.isFinite(gamesLost) && gamesLost >= 0 ? gamesLost : 0,
    karma: Number.isFinite(karma) && karma >= 0 ? Math.floor(karma) : 0,
  };
}

// Older profiles predate cosmetics; missing/garbage normalizes to the
// default skin id. Validity against the catalog (and unlock gating) is the
// cosmetics layer's job — this only guarantees a non-empty string.
function normalizeEquippedCosmetic(raw: unknown): string {
  return typeof raw === 'string' && raw.length > 0 ? raw : getDefaultCosmeticId();
}

function getFirebaseErrorCode(error: unknown): string | null {
  const firebaseError = error as FirebaseLikeError | null;
  return firebaseError?.code ?? null;
}

function getFirebaseErrorMessage(error: unknown): string {
  const firebaseError = error as FirebaseLikeError | null;
  return firebaseError?.message || 'Erro Firebase desconhecido.';
}

function buildFirebaseDebugContext(user?: User): Record<string, unknown> {
  return {
    projectId: getFirebaseProjectId(),
    uid: user?.uid ?? null,
    email: user?.email ?? null,
    authConfigured: isFirebaseConfigured,
  };
}

async function ensureUserProfile(user: User): Promise<UserProfile> {
  const db = getFirestoreDb();
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  const existingData = snapshot.exists() ? snapshot.data() : undefined;
  const existingStats = normalizeStats(existingData?.stats);
  const equippedCosmetic = normalizeEquippedCosmetic(existingData?.equippedCosmetic);
  const nickname = sanitizeNickname(existingData?.nickname as string | undefined) || getDefaultNickname(user);

  const profile: UserProfile = {
    uid: user.uid,
    nickname,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    photoURL: user.photoURL ?? null,
    stats: existingStats,
    equippedCosmetic,
  };

  const providerIds = getAuthProviderIds(user);

  const userDocument: Record<string, unknown> = {
    uid: profile.uid,
    nickname: profile.nickname,
    displayName: profile.displayName,
    email: profile.email,
    emailVerified: profile.emailVerified,
    photoURL: profile.photoURL,
    authProvider: getPrimaryAuthProvider(user),
    providerIds,
    stats: profile.stats,
    equippedCosmetic: profile.equippedCosmetic,
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };

  if (snapshot.exists()) {
    userDocument.createdAt = existingData?.createdAt ?? serverTimestamp();
  } else {
    userDocument.createdAt = serverTimestamp();
  }

  await setDoc(
    userRef,
    userDocument,
    { merge: true },
  );

  return profile;
}

export function startAuthObserver(access: SessionAccess): void {
  const auth = getFirebaseAuth();

  onAuthStateChanged(
    auth,
    async (user) => {
      if (!user) {
        access.setSession({ user: null, profile: null, isLoading: false });
        return;
      }

      access.setSession({ user, profile: null, isLoading: false });
      const expectedUid = user.uid;

      try {
        const profile = await ensureUserProfile(user);
        if (access.getSession().user?.uid !== expectedUid) {
          return;
        }

        access.setSession({ profile, isLoading: false });
      } catch (error) {
        console.error(
          '[firebase] Falha ao sincronizar perfil no Firestore.',
          {
            code: getFirebaseErrorCode(error),
            message: getFirebaseErrorMessage(error),
            context: buildFirebaseDebugContext(user),
          },
        );
        if (access.getSession().user?.uid !== expectedUid) {
          return;
        }

        access.setSession({
          profile: {
            uid: user.uid,
            nickname: getDefaultNickname(user),
            displayName: user.displayName ?? null,
            email: user.email ?? null,
            emailVerified: user.emailVerified,
            photoURL: user.photoURL ?? null,
            stats: { ...DEFAULT_STATS },
            equippedCosmetic: getDefaultCosmeticId(),
          },
          isLoading: false,
        });
      }
    },
    (error) => {
      console.error('[firebase] Falha no listener de autenticação.', error);
      access.setSession({ user: null, profile: null, isLoading: false });
    },
  );
}

export async function signInWithGoogle(access: SessionAccess): Promise<void> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);

  const profile = await ensureUserProfile(credential.user);
  access.setSession({
    user: credential.user,
    profile,
    isLoading: false,
  });
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export async function updateCurrentUserNickname(
  access: SessionAccess,
  rawNickname: string,
): Promise<UserProfile | null> {
  const session = access.getSession();
  if (!session.user) {
    return null;
  }

  const nickname = sanitizeNickname(rawNickname);
  if (!nickname) {
    throw new Error('Nickname inválido.');
  }

  const user = session.user;
  const db = getFirestoreDb();
  const userRef = doc(db, 'users', user.uid);

  const userDocument: Record<string, unknown> = {
    uid: user.uid,
    nickname,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    photoURL: user.photoURL ?? null,
    authProvider: getPrimaryAuthProvider(user),
    providerIds: getAuthProviderIds(user),
    stats: session.profile?.stats ?? { ...DEFAULT_STATS },
    equippedCosmetic: session.profile?.equippedCosmetic ?? getDefaultCosmeticId(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };

  if (!session.profile) {
    userDocument.createdAt = serverTimestamp();
  }

  await setDoc(
    userRef,
    userDocument,
    { merge: true },
  );

  const updatedProfile: UserProfile = {
    uid: user.uid,
    nickname,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    photoURL: user.photoURL ?? null,
    stats: session.profile?.stats ?? { ...DEFAULT_STATS },
    equippedCosmetic: session.profile?.equippedCosmetic ?? getDefaultCosmeticId(),
  };

  access.setSession({ profile: updatedProfile });
  return updatedProfile;
}

export async function setEquippedCosmetic(access: SessionAccess, id: string): Promise<void> {
  const session = access.getSession();
  if (!session.user || !id) {
    return;
  }

  const user = session.user;

  if (session.profile) {
    access.setSession({ profile: { ...session.profile, equippedCosmetic: id } });
  }

  try {
    const db = getFirestoreDb();
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      equippedCosmetic: id,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[firebase] Falha ao salvar cosmético equipado.', {
      code: getFirebaseErrorCode(error),
      message: getFirebaseErrorMessage(error),
      context: buildFirebaseDebugContext(user),
    });
  }
}

export async function recordCurrentUserMatchResult(
  access: SessionAccess,
  didWin: boolean,
): Promise<UserProfile | null> {
  const session = access.getSession();
  if (!session.user) {
    return null;
  }

  const user = session.user;
  let profile = session.profile;

  if (!profile) {
    profile = await ensureUserProfile(user);
    access.setSession({ profile });
  }

  const db = getFirestoreDb();
  const userRef = doc(db, 'users', user.uid);
  const nickname = profile.nickname ?? getDefaultNickname(user);
  const existingStats = profile.stats ?? { ...DEFAULT_STATS };

  const userDocument: Record<string, unknown> = {
    uid: user.uid,
    nickname,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    photoURL: user.photoURL ?? null,
    authProvider: getPrimaryAuthProvider(user),
    providerIds: getAuthProviderIds(user),
    stats: existingStats,
    equippedCosmetic: profile.equippedCosmetic ?? getDefaultCosmeticId(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };

  if (!session.profile) {
    userDocument.createdAt = serverTimestamp();
  }

  await setDoc(
    userRef,
    userDocument,
    { merge: true },
  );

  const earnedKarma = karmaForMatch(didWin);

  await updateDoc(userRef, {
    'stats.gamesPlayed': increment(1),
    'stats.gamesWon': increment(didWin ? 1 : 0),
    'stats.gamesLost': increment(didWin ? 0 : 1),
    'stats.karma': increment(earnedKarma),
    updatedAt: serverTimestamp(),
  });

  const updatedProfile: UserProfile = {
    uid: user.uid,
    nickname,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    photoURL: user.photoURL ?? null,
    stats: {
      gamesPlayed: existingStats.gamesPlayed + 1,
      gamesWon: existingStats.gamesWon + (didWin ? 1 : 0),
      gamesLost: existingStats.gamesLost + (didWin ? 0 : 1),
      karma: existingStats.karma + earnedKarma,
    },
    equippedCosmetic: profile.equippedCosmetic ?? getDefaultCosmeticId(),
  };

  access.setSession({ profile: updatedProfile });
  return updatedProfile;
}

export async function recordCurrentUserMatchSummary(
  access: SessionAccess,
  summary: Omit<MatchSummary, 'playedAt'>,
): Promise<void> {
  const session = access.getSession();
  if (!session.user) {
    return;
  }

  const user = session.user;
  const db = getFirestoreDb();
  const matchesRef = collection(db, 'users', user.uid, 'matches');

  await addDoc(matchesRef, {
    playedAt: serverTimestamp(),
    didWin: summary.didWin,
    opponents: summary.opponents,
    durationMs: Math.max(0, Math.round(summary.durationMs)),
    turns: Math.max(0, Math.round(summary.turns)),
    playerCount: Math.max(0, Math.round(summary.playerCount)),
  });
}

function toEpochMs(rawPlayedAt: unknown): number | null {
  // serverTimestamp() reads back null until the server resolves it; tolerate
  // that plus already-resolved Timestamp / Date / epoch shapes.
  if (rawPlayedAt instanceof Timestamp) {
    return rawPlayedAt.toMillis();
  }
  if (rawPlayedAt instanceof Date) {
    return rawPlayedAt.getTime();
  }
  if (typeof rawPlayedAt === 'number' && Number.isFinite(rawPlayedAt)) {
    return rawPlayedAt;
  }
  return null;
}

function toMatchSummary(data: Record<string, unknown>): MatchSummary {
  const rawOpponents = Array.isArray(data.opponents) ? data.opponents : [];
  const opponents = rawOpponents
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const durationMs = Number(data.durationMs);
  const turns = Number(data.turns);
  const playerCount = Number(data.playerCount);

  return {
    playedAt: toEpochMs(data.playedAt),
    didWin: data.didWin === true,
    opponents,
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0,
    turns: Number.isFinite(turns) && turns >= 0 ? turns : 0,
    playerCount: Number.isFinite(playerCount) && playerCount >= 0 ? playerCount : 0,
  };
}

export async function fetchRecentMatches(
  access: SessionAccess,
  max = 20,
): Promise<MatchSummary[]> {
  const session = access.getSession();
  if (!session.user) {
    return [];
  }

  try {
    const user = session.user;
    const db = getFirestoreDb();
    const matchesRef = collection(db, 'users', user.uid, 'matches');
    const recentQuery = query(matchesRef, orderBy('playedAt', 'desc'), limitTo(max));
    const snapshot = await getDocs(recentQuery);

    return snapshot.docs.map((matchDoc) => toMatchSummary(matchDoc.data()));
  } catch (error) {
    console.error('[firebase] Falha ao carregar histórico de partidas.', error);
    return [];
  }
}
