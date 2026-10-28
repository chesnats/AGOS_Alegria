<script setup lang="ts">
import { useRouter } from 'vue-router'
import { LOCALES, locale, setLocale, t } from '@/i18n'

const router = useRouter()

function start(): void {
  try {
    localStorage.setItem('tl.welcomed', '1')
  } catch {
    /* ignore */
  }
  router.replace('/')
}
</script>

<template>
  <div class="container center" style="padding-top: 3rem">
    <svg viewBox="0 0 64 64" width="96" height="96" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0b6e8c" />
      <path d="M32 10C25 20 17 28.5 17 38a15 15 0 0 0 30 0C47 28.5 39 20 32 10Z" fill="#fff" />
    </svg>
    <h1 class="mt">{{ t('welcome.title') }}</h1>
    <p class="muted">{{ t('welcome.body') }}</p>

    <div class="card mt" style="text-align: left">
      <p class="lbl">{{ t('welcome.lang') }}</p>
      <div class="chips">
        <button
          v-for="l in LOCALES"
          :key="l.code"
          type="button"
          class="btn sm"
          :class="{ secondary: locale !== l.code }"
          @click="setLocale(l.code)"
        >
          {{ l.label }}
        </button>
      </div>
    </div>

    <button type="button" class="btn block big mt" @click="start">{{ t('welcome.start') }}</button>
    <p class="mt small"><RouterLink to="/install" @click="start">{{ t('help.install') }}</RouterLink></p>
  </div>
</template>
