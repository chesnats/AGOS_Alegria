<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import { STATUS_LABELS_EN, STATUS_META, type RequestStatus } from '@/lib/constants'

const props = defineProps<{ status: RequestStatus; admin?: boolean; large?: boolean }>()
const meta = computed(() => STATUS_META[props.status] ?? STATUS_META.submitted)
// Icon + words + colour, so the meaning never depends on colour alone.
const label = computed(() => (props.admin ? STATUS_LABELS_EN[props.status] : t(`status.${props.status}`)))
</script>

<template>
  <span class="badge" :class="[meta.tone, { lg: props.large }]">
    <span aria-hidden="true">{{ meta.icon }}</span>
    <span>{{ label }}</span>
  </span>
</template>
