<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import type { ScheduleStatus } from '@/lib/constants'

const props = defineProps<{ status: ScheduleStatus; admin?: boolean; large?: boolean }>()

const META: Record<ScheduleStatus, { icon: string; tone: string; en: string }> = {
  planned: { icon: '🕓', tone: 'warn', en: 'Planned, not yet confirmed' },
  confirmed: { icon: '✅', tone: 'ok', en: 'Confirmed' },
  in_progress: { icon: '🚚', tone: 'ok', en: 'Under way' },
  completed: { icon: '💧', tone: 'muted', en: 'Completed' },
  cancelled: { icon: '⛔', tone: 'bad', en: 'Cancelled' }
}
const meta = computed(() => META[props.status] ?? META.planned)
const label = computed(() => (props.admin ? meta.value.en : t(`sched.${props.status}`)))
</script>

<template>
  <span class="badge" :class="[meta.tone, { lg: props.large }]">
    <span aria-hidden="true">{{ meta.icon }}</span>
    <span>{{ label }}</span>
  </span>
</template>
