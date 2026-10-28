<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/firebase'
import { homeFor, useAuth } from '@/composables/useAuth'

const route = useRoute()
const router = useRouter()
const { signIn, profile } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const info = ref('')
const busy = ref(false)

async function forgot(): Promise<void> {
  error.value = ''
  info.value = ''
  if (!email.value.trim()) {
    error.value = 'Enter your email address first, then choose “Forgot password”.'
    return
  }
  try {
    await sendPasswordResetEmail(auth, email.value.trim())
  } catch {
    /* Do not reveal whether the address belongs to an account. */
  }
  info.value = 'If that address belongs to a staff account, a password reset link is on its way.'
}

function safeRedirect(): string | null {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/admin') && !r.startsWith('//') ? r : null
}

async function submit(): Promise<void> {
  error.value = ''
  busy.value = true
  try {
    await signIn(email.value.trim(), password.value)
    await router.replace(safeRedirect() ?? homeFor(profile.value?.role))
  } catch (err) {
    const e = err as { code?: string; message?: string }
    if (e.message === 'no-staff-profile') {
      error.value = 'This account is not an active staff account. Please ask a municipal administrator.'
    } else if (e.code === 'auth/multi-factor-auth-required') {
      error.value = 'This account requires a second verification step, which this screen does not support yet. Please contact the system administrator.'
    } else if (e.code === 'auth/too-many-requests') {
      error.value = 'Too many attempts. Please wait a few minutes and try again.'
    } else if (e.code === 'auth/network-request-failed') {
      error.value = 'No connection. Check your internet and try again.'
    } else if (
      ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(e.code ?? '')
    ) {
      error.value = 'Email or password is incorrect.'
    } else {
      error.value = 'We could not sign you in. Please try again.'
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="login">
    <div class="card">
      <h1>Staff sign in</h1>
      <p class="muted small">For barangay coordinators, municipal staff and delivery operators. Residents do not need an account.</p>
      <div v-if="error" class="error" role="alert">{{ error }}</div>
      <div v-if="info" class="success" role="status">{{ info }}</div>
      <form @submit.prevent="submit">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="username" required />
        </div>
        <div class="field">
          <label for="pw">Password</label>
          <input id="pw" v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <button class="btn block" type="submit" :disabled="busy || !email || !password">
          {{ busy ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <p class="small mt center"><button class="btn sm secondary" type="button" @click="forgot">Forgot password?</button></p>
      <p class="small center"><RouterLink to="/">Back to the public app</RouterLink></p>
    </div>
  </main>
</template>
