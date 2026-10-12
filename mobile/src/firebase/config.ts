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
import { initializeAuth, getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
/**
 * FROM '@firebase/auth', NOT 'firebase/auth'. This is the whole reason
 * students were being signed out every time they reopened the app.
 *
 * The umbrella `firebase` package has no React Native export condition
 * for `./auth` — it resolves to the browser build, which does not export
 * `getReactNativePersistence` at all. The import therefore came back
 * `undefined`, calling it threw, the catch below swallowed the throw,
 * and auth fell back to IN-MEMORY persistence. Signed in until the app
 * closed, every time.
 *
 * `@firebase/auth` carries a top-level "react-native" field, which is
 * what Metro resolves on, so this import gets the RN build that does
 * export it.
 *
 * It is deliberately NOT in mobile/package.json. Declaring it risks a
 * second copy of the auth SDK at a different version — two auth
 * instances is a far worse failure than this one. If hoisting ever
 * stops working, Metro fails loudly at build time, which is fine.
 */
// @ts-expect-error — the RN build's types are not what TypeScript
// resolves here, though the runtime export is real. See above.
import { getReactNativePersistence } from '@firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

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
 * Where the emulators are.
 *
 * Your phone cannot reach "localhost" — that means the phone itself. So on
 * a real device we need the laptop's address on the Wi-Fi.
 *
 * WE WORK IT OUT RATHER THAN BEING TOLD. Expo already knows the address
 * the phone used to reach the Metro dev server — it is how the app got
 * here at all — and the emulators are on that same laptop. Reading it
 * from `hostUri` means the app follows the laptop from network to
 * network with nothing to configure, which matters because a laptop's
 * IP changes every time you move.
 *
 * EXPO_PUBLIC_EMULATOR_HOST still wins if it is set, for the case where
 * the emulators are somewhere other than the machine running Metro.
 * Falling back to 127.0.0.1 is right for the iOS Simulator, which shares
 * the laptop's network.
 */
function resolveEmulatorHost(): string {
  const override = process.env.EXPO_PUBLIC_EMULATOR_HOST;
  if (override) return override;

  // e.g. "192.168.1.198:8081" — strip the Metro port, keep the host.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;

  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost') return host;

  return '127.0.0.1';
}

const EMULATOR_HOST = resolveEmulatorHost();

export const app: FirebaseApp =
  getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

function createAuth(): Auth {
  try {
    // Persisting to AsyncStorage keeps her signed in between launches.
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (error) {
    // Fast Refresh re-runs this module and auth is already set up. The
    // only benign case, and the only one that gets swallowed.
    if ((error as { code?: string })?.code === 'auth/already-initialized') {
      return getAuth(app);
    }

    // Anything else means persistence is NOT configured and she will be
    // signed out the moment the app closes. That used to happen in
    // silence; a blanket catch here is what hid the bug for weeks.
    console.error(
      '[Loane] Auth persistence failed to initialise — users will be signed out ' +
        'on every launch. Check the @firebase/auth import in config.ts.',
      error,
    );
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

  // Printed on purpose: when a phone cannot connect, the first useful
  // question is always "which address is it even trying?".
  console.warn(`[Loane] Using Firebase emulators at ${EMULATOR_HOST}`);
}

connectEmulators();
