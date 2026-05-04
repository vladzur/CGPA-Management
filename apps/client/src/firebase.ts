import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const isDev = import.meta.env.DEV;

const firebaseConfig = {
  apiKey: isDev ? 'demo-api-key' : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: isDev ? 'demo-cgpa-platform.firebaseapp.com' : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: isDev ? 'demo-cgpa-platform' : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: isDev ? 'demo-cgpa-platform.appspot.com' : import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: isDev ? '123456789' : import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: isDev ? '1:123456789:web:abcdef123456' : import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (isDev) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
