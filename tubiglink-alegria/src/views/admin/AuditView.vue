<script setup lang="ts">
import { computed, ref } from 'vue'
import { collection, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/firebase'
import { useLive } from '@/composables/useLive'
import { useStaffNames } from '@/composables/useStaffData'
import { fmtDateTime } from '@/lib/format'
import type { AuditLog } from '@/types'

const MAX = 300
const { nameFor } = useStaffNames()
const { items, loading, error } = useLive<AuditLog>(() => query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(MAX)))

const text = ref('')
const shown = computed(() => {
  const q = text.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((a) =>
    [a.action, a.recordType, a.recordId, nameFor(a.actorUid)].some((s) => s.toLowerCase().includes(q))
  )
})

function describe(a: AuditLog): string {
  return a.summary && Object.keys(a.summary).length ? JSON.stringify(a.summary) : ''
}
</script>

<template>
  <div>
    <h1>Audit log</h1>
    <p class="small muted">
      Important actions are recorded automatically and cannot be edited: status changes, publishing, staff changes, and every time someone views a
      resident's contact details. Showing the latest {{ MAX }} entries.
    </p>

    <div class="toolbar">
      <div class="grow">
        <label for="f">Filter</label>
        <input id="f" v-model="text" type="search" placeholder="Person, action or record, e.g. contact_viewed" />
      </div>
    </div>

    <p v-if="error" class="error" role="alert">We could not load the audit log.</p>
    <p v-else-if="loading" class="muted">Loading…</p>
    <p v-else-if="!shown.length" class="muted">No entries match.</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
        <tbody>
          <tr v-for="a in shown" :key="a.id">
            <td>{{ fmtDateTime(a.timestamp) }}</td>
            <td>{{ nameFor(a.actorUid) }}</td>
            <td class="mono">{{ a.action }}</td>
            <td><span class="mono">{{ a.recordId }}</span><br /><span class="small muted">{{ a.recordType }}</span></td>
            <td class="small mono" style="word-break: break-all">{{ describe(a) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
