/**
 * Firebase setup for the admin dashboard.
 *
 * Same web config as the mobile app — one Firebase web app, two clients.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-loane.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-loane',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-loane.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:000000000000:web:0',
};

export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS !== 'false';
const HOST = import.meta.env.VITE_EMULATOR_HOST ?? '127.0.0.1';

export const app: FirebaseApp = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const functions: Functions = getFunctions(app);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, HOST, 8080);
  connectFunctionsEmulator(functions, HOST, 5001);
}
