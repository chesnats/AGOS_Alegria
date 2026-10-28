# TubigLink Alegria

Municipality-wide water assistance and monitoring app for Alegria, Cebu. An installable PWA
(Vue 3 + TypeScript + Vite) on Firebase (Auth, Firestore, Cloud Functions, Hosting).

Residents report a shortage, get a reference number, and track the response. Barangay coordinators verify
requests in their own barangay. The municipal team sees demand across all nine barangays, publishes schedules and
announcements, records deliveries and exports reports.

> **Status: complete first draft, not yet run.** All code is written, but this workspace could not reach the npm
> registry, so `npm install`, the type-check, the build and the emulator tests have **not** been run. Expect to fix a
> small number of type or typo errors on first build. See [Verification status](#verification-status).

## What is in the box

| Area | Where | Notes |
| --- | --- | --- |
| Resident app (11 screens) | `src/views/resident/` | Welcome, home, request form, confirmation, track, my requests, schedule, updates, water points (list + map), help, install, privacy. English, Cebuano, Filipino. |
| Staff console | `src/views/admin/` | Dashboard, requests (verify, status, notes, contact reveal), distribution schedules, deliveries, announcements, water points, barangays, staff accounts, reports + CSV, audit log, settings. |
| Trusted backend | `functions/src/index.ts` | Submit and track requests, status changes, contact reveal, staff management, public shortage level, audit triggers. |
| Security rules | `firestore.rules`, `firestore.indexes.json` | Role and barangay scoping; residents never read Firestore directly. |
| Setup scripts | `scripts/seed.mjs`, `scripts/bootstrap-admin.mjs` | Barangays and settings; first system administrator. |
| Documents for the municipality | `docs/` | Requirements and workflow, privacy notice template, operations runbook, test plan, pilot and training plan. |

## How the privacy model works

* Residents have no accounts. A request is submitted through a Cloud Function, which returns a random reference number such as `TL-7K4M-2QXH`.
  Anyone holding that number can see its status (so it should be kept private). Tracking returns public fields only.
* Contact details live in `requestPrivateDetails`, which **no browser can read**. Staff view them through the `revealRequestContact`
  function, which checks the staff member's barangay scope and writes an audit entry each time.
* Staff roles are read from `users/{uid}` on every request, so deactivating someone takes effect at once (no waiting for tokens to expire).
* The public Water Points screen shows only a shortage **level** per barangay (none / low / moderate / high), never counts or households.

### Roles

| Role | Can do |
| --- | --- |
| Barangay coordinator | Verify, refer and mark under-verification for requests in **their barangay only**; manage that barangay's announcements, schedules, water points, deliveries; view contact details for their requests. |
| Municipal administrator | Everything above for all barangays, plus schedule/assistance decisions, barangays, settings, reports, audit log, and coordinator/provider accounts. |
| Provider / delivery operator | See and update deliveries assigned to them (quantities, status). No access to requests or contact details. |
| System administrator | Everything, including creating administrator accounts. |

## Set up

Prerequisites: Node 20+ and a Google account. The app can submit and track requests directly through Firestore on Firebase's Spark plan.
Cloud Functions are optional; they require Blaze and add server-side rate limiting, duplicate detection, audited contact reveals, and staff-account creation.

```bash
npm install
npm --prefix functions install
cp .env.example .env.local        # fill in values from Firebase console > Project settings > Your apps (Web)
```

1. Create the Firebase project; enable **Authentication → Email/Password**, **Firestore** (location `asia-southeast1`), **Hosting**.
2. Put your project id in `.firebaserc`.
3. Deploy rules and indexes:
   ```bash
   firebase deploy --only firestore
   ```
4. Seed the reference data and create the first administrator (needs a service-account key; never commit it):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json
   npm run seed
   npm run bootstrap-admin -- --email you@example.gov.ph --name "Your Name"
   ```
   The script prints a one-time link for setting the password. That person then creates every other account under **Staff** in the console.
5. Build and deploy the Spark-plan app: `firebase deploy --only hosting,firestore --project default`.
   Use `npm run deploy` only after upgrading to Blaze, because it also deploys Cloud Functions.
6. Sign in at `/admin/login`, open **Settings**, and add the official municipal contact numbers. Check **Barangays**.

### Run locally with the Firebase emulators

```bash
npm run emulators                       # auth 9099, firestore 8080, functions 5001, UI 4000
# in another terminal
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=tubiglink-alegria
npm run seed && npm run bootstrap-admin -- --email test@example.com --name "Test Admin"
VITE_USE_EMULATORS=true npm run dev     # needs VITE_FIREBASE_API_KEY set to any non-empty value
```
Functions must be built first: `npm --prefix functions run build`.

## Before public launch

These are configuration steps that code cannot do for you:

- [ ] **TTL policy** on collection `rateLimits`, field `expiresAt` (Firestore → TTL), so rate-limit counters clean themselves up.
- [ ] **App Check**: register a reCAPTCHA key, set `VITE_APPCHECK_SITE_KEY`, test, then set `ENFORCE_APP_CHECK=true` in `functions/.env` and redeploy functions.
- [ ] **Stronger staff sign-in**: upgrade to Identity Platform and require multi-factor authentication for administrators.
- [ ] **Backups**: enable Firestore point-in-time recovery and scheduled exports; decide the retention period (see `docs/operations-runbook.md`).
- [ ] **Budget alerts** and a named technical owner for the Firebase project.
- [ ] **Privacy**: municipal privacy officer reviews and approves the notice (`docs/privacy-notice-template.md`); update `PRIVACY_NOTICE_VERSION` in both `src/lib/constants.ts` and `functions/src/index.ts`.
- [ ] **Language review**: Cebuano and Filipino text are drafts; have native speakers from the municipality review them.
- [ ] **Real contacts and instructions** in Settings, and a reachable non-digital way to ask for help.
- [ ] Run the full `docs/test-plan.md` and the pilot in `docs/pilot-and-training.md`.

## Verification status

What was checked in the workspace where this was written:

* Cross-file consistency: every `@/` import resolves to a file; every literal translation key exists; English, Cebuano and Filipino dictionaries each hold the same 200 keys and parse; all callable function names used by the app exist in `functions/src/index.ts`.
* A manual read-through of `firestore.rules` and `functions/src/index.ts` against the plan's privacy and access requirements.

What was **not** possible (npm registry blocked): `npm install`, `vue-tsc`, `vite build`, running the emulators, and any browser test.
First steps on your machine: `npm install && npm --prefix functions install && npm run typecheck && npm --prefix functions run build`, then fix whatever it reports.

## Scope

Included: MVP features 1–4 and 7 from the plan, plus the Phase 2 items for the map, deliveries/inventory and shortage levels.
Deliberately **not** included (plan §15): SMS or push notifications, live truck GPS, sensors, forecasting, chatbots, payments, app-store builds.
The app never promises SMS/push, and it does not queue submissions offline: if a submission cannot reach the server it says so, so no one gets a false confirmation.

## Known gaps and next steps

* No dedicated "enter a request for a resident" screen yet; staff can use the public form on the resident's behalf.
* Cebuano and Filipino are drafts. The staff console is English only.
* No automated tests are included yet. Recommended first: Firestore rules tests with the emulator (see `docs/test-plan.md` section C), then unit tests for the status transition table, which is duplicated in `src/lib/constants.ts` and `functions/src/index.ts` (the server is authoritative).
* SMS and push notifications are Phase 2 and need a provider, budget and consent flow.
