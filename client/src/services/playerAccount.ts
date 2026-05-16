import { isFirebaseConfigured } from '../config/firebase';
import type {
  AuthSession,
  MatchSummary,
  UserProfile,
} from './playerAccountTypes';

export type {
  AuthSession,
  MatchSummary,
  UserProfile,
  UserStats,
} from './playerAccountTypes';

type SessionListener = (session: AuthSession) => void;

type FirebaseLikeError = {
  code?: string;
  message?: string;
};

type FirebaseGateway = typeof import('./playerAccountFirebase');

const listeners = new Set<SessionListener>();

let currentSession: AuthSession = {
  firebaseReady: isFirebaseConfigured,
  isLoading: isFirebaseConfigured,
  user: null,
  profile: null,
};

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

function getSession(): AuthSession {
  return currentSession;
}

const sessionAccess = { setSession, getSession };

// The lazy Firebase boundary: firebase/* + the SDK init + all Firestore/Auth
// logic live behind this dynamic import(), so Rollup emits them as a separate
// chunk that the initial bundle never loads. Nothing here imports the SDK
// statically — availability is derived from env (isFirebaseConfigured), and
// the chunk is fetched on first auth/profile/store/stats use. The promise is
// memoized so concurrent callers share one load + one auth observer.
let gatewayPromise: Promise<FirebaseGateway> | null = null;
let hasStartedAuthObserver = false;

function loadGateway(): Promise<FirebaseGateway> {
  if (!gatewayPromise) {
    gatewayPromise = import('./playerAccountFirebase');
  }
  return gatewayPromise;
}

// Synchronous-looking subscribe contract preserved: callers get the current
// session immediately and an unsubscribe. Behind the scenes the first
// subscriber/probe kicks off the lazy Firebase load; once the SDK chunk is in
// and the auth observer fires, the real session is pushed through setSession.
function startAuthObserverIfNeeded(): void {
  if (!isFirebaseConfigured || hasStartedAuthObserver) {
    return;
  }

  hasStartedAuthObserver = true;
  loadGateway()
    .then((gateway) => {
      gateway.startAuthObserver(sessionAccess);
    })
    .catch((error) => {
      console.error('[firebase] Falha ao carregar módulo de autenticação.', error);
      // Without the SDK there is no session to wait for; stop the spinner so
      // the UI degrades to the guest/offline state instead of hanging.
      setSession({ user: null, profile: null, isLoading: false });
    });
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

  const gateway = await loadGateway();
  await gateway.signInWithGoogle(sessionAccess);
}

export async function signOutCurrentUser(): Promise<void> {
  if (!isFirebaseConfigured) {
    return;
  }

  const gateway = await loadGateway();
  await gateway.signOutCurrentUser();
}

export async function updateCurrentUserNickname(rawNickname: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured || !currentSession.user) {
    return null;
  }

  const gateway = await loadGateway();
  return gateway.updateCurrentUserNickname(sessionAccess, rawNickname);
}

export async function setEquippedCosmetic(id: string): Promise<void> {
  if (!isFirebaseConfigured || !currentSession.user || !id) {
    return;
  }

  const gateway = await loadGateway();
  await gateway.setEquippedCosmetic(sessionAccess, id);
}

export async function recordCurrentUserMatchResult(didWin: boolean): Promise<UserProfile | null> {
  if (!isFirebaseConfigured || !currentSession.user) {
    return null;
  }

  const gateway = await loadGateway();
  return gateway.recordCurrentUserMatchResult(sessionAccess, didWin);
}

export async function recordCurrentUserMatchSummary(
  summary: Omit<MatchSummary, 'playedAt'>,
): Promise<void> {
  if (!isFirebaseConfigured || !currentSession.user) {
    return;
  }

  const gateway = await loadGateway();
  await gateway.recordCurrentUserMatchSummary(sessionAccess, summary);
}

export async function fetchRecentMatches(max = 20): Promise<MatchSummary[]> {
  if (!isFirebaseConfigured || !currentSession.user) {
    return [];
  }

  const gateway = await loadGateway();
  return gateway.fetchRecentMatches(sessionAccess, max);
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

function getFirebaseErrorMessage(error: unknown): string {
  const firebaseError = error as FirebaseLikeError | null;
  return firebaseError?.message || 'Erro Firebase desconhecido.';
}
