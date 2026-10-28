// Shared vocabulary. Keep the request lifecycle in sync with functions/src/index.ts
// (the server is authoritative; the UI only uses these lists to show sensible options).

export const REQUEST_STATUSES = [
  'submitted',
  'under_verification',
  'verified',
  'scheduled',
  'in_progress',
  'resolved',
  'referred',
  'unable_to_fulfill'
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

// Anything not resolved stays visible as outstanding, including referrals.
export const OPEN_STATUSES: RequestStatus[] = [
  'submitted',
  'under_verification',
  'verified',
  'scheduled',
  'in_progress',
  'referred',
  'unable_to_fulfill'
]

export type Tone = 'info' | 'warn' | 'ok' | 'muted' | 'bad'

// Icon + label + colour: status never relies on colour alone.
export const STATUS_META: Record<RequestStatus, { icon: string; tone: Tone }> = {
  submitted: { icon: '📥', tone: 'info' },
  under_verification: { icon: '🔎', tone: 'warn' },
  verified: { icon: '✅', tone: 'ok' },
  scheduled: { icon: '📅', tone: 'ok' },
  in_progress: { icon: '🚚', tone: 'ok' },
  resolved: { icon: '💧', tone: 'ok' },
  referred: { icon: '↪️', tone: 'muted' },
  unable_to_fulfill: { icon: '⚠️', tone: 'bad' }
}

export const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  submitted: ['under_verification', 'verified', 'referred', 'unable_to_fulfill'],
  under_verification: ['verified', 'referred', 'unable_to_fulfill'],
  verified: ['scheduled', 'in_progress', 'referred', 'unable_to_fulfill', 'resolved'],
  scheduled: ['in_progress', 'resolved', 'referred', 'unable_to_fulfill'],
  in_progress: ['scheduled', 'resolved', 'referred', 'unable_to_fulfill'],
  referred: ['under_verification', 'scheduled', 'in_progress', 'resolved', 'unable_to_fulfill'],
  unable_to_fulfill: ['verified', 'scheduled', 'in_progress', 'referred', 'resolved'],
  resolved: ['under_verification']
}
export const COORDINATOR_TARGETS: RequestStatus[] = ['under_verification', 'verified', 'referred']
export const NOTE_REQUIRED: RequestStatus[] = ['resolved', 'referred', 'unable_to_fulfill']

export const ISSUE_TYPES = ['no_water', 'low_pressure', 'contaminated', 'no_connection', 'source_dry', 'other'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

export const DURATIONS = ['lt1d', 'd1_3', 'd4_7', 'gt7'] as const
export type Duration = (typeof DURATIONS)[number]

export const CONTACT_METHODS = ['phone', 'messenger', 'landmark_only'] as const
export type ContactMethod = (typeof CONTACT_METHODS)[number]

export const SCHEDULE_STATUSES = ['planned', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]

export const ANNOUNCEMENT_CATEGORIES = [
  'interruption',
  'maintenance',
  'conservation',
  'emergency',
  'distribution',
  'general'
] as const
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]

export const WATER_POINT_STATUSES = ['operational', 'limited', 'closed'] as const
export type WaterPointStatus = (typeof WATER_POINT_STATUSES)[number]

export const SOURCE_TYPES = ['deepwell', 'spring', 'refill_station', 'tank', 'other'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const DELIVERY_STATUSES = ['planned', 'dispatched', 'delivered', 'failed'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const ROLES = ['barangay_coordinator', 'municipal_admin', 'provider', 'system_admin'] as const
export type Role = (typeof ROLES)[number]
export const ROLE_LABELS: Record<Role, string> = {
  barangay_coordinator: 'Barangay coordinator',
  municipal_admin: 'Municipal administrator',
  provider: 'Water provider / delivery operator',
  system_admin: 'System administrator'
}

export type ShortageLevel = 'none' | 'low' | 'moderate' | 'high'

export const PRIVACY_NOTICE_VERSION = '2026-10-draft'

// Plain-English labels for admin screens (the resident app uses the i18n dictionaries).
export const STATUS_LABELS_EN: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  under_verification: 'Under verification',
  verified: 'Verified',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  resolved: 'Resolved',
  referred: 'Referred',
  unable_to_fulfill: 'Unable to fulfill'
}
export const ISSUE_LABELS_EN: Record<IssueType, string> = {
  no_water: 'No water at all',
  low_pressure: 'Low pressure / little water',
  contaminated: 'Dirty or unsafe water',
  no_connection: 'No water connection',
  source_dry: 'Water source is dry',
  other: 'Other'
}
export const DURATION_LABELS_EN: Record<Duration, string> = {
  lt1d: 'Less than a day',
  d1_3: '1 to 3 days',
  d4_7: '4 to 7 days',
  gt7: 'More than a week'
}
