<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { collection, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { useLive } from '@/composables/useLive'
import { useScopedRequests, useStaffNames } from '@/composables/useStaffData'
import StatusBadge from '@/components/StatusBadge.vue'
import ScheduleBadge from '@/components/ScheduleBadge.vue'
import { OPEN_STATUSES, STATUS_LABELS_EN } from '@/lib/constants'
import { ageDays, fmtAge, median } from '@/lib/stats'
import { fmtDateTime, fmtHours, fmtIsoDate, hoursBetween, todayIso } from '@/lib/format'
import type { Schedule, StatusHistoryEntry } from '@/types'

const MAX = 500
const { profile, isMuni, scopeBarangayId } = useAuth()
const { active: barangays, nameOf } = useBarangays()
const { nameFor } = useStaffNames()
const { items, loading, error } = useScopedRequests(MAX)

const open = computed(() => items.value.filter((r) => OPEN_STATUSES.includes(r.status)))
const unverified = computed(() => items.value.filter((r) => r.status === 'submitted' || r.status === 'under_verification'))
const duplicates = computed(() => open.value.filter((r) => r.possibleDuplicate))
const unmet = computed(() => items.value.filter((r) => r.status === 'unable_to_fulfill' || r.status === 'referred'))
const resolved = computed(() => items.value.filter((r) => r.status === 'resolved'))

const toVerification = computed(() =>
  median(items.value.map((r) => hoursBetween(r.createdAt, r.verifiedAt)).filter((h): h is number => h !== null))
)
const toAssistance = computed(() =>
  median(items.value.map((r) => hoursBetween(r.verifiedAt, r.assistanceAt)).filter((h): h is number => h !== null))
)

const needsAttention = computed(() =>
  [...unverified.value]
    .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))
    .slice(0, 8)
)

const byBarangay = computed(() =>
  barangays.value.map((b) => {
    const mine = items.value.filter((r) => r.barangayId === b.id)
    const mineOpen = mine.filter((r) => OPEN_STATUSES.includes(r.status))
    const oldest = mineOpen.reduce<number | null>((acc, r) => {
      const a = ageDays(r.createdAt)
      return a !== null && (acc === null || a > acc) ? a : acc
    }, null)
    return {
      id: b.id,
      name: b.name,
      open: mineOpen.length,
      unverified: mine.filter((r) => r.status === 'submitted' || r.status === 'under_verification').length,
      unmet: mine.filter((r) => r.status === 'unable_to_fulfill' || r.status === 'referred').length,
      oldest
    }
  })
)

const upcoming = useLive<Schedule>(() =>
  query(collection(db, 'distributionSchedules'), where('date', '>=', todayIso()), orderBy('date'), limit(40))
)
const upcomingShown = computed(() =>
  upcoming.items.value
    .filter((s) => (!scopeBarangayId.value || s.barangayId === scopeBarangayId.value) && s.status !== 'cancelled' && s.status !== 'completed')
    .slice(0, 6)
)

const activity = useLive<StatusHistoryEntry>(() => {
  const p = profile.value
  if (!p || p.role === 'provider') return null
  const base = collection(db, 'statusHistory')
  if (p.role === 'barangay_coordinator') {
    const scope = scopeBarangayId.value
    return scope ? query(base, where('barangayId', '==', scope), orderBy('timestamp', 'desc'), limit(8)) : null
  }
  return query(base, orderBy('timestamp', 'desc'), limit(8))
})
</script>

<template>
  <div>
    <h1>Dashboard</h1>
    <p v-if="!isMuni && scopeBarangayId" class="muted">Showing {{ nameOf(scopeBarangayId) }} only.</p>

    <p v-if="error" class="error" role="alert">We could not load requests. Check your connection and permissions, then refresh.</p>
    <p v-else-if="loading" class="muted">Loading…</p>

    <template v-else>
      <p v-if="items.length >= MAX" class="notice small">
        Showing the latest {{ MAX }} requests. Use Reports for a full export.
      </p>

      <div class="grid cols-4 mb">
        <div class="stat"><div class="n">{{ items.length }}</div><div class="l">Requests received</div></div>
        <div class="stat" :class="{ alert: unverified.length }"><div class="n">{{ unverified.length }}</div><div class="l">Waiting for verification</div></div>
        <div class="stat"><div class="n">{{ open.length }}</div><div class="l">Outstanding (not resolved)</div></div>
        <div class="stat" :class="{ alert: unmet.length }"><div class="n">{{ unmet.length }}</div><div class="l">Referred or unable to fulfill</div></div>
        <div class="stat"><div class="n">{{ resolved.length }}</div><div class="l">Resolved</div></div>
        <div class="stat"><div class="n">{{ duplicates.length }}</div><div class="l">Possible duplicates open</div></div>
        <div class="stat"><div class="n">{{ fmtHours(toVerification) }}</div><div class="l">Median time to verify</div></div>
        <div class="stat"><div class="n">{{ fmtHours(toAssistance) }}</div><div class="l">Median verified → assistance</div></div>
      </div>

      <div class="grid cols-2">
        <section class="panel">
          <div class="row between"><h2>Needs verification</h2><RouterLink to="/admin/requests">All requests</RouterLink></div>
          <p v-if="!needsAttention.length" class="muted">Nothing is waiting for verification.</p>
          <div v-else class="table-wrap">
            <table>
              <thead><tr><th>Reference</th><th>Barangay</th><th>Waiting</th></tr></thead>
              <tbody>
                <tr v-for="r in needsAttention" :key="r.id">
                  <td><RouterLink :to="`/admin/requests/${r.id}`" class="mono">{{ r.id }}</RouterLink></td>
                  <td>{{ r.barangayName }}</td>
                  <td>{{ fmtAge(ageDays(r.createdAt)) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="row between"><h2>Upcoming distribution</h2><RouterLink to="/admin/distribution">Manage</RouterLink></div>
          <p v-if="!upcomingShown.length" class="muted">No upcoming schedules.</p>
          <ul v-else style="list-style: none; padding: 0; margin: 0">
            <li v-for="s in upcomingShown" :key="s.id" class="row between" style="padding: 0.4rem 0; border-bottom: 1px solid var(--line)">
              <span>
                <strong>{{ fmtIsoDate(s.date) }}</strong> {{ s.timeStart }}<br />
                <span class="small muted">{{ s.barangayName }} · {{ s.locationName }}</span>
              </span>
              <ScheduleBadge :status="s.status" admin />
            </li>
          </ul>
        </section>
      </div>

      <section v-if="isMuni" class="panel">
        <h2>Demand by barangay</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Barangay</th><th>Outstanding</th><th>Waiting for verification</th><th>Referred / unable</th><th>Oldest outstanding</th></tr></thead>
            <tbody>
              <tr v-for="b in byBarangay" :key="b.id">
                <td>{{ b.name }}</td>
                <td>{{ b.open }}</td>
                <td>{{ b.unverified }}</td>
                <td>{{ b.unmet }}</td>
                <td>{{ fmtAge(b.oldest) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="small muted mt">Counts show reported demand only. Households without internet access or awareness of the app are not represented.</p>
      </section>

      <section class="panel">
        <h2>Recent activity</h2>
        <p v-if="!activity.items.value.length" class="muted">No activity yet.</p>
        <ul v-else style="list-style: none; padding: 0; margin: 0">
          <li v-for="a in activity.items.value" :key="a.id" style="padding: 0.4rem 0; border-bottom: 1px solid var(--line)">
            <RouterLink :to="`/admin/requests/${a.requestId}`" class="mono">{{ a.requestId }}</RouterLink>
            → <StatusBadge :status="a.newStatus" admin />
            <span class="small muted"> · {{ nameFor(a.changedBy) }} · {{ fmtDateTime(a.timestamp) }}</span>
            <span v-if="a.oldStatus" class="small muted"> (was {{ STATUS_LABELS_EN[a.oldStatus] }})</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
