<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { addDoc, collection, doc, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { useLive } from '@/composables/useLive'
import { SOURCE_TYPES, WATER_POINT_STATUSES, type SourceType, type WaterPointStatus } from '@/lib/constants'
import { fmtDateTime } from '@/lib/format'
import { toNumberOrNull } from '@/lib/stats'
import type { WaterPoint } from '@/types'

const STATUS_LABEL: Record<WaterPointStatus, string> = { operational: 'Operating', limited: 'Limited supply', closed: 'Closed' }
const SOURCE_LABEL: Record<SourceType, string> = {
  deepwell: 'Deep well',
  spring: 'Spring',
  refill_station: 'Refilling station',
  tank: 'Water tank',
  other: 'Other'
}

const { profile, isMuni, scopeBarangayId } = useAuth()
const { active: barangays, nameOf } = useBarangays()

const { items, loading, error } = useLive<WaterPoint>(() => (profile.value ? query(collection(db, 'waterPoints')) : null))
const sorted = computed(() => [...items.value].sort((a, b) => a.barangayName.localeCompare(b.barangayName) || a.name.localeCompare(b.name)))

function editable(p: WaterPoint): boolean {
  return isMuni.value || p.barangayId === scopeBarangayId.value
}

function blank() {
  return {
    name: '',
    barangayId: scopeBarangayId.value ?? '',
    addressDescription: '',
    accessInstructions: '',
    lat: '',
    lng: '',
    status: 'operational' as WaterPointStatus,
    sourceType: 'deepwell' as SourceType,
    published: false
  }
}
const form = reactive(blank())
const editing = ref<WaterPoint | null>(null)
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

function startEdit(p: WaterPoint): void {
  Object.assign(form, {
    name: p.name,
    barangayId: p.barangayId,
    addressDescription: p.addressDescription ?? '',
    accessInstructions: p.accessInstructions ?? '',
    lat: p.lat != null ? String(p.lat) : '',
    lng: p.lng != null ? String(p.lng) : '',
    status: p.status,
    sourceType: p.sourceType,
    published: p.published
  })
  editing.value = p
  formError.value = ''
  message.value = ''
  showForm.value = true
}

function validate(): string {
  if (form.name.trim().length < 2) return 'Enter the name of the water point.'
  if (!form.barangayId) return 'Choose a barangay.'
  const lat = toNumberOrNull(form.lat)
  const lng = toNumberOrNull(form.lng)
  if ((lat === null) !== (lng === null)) return 'Enter both latitude and longitude, or leave both blank.'
  if (lat !== null && lng !== null) {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.'
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.'
  }
  if (form.published && !form.addressDescription.trim()) return 'Describe where the water point is before publishing it.'
  return ''
}

async function save(): Promise<void> {
  formError.value = validate()
  if (formError.value || !profile.value) return
  busy.value = true
  const prev = editing.value
  try {
    const data = {
      name: form.name.trim(),
      barangayId: form.barangayId,
      barangayName: nameOf(form.barangayId),
      addressDescription: form.addressDescription.trim(),
      accessInstructions: form.accessInstructions.trim(),
      lat: toNumberOrNull(form.lat),
      lng: toNumberOrNull(form.lng),
      status: form.status,
      sourceType: form.sourceType,
      published: form.published,
      updatedAt: serverTimestamp(),
      updatedBy: profile.value.uid
    }
    if (prev) {
      const { barangayId: _b, barangayName: _n, ...rest } = data // a water point never moves between barangays
      await updateDoc(doc(db, 'waterPoints', prev.id), rest)
    } else {
      await addDoc(collection(db, 'waterPoints'), data)
    }
    message.value = 'Water point saved.'
    showForm.value = false
  } catch {
    formError.value = 'The water point could not be saved. Check your permissions and connection, then try again.'
  } finally {
    busy.value = false
  }
}

async function togglePublished(p: WaterPoint): Promise<void> {
  if (!profile.value) return
  message.value = ''
  try {
    await updateDoc(doc(db, 'waterPoints', p.id), {
      published: !p.published,
      updatedAt: serverTimestamp(),
      updatedBy: profile.value.uid
    })
  } catch {
    message.value = 'The change could not be saved.'
  }
}
</script>

<template>
  <div>
    <div class="row between">
      <h1>Water points</h1>
      <button class="btn" type="button" @click="startNew">New water point</button>
    </div>
    <p class="small muted">
      Only verified, public collection points belong here. Do not enter private wells or household addresses. A water point is shown to
      residents only when it is <strong>published</strong>.
    </p>
    <p v-if="message" class="success" role="status">{{ message }}</p>

    <section v-if="showForm" class="panel">
      <h2>{{ editing ? 'Edit water point' : 'New water point' }}</h2>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="field"><label for="n">Name</label><input id="n" v-model="form.name" type="text" maxlength="120" required /></div>
          <div class="field">
            <label for="b">Barangay</label>
            <select id="b" v-model="form.barangayId" :disabled="!isMuni || !!editing" required>
              <option value="" disabled>Choose…</option>
              <option v-for="b in barangays" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="field">
            <label for="s">Status</label>
            <select id="s" v-model="form.status"><option v-for="s in WATER_POINT_STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option></select>
          </div>
          <div class="field">
            <label for="t">Source</label>
            <select id="t" v-model="form.sourceType"><option v-for="s in SOURCE_TYPES" :key="s" :value="s">{{ SOURCE_LABEL[s] }}</option></select>
          </div>
          <div class="field"><label for="la">Latitude <span class="hint">(optional)</span></label><input id="la" v-model="form.lat" type="text" inputmode="decimal" placeholder="9.7243" /></div>
          <div class="field"><label for="lo">Longitude <span class="hint">(optional)</span></label><input id="lo" v-model="form.lng" type="text" inputmode="decimal" placeholder="123.3402" /></div>
        </div>
        <div class="field"><label for="a">Where is it?</label><input id="a" v-model="form.addressDescription" type="text" maxlength="200" placeholder="Beside the barangay hall, Purok 2" /></div>
        <div class="field"><label for="i">Access instructions <span class="hint">(hours, containers, who may use it)</span></label><textarea id="i" v-model="form.accessInstructions" maxlength="400" /></div>
        <label class="check mb"><input v-model="form.published" type="checkbox" /> Published: I have verified this water point and residents may see it</label>
        <div class="row">
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save water point' }}</button>
          <button class="btn secondary" type="button" @click="showForm = false">Cancel</button>
        </div>
      </form>
    </section>

    <p v-if="error" class="error" role="alert">We could not load water points.</p>
    <p v-else-if="loading" class="muted">Loading…</p>
    <p v-else-if="!sorted.length" class="muted">No water points yet.</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Barangay</th><th>Source</th><th>Status</th><th>Public</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          <tr v-for="p in sorted" :key="p.id">
            <td><strong>{{ p.name }}</strong><br /><span class="small muted">{{ p.addressDescription }}</span></td>
            <td>{{ p.barangayName }}</td>
            <td>{{ SOURCE_LABEL[p.sourceType] ?? p.sourceType }}</td>
            <td>{{ STATUS_LABEL[p.status] ?? p.status }}</td>
            <td><span class="badge" :class="p.published ? 'ok' : 'warn'">{{ p.published ? 'Published' : 'Hidden' }}</span></td>
            <td>{{ fmtDateTime(p.updatedAt) }}</td>
            <td>
              <div v-if="editable(p)" class="row" style="flex-wrap: nowrap">
                <button class="btn sm secondary" type="button" @click="startEdit(p)">Edit</button>
                <button class="btn sm secondary" type="button" @click="togglePublished(p)">{{ p.published ? 'Hide' : 'Publish' }}</button>
              </div>
              <span v-else class="small muted">Read only</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
