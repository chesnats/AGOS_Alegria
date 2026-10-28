<script setup lang="ts">
import { computed, ref } from 'vue'
import { collection, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { useLive } from '@/composables/useLive'
import { useScopedRequests } from '@/composables/useStaffData'
import { ISSUE_LABELS_EN, ISSUE_TYPES, OPEN_STATUSES, STATUS_LABELS_EN, REQUEST_STATUSES, DURATION_LABELS_EN } from '@/lib/constants'
import { downloadCsv, fmtHours, hoursBetween, todayIso, toDate } from '@/lib/format'
import { median, phDayEnd, phDayStart } from '@/lib/stats'
import type { Delivery, Schedule, WaterRequest } from '@/types'

const MAX = 2000
const { profile, isMuni, scopeBarangayId } = useAuth()
const { active: barangays, nameOf } = useBarangays()
const requests = useScopedRequests(MAX)

const from = ref(todayIso(-30))
const to = ref(todayIso())
const barangay = ref('')

function inRange(v: unknown): boolean {
  const t = toDate(v)?.getTime()
  if (t === undefined) return false
  if (from.value && t < phDayStart(from.value)) return false
  if (to.value && t > phDayEnd(to.value)) return false
  return true
}

const rows = computed(() =>
  requests.items.value.filter((r) => inRange(r.createdAt) && (!barangay.value || r.barangayId === barangay.value))
)

const received = computed(() => rows.value.length)
const resolved = computed(() => rows.value.filter((r) => r.status === 'resolved').length)
const outstanding = computed(() => rows.value.filter((r) => OPEN_STATUSES.includes(r.status)).length)
const unmet = computed(() => rows.value.filter((r) => r.status === 'unable_to_fulfill' || r.status === 'referred').length)
const rate = computed(() => (received.value ? Math.round((resolved.value / received.value) * 100) : null))

function verifyHours(list: WaterRequest[]): number | null {
  return median(list.map((r) => hoursBetween(r.createdAt, r.verifiedAt)).filter((h): h is number => h !== null))
}
function assistHours(list: WaterRequest[]): number | null {
  return median(list.map((r) => hoursBetween(r.verifiedAt, r.assistanceAt)).filter((h): h is number => h !== null))
}

const byBarangay = computed(() => {
  const list = isMuni.value ? barangays.value : barangays.value.filter((b) => b.id === scopeBarangayId.value)
  return list.map((b) => {
    const mine = rows.value.filter((r) => r.barangayId === b.id)
    return {
      Barangay: b.name,
      Received: mine.length,
      Resolved: mine.filter((r) => r.status === 'resolved').length,
      Outstanding: mine.filter((r) => OPEN_STATUSES.includes(r.status)).length,
      'Referred or unable to fulfill': mine.filter((r) => r.status === 'unable_to_fulfill' || r.status === 'referred').length,
      'Median hours to verify': verifyHours(mine) === null ? '' : Math.round((verifyHours(mine) as number) * 10) / 10
    }
  })
})

const byIssue = computed(() =>
  ISSUE_TYPES.map((i) => ({ Problem: ISSUE_LABELS_EN[i], Requests: rows.value.filter((r) => r.issueType === i).length }))
)
const byStatus = computed(() =>
  REQUEST_STATUSES.map((s) => ({ Status: STATUS_LABELS_EN[s], Requests: rows.value.filter((r) => r.status === s).length }))
)

// ---- deliveries and distributed water ----
const deliveries = useLive<Delivery>(() => {
  const p = profile.value
  if (!p || p.role === 'provider') return null
  const base = collection(db, 'deliveries')
  if (p.role === 'barangay_coordinator') {
    return scopeBarangayId.value ? query(base, where('barangayId', '==', scopeBarangayId.value), orderBy('createdAt', 'desc'), limit(500)) : null
  }
  return query(base, orderBy('createdAt', 'desc'), limit(500))
})
const schedules = useLive<Schedule>(() => {
  const p = profile.value
  if (!p || p.role === 'provider') return null
  const base = collection(db, 'distributionSchedules')
  if (p.role === 'barangay_coordinator') {
    return scopeBarangayId.value ? query(base, where('barangayId', '==', scopeBarangayId.value), orderBy('date'), limit(500)) : null
  }
  return query(base, orderBy('date', 'desc'), limit(500))
})

const deliveryRows = computed(() =>
  deliveries.items.value.filter(
    (d) => d.status === 'delivered' && inRange(d.completedAt ?? d.updatedAt) && (!barangay.value || d.barangayId === barangay.value)
  )
)
const litersDelivered = computed(() => deliveryRows.value.reduce((n, d) => n + (d.quantityDelivered ?? 0), 0))
const scheduleRows = computed(() =>
  schedules.items.value.filter(
    (s) =>
      s.status === 'completed' &&
      (!barangay.value || s.barangayId === barangay.value) &&
      (!from.value || s.date >= from.value) &&
      (!to.value || s.date <= to.value)
  )
)
const litersDistributed = computed(() => scheduleRows.value.reduce((n, s) => n + (s.quantityDistributed ?? 0), 0))

// ---- CSV exports (no names, phone numbers or landmarks are ever included) ----
const iso = (v: unknown): string => toDate(v)?.toISOString() ?? ''
const hrs = (h: number | null): string => (h === null ? '' : (Math.round(h * 10) / 10).toString())

function exportRequests(): void {
  downloadCsv(
    `tubiglink-requests-${from.value}-to-${to.value}.csv`,
    rows.value.map((r) => ({
      Reference: r.id,
      Barangay: r.barangayName,
      Purok: r.purok,
      Problem: ISSUE_LABELS_EN[r.issueType],
      'People affected': r.householdMembers,
      Duration: DURATION_LABELS_EN[r.duration],
      Status: STATUS_LABELS_EN[r.status],
      'Possible duplicate': r.possibleDuplicate ? 'yes' : 'no',
      Received: iso(r.createdAt),
      Verified: iso(r.verifiedAt),
      'Assistance started': iso(r.assistanceAt),
      Resolved: iso(r.resolvedAt),
      'Hours to verify': hrs(hoursBetween(r.createdAt, r.verifiedAt)),
      'Hours verified to assistance': hrs(hoursBetween(r.verifiedAt, r.assistanceAt))
    }))
  )
}
function exportSummary(): void {
  downloadCsv(`tubiglink-barangay-summary-${from.value}-to-${to.value}.csv`, byBarangay.value)
}
function exportDeliveries(): void {
  downloadCsv(
    `tubiglink-deliveries-${from.value}-to-${to.value}.csv`,
    deliveryRows.value.map((d) => ({
      Barangay: d.barangayName,
      Supplier: d.supplierName,
      Vehicle: d.vehicle,
      'Liters planned': d.quantityPlanned ?? '',
      'Liters delivered': d.quantityDelivered ?? '',
      'Remaining stock (L)': d.remainingStock ?? '',
      Completed: iso(d.completedAt ?? d.updatedAt),
      Notes: d.notes ?? ''
    }))
  )
}
</script>

<template>
  <div>
    <h1>Reports</h1>

    <div class="toolbar">
      <div><label for="f">From</label><input id="f" v-model="from" type="date" /></div>
      <div><label for="t">To</label><input id="t" v-model="to" type="date" /></div>
      <div v-if="isMuni">
        <label for="b">Barangay</label>
        <select id="b" v-model="barangay">
          <option value="">All barangays</option>
          <option v-for="b in barangays" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>
    </div>
    <p v-if="!isMuni && scopeBarangayId" class="small muted">Showing {{ nameOf(scopeBarangayId) }} only.</p>

    <p v-if="requests.error.value" class="error" role="alert">We could not load requests.</p>
    <p v-else-if="requests.loading.value" class="muted">Loading…</p>

    <template v-else>
      <p v-if="requests.items.value.length >= MAX" class="notice small">
        Only the latest {{ MAX }} requests are loaded. Narrow the date range for complete figures.
      </p>

      <div class="grid cols-4 mb">
        <div class="stat"><div class="n">{{ received }}</div><div class="l">Requests received</div></div>
        <div class="stat"><div class="n">{{ resolved }}</div><div class="l">Resolved</div></div>
        <div class="stat"><div class="n">{{ rate === null ? '–' : rate + '%' }}</div><div class="l">Resolved ÷ received</div></div>
        <div class="stat" :class="{ alert: outstanding }"><div class="n">{{ outstanding }}</div><div class="l">Outstanding</div></div>
        <div class="stat" :class="{ alert: unmet }"><div class="n">{{ unmet }}</div><div class="l">Referred or unable to fulfill</div></div>
        <div class="stat"><div class="n">{{ fmtHours(verifyHours(rows)) }}</div><div class="l">Median time to verify</div></div>
        <div class="stat"><div class="n">{{ fmtHours(assistHours(rows)) }}</div><div class="l">Median verified → assistance</div></div>
        <div class="stat"><div class="n">{{ (litersDelivered + litersDistributed).toLocaleString() }}</div><div class="l">Liters recorded as delivered</div></div>
      </div>

      <p class="notice small">
        These figures describe <strong>reported</strong> demand only. Residents without internet access, or who do not know about the app, are not
        counted, so please do not read them as the municipality's total need.
        “Liters recorded” adds completed deliveries ({{ litersDelivered.toLocaleString() }} L) and completed schedules ({{ litersDistributed.toLocaleString() }} L);
        if the same truckload is entered in both places it will be counted twice.
      </p>

      <div class="row mb">
        <button class="btn" type="button" :disabled="!rows.length" @click="exportRequests">Download requests (CSV)</button>
        <button class="btn secondary" type="button" :disabled="!byBarangay.length" @click="exportSummary">Download barangay summary (CSV)</button>
        <button class="btn secondary" type="button" :disabled="!deliveryRows.length" @click="exportDeliveries">Download deliveries (CSV)</button>
      </div>

      <div class="grid cols-2">
        <section class="panel">
          <h2>By barangay</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Barangay</th><th>Received</th><th>Resolved</th><th>Outstanding</th><th>Referred / unable</th></tr></thead>
              <tbody>
                <tr v-for="b in byBarangay" :key="b.Barangay">
                  <td>{{ b.Barangay }}</td><td>{{ b.Received }}</td><td>{{ b.Resolved }}</td><td>{{ b.Outstanding }}</td><td>{{ b['Referred or unable to fulfill'] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel">
          <h2>By problem</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Problem</th><th>Requests</th></tr></thead>
              <tbody><tr v-for="i in byIssue" :key="i.Problem"><td>{{ i.Problem }}</td><td>{{ i.Requests }}</td></tr></tbody>
            </table>
          </div>
          <h2 class="mt">By status</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Status</th><th>Requests</th></tr></thead>
              <tbody><tr v-for="s in byStatus" :key="s.Status"><td>{{ s.Status }}</td><td>{{ s.Requests }}</td></tr></tbody>
            </table>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
