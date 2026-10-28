import { setGlobalOptions } from 'firebase-functions/v2'
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import * as logger from 'firebase-functions/logger'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { createHash, randomBytes, randomInt } from 'node:crypto'

initializeApp()
const db = getFirestore()
const auth = getAuth()

// Keep in sync with VITE_FUNCTIONS_REGION in the web app.
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 })

// Set ENFORCE_APP_CHECK=true in functions/.env once App Check is configured in the web app.
const callableOptions = { enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true', cors: true }

// ---------------------------------------------------------------------------
// Shared constants (mirrors src/lib/constants.ts in the web app)
// ---------------------------------------------------------------------------
const STATUSES = [
  'submitted',
  'under_verification',
  'verified',
  'scheduled',
  'in_progress',
  'resolved',
  'referred',
  'unable_to_fulfill'
] as const
type Status = (typeof STATUSES)[number]

const ISSUE_TYPES = ['no_water', 'low_pressure', 'contaminated', 'no_connection', 'source_dry', 'other']
const DURATIONS = ['lt1d', 'd1_3', 'd4_7', 'gt7']
const CONTACT_METHODS = ['phone', 'messenger', 'landmark_only']
const OPEN_STATUSES: Status[] = [
  'submitted',
  'under_verification',
  'verified',
  'scheduled',
  'in_progress',
  'referred',
  'unable_to_fulfill'
]

const TRANSITIONS: Record<Status, Status[]> = {
  submitted: ['under_verification', 'verified', 'referred', 'unable_to_fulfill'],
  under_verification: ['verified', 'referred', 'unable_to_fulfill'],
  verified: ['scheduled', 'in_progress', 'referred', 'unable_to_fulfill', 'resolved'],
  scheduled: ['in_progress', 'resolved', 'referred', 'unable_to_fulfill'],
  in_progress: ['scheduled', 'resolved', 'referred', 'unable_to_fulfill'],
  referred: ['under_verification', 'scheduled', 'in_progress', 'resolved', 'unable_to_fulfill'],
  unable_to_fulfill: ['verified', 'scheduled', 'in_progress', 'referred', 'resolved'],
  resolved: ['under_verification']
}
// Coordinators verify and refer. Assistance and closure decisions belong to the municipal team.
const COORDINATOR_TARGETS: Status[] = ['under_verification', 'verified', 'referred']
// Closing or deflecting a request must always explain the outcome to the resident.
const NOTE_REQUIRED: Status[] = ['resolved', 'referred', 'unable_to_fulfill']

const PRIVACY_NOTICE_VERSION = '2026-10-draft'
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L
const REF_PATTERN = /^TL-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface StaffProfile {
  uid: string
  role: 'barangay_coordinator' | 'municipal_admin' | 'provider' | 'system_admin'
  assignedBarangayId: string | null
  active: boolean
  displayName?: string
}

function str(v: unknown, field: string, { min = 0, max = 200, required = true } = {}): string {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpsError('invalid-argument', `${field} is required.`)
    return ''
  }
  if (typeof v !== 'string') throw new HttpsError('invalid-argument', `${field} must be text.`)
  const s = v.trim()
  if (s.length < min) throw new HttpsError('invalid-argument', `${field} is too short.`)
  if (s.length > max) throw new HttpsError('invalid-argument', `${field} is too long.`)
  return s
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new HttpsError('invalid-argument', `${field} is not valid.`)
  }
  return v as T
}

function newReference(): string {
  const pick = () => Array.from({ length: 4 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join('')
  return `TL-${pick()}-${pick()}`
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

async function rateLimit(req: CallableRequest, bucket: string, limit: number, windowMs: number) {
  const ip = req.rawRequest?.ip ?? 'unknown'
  const key = sha256(`${bucket}|${ip}`)
  const ref = db.collection('rateLimits').doc(key)
  const now = Date.now()
  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref)
    const data = snap.data() as { count: number; windowStart: number } | undefined
    if (!data || now - data.windowStart > windowMs) {
      tx.set(ref, { count: 1, windowStart: now, expiresAt: Timestamp.fromMillis(now + windowMs * 2) })
      return
    }
    if (data.count >= limit) {
      throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.')
    }
    tx.update(ref, { count: FieldValue.increment(1) })
  })
}

async function requireStaff(req: CallableRequest): Promise<StaffProfile> {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in.')
  const snap = await db.collection('users').doc(req.auth.uid).get()
  const data = snap.data()
  if (!snap.exists || !data || data.active !== true) {
    throw new HttpsError('permission-denied', 'Your account is not active.')
  }
  return { uid: req.auth.uid, ...(data as Omit<StaffProfile, 'uid'>) }
}

const isMuni = (p: StaffProfile) => p.role === 'municipal_admin' || p.role === 'system_admin'

async function writeAudit(
  actorUid: string,
  action: string,
  recordType: string,
  recordId: string,
  summary: Record<string, unknown> = {}
) {
  await db.collection('auditLogs').add({
    actorUid,
    action,
    recordType,
    recordId,
    summary,
    timestamp: FieldValue.serverTimestamp()
  })
}

// ---------------------------------------------------------------------------
// Residents: submit a request
// ---------------------------------------------------------------------------
export const submitWaterRequest = onCall(callableOptions, async (req) => {
  await rateLimit(req, 'submit', 20, 60 * 60 * 1000)
  const d = (req.data ?? {}) as Record<string, unknown>

  const barangayId = str(d.barangayId, 'Barangay', { max: 60 })
  const purok = str(d.purok, 'Purok / sitio', { min: 1, max: 60 })
  const issueType = oneOf(d.issueType, ISSUE_TYPES, 'Issue type')
  const duration = oneOf(d.duration, DURATIONS, 'Duration')
  const contactMethod = oneOf(d.contactMethod, CONTACT_METHODS, 'Contact method')
  const householdMembers = Number(d.householdMembers)
  if (!Number.isInteger(householdMembers) || householdMembers < 1 || householdMembers > 100) {
    throw new HttpsError('invalid-argument', 'Household size must be between 1 and 100.')
  }
  const contactName = str(d.contactName, 'Name', { max: 80, required: false })
  const contactValue = str(d.contactValue, 'Contact', { max: 100, required: false })
  const landmark = str(d.landmark, 'Landmark', { max: 160, required: false })
  const description = str(d.description, 'Description', { max: 600, required: false })
  if (d.consent !== true) {
    throw new HttpsError('failed-precondition', 'Please confirm you have read the privacy notice.')
  }
  if (contactMethod !== 'landmark_only' && !contactValue) {
    throw new HttpsError('invalid-argument', 'Please provide a contact number or Messenger name.')
  }
  if (!contactValue && !landmark) {
    throw new HttpsError('invalid-argument', 'Please provide a contact or a nearby landmark.')
  }

  const brgySnap = await db.collection('barangays').doc(barangayId).get()
  if (!brgySnap.exists || brgySnap.data()?.active !== true) {
    throw new HttpsError('invalid-argument', 'Barangay is not valid.')
  }
  const barangayName = String(brgySnap.data()?.name ?? barangayId)

  // Duplicate detection (flag only; staff decide).
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const dupKey = sha256([barangayId, norm(purok), norm(contactValue || landmark)].join('|'))
  const cutoff = Timestamp.fromMillis(Date.now() - 48 * 60 * 60 * 1000)
  const dupSnap = await db
    .collection('requestPrivateDetails')
    .where('dupKey', '==', dupKey)
    .where('createdAt', '>', cutoff)
    .limit(1)
    .get()
  const duplicateOf = dupSnap.empty ? null : dupSnap.docs[0].id

  for (let attempt = 0; attempt < 6; attempt++) {
    const ref = newReference()
    const reqRef = db.collection('waterRequests').doc(ref)
    const batch = db.batch()
    batch.create(reqRef, {
      referenceNumber: ref,
      barangayId,
      barangayName,
      purok,
      issueType,
      householdMembers,
      duration,
      status: 'submitted',
      possibleDuplicate: duplicateOf !== null,
      duplicateOf,
      lastPublicNote: 'Your request was received.',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    })
    batch.create(db.collection('requestPrivateDetails').doc(ref), {
      requestId: ref,
      barangayId,
      contactName,
      contactMethod,
      contactValue,
      landmark,
      description,
      dupKey,
      consentAt: FieldValue.serverTimestamp(),
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      locale: typeof d.locale === 'string' ? d.locale.slice(0, 5) : 'en',
      createdAt: FieldValue.serverTimestamp()
    })
    batch.create(db.collection('statusHistory').doc(), {
      requestId: ref,
      barangayId,
      oldStatus: null,
      newStatus: 'submitted',
      changedBy: 'resident',
      timestamp: FieldValue.serverTimestamp(),
      publicNote: 'Your request was received.',
      internalNote: ''
    })
    try {
      await batch.commit()
      return { referenceNumber: ref }
    } catch (err) {
      // Reference collision (ALREADY_EXISTS): try a new one.
      if ((err as { code?: number }).code === 6) continue
      logger.error('submitWaterRequest failed', err)
      throw new HttpsError('internal', 'We could not save your request. Please try again.')
    }
  }
  throw new HttpsError('internal', 'We could not create a reference number. Please try again.')
})

// ---------------------------------------------------------------------------
// Residents: track a request by reference number (returns public fields only)
// ---------------------------------------------------------------------------
export const trackRequest = onCall(callableOptions, async (req) => {
  await rateLimit(req, 'track', 60, 60 * 60 * 1000)
  const ref = str((req.data as { referenceNumber?: unknown })?.referenceNumber, 'Reference number', { max: 20 })
    .toUpperCase()
    .replace(/\s+/g, '')
  if (!REF_PATTERN.test(ref)) throw new HttpsError('invalid-argument', 'That reference number looks incorrect.')

  const snap = await db.collection('waterRequests').doc(ref).get()
  if (!snap.exists) throw new HttpsError('not-found', 'No request found for that reference number.')
  const r = snap.data()!
  const hist = await db.collection('statusHistory').where('requestId', '==', ref).orderBy('timestamp', 'asc').get()

  return {
    referenceNumber: ref,
    status: r.status as Status,
    barangayName: r.barangayName as string,
    issueType: r.issueType as string,
    createdAt: (r.createdAt as Timestamp)?.toMillis() ?? null,
    updatedAt: (r.updatedAt as Timestamp)?.toMillis() ?? null,
    lastPublicNote: (r.lastPublicNote as string | null) ?? null,
    timeline: hist.docs.map((h) => {
      const x = h.data()
      return {
        status: x.newStatus as Status,
        at: (x.timestamp as Timestamp)?.toMillis() ?? null,
        note: (x.publicNote as string) || ''
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Staff: change a request's status (role-checked, validated, audited)
// ---------------------------------------------------------------------------
export const updateRequestStatus = onCall(callableOptions, async (req) => {
  const staff = await requireStaff(req)
  if (staff.role === 'provider') throw new HttpsError('permission-denied', 'Your role cannot update requests.')

  const d = (req.data ?? {}) as Record<string, unknown>
  const requestId = str(d.requestId, 'Request', { max: 20 }).toUpperCase()
  if (!REF_PATTERN.test(requestId)) throw new HttpsError('invalid-argument', 'Request reference is not valid.')
  const newStatus = oneOf(d.newStatus, STATUSES, 'Status')
  const publicNote = str(d.publicNote, 'Public note', { max: 400, required: false })
  const internalNote = str(d.internalNote, 'Internal note', { max: 800, required: false })

  if (NOTE_REQUIRED.includes(newStatus) && publicNote.length < 5) {
    throw new HttpsError('invalid-argument', 'Please add a note for the resident explaining the outcome.')
  }

  await db.runTransaction(async (tx) => {
    const ref = db.collection('waterRequests').doc(requestId)
    const snap = await tx.get(ref)
    if (!snap.exists) throw new HttpsError('not-found', 'Request not found.')
    const r = snap.data()!

    if (!isMuni(staff) && !(staff.role === 'barangay_coordinator' && staff.assignedBarangayId === r.barangayId)) {
      throw new HttpsError('permission-denied', 'This request is outside your assigned barangay.')
    }
    const oldStatus = r.status as Status
    if (!TRANSITIONS[oldStatus]?.includes(newStatus)) {
      throw new HttpsError('failed-precondition', `Cannot change from "${oldStatus}" to "${newStatus}".`)
    }
    if (!isMuni(staff) && !COORDINATOR_TARGETS.includes(newStatus)) {
      throw new HttpsError('permission-denied', 'Only the municipal team can set that status.')
    }

    const update: Record<string, unknown> = {
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
      lastPublicNote: publicNote || null,
      lastUpdatedBy: staff.uid
    }
    if (newStatus === 'verified' && !r.verifiedAt) update.verifiedAt = FieldValue.serverTimestamp()
    if (['scheduled', 'in_progress', 'resolved'].includes(newStatus) && !r.assistanceAt) {
      update.assistanceAt = FieldValue.serverTimestamp()
    }
    if (newStatus === 'resolved') update.resolvedAt = FieldValue.serverTimestamp()
    if (oldStatus === 'resolved') update.resolvedAt = FieldValue.delete()

    tx.update(ref, update)
    tx.create(db.collection('statusHistory').doc(), {
      requestId,
      barangayId: r.barangayId,
      oldStatus,
      newStatus,
      changedBy: staff.uid,
      timestamp: FieldValue.serverTimestamp(),
      publicNote,
      internalNote
    })
    tx.create(db.collection('auditLogs').doc(), {
      actorUid: staff.uid,
      action: 'request.status_change',
      recordType: 'waterRequests',
      recordId: requestId,
      summary: { from: oldStatus, to: newStatus },
      timestamp: FieldValue.serverTimestamp()
    })
  })
  return { ok: true }
})

// ---------------------------------------------------------------------------
// Staff: view a resident's private contact details (scope-checked and audited)
// ---------------------------------------------------------------------------
export const revealRequestContact = onCall(callableOptions, async (req) => {
  const staff = await requireStaff(req)
  if (staff.role === 'provider') throw new HttpsError('permission-denied', 'Your role cannot view contact details.')

  const requestId = str((req.data as { requestId?: unknown })?.requestId, 'Request', { max: 20 }).toUpperCase()
  if (!REF_PATTERN.test(requestId)) throw new HttpsError('invalid-argument', 'Request reference is not valid.')

  const snap = await db.collection('requestPrivateDetails').doc(requestId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'Request not found.')
  const p = snap.data()!
  if (!isMuni(staff) && !(staff.role === 'barangay_coordinator' && staff.assignedBarangayId === p.barangayId)) {
    throw new HttpsError('permission-denied', 'This request is outside your assigned barangay.')
  }

  await writeAudit(staff.uid, 'request.contact_viewed', 'requestPrivateDetails', requestId, {
    barangayId: p.barangayId
  })
  return {
    contactName: (p.contactName as string) ?? '',
    contactMethod: p.contactMethod as string,
    contactValue: (p.contactValue as string) ?? '',
    landmark: (p.landmark as string) ?? '',
    description: (p.description as string) ?? '',
    privacyNoticeVersion: (p.privacyNoticeVersion as string) ?? ''
  }
})

// ---------------------------------------------------------------------------
// Staff management (municipal admins: coordinators/providers; system admins: anyone)
// ---------------------------------------------------------------------------
const ROLES = ['barangay_coordinator', 'municipal_admin', 'provider', 'system_admin'] as const

export const upsertStaffUser = onCall(callableOptions, async (req) => {
  const caller = await requireStaff(req)
  if (!isMuni(caller)) throw new HttpsError('permission-denied', 'Only administrators can manage staff.')

  const d = (req.data ?? {}) as Record<string, unknown>
  const email = str(d.email, 'Email', { max: 120 }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Email is not valid.')
  const displayName = str(d.displayName, 'Name', { min: 2, max: 80 })
  const role = oneOf(d.role, ROLES, 'Role')
  const active = d.active !== false
  const assignedBarangayId =
    role === 'barangay_coordinator' ? str(d.assignedBarangayId, 'Barangay', { max: 60 }) : null

  if (caller.role !== 'system_admin' && (role === 'municipal_admin' || role === 'system_admin')) {
    throw new HttpsError('permission-denied', 'Only a system administrator can grant administrator roles.')
  }
  if (assignedBarangayId) {
    const b = await db.collection('barangays').doc(assignedBarangayId).get()
    if (!b.exists) throw new HttpsError('invalid-argument', 'Barangay does not exist.')
  }

  let created = false
  let resetLink: string | null = null
  let userRecord
  try {
    userRecord = await auth.getUserByEmail(email)
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err
    userRecord = await auth.createUser({
      email,
      displayName,
      password: randomBytes(18).toString('base64url'),
      emailVerified: false
    })
    created = true
  }

  const target = await db.collection('users').doc(userRecord.uid).get()
  const targetRole = target.data()?.role as string | undefined
  if (caller.role !== 'system_admin' && (targetRole === 'municipal_admin' || targetRole === 'system_admin')) {
    throw new HttpsError('permission-denied', 'Only a system administrator can modify administrator accounts.')
  }
  if (userRecord.uid === caller.uid && (role !== caller.role || !active)) {
    throw new HttpsError('failed-precondition', 'You cannot change your own role or deactivate yourself.')
  }

  await db.collection('users').doc(userRecord.uid).set(
    {
      displayName,
      email,
      role,
      assignedBarangayId,
      active,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: caller.uid,
      ...(target.exists ? {} : { createdAt: FieldValue.serverTimestamp() })
    },
    { merge: true }
  )
  await auth.updateUser(userRecord.uid, { displayName, disabled: !active })
  if (!active) await auth.revokeRefreshTokens(userRecord.uid)
  if (created) resetLink = await auth.generatePasswordResetLink(email)

  await writeAudit(caller.uid, created ? 'user.create' : 'user.update', 'users', userRecord.uid, {
    role,
    assignedBarangayId,
    active
  })
  return { uid: userRecord.uid, created, resetLink }
})

// ---------------------------------------------------------------------------
// Public, privacy-preserving shortage level per barangay (no counts, no households)
// ---------------------------------------------------------------------------
function levelFor(openCount: number): 'none' | 'low' | 'moderate' | 'high' {
  if (openCount === 0) return 'none'
  if (openCount < 5) return 'low'
  if (openCount < 15) return 'moderate'
  return 'high'
}

export const refreshShortageStats = onDocumentWritten('waterRequests/{id}', async (event) => {
  const before = event.data?.before.data()
  const after = event.data?.after.data()
  const barangayId = (after ?? before)?.barangayId as string | undefined
  if (!barangayId) return
  if (before && after && before.status === after.status) return // only status changes matter

  const count = await db
    .collection('waterRequests')
    .where('barangayId', '==', barangayId)
    .where('status', 'in', OPEN_STATUSES)
    .count()
    .get()
  await db.collection('publicStats').doc('shortage').set(
    {
      barangays: { [barangayId]: { level: levelFor(count.data().count), updatedAt: FieldValue.serverTimestamp() } },
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  )
})

// ---------------------------------------------------------------------------
// Audit trail for client-written operational records
// (clients cannot delete these documents, so the actor is always updatedBy)
// ---------------------------------------------------------------------------
function auditTrigger(collection: string) {
  return onDocumentWritten(`${collection}/{id}`, async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!after) return
    const action = before ? 'update' : 'create'
    const summary: Record<string, unknown> = {}
    if (before?.status !== after.status) summary.status = { from: before?.status ?? null, to: after.status ?? null }
    if (typeof after.title === 'string') summary.title = after.title
    if (typeof after.name === 'string') summary.name = after.name
    await writeAudit(String(after.updatedBy ?? 'unknown'), `${collection}.${action}`, collection, event.params.id, summary)
  })
}

export const auditAnnouncements = auditTrigger('announcements')
export const auditSchedules = auditTrigger('distributionSchedules')
export const auditWaterPoints = auditTrigger('waterPoints')
export const auditDeliveries = auditTrigger('deliveries')
export const auditBarangays = auditTrigger('barangays')
export const auditSettings = auditTrigger('appSettings')
