// Seeds the reference data the app needs on day one: the barangays and the public settings document.
// Usage:
//   Emulator:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=agos-alegria-74e97 node scripts/seed.mjs
//   Production: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/seed.mjs   (never commit the key file)
// Safe to run more than once: existing documents are merged, not duplicated.
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'agos-alegria-74e97' })
const db = getFirestore()

const barangays = JSON.parse(readFileSync(new URL('../seed/barangays.json', import.meta.url), 'utf8'))
const batch = db.batch()
for (const b of barangays) {
  batch.set(
    db.collection('barangays').doc(b.id),
    { name: b.name, code: b.code, active: b.active, updatedBy: 'seed', updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  )
}
batch.set(
  db.collection('appSettings').doc('public'),
  {
    appName: 'AGOS Alegria',
    officialContacts: [],
    maintenanceMode: false,
    maintenanceMessage: '',
    privacyContact: '',
    updatedBy: 'seed',
    updatedAt: FieldValue.serverTimestamp()
  },
  { merge: true }
)
await batch.commit()
console.log(`Seeded ${barangays.length} barangays and appSettings/public.`)
console.log('Next: add the official municipal contacts in the staff console (Settings) and run: npm run bootstrap-admin')
