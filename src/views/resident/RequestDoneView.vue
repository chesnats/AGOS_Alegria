<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { t } from '@/i18n'

const props = defineProps<{ reference: string }>()
const copied = ref(false)

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.reference)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* clipboard unavailable: the number is still on screen */
  }
}
</script>

<template>
  <div>
    <div class="success" role="status"><strong>✅ {{ t('done.title') }}</strong></div>
    <div class="card">
      <p class="muted" style="margin-bottom: 0.4rem">{{ t('done.ref') }}</p>
      <div class="refnum" aria-live="polite">{{ props.reference }}</div>
      <button class="btn secondary block mt" type="button" @click="copy">
        {{ copied ? t('common.copied') : t('common.copy') }}
      </button>
      <p class="small mt" style="margin-bottom: 0"><strong>{{ t('done.save') }}</strong></p>
    </div>

    <div class="card">
      <h2>{{ t('done.next') }}</h2>
      <ol style="padding-left: 1.2rem; margin: 0">
        <li>{{ t('done.n1') }}</li>
        <li>{{ t('done.n2') }}</li>
        <li>{{ t('done.n3') }}</li>
      </ol>
    </div>
    <p class="notice small">{{ t('done.notice') }}</p>

    <RouterLink class="btn block" :to="{ name: 'track', query: { ref: props.reference } }">🔎 {{ t('done.track') }}</RouterLink>
    <RouterLink class="btn secondary block mt" to="/">{{ t('done.home') }}</RouterLink>
  </div>
</template>
