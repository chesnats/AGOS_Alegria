<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { t } from '@/i18n'
import { errorMessage, trackRequest } from '@/lib/api'
import { fmtDateTime } from '@/lib/format'
import StatusBadge from '@/components/StatusBadge.vue'
import { useLocalRequests } from '@/composables/useLocalRequests'
import { useOnline } from '@/composables/useOnline'
import type { TrackResult } from '@/types'

const route = useRoute()
const online = useOnline()
const { add, has } = useLocalRequests()

const input = ref('')
const result = shallowRef<TrackResult | null>(null)
const error = ref('')
const busy = ref(false)

function normalise(v: string): string {
  return v.toUpperCase().replace(/\s+/g, '')
}

async function search(): Promise<void> {
  error.value = ''
  result.value = null
  const ref = normalise(input.value)
  if (!ref) return
  if (!online.value) {
    error.value = t('common.offline')
    return
  }
  busy.value = true
  try {
    result.value = await trackRequest(ref)
  } catch (err) {
    const code = (err as { code?: string }).code
    error.value = code === 'functions/not-found' || code === 'functions/invalid-argument' ? t('track.notFound') : errorMessage(err, t('common.error'))
  } finally {
    busy.value = false
  }
}

function save(): void {
  if (result.value) add({ ref: result.value.referenceNumber, barangayName: result.value.barangayName })
}

onMounted(() => {
  const q = route.query.ref
  if (typeof q === 'string' && q) {
    input.value = q
    void search()
  }
})
</script>

<template>
  <div>
    <h1>{{ t('track.title') }}</h1>
    <form class="field" @submit.prevent="search">
      <label for="ref">{{ t('track.enter') }}</label>
      <input
        id="ref"
        v-model="input"
        type="text"
        class="mono"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        maxlength="20"
        :placeholder="t('track.placeholder')"
      />
      <button class="btn block mt" type="submit" :disabled="busy || !input.trim()">
        {{ busy ? t('common.loading') : t('track.search') }}
      </button>
    </form>

    <div v-if="error" class="error" role="alert">{{ error }}</div>

    <template v-if="result">
      <div class="card">
        <div class="row between">
          <span class="mono"><strong>{{ result.referenceNumber }}</strong></span>
          <StatusBadge :status="result.status" />
        </div>
        <p class="mt">
          <strong>{{ t('track.meaning') }}:</strong> {{ t('statusDesc.' + result.status) }}
        </p>
        <p v-if="result.lastPublicNote" class="notice">{{ result.lastPublicNote }}</p>
        <dl class="kv small">
          <dt>{{ t('track.barangay') }}</dt>
          <dd>{{ result.barangayName }}</dd>
          <dt>{{ t('track.submitted') }}</dt>
          <dd>{{ fmtDateTime(result.createdAt) }}</dd>
          <dt>{{ t('track.updated') }}</dt>
          <dd>{{ fmtDateTime(result.updatedAt) }}</dd>
        </dl>
        <button v-if="!has(result.referenceNumber)" class="btn secondary sm mt" type="button" @click="save">
          {{ t('track.save') }}
        </button>
        <p v-else class="small muted mt" style="margin-bottom: 0">✔ {{ t('track.saved') }}</p>
      </div>

      <div class="card">
        <h2>{{ t('track.timeline') }}</h2>
        <ul class="timeline">
          <li v-for="(e, i) in result.timeline" :key="i">
            <StatusBadge :status="e.status" />
            <div class="small muted">{{ fmtDateTime(e.at) }}</div>
            <div v-if="e.note">{{ e.note }}</div>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
