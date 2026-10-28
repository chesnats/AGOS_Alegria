<script setup lang="ts">
import { reactive, ref } from 'vue'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { useStaffList } from '@/composables/useStaffData'
import { slugify, toNumberOrNull } from '@/lib/stats'
import type { Barangay } from '@/types'

const { profile } = useAuth()
const { all, loading } = useBarangays()
const staff = useStaffList()

function coordinatorsOf(id: string): string {
  const names = staff.items.value
    .filter((u) => u.role === 'barangay_coordinator' && u.assignedBarangayId === id && u.active)
    .map((u) => u.displayName)
  return names.length ? names.join(', ') : '–'
}

function blank() {
  return { name: '', code: '', active: true, lat: '', lng: '' }
}
const form = reactive(blank())
const editing = ref<Barangay | null>(null)
const showForm = ref(false)
const busy = ref(false)
const formError = ref('')
const message = ref('')

function startNew(): void {
  Object.assign(form, blank())
  editing.value = null
  formError.value = ''
  message.value = ''
  showForm.value = true
}

function startEdit(b: Barangay): void {
  Object.assign(form, {
    name: b.name,
    code: b.code ?? '',
    active: b.active,
    lat: b.lat != null ? String(b.lat) : '',
    lng: b.lng != null ? String(b.lng) : ''
  })
  editing.value = b
  formError.value = ''
  message.value = ''
  showForm.value = true
}

async function save(): Promise<void> {
  formError.value = ''
  const name = form.name.trim()
  if (name.length < 2) {
    formError.value = 'Enter the barangay name.'
    return
  }
  const id = editing.value?.id ?? slugify(name)
  if (!id) {
    formError.value = 'The name must contain letters or numbers.'
    return
  }
  if (!editing.value && all.value.some((b) => b.id === id)) {
    formError.value = 'A barangay with this name already exists.'
    return
  }
  const lat = toNumberOrNull(form.lat)
  const lng = toNumberOrNull(form.lng)
  if ((lat === null) !== (lng === null) || (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lng as number)))) {
    formError.value = 'Enter both latitude and longitude as numbers, or leave both blank.'
    return
  }
  if (!profile.value) return
  busy.value = true
  try {
    await setDoc(
      doc(db, 'barangays', id),
      { name, code: form.code.trim(), active: form.active, lat, lng, updatedAt: serverTimestamp(), updatedBy: profile.value.uid },
      { merge: true }
    )
    message.value = 'Barangay saved.'
    showForm.value = false
  } catch {
    formError.value = 'The barangay could not be saved. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="row between">
      <h1>Barangays</h1>
      <button class="btn" type="button" @click="startNew">Add barangay</button>
    </div>
    <p class="small muted">
      Residents choose from the active barangays when they request water. Deactivating a barangay hides it from the form; existing requests stay in the system.
      Assign coordinators under <strong>Staff</strong>.
    </p>
    <p v-if="message" class="success" role="status">{{ message }}</p>

    <section v-if="showForm" class="panel">
      <h2>{{ editing ? 'Edit barangay' : 'Add barangay' }}</h2>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="field"><label for="n">Name</label><input id="n" v-model="form.name" type="text" maxlength="80" required /></div>
          <div class="field"><label for="c">Code <span class="hint">(optional, e.g. PSGC)</span></label><input id="c" v-model="form.code" type="text" maxlength="20" /></div>
          <div class="field"><label for="la">Centre latitude <span class="hint">(optional)</span></label><input id="la" v-model="form.lat" type="text" inputmode="decimal" /></div>
          <div class="field"><label for="lo">Centre longitude <span class="hint">(optional)</span></label><input id="lo" v-model="form.lng" type="text" inputmode="decimal" /></div>
        </div>
        <label class="check mb"><input v-model="form.active" type="checkbox" /> Active (shown to residents)</label>
        <div class="row">
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save' }}</button>
          <button class="btn secondary" type="button" @click="showForm = false">Cancel</button>
        </div>
      </form>
    </section>

    <p v-if="loading" class="muted">Loading…</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Code</th><th>Coordinators</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="b in all" :key="b.id">
            <td><strong>{{ b.name }}</strong></td>
            <td>{{ b.code || '–' }}</td>
            <td>{{ coordinatorsOf(b.id) }}</td>
            <td><span class="badge" :class="b.active ? 'ok' : 'muted'">{{ b.active ? 'Active' : 'Inactive' }}</span></td>
            <td><button class="btn sm secondary" type="button" @click="startEdit(b)">Edit</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
