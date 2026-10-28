<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { useStaffList, type StaffRow } from '@/composables/useStaffData'
import { errorMessage, upsertStaffUser } from '@/lib/api'
import { ROLES, ROLE_LABELS, type Role } from '@/lib/constants'
import { fmtDateTime } from '@/lib/format'

const { profile, isSysAdmin } = useAuth()
const { active: barangays, nameOf } = useBarangays()
const { items, loading, error } = useStaffList()

// Only a system administrator may grant or change administrator roles (the server enforces this too).
const roleOptions = computed<Role[]>(() => (isSysAdmin.value ? [...ROLES] : ['barangay_coordinator', 'provider']))

function canManage(u: StaffRow): boolean {
  return isSysAdmin.value || u.role === 'barangay_coordinator' || u.role === 'provider'
}

function blank() {
  return { email: '', displayName: '', role: 'barangay_coordinator' as Role, assignedBarangayId: '', active: true }
}
const form = reactive(blank())
const editing = ref<StaffRow | null>(null)
const showForm = ref(false)
const busy = ref(false)
const formError = ref('')
const message = ref('')
const resetLink = ref('')
const copied = ref(false)

function startNew(): void {
  Object.assign(form, blank())
  editing.value = null
  formError.value = ''
  message.value = ''
  resetLink.value = ''
  showForm.value = true
}

function startEdit(u: StaffRow): void {
  Object.assign(form, {
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    assignedBarangayId: u.assignedBarangayId ?? '',
    active: u.active
  })
  editing.value = u
  formError.value = ''
  message.value = ''
  resetLink.value = ''
  showForm.value = true
}

async function submit(payload: { email: string; displayName: string; role: Role; assignedBarangayId: string; active: boolean }): Promise<boolean> {
  const res = await upsertStaffUser({
    email: payload.email.trim().toLowerCase(),
    displayName: payload.displayName.trim(),
    role: payload.role,
    assignedBarangayId: payload.role === 'barangay_coordinator' ? payload.assignedBarangayId : null,
    active: payload.active
  })
  if (res.created && res.resetLink) {
    resetLink.value = res.resetLink
    message.value = `Account created for ${payload.email}. Send them the password link below through a private channel.`
  } else {
    message.value = 'Staff account updated.'
  }
  return true
}

async function save(): Promise<void> {
  formError.value = ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return void (formError.value = 'Enter a valid email address.')
  if (form.displayName.trim().length < 2) return void (formError.value = 'Enter the person’s name.')
  if (form.role === 'barangay_coordinator' && !form.assignedBarangayId) return void (formError.value = 'Choose the barangay this coordinator is responsible for.')
  busy.value = true
  copied.value = false
  try {
    await submit(form)
    showForm.value = false
  } catch (err) {
    formError.value = errorMessage(err, 'The account could not be saved. Please try again.')
  } finally {
    busy.value = false
  }
}

async function toggleActive(u: StaffRow): Promise<void> {
  message.value = ''
  resetLink.value = ''
  try {
    await submit({
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      assignedBarangayId: u.assignedBarangayId ?? '',
      active: !u.active
    })
    message.value = u.active ? `${u.displayName} can no longer sign in.` : `${u.displayName} can sign in again.`
  } catch (err) {
    message.value = errorMessage(err, 'The change could not be saved.')
  }
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(resetLink.value)
    copied.value = true
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div>
    <div class="row between">
      <h1>Staff accounts</h1>
      <button class="btn" type="button" @click="startNew">Add staff member</button>
    </div>
    <p class="small muted">
      Give each person their own account. Remove access the same day someone leaves their role. Administrators should also turn on
      two-step verification in Firebase.
    </p>
    <p v-if="message" class="success" role="status">{{ message }}</p>
    <div v-if="resetLink" class="notice">
      <strong>One-time password link</strong> (shown once; send it privately, never in a group chat):
      <input :value="resetLink" type="text" readonly style="margin: 0.5rem 0" @focus="($event.target as HTMLInputElement).select()" />
      <button class="btn sm secondary" type="button" @click="copyLink">{{ copied ? 'Copied' : 'Copy link' }}</button>
    </div>

    <section v-if="showForm" class="panel">
      <h2>{{ editing ? 'Edit staff member' : 'Add staff member' }}</h2>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="field"><label for="e">Email</label><input id="e" v-model="form.email" type="email" required :readonly="!!editing" /></div>
          <div class="field"><label for="n">Full name</label><input id="n" v-model="form.displayName" type="text" maxlength="80" required /></div>
          <div class="field">
            <label for="r">Role</label>
            <select id="r" v-model="form.role">
              <option v-for="r in roleOptions" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
            </select>
          </div>
          <div v-if="form.role === 'barangay_coordinator'" class="field">
            <label for="b">Barangay</label>
            <select id="b" v-model="form.assignedBarangayId" required>
              <option value="" disabled>Choose…</option>
              <option v-for="b in barangays" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
        </div>
        <label class="check mb"><input v-model="form.active" type="checkbox" /> Account is active</label>
        <div class="row">
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save' }}</button>
          <button class="btn secondary" type="button" @click="showForm = false">Cancel</button>
        </div>
      </form>
    </section>

    <p v-if="error" class="error" role="alert">We could not load staff accounts.</p>
    <p v-else-if="loading" class="muted">Loading…</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Barangay</th><th>Status</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          <tr v-for="u in items" :key="u.id">
            <td><strong>{{ u.displayName }}</strong></td>
            <td>{{ u.email }}</td>
            <td>{{ ROLE_LABELS[u.role] }}</td>
            <td>{{ u.assignedBarangayId ? nameOf(u.assignedBarangayId) : '–' }}</td>
            <td><span class="badge" :class="u.active ? 'ok' : 'muted'">{{ u.active ? 'Active' : 'Deactivated' }}</span></td>
            <td>{{ fmtDateTime(u.updatedAt) }}</td>
            <td>
              <div v-if="canManage(u) && u.id !== profile?.uid" class="row" style="flex-wrap: nowrap">
                <button class="btn sm secondary" type="button" @click="startEdit(u)">Edit</button>
                <button class="btn sm" :class="u.active ? 'danger' : 'secondary'" type="button" @click="toggleActive(u)">
                  {{ u.active ? 'Deactivate' : 'Reactivate' }}
                </button>
              </div>
              <span v-else class="small muted">{{ u.id === profile?.uid ? 'You' : 'Protected' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
