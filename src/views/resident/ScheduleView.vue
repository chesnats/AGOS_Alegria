<script setup lang="ts">
import { computed, ref } from 'vue'
import { collection, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { t } from '@/i18n'
import { useLive } from '@/composables/useLive'
import { useBarangays } from '@/composables/useBarangays'
import ScheduleBadge from '@/components/ScheduleBadge.vue'
import { fmtDateTime, fmtIsoDate, todayIso } from '@/lib/format'
import type { Schedule } from '@/types'

const { active: barangays } = useBarangays()
const filter = ref('')

// Upcoming plus the last week, so recent completions and cancellations stay visible.
const { items, loading, error } = useLive<Schedule>(() =>
  query(collection(db, 'distributionSchedules'), where('date', '>=', todayIso(-7)), orderBy('date'))
)

const shown = computed(() => items.value.filter((s) => !filter.value || s.barangayId === filter.value))
</script>

<template>
  <div>
    <h1>{{ t('sched.title') }}</h1>
    <p class="small muted">{{ t('sched.intro') }}</p>

    <div class="field">
      <label for="f">{{ t('updates.filter') }}</label>
      <select id="f" v-model="filter">
        <option value="">{{ t('common.all') }}</option>
        <option v-for="b in barangays" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
    </div>

    <p v-if="loading" class="muted">{{ t('common.loading') }}</p>
    <p v-else-if="error" class="error">{{ t('common.error') }}</p>
    <p v-else-if="!shown.length" class="muted">{{ t('sched.empty') }}</p>

    <div v-for="s in shown" :key="s.id" class="card next-up" :style="s.status === 'cancelled' ? 'opacity: .75' : ''">
      <div class="row between">
        <span class="when">{{ fmtIsoDate(s.date) }}</span>
        <ScheduleBadge :status="s.status" large />
      </div>
      <dl class="kv mt small">
        <dt>{{ t('sched.when') }}</dt>
        <dd>{{ s.timeStart }}–{{ s.timeEnd }}</dd>
        <dt>{{ t('track.barangay') }}</dt>
        <dd>{{ s.barangayName }}</dd>
        <dt>{{ t('sched.where') }}</dt>
        <dd>{{ s.locationName }}</dd>
        <dt>{{ t('sched.quantity') }}</dt>
        <dd>{{ s.estimatedQuantityLiters ? t('sched.liters', { n: s.estimatedQuantityLiters.toLocaleString() }) : t('sched.unknown') }}</dd>
        <template v-if="s.status === 'completed' && typeof s.quantityDistributed === 'number'">
          <dt>{{ t('sched.delivered') }}</dt>
          <dd>{{ t('sched.liters', { n: s.quantityDistributed.toLocaleString() }) }}</dd>
        </template>
      </dl>
      <p v-if="s.changeNote" class="notice small mt" style="margin-bottom: 0"><strong>{{ t('sched.change') }}:</strong> {{ s.changeNote }}</p>
      <p v-if="s.notes" class="small mt pre" style="margin-bottom: 0">{{ s.notes }}</p>
      <p class="small muted mt" style="margin-bottom: 0">{{ t('common.lastUpdated', { time: fmtDateTime(s.updatedAt) }) }}</p>
    </div>
  </div>
</template>
