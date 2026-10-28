<script setup lang="ts">
import { onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { t } from '@/i18n'
import { useInstall } from '@/composables/useInstall'

const { canInstall, installed, isIos, install } = useInstall()

const link = window.location.origin
const qr = ref('')
const copied = ref(false)
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

onMounted(async () => {
  try {
    qr.value = await QRCode.toDataURL(link, { margin: 1, width: 360 })
  } catch {
    qr.value = ''
  }
})

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(link)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* link is shown on screen anyway */
  }
}

async function share(): Promise<void> {
  try {
    await navigator.share({ title: 'AGOS Alegria', url: link })
  } catch {
    /* user cancelled */
  }
}
</script>

<template>
  <div>
    <h1>{{ t('install.title') }}</h1>
    <p class="muted">{{ t('install.intro') }}</p>

    <p v-if="installed" class="success">✔ {{ t('install.installed') }}</p>
    <button v-else-if="canInstall" class="btn block big mb" type="button" @click="install">📲 {{ t('install.button') }}</button>

    <section class="card" :style="isIos ? 'order: 2' : ''">
      <h2>🤖 {{ t('install.android') }}</h2>
      <ol style="padding-left: 1.2rem; margin: 0">
        <li>{{ t('install.a1') }}</li>
        <li>{{ t('install.a2') }}</li>
        <li>{{ t('install.a3') }}</li>
      </ol>
    </section>

    <section class="card">
      <h2>🍎 {{ t('install.ios') }}</h2>
      <ol style="padding-left: 1.2rem; margin: 0">
        <li>{{ t('install.i1') }}</li>
        <li>{{ t('install.i2') }}</li>
        <li>{{ t('install.i3') }}</li>
      </ol>
    </section>

    <section class="card center">
      <h2>{{ t('install.link') }}</h2>
      <p class="mono" style="word-break: break-all">{{ link }}</p>
      <div class="row" style="justify-content: center">
        <button class="btn secondary sm" type="button" @click="copy">{{ copied ? t('common.copied') : t('common.copy') }}</button>
        <button v-if="canShare" class="btn secondary sm" type="button" @click="share">{{ t('common.share') }}</button>
      </div>
      <template v-if="qr">
        <img class="qr mt" :src="qr" :alt="t('install.qr')" />
        <p class="small muted">{{ t('install.qr') }}</p>
      </template>
    </section>
  </div>
</template>
