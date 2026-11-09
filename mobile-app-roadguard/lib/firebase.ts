import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every(
  (value) => typeof value === 'string' && value.length > 0,
);

export const firebaseApp = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(config)
  : null;

let firebaseAuth: Auth | null = null;
if (firebaseApp) {
  try {
    const nativePersistenceFactory = (
      FirebaseAuth as unknown as {
        getReactNativePersistence?: (storage: unknown) => unknown;
      }
    ).getReactNativePersistence;
    firebaseAuth = nativePersistenceFactory
      ? initializeAuth(firebaseApp, {
          persistence: nativePersistenceFactory(AsyncStorage) as never,
        })
      : getAuth(firebaseApp);
  } catch {
    // Fast refresh can initialize Auth more than once; reuse the existing instance.
    firebaseAuth = getAuth(firebaseApp);
  }
}

export const auth = firebaseAuth;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;

export function getFirebaseSetupMessage() {
  return 'Add the Firebase project values from .env.example, enable Email/Password sign-in, and publish the provided Firestore and Storage rules.';
}
