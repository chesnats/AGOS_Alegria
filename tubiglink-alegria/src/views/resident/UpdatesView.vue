<script setup lang="ts">
import { computed, ref } from 'vue'
import { collection, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { t } from '@/i18n'
import { useLive } from '@/composables/useLive'
import { useBarangays } from '@/composables/useBarangays'
import { fmtDateTime } from '@/lib/format'
import type { Announcement } from '@/types'

const { active: barangays, nameOf } = useBarangays()
const filter = ref('')

const { items, loading, error } = useLive<Announcement>(() =>
  query(collection(db, 'announcements'), where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(50))
)

// An empty target list means municipality-wide.
const shown = computed(() =>
  items.value.filter(
    (a) => !filter.value || !a.targetBarangayIds?.length || a.targetBarangayIds.includes(filter.value)
  )
)

function coverage(a: Announcement): string {
  if (!a.targetBarangayIds?.length) return t('common.municipalityWide')
  return a.targetBarangayIds.map((id) => nameOf(id)).join(', ')
}
</script>

<template>
  <div>
    <h1>{{ t('updates.title') }}</h1>
    <div class="field">
      <label for="f">{{ t('updates.filter') }}</label>
      <select id="f" v-model="filter">
        <option value="">{{ t('common.all') }}</option>
        <option v-for="b in barangays" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
    </div>

    <p v-if="loading" class="muted">{{ t('common.loading') }}</p>
    <p v-else-if="error" class="error">{{ t('common.error') }}</p>
    <p v-else-if="!shown.length" class="muted">{{ t('updates.empty') }}</p>

    <article v-for="a in shown" :key="a.id" class="card">
      <div class="row between small muted">
        <span class="badge" :class="a.category === 'emergency' ? 'bad' : 'info'">{{ t(`updates.cat.${a.category || 'general'}`) }}</span>
        <span>{{ fmtDateTime(a.publishedAt) }}</span>
      </div>
      <h2 class="mt">{{ a.title }}</h2>
      <p class="pre">{{ a.body }}</p>
      <p class="small muted" style="margin-bottom: 0">📍 {{ coverage(a) }}</p>
    </article>
  </div>
</template>
