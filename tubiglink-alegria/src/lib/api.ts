import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import type { ContactMethod, Duration, IssueType, RequestStatus, Role } from '@/lib/constants'
import type { TrackResult } from '@/types'

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

export async function submitRequest(p: SubmitPayload): Promise<{ referenceNumber: string }> {
  const res = await httpsCallable<SubmitPayload, { referenceNumber: string }>(functions, 'submitWaterRequest', opts)(p)
  return res.data
}

export async function trackRequest(referenceNumber: string): Promise<TrackResult> {
  const res = await httpsCallable<{ referenceNumber: string }, TrackResult>(functions, 'trackRequest', opts)({
    referenceNumber
  })
  return res.data
}

export interface StatusUpdatePayload {
  requestId: string
  newStatus: RequestStatus
  publicNote: string
  internalNote: string
}

export async function updateRequestStatus(p: StatusUpdatePayload): Promise<void> {
  await httpsCallable<StatusUpdatePayload, { ok: boolean }>(functions, 'updateRequestStatus', opts)(p)
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
  const res = await httpsCallable<{ requestId: string }, RevealedContact>(functions, 'revealRequestContact', opts)({
    requestId
  })
  return res.data
}

/** Turn a Firebase/network error into a message that is safe to show people. */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string }
  if (e?.code === 'functions/unavailable' || e?.code === 'functions/deadline-exceeded') return fallback
  if (e?.code?.startsWith('functions/') && e.message && e.code !== 'functions/internal') return e.message
  return fallback
}
