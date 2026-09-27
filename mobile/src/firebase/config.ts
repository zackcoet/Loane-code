/**
 * Firebase setup for the mobile app.
 *
 * We use the Firebase JS SDK (the web SDK) rather than native modules, which
 * is what lets the app run in Expo Go with no custom build.
 *
 * While building, this points at the local Emulator Suite. Nothing here
 * touches a real Firebase project unless EXPO_PUBLIC_USE_EMULATORS is false.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  connectAuthEmulator,
  // @ts-expect-error — not in the published types, but it is the documented
  // way to persist auth in React Native.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-loane.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-loane',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'demo-loane.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:000000000000:web:0',
};

export const USE_EMULATORS = process.env.EXPO_PUBLIC_USE_EMULATORS !== 'false';

/**
 * Your phone cannot reach "localhost" — that means the phone itself. When
 * testing on a real device, set EXPO_PUBLIC_EMULATOR_HOST to your laptop's
 * LAN IP (`ipconfig getifaddr en0`).
 */
const EMULATOR_HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? '127.0.0.1';

export const app: FirebaseApp = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

function createAuth(): Auth {
  try {
    // Persisting to AsyncStorage keeps her signed in between app launches.
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Already initialized (happens on Fast Refresh).
    return getAuth(app);
  }
}

export const auth: Auth = createAuth();
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

let emulatorsConnected = false;

export function connectEmulators(): void {
  if (!USE_EMULATORS || emulatorsConnected) return;
  emulatorsConnected = true;

  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);

  console.warn(`[Loane] Using Firebase emulators at ${EMULATOR_HOST}`);
}

connectEmulators();
