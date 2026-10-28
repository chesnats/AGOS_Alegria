import type { Timestamp } from 'firebase/firestore'
import type {
  AnnouncementCategory,
  ContactMethod,
  DeliveryStatus,
  Duration,
  IssueType,
  RequestStatus,
  Role,
  ScheduleStatus,
  ShortageLevel,
  SourceType,
  WaterPointStatus
} from '@/lib/constants'

export type Ts = Timestamp | null | undefined

export interface Barangay {
  id: string
  name: string
  code: string
  active: boolean
  lat?: number | null
  lng?: number | null
}

export interface StaffProfile {
  uid: string
  displayName: string
  email: string
  role: Role
  assignedBarangayId: string | null
  active: boolean
}

export interface WaterRequest {
  id: string
  referenceNumber: string
  barangayId: string
  barangayName: string
  purok: string
  issueType: IssueType
  householdMembers: number
  duration: Duration
  status: RequestStatus
  possibleDuplicate: boolean
  duplicateOf: string | null
  lastPublicNote?: string | null
  publicTimeline: PublicTimelineEntry[]
  createdAt: Ts
  updatedAt: Ts
  verifiedAt?: Ts
  assistanceAt?: Ts
  resolvedAt?: Ts
}

/** The resident-safe progress history stored with a request for Spark-plan tracking. */
export interface PublicTimelineEntry {
  status: RequestStatus
  at: number
  note: string
}

export interface PrivateDetails {
  id: string
  requestId: string
  barangayId: string
  contactName: string
  contactMethod: ContactMethod
  contactValue: string
  landmark: string
  description: string
  privacyNoticeVersion?: string
  createdAt: Ts
}

export interface StatusHistoryEntry {
  id: string
  requestId: string
  barangayId: string
  oldStatus: RequestStatus | null
  newStatus: RequestStatus
  changedBy: string
  timestamp: Ts
  publicNote: string
  internalNote: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  category: AnnouncementCategory
  targetBarangayIds: string[]
  status: 'draft' | 'published' | 'archived'
  publishedAt?: Ts
  publishedBy?: string | null
  createdAt?: Ts
  updatedAt?: Ts
  updatedBy?: string
}

export interface Schedule {
  id: string
  barangayId: string
  barangayName: string
  date: string // YYYY-MM-DD (Philippine date)
  timeStart: string
  timeEnd: string
  locationName: string
  locationId?: string | null
  estimatedQuantityLiters?: number | null
  status: ScheduleStatus
  notes?: string
  changeNote?: string
  verifiedBy?: string | null
  quantityDistributed?: number | null
  outcomeNote?: string
  createdAt?: Ts
  updatedAt?: Ts
  updatedBy?: string
}

export interface WaterPoint {
  id: string
  name: string
  barangayId: string
  barangayName: string
  addressDescription: string
  accessInstructions: string
  lat?: number | null
  lng?: number | null
  status: WaterPointStatus
  sourceType: SourceType
  published: boolean
  updatedAt?: Ts
  updatedBy?: string
}

export interface Delivery {
  id: string
  scheduleId?: string | null
  barangayId: string
  barangayName: string
  supplierName: string
  vehicle: string
  operatorUid?: string | null
  quantityPlanned: number | null
  quantityDelivered?: number | null
  remainingStock?: number | null
  status: DeliveryStatus
  notes?: string
  completedAt?: Ts
  createdAt?: Ts
  updatedAt?: Ts
  updatedBy?: string
}

export interface AuditLog {
  id: string
  actorUid: string
  action: string
  recordType: string
  recordId: string
  summary?: Record<string, unknown>
  timestamp: Ts
}

export interface OfficialContact {
  label: string
  phone: string
  hours?: string
}

export interface AppSettings {
  appName: string
  officialContacts: OfficialContact[]
  maintenanceMode: boolean
  maintenanceMessage: string
  privacyContact: string
  updatedAt?: Ts
}

export interface ShortageStats {
  barangays?: Record<string, { level: ShortageLevel }>
  updatedAt?: Ts
}

export interface TrackResult {
  referenceNumber: string
  status: RequestStatus
  barangayName: string
  issueType: IssueType
  createdAt: number | null
  updatedAt: number | null
  lastPublicNote: string | null
  timeline: { status: RequestStatus; at: number | null; note: string }[]
}
