<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { t } from '@/i18n'
</script>

<template>
  <div class="center" style="padding-top: 2rem">
    <h1>{{ t('notfound.title') }}</h1>
    <p class="muted">{{ t('notfound.body') }}</p>
    <RouterLink class="btn" to="/">{{ t('done.home') }}</RouterLink>
  </div>
</template>
