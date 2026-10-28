import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  collection
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '@/firebase'
import {
  CONTACT_METHODS,
  DURATIONS,
  ISSUE_TYPES,
  REQUEST_STATUSES,
  TRANSITIONS,
  type ContactMethod,
  type Duration,
  type IssueType,
  type RequestStatus,
  type Role
} from '@/lib/constants'
import type { PrivateDetails, PublicTimelineEntry, TrackResult, WaterRequest } from '@/types'

const opts = { timeout: 20000 }

export interface SubmitPayload {
  barangayId: string
  purok: string
  issueType: IssueType
  householdMembers: number
  duration: Duration
  contactName: string
  contactMethod: ContactMethod
  contactValue: string
  landmark: string
  description: string
  consent: boolean
  locale: string
}

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const REF_PATTERN = /^TL-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/
const INITIAL_NOTE = 'Your request was received.'

function newReference(): string {
  const bytes = new Uint32Array(8)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (n) => REF_ALPHABET[n % REF_ALPHABET.length]).join('')
  return `TL-${chars.slice(0, 4)}-${chars.slice(4)}`
}

function asMillis(value: unknown): number | null {
  return value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : null
}

function asStatus(value: unknown): RequestStatus | null {
  return typeof value === 'string' && (REQUEST_STATUSES as readonly string[]).includes(value) ? (value as RequestStatus) : null
}

export async function submitRequest(p: SubmitPayload): Promise<{ referenceNumber: string }> {
  if (!p.consent) throw new Error('Please confirm you have read the privacy notice.')
  if (!(ISSUE_TYPES as readonly string[]).includes(p.issueType) || !(DURATIONS as readonly string[]).includes(p.duration)) {
    throw new Error('The request details are not valid.')
  }
  if (!(CONTACT_METHODS as readonly string[]).includes(p.contactMethod) || !Number.isInteger(p.householdMembers)) {
    throw new Error('The request details are not valid.')
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const referenceNumber = newReference()
    const now = Date.now()
    const requestRef = doc(db, 'waterRequests', referenceNumber)
    const privateRef = doc(db, 'requestPrivateDetails', referenceNumber)
    try {
      await runTransaction(db, async (tx) => {
        if ((await tx.get(requestRef)).exists()) throw new Error('reference-collision')
        const barangay = await tx.get(doc(db, 'barangays', p.barangayId))
        if (!barangay.exists() || barangay.data().active !== true) throw new Error('Barangay is not valid.')
        const barangayName = String(barangay.data().name ?? p.barangayId)
        const timeline: PublicTimelineEntry[] = [{ status: 'submitted', at: now, note: INITIAL_NOTE }]
        tx.set(requestRef, {
          referenceNumber,
          barangayId: p.barangayId,
          barangayName,
          purok: p.purok,
          issueType: p.issueType,
          householdMembers: p.householdMembers,
          duration: p.duration,
          status: 'submitted',
          possibleDuplicate: false,
          duplicateOf: null,
          lastPublicNote: INITIAL_NOTE,
          publicTimeline: timeline,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        tx.set(privateRef, {
          requestId: referenceNumber,
          barangayId: p.barangayId,
          contactName: p.contactName,
          contactMethod: p.contactMethod,
          contactValue: p.contactValue,
          landmark: p.landmark,
          description: p.description,
          consentAt: serverTimestamp(),
          privacyNoticeVersion: '2026-10-draft',
          locale: p.locale.slice(0, 5),
          createdAt: serverTimestamp()
        })
      })
      return { referenceNumber }
    } catch (err) {
      if ((err as Error).message === 'reference-collision') continue
      throw err
    }
  }
  throw new Error('We could not create a reference number. Please try again.')
}

export async function trackRequest(referenceNumber: string): Promise<TrackResult> {
  const ref = referenceNumber.toUpperCase().replace(/\s+/g, '')
  if (!REF_PATTERN.test(ref)) throw Object.assign(new Error('No request found for that reference number.'), { code: 'functions/not-found' })
  const snap = await getDoc(doc(db, 'waterRequests', ref))
  if (!snap.exists()) throw Object.assign(new Error('No request found for that reference number.'), { code: 'functions/not-found' })
  const data = snap.data() as Omit<WaterRequest, 'id'>
  const status = asStatus(data.status)
  if (!status) throw Object.assign(new Error('No request found for that reference number.'), { code: 'functions/not-found' })
  const timeline = Array.isArray(data.publicTimeline)
    ? data.publicTimeline
        .map((entry) => ({ status: asStatus(entry.status), at: Number(entry.at), note: String(entry.note ?? '') }))
        .filter((entry): entry is { status: RequestStatus; at: number; note: string } => entry.status !== null && Number.isFinite(entry.at))
    : []
  return {
    referenceNumber: ref,
    status,
    barangayName: data.barangayName,
    issueType: data.issueType,
    createdAt: asMillis(data.createdAt),
    updatedAt: asMillis(data.updatedAt),
    lastPublicNote: data.lastPublicNote ?? null,
    timeline
  }
}

export interface StatusUpdatePayload {
  requestId: string
  newStatus: RequestStatus
  publicNote: string
  internalNote: string
}

export async function updateRequestStatus(p: StatusUpdatePayload): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Please sign in again.')
  const requestRef = doc(db, 'waterRequests', p.requestId)
  const historyRef = doc(collection(db, 'statusHistory'))
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(requestRef)
    if (!snap.exists()) throw new Error('Request not found.')
    const request = snap.data() as Omit<WaterRequest, 'id'>
    const oldStatus = asStatus(request.status)
    if (!oldStatus || !(TRANSITIONS[oldStatus] ?? []).includes(p.newStatus)) throw new Error('That status change is not allowed.')
    const publicTimeline = Array.isArray(request.publicTimeline) ? [...request.publicTimeline] : []
    publicTimeline.push({ status: p.newStatus, at: Date.now(), note: p.publicNote })
    tx.update(requestRef, {
      status: p.newStatus,
      lastPublicNote: p.publicNote || null,
      lastUpdatedBy: uid,
      publicTimeline,
      updatedAt: serverTimestamp()
    })
    tx.set(historyRef, {
      requestId: p.requestId,
      barangayId: request.barangayId,
      oldStatus,
      newStatus: p.newStatus,
      changedBy: uid,
      timestamp: serverTimestamp(),
      publicNote: p.publicNote,
      internalNote: p.internalNote
    })
  })
}

export interface StaffPayload {
  email: string
  displayName: string
  role: Role
  assignedBarangayId: string | null
  active: boolean
}

export async function upsertStaffUser(
  p: StaffPayload
): Promise<{ uid: string; created: boolean; resetLink: string | null }> {
  const res = await httpsCallable<StaffPayload, { uid: string; created: boolean; resetLink: string | null }>(
    functions,
    'upsertStaffUser',
    opts
  )(p)
  return res.data
}

export interface RevealedContact {
  contactName: string
  contactMethod: ContactMethod
  contactValue: string
  landmark: string
  description: string
  privacyNoticeVersion: string
}

/** Staff only. Every call is written to the audit log on the server. */
export async function revealContact(requestId: string): Promise<RevealedContact> {
  const snap = await getDoc(doc(db, 'requestPrivateDetails', requestId))
  if (!snap.exists()) throw new Error('Request not found.')
  const data = snap.data() as Omit<PrivateDetails, 'id'>
  return {
    contactName: data.contactName ?? '',
    contactMethod: data.contactMethod,
    contactValue: data.contactValue ?? '',
    landmark: data.landmark ?? '',
    description: data.description ?? '',
    privacyNoticeVersion: data.privacyNoticeVersion ?? ''
  }
}

/** Turn a Firebase/network error into a message that is safe to show people. */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string }
  if (e?.code === 'functions/unavailable' || e?.code === 'functions/deadline-exceeded') return fallback
  if (e?.code?.startsWith('functions/') && e.message && e.code !== 'functions/internal') return e.message
  return fallback
}
