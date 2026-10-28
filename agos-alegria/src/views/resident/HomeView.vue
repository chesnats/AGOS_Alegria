<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { collection, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { t } from '@/i18n'
import { useLive } from '@/composables/useLive'
import { useLocalRequests } from '@/composables/useLocalRequests'
import { useAppSettings } from '@/composables/useAppSettings'
import ScheduleBadge from '@/components/ScheduleBadge.vue'
import { fmtDateTime, fmtIsoDate, toDate, todayIso } from '@/lib/format'
import type { Announcement, Schedule } from '@/types'

const { items: announcements } = useLive<Announcement>(() =>
  query(collection(db, 'announcements'), where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(3))
)
const { items: schedules } = useLive<Schedule>(() =>
  query(collection(db, 'distributionSchedules'), where('date', '>=', todayIso()), orderBy('date'), limit(10))
)
const { list: saved } = useLocalRequests()
const { settings } = useAppSettings()

const latest = computed(() => announcements.value[0] ?? null)
const upcoming = computed(() => schedules.value.filter((s) => s.status !== 'cancelled').slice(0, 3))

// Operational information always shows how fresh it is.
const lastUpdated = computed(() => {
  const times = [latest.value?.publishedAt, ...schedules.value.map((s) => s.updatedAt)]
    .map((v) => toDate(v))
    .filter((d): d is Date => d !== null)
  return times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null
})
</script>

<template>
  <div>
    <div class="card hero">
      <h1>{{ t('home.title') }}</h1>
      <RouterLink class="btn light block big" to="/request">💧 {{ t('home.requestCta') }}</RouterLink>
      <p class="small mt" style="margin-bottom: 0">{{ t('home.requestHint') }}</p>
    </div>

    <section class="card">
      <div class="section-head">
        <span class="ico" aria-hidden="true">📞</span>
        <h2>{{ t('help.contacts') }}</h2>
      </div>
      <p v-if="!settings.officialContacts.length" class="muted" style="margin-bottom: 0">{{ t('help.noContacts') }}</p>
      <div v-for="(c, i) in settings.officialContacts" :key="i" class="list-row call-row">
        <div>
          <strong>{{ c.label }}</strong>
          <div v-if="c.hours" class="small muted">{{ c.hours }}</div>
        </div>
        <a class="tel" :href="`tel:${c.phone.replace(/[^+\d]/g, '')}`">{{ c.phone }}</a>
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <span class="ico" aria-hidden="true">🚚</span>
        <h2>{{ t('home.upcoming') }}</h2>
      </div>
      <template v-if="upcoming.length">
        <div v-for="s in upcoming" :key="s.id" class="list-row next-up">
          <div class="row between">
            <span class="when">{{ fmtIsoDate(s.date) }}, {{ s.timeStart }}–{{ s.timeEnd }}</span>
            <ScheduleBadge :status="s.status" />
          </div>
          <div>{{ s.barangayName }} · {{ s.locationName }}</div>
        </div>
        <RouterLink class="btn secondary block mt" to="/schedule">{{ t('home.seeAll') }}</RouterLink>
      </template>
      <p v-else class="muted" style="margin-bottom: 0">{{ t('home.noSchedules') }}</p>
      <p v-if="lastUpdated" class="small muted mt" style="margin-bottom: 0">
        {{ t('common.lastUpdated', { time: fmtDateTime(lastUpdated) }) }}
      </p>
    </section>

    <section class="card">
      <div class="section-head">
        <span class="ico" aria-hidden="true">📣</span>
        <h2>{{ t('home.q1') }}</h2>
      </div>
      <template v-if="latest">
        <p class="small muted" style="margin-bottom: 0.25rem">
          {{ t('home.latest') }} · {{ t(`updates.cat.${latest.category || 'general'}`) }} · {{ fmtDateTime(latest.publishedAt) }}
        </p>
        <h3>{{ latest.title }}</h3>
        <p class="pre">{{ latest.body }}</p>
        <RouterLink to="/updates">{{ t('home.seeAll') }}</RouterLink>
      </template>
      <p v-else class="muted" style="margin-bottom: 0">{{ t('home.noUpdates') }}</p>
    </section>

    <section class="card soft stack">
      <RouterLink class="btn secondary block" to="/water-points">📍 {{ t('home.pointsCta') }}</RouterLink>
      <RouterLink class="btn secondary block" to="/track">🔎 {{ t('home.trackCta') }}</RouterLink>
      <RouterLink v-if="saved.length" class="btn secondary block" to="/my-requests">
        📄 {{ t('myreq.title') }} ({{ saved.length }})
      </RouterLink>
      <p class="small muted" style="margin-bottom: 0">{{ t('home.nonDigital') }}</p>
    </section>
  </div>
</template>
