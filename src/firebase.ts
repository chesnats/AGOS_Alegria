import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const env = import.meta.env

export const firebaseConfigured = Boolean(env.VITE_FIREBASE_API_KEY)

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
})

// Never point a production build at a visitor's localhost, even when a local
// .env.local keeps emulator mode enabled for development.
const useEmulators = import.meta.env.DEV && env.VITE_USE_EMULATORS === 'true'

if (env.VITE_APPCHECK_SITE_KEY && !useEmulators) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(env.VITE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  })
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, env.VITE_FUNCTIONS_REGION || 'asia-southeast1')

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
}
