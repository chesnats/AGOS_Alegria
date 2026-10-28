<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { LOCALES, locale, setLocale, t, type Locale } from '@/i18n'
import { useOnline } from '@/composables/useOnline'
import { useAppSettings } from '@/composables/useAppSettings'
import { firebaseConfigured } from '@/firebase'

const online = useOnline()
const { settings } = useAppSettings()

function onLocale(e: Event): void {
  setLocale((e.target as HTMLSelectElement).value as Locale)
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <RouterLink to="/" class="brand" aria-label="AGOS Alegria">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="16" fill="#fff" />
          <path d="M32 10C25 20 17 28.5 17 38a15 15 0 0 0 30 0C47 28.5 39 20 32 10Z" fill="#0b6e8c" />
        </svg>
        <span>AGOS Alegria</span>
      </RouterLink>
      <label class="sr-only" for="lang">{{ t('common.language') }}</label>
      <select id="lang" class="langsel" :value="locale" @change="onLocale">
        <option v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.label }}</option>
      </select>
    </header>

    <div v-if="!firebaseConfigured" class="banner bad" role="alert">{{ t('common.notConfigured') }}</div>
    <div v-if="!online" class="banner warn" role="status">{{ t('common.offline') }}</div>
    <div v-if="settings.maintenanceMode" class="banner warn" role="status">
      {{ settings.maintenanceMessage || 'The app is under maintenance. Some information may be out of date.' }}
    </div>

    <main class="container">
      <RouterView />
    </main>

    <nav class="tabbar" aria-label="Main">
      <RouterLink to="/" exact-active-class="active"><span class="ico" aria-hidden="true">🏠</span>{{ t('nav.home') }}</RouterLink>
      <RouterLink to="/request" class="tab-primary" active-class="active"><span class="ico" aria-hidden="true">💧</span>{{ t('nav.request') }}</RouterLink>
      <RouterLink to="/track" active-class="active"><span class="ico" aria-hidden="true">🔎</span>{{ t('nav.track') }}</RouterLink>
      <RouterLink to="/schedule" active-class="active"><span class="ico" aria-hidden="true">📅</span>{{ t('nav.schedule') }}</RouterLink>
      <RouterLink to="/updates" active-class="active"><span class="ico" aria-hidden="true">📣</span>{{ t('nav.updates') }}</RouterLink>
      <RouterLink to="/help" active-class="active"><span class="ico" aria-hidden="true">☰</span>{{ t('nav.more') }}</RouterLink>
    </nav>
  </div>
</template>
