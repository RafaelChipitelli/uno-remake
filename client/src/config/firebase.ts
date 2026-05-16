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

// Whether Firebase *could* run is knowable from env alone — no SDK needed.
// Keeping this SDK-free is what lets the auth/store/profile screens probe
// availability without pulling firebase/* into the initial bundle.
export const isFirebaseConfigured = missingKeys.length === 0;

if (!isFirebaseConfigured) {
  console.warn(
    `[firebase] Configuração incompleta. Variáveis ausentes: ${missingKeys.join(', ')}. ` +
      'Autenticação/Firestore ficarão indisponíveis até preencher o .env.local.',
  );
}

export function getFirebaseProjectId(): string | null {
  return firebaseConfig.projectId || null;
}

export type FirebaseClientConfig = typeof firebaseConfig;

export function getFirebaseConfig(): FirebaseClientConfig {
  return firebaseConfig;
}
