<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { collection, doc, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { t } from '@/i18n'
import { useLive, useLiveDoc } from '@/composables/useLive'
import { useBarangays } from '@/composables/useBarangays'
import type { ShortageStats, WaterPoint } from '@/types'
import type { ShortageLevel } from '@/lib/constants'

// Leaflet is only downloaded when the map tab is opened.
const WaterMap = defineAsyncComponent(() => import('@/components/WaterMap.vue'))

const { active: barangays } = useBarangays()
const view = ref<'list' | 'map'>('list')

const { items, loading, error } = useLive<WaterPoint>(() =>
  query(collection(db, 'waterPoints'), where('published', '==', true))
)
const points = computed(() => [...items.value].sort((a, b) => a.name.localeCompare(b.name)))

// Aggregated per-barangay level published by a Cloud Function. No counts, no households.
const { data: stats } = useLiveDoc<ShortageStats>(() => doc(db, 'publicStats', 'shortage'))

function levelOf(id: string): ShortageLevel {
  return stats.value?.barangays?.[id]?.level ?? 'none'
}
const TONE: Record<ShortageLevel, string> = { none: 'ok', low: 'info', moderate: 'warn', high: 'bad' }
const ICON: Record<ShortageLevel, string> = { none: '✔', low: '▪', moderate: '▲', high: '⬣' }
</script>

<template>
  <div>
    <h1>{{ t('points.title') }}</h1>
    <p class="muted">{{ t('points.intro') }}</p>

    <div class="tabs mb" role="tablist">
      <button type="button" role="tab" :class="{ on: view === 'list' }" :aria-selected="view === 'list'" @click="view = 'list'">{{ t('points.list') }}</button>
      <button type="button" role="tab" :class="{ on: view === 'map' }" :aria-selected="view === 'map'" @click="view = 'map'">{{ t('points.map') }}</button>
    </div>

    <p v-if="loading" class="muted">{{ t('common.loading') }}</p>
    <p v-else-if="error" class="error">{{ t('common.error') }}</p>
    <p v-else-if="!points.length" class="muted">{{ t('points.empty') }}</p>

    <WaterMap v-if="view === 'map'" :points="points" />

    <template v-else>
      <article v-for="p in points" :key="p.id" class="card">
        <div class="row between">
          <h2 style="margin: 0">{{ p.name }}</h2>
          <span class="badge" :class="p.status === 'operational' ? 'ok' : p.status === 'limited' ? 'warn' : 'bad'">
            {{ t(`points.${p.status}`) }}
          </span>
        </div>
        <p class="small muted" style="margin: 0.25rem 0">{{ p.barangayName }} · {{ p.addressDescription }}</p>
        <p v-if="p.accessInstructions" style="margin-bottom: 0">
          <strong>{{ t('points.access') }}:</strong> {{ p.accessInstructions }}
        </p>
      </article>
    </template>

    <section class="card mt">
      <h2>{{ t('points.shortage') }}</h2>
      <div v-for="b in barangays" :key="b.id" class="row between list-row">
        <span>{{ b.name }}</span>
        <span class="badge" :class="TONE[levelOf(b.id)]">
          <span aria-hidden="true">{{ ICON[levelOf(b.id)] }}</span> {{ t(`points.level.${levelOf(b.id)}`) }}
        </span>
      </div>
      <p class="small muted mt" style="margin-bottom: 0">{{ t('points.levelNote') }}</p>
    </section>
  </div>
</template>
