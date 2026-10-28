<script setup lang="ts">
import { t } from '@/i18n'
import { useAppSettings } from '@/composables/useAppSettings'
import { PRIVACY_NOTICE_VERSION } from '@/lib/constants'

const { settings } = useAppSettings()
const sections = [1, 2, 3, 4, 5, 6]
</script>

<template>
  <div>
    <h1>{{ t('privacy.title') }}</h1>
    <p class="notice small">{{ t('privacy.draft', { version: PRIVACY_NOTICE_VERSION }) }}</p>
    <section v-for="n in sections" :key="n" class="card">
      <h2>{{ t(`privacy.h${n}`) }}</h2>
      <p style="margin-bottom: 0">{{ t(`privacy.p${n}`) }}</p>
    </section>
    <p v-if="settings.privacyContact" class="small muted mt">{{ settings.privacyContact }}</p>
  </div>
</template>
