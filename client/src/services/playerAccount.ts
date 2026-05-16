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
import {
  getFirebaseAuth,
  getFirebaseProjectId,
  getFirestoreDb,
  isFirebaseConfigured,
} from '../config/firebase';
import { karmaForMatch } from './karma';

export type UserStats = {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  karma: number;
};

export type UserProfile = {
  uid: string;
  nickname: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  stats: UserStats;
};

export type MatchSummary = {
  playedAt: number | null;
  didWin: boolean;
  opponents: string[];
  durationMs: number;
  turns: number;
  playerCount: number;
};

export type AuthSession = {
  firebaseReady: boolean;
  isLoading: boolean;
  user: User | null;
  profile: UserProfile | null;
};

type SessionListener = (session: AuthSession) => void;

type FirebaseLikeError = {
  code?: string;
  message?: string;
};

const DEFAULT_STATS: UserStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  karma: 0,
};

const listeners = new Set<SessionListener>();

let hasStartedAuthObserver = false;
let currentSession: AuthSession = {
  firebaseReady: isFirebaseConfigured,
  isLoading: isFirebaseConfigured,
  user: null,
  profile: null,
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

function emitSession(): void {
  listeners.forEach((listener) => listener(currentSession));
}

function setSession(next: Partial<AuthSession>): void {
  currentSession = {
    ...currentSession,
    ...next,
  };
  emitSession();
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
  const nickname = sanitizeNickname(existingData?.nickname as string | undefined) || getDefaultNickname(user);

  const profile: UserProfile = {
    uid: user.uid,
    nickname,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    photoURL: user.photoURL ?? null,
    stats: existingStats,
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

function startAuthObserverIfNeeded(): void {
  if (!isFirebaseConfigured || hasStartedAuthObserver) {
    return;
  }

  hasStartedAuthObserver = true;
  const auth = getFirebaseAuth();

  onAuthStateChanged(
    auth,
    async (user) => {
      if (!user) {
        setSession({ user: null, profile: null, isLoading: false });
        return;
      }

      setSession({ user, profile: null, isLoading: false });
      const expectedUid = user.uid;

      try {
        const profile = await ensureUserProfile(user);
        if (currentSession.user?.uid !== expectedUid) {
          return;
        }

        setSession({ profile, isLoading: false });
      } catch (error) {
        console.error(
          '[firebase] Falha ao sincronizar perfil no Firestore.',
          {
            code: getFirebaseErrorCode(error),
            message: getFirebaseErrorMessage(error),
            context: buildFirebaseDebugContext(user),
          },
        );
        if (currentSession.user?.uid !== expectedUid) {
          return;
        }

        setSession({
          profile: {
            uid: user.uid,
            nickname: getDefaultNickname(user),
            displayName: user.displayName ?? null,
            email: user.email ?? null,
            emailVerified: user.emailVerified,
            photoURL: user.photoURL ?? null,
            stats: { ...DEFAULT_STATS },
          },
          isLoading: false,
        });
      }
    },
    (error) => {
      console.error('[firebase] Falha no listener de autenticação.', error);
      setSession({ user: null, profile: null, isLoading: false });
    },
  );
}

export function isAuthenticationAvailable(): boolean {
  return isFirebaseConfigured;
}

export function getCurrentAuthSession(): AuthSession {
  startAuthObserverIfNeeded();
  return currentSession;
}

export function subscribeAuthSession(listener: SessionListener): () => void {
  startAuthObserverIfNeeded();
  listeners.add(listener);
  listener(currentSession);

  return () => {
    listeners.delete(listener);
  };
}

export async function signInWithGoogle(): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase não configurado. Defina as variáveis VITE_FIREBASE_* para habilitar login.');
  }

  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);

  const profile = await ensureUserProfile(credential.user);
  setSession({
    user: credential.user,
    profile,
    isLoading: false,
  });
}

export async function signOutCurrentUser(): Promise<void> {
  if (!isFirebaseConfigured) {
    return;
  }

  await signOut(getFirebaseAuth());
}

export async function updateCurrentUserNickname(rawNickname: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured || !currentSession.user) {
    return null;
  }

  const nickname = sanitizeNickname(rawNickname);
  if (!nickname) {
    throw new Error('Nickname inválido.');
  }

  const user = currentSession.user;
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
    stats: currentSession.profile?.stats ?? { ...DEFAULT_STATS },
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };

  if (!currentSession.profile) {
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
    stats: currentSession.profile?.stats ?? { ...DEFAULT_STATS },
  };

  setSession({ profile: updatedProfile });
  return updatedProfile;
}

export async function recordCurrentUserMatchResult(didWin: boolean): Promise<UserProfile | null> {
  if (!isFirebaseConfigured || !currentSession.user) {
    return null;
  }

  const user = currentSession.user;
  let profile = currentSession.profile;

  if (!profile) {
    profile = await ensureUserProfile(user);
    setSession({ profile });
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
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  };

  if (!currentSession.profile) {
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
  };

  setSession({ profile: updatedProfile });
  return updatedProfile;
}

export async function recordCurrentUserMatchSummary(
  summary: Omit<MatchSummary, 'playedAt'>,
): Promise<void> {
  if (!isFirebaseConfigured || !currentSession.user) {
    return;
  }

  const user = currentSession.user;
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

export async function fetchRecentMatches(max = 20): Promise<MatchSummary[]> {
  if (!isFirebaseConfigured || !currentSession.user) {
    return [];
  }

  try {
    const user = currentSession.user;
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

export function describeFirebasePersistenceError(error: unknown): string {
  const firebaseError = error as FirebaseLikeError | null;
  const code = firebaseError?.code ?? 'unknown';

  switch (code) {
    case 'permission-denied':
      return 'Firestore recusou escrita (permission-denied). Verifique Rules: users/{uid} com request.auth.uid == uid.';
    case 'unauthenticated':
      return 'Usuário não autenticado no momento da gravação (unauthenticated). Faça login novamente com Google.';
    case 'not-found':
      return 'Documento/coleção não encontrado no Firestore (not-found).';
    case 'failed-precondition':
      return 'Falha de pré-condição do Firestore (failed-precondition). Verifique configuração do projeto/índices.';
    case 'unavailable':
      return 'Firestore indisponível no momento (unavailable). Verifique conexão de rede.';
    default:
      return `Falha Firebase ao persistir estatísticas (${code}): ${getFirebaseErrorMessage(error)}`;
  }
}
