import { computed, ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferred = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(false)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred.value = e as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    deferred.value = null
  })
  installed.value =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function useInstall() {
  const canInstall = computed(() => deferred.value !== null)
  const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
  async function install(): Promise<void> {
    const ev = deferred.value
    if (!ev) return
    await ev.prompt()
    const choice = await ev.userChoice
    if (choice.outcome === 'accepted') installed.value = true
    deferred.value = null
  }
  return { canInstall, installed, isIos, install }
}
