import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  getFirebaseAuth,
  getFirebaseProjectId,
  getFirestoreDb,
  isFirebaseConfigured,
} from '../config/firebase';

export type UserStats = {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
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

  return {
    gamesPlayed: Number.isFinite(gamesPlayed) && gamesPlayed >= 0 ? gamesPlayed : 0,
    gamesWon: Number.isFinite(gamesWon) && gamesWon >= 0 ? gamesWon : 0,
    gamesLost: Number.isFinite(gamesLost) && gamesLost >= 0 ? gamesLost : 0,
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

  await updateDoc(userRef, {
    'stats.gamesPlayed': increment(1),
    'stats.gamesWon': increment(didWin ? 1 : 0),
    'stats.gamesLost': increment(didWin ? 0 : 1),
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
    },
  };

  setSession({ profile: updatedProfile });
  return updatedProfile;
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
