// Creates the first system administrator. After this, that person creates all other staff accounts in the app.
// Usage:
//   node scripts/bootstrap-admin.mjs --email you@example.gov.ph --name "Full Name"
// Emulator: also set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 and FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
// Production: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json (never commit the key file)
// No password is chosen here: the script prints a one-time link for setting it.
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
)
const email = String(args.email || '').trim().toLowerCase()
const name = String(args.name || '').trim()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2) {
  console.error('Usage: node scripts/bootstrap-admin.mjs --email someone@example.com --name "Full Name"')
  process.exit(1)
}

initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'tubiglink-alegria' })
const auth = getAuth()
const db = getFirestore()

let user
try {
  user = await auth.getUserByEmail(email)
  console.log('Existing sign-in account found; promoting it.')
} catch (e) {
  if (e.code !== 'auth/user-not-found') throw e
  user = await auth.createUser({ email, displayName: name, password: randomBytes(18).toString('base64url') })
  console.log('Created sign-in account.')
}

await db.collection('users').doc(user.uid).set(
  {
    displayName: name,
    email,
    role: 'system_admin',
    assignedBarangayId: null,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'bootstrap'
  },
  { merge: true }
)
await db.collection('auditLogs').add({
  actorUid: 'bootstrap', action: 'user.create', recordType: 'users', recordId: user.uid,
  summary: { role: 'system_admin' }, timestamp: FieldValue.serverTimestamp()
})
const link = await auth.generatePasswordResetLink(email)
console.log(`\n${name} is now a system administrator.\nOne-time link to set the password (share privately):\n${link}\n`)
