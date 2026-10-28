<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { useScopedRequests } from '@/composables/useStaffData'
import StatusBadge from '@/components/StatusBadge.vue'
import {
  ISSUE_LABELS_EN,
  ISSUE_TYPES,
  OPEN_STATUSES,
  REQUEST_STATUSES,
  STATUS_LABELS_EN,
  type IssueType,
  type RequestStatus
} from '@/lib/constants'
import { ageDays, fmtAge } from '@/lib/stats'
import { fmtDateTime } from '@/lib/format'

const MAX = 500
const router = useRouter()
const { isMuni } = useAuth()
const { active: barangays } = useBarangays()
const { items, loading, error } = useScopedRequests(MAX)

const search = ref('')
const status = ref<'' | 'open' | RequestStatus>('open')
const barangay = ref('')
const issue = ref<'' | IssueType>('')
const duplicatesOnly = ref(false)

const shown = computed(() => {
  const q = search.value.trim().toUpperCase()
  return items.value.filter((r) => {
    if (q && !r.id.includes(q) && !r.purok.toUpperCase().includes(q)) return false
    if (status.value === 'open' && !OPEN_STATUSES.includes(r.status)) return false
    if (status.value && status.value !== 'open' && r.status !== status.value) return false
    if (barangay.value && r.barangayId !== barangay.value) return false
    if (issue.value && r.issueType !== issue.value) return false
    if (duplicatesOnly.value && !r.possibleDuplicate) return false
    return true
  })
})

function open(id: string): void {
  void router.push(`/admin/requests/${id}`)
}
</script>

<template>
  <div>
    <h1>Requests</h1>

    <div class="toolbar">
      <div class="grow">
        <label for="q">Search reference or purok</label>
        <input id="q" v-model="search" type="search" placeholder="TL-…" />
      </div>
      <div>
        <label for="st">Status</label>
        <select id="st" v-model="status">
          <option value="open">Outstanding (not resolved)</option>
          <option value="">All</option>
          <option v-for="s in REQUEST_STATUSES" :key="s" :value="s">{{ STATUS_LABELS_EN[s] }}</option>
        </select>
      </div>
      <div v-if="isMuni">
        <label for="br">Barangay</label>
        <select id="br" v-model="barangay">
          <option value="">All barangays</option>
          <option v-for="b in barangays" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>
      <div>
        <label for="is">Problem</label>
        <select id="is" v-model="issue">
          <option value="">All</option>
          <option v-for="i in ISSUE_TYPES" :key="i" :value="i">{{ ISSUE_LABELS_EN[i] }}</option>
        </select>
      </div>
      <label class="check" style="flex: 0 0 auto; align-self: center">
        <input v-model="duplicatesOnly" type="checkbox" /> Possible duplicates only
      </label>
    </div>

    <p v-if="error" class="error" role="alert">We could not load requests. Check your connection and permissions, then refresh.</p>
    <p v-else-if="loading" class="muted">Loading…</p>
    <template v-else>
      <p class="small muted">{{ shown.length }} of {{ items.length }} requests{{ items.length >= MAX ? ` (latest ${MAX} loaded)` : '' }}</p>
      <p v-if="!shown.length" class="muted">No requests match these filters.</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr><th>Reference</th><th>Barangay</th><th>Purok</th><th>Problem</th><th>People</th><th>Received</th><th>Age</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in shown" :key="r.id" class="click" @click="open(r.id)">
              <td>
                <RouterLink :to="`/admin/requests/${r.id}`" class="mono" @click.stop>{{ r.id }}</RouterLink>
                <span v-if="r.possibleDuplicate" class="badge warn" style="margin-left: 0.4rem" title="May duplicate an earlier request">⚠ duplicate?</span>
              </td>
              <td>{{ r.barangayName }}</td>
              <td>{{ r.purok }}</td>
              <td>{{ ISSUE_LABELS_EN[r.issueType] }}</td>
              <td>{{ r.householdMembers }}</td>
              <td>{{ fmtDateTime(r.createdAt) }}</td>
              <td>{{ OPEN_STATUSES.includes(r.status) ? fmtAge(ageDays(r.createdAt)) : '–' }}</td>
              <td><StatusBadge :status="r.status" admin /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
