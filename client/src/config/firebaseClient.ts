import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import { getFirebaseConfig } from './firebase';

// This module is the only place that touches the firebase/* SDK at
// module-eval. It is reached exclusively via a dynamic import() from
// playerAccountFirebase, so Rollup splits firebase/* into its own chunk
// that never lands in the initial bundle.

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;

function ensureInitialized(): void {
  if (firebaseApp) {
    return;
  }
  firebaseApp = initializeApp(getFirebaseConfig());
  firebaseAuth = getAuth(firebaseApp);
  firestoreDb = getFirestore(firebaseApp);
}

export function getFirebaseAuth(): Auth {
  ensureInitialized();
  return firebaseAuth!;
}

export function getFirestoreDb(): Firestore {
  ensureInitialized();
  return firestoreDb!;
}
