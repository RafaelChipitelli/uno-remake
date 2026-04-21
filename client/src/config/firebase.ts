import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredFirebaseConfigKeys: Array<keyof typeof firebaseConfig> = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

const missingKeys = requiredFirebaseConfigKeys.filter((key) => !firebaseConfig[key]);

export const isFirebaseConfigured = missingKeys.length === 0;

if (!isFirebaseConfigured) {
  console.warn(
    `[firebase] Configuração incompleta. Variáveis ausentes: ${missingKeys.join(', ')}. ` +
      'Autenticação/Firestore ficarão indisponíveis até preencher o .env.local.',
  );
}

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;

if (isFirebaseConfigured) {
  firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firestoreDb = getFirestore(firebaseApp);
}

function assertFirebaseConfigured(): void {
  if (!firebaseAuth || !firestoreDb) {
    throw new Error('Firebase não está configurado. Preencha as variáveis VITE_FIREBASE_* no client/.env.local.');
  }
}

export function getFirebaseAuth(): Auth {
  assertFirebaseConfigured();
  return firebaseAuth!;
}

export function getFirestoreDb(): Firestore {
  assertFirebaseConfigured();
  return firestoreDb!;
}

export function getFirebaseProjectId(): string | null {
  return firebaseConfig.projectId || null;
}
