<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { t } from '@/i18n'
import { useAppSettings } from '@/composables/useAppSettings'
import { useLocalRequests } from '@/composables/useLocalRequests'

const { settings } = useAppSettings()
const { list } = useLocalRequests()
</script>

<template>
  <div>
    <h1>{{ t('help.title') }}</h1>

    <section class="card">
      <div class="section-head">
        <span class="ico" aria-hidden="true">📞</span>
        <h2>{{ t('help.noApp') }}</h2>
      </div>
      <p>{{ t('help.noAppBody') }}</p>
      <h3>{{ t('help.contacts') }}</h3>
      <p v-if="!settings.officialContacts.length" class="muted" style="margin-bottom: 0">{{ t('help.noContacts') }}</p>
      <div v-for="(c, i) in settings.officialContacts" :key="i" class="list-row call-row">
        <div>
          <strong>{{ c.label }}</strong>
          <div v-if="c.hours" class="small muted">{{ c.hours }}</div>
        </div>
        <a class="tel" :href="`tel:${c.phone.replace(/[^+\d]/g, '')}`">{{ c.phone }}</a>
      </div>
    </section>

    <section class="card soft">
      <h2>{{ t('help.howTitle') }}</h2>
      <p style="margin-bottom: 0">{{ t('help.how') }}</p>
    </section>

    <section class="card stack">
      <RouterLink v-if="list.length" class="btn secondary block" to="/my-requests">{{ t('myreq.title') }} ({{ list.length }})</RouterLink>
      <RouterLink class="btn secondary block" to="/water-points">📍 {{ t('points.title') }}</RouterLink>
      <RouterLink class="btn secondary block" to="/install">📲 {{ t('help.install') }}</RouterLink>
      <RouterLink class="btn secondary block" to="/privacy">🔒 {{ t('help.privacy') }}</RouterLink>
    </section>
  </div>
</template>
