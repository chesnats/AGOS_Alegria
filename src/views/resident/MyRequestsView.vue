<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { t } from '@/i18n'
import { trackRequest } from '@/lib/api'
import { fmtDateTime } from '@/lib/format'
import StatusBadge from '@/components/StatusBadge.vue'
import { useLocalRequests } from '@/composables/useLocalRequests'
import type { RequestStatus } from '@/lib/constants'

const { list, remove } = useLocalRequests()
const statuses = ref<Record<string, RequestStatus | 'error'>>({})

onMounted(() => {
  for (const r of list.value) {
    trackRequest(r.ref)
      .then((res) => (statuses.value = { ...statuses.value, [r.ref]: res.status }))
      .catch(() => (statuses.value = { ...statuses.value, [r.ref]: 'error' }))
  }
})

function statusOf(refNumber: string): RequestStatus | null {
  const s = statuses.value[refNumber]
  return s && s !== 'error' ? s : null
}
</script>

<template>
  <div>
    <h1>{{ t('myreq.title') }}</h1>
    <p class="small muted">{{ t('myreq.hint') }}</p>
    <p v-if="!list.length" class="muted">{{ t('myreq.empty') }}</p>
    <div v-for="r in list" :key="r.ref" class="card">
      <div class="row between">
        <strong class="mono">{{ r.ref }}</strong>
        <StatusBadge v-if="statusOf(r.ref)" :status="statusOf(r.ref)!" />
      </div>
      <p class="small muted" style="margin: 0.25rem 0">{{ r.barangayName }} · {{ fmtDateTime(r.savedAt) }}</p>
      <div class="row mt">
        <RouterLink class="btn sm" :to="{ name: 'track', query: { ref: r.ref } }">{{ t('myreq.check') }}</RouterLink>
        <button class="btn sm secondary" type="button" @click="remove(r.ref)">{{ t('myreq.remove') }}</button>
      </div>
    </div>
  </div>
</template>
