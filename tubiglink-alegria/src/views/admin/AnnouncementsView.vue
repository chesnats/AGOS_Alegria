<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { addDoc, collection, doc, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useBarangays } from '@/composables/useBarangays'
import { useLive } from '@/composables/useLive'
import { ANNOUNCEMENT_CATEGORIES, type AnnouncementCategory } from '@/lib/constants'
import { fmtDateTime } from '@/lib/format'
import type { Announcement } from '@/types'

const CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  interruption: 'Water interruption',
  maintenance: 'Maintenance',
  conservation: 'Conservation notice',
  emergency: 'Emergency arrangement',
  distribution: 'Distribution change',
  general: 'General'
}
const STATUS_TONE = { draft: 'warn', published: 'ok', archived: 'muted' } as const

const { profile, isMuni, scopeBarangayId } = useAuth()
const { active: barangays, nameOf } = useBarangays()

const { items, loading, error } = useLive<Announcement>(() =>
  profile.value ? query(collection(db, 'announcements'), orderBy('updatedAt', 'desc'), limit(100)) : null
)

/** Coordinators may only change notices that are addressed to their own barangay alone. */
function editable(a: Announcement): boolean {
  if (isMuni.value) return true
  const t = a.targetBarangayIds ?? []
  return t.length === 1 && t[0] === scopeBarangayId.value
}

function coverage(a: Announcement): string {
  return a.targetBarangayIds?.length ? a.targetBarangayIds.map((id) => nameOf(id)).join(', ') : 'Whole municipality'
}

function blank() {
  return {
    title: '',
    body: '',
    category: 'general' as AnnouncementCategory,
    wholeMunicipality: isMuni.value,
    selected: [] as string[]
  }
}
const form = reactive(blank())
const editing = ref<Announcement | null>(null)
const showForm = ref(false)
const busy = ref(false)
const formError = ref('')
const message = ref('')

const targets = computed<string[]>(() => {
  if (!isMuni.value) return scopeBarangayId.value ? [scopeBarangayId.value] : []
  return form.wholeMunicipality ? [] : form.selected
})

function startNew(): void {
  Object.assign(form, blank())
  editing.value = null
  formError.value = ''
  message.value = ''
  showForm.value = true
}

function startEdit(a: Announcement): void {
  Object.assign(form, {
    title: a.title,
    body: a.body,
    category: a.category ?? 'general',
    wholeMunicipality: !a.targetBarangayIds?.length,
    selected: [...(a.targetBarangayIds ?? [])]
  })
  editing.value = a
  formError.value = ''
  message.value = ''
  showForm.value = true
}

function validate(): string {
  if (form.title.trim().length < 3) return 'The title needs at least 3 characters.'
  if (form.body.trim().length < 3) return 'Write the notice text.'
  if (isMuni.value && !form.wholeMunicipality && !form.selected.length) return 'Choose at least one barangay, or select the whole municipality.'
  if (!isMuni.value && !scopeBarangayId.value) return 'Your account has no assigned barangay.'
  return ''
}

async function save(status: 'draft' | 'published'): Promise<void> {
  formError.value = validate()
  if (formError.value || !profile.value) return
  busy.value = true
  const uid = profile.value.uid
  const prev = editing.value
  try {
    const data: Record<string, unknown> = {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      targetBarangayIds: targets.value,
      status,
      updatedAt: serverTimestamp(),
      updatedBy: uid
    }
    if (status === 'published') {
      data.publishedBy = uid
      if (!prev || prev.status !== 'published') data.publishedAt = serverTimestamp()
    }
    if (prev) await updateDoc(doc(db, 'announcements', prev.id), data)
    else await addDoc(collection(db, 'announcements'), { ...data, createdAt: serverTimestamp() })
    message.value = status === 'published' ? 'Published. Residents can see it now.' : 'Draft saved. Residents cannot see it yet.'
    showForm.value = false
  } catch {
    formError.value = 'The notice could not be saved. Check your permissions and connection, then try again.'
  } finally {
    busy.value = false
  }
}

async function setStatus(a: Announcement, status: 'published' | 'archived'): Promise<void> {
  if (!profile.value) return
  message.value = ''
  try {
    const data: Record<string, unknown> = { status, updatedAt: serverTimestamp(), updatedBy: profile.value.uid }
    if (status === 'published') {
      data.publishedBy = profile.value.uid
      data.publishedAt = serverTimestamp()
    }
    await updateDoc(doc(db, 'announcements', a.id), data)
    message.value = status === 'published' ? 'Published.' : 'Archived. It is no longer shown to residents.'
  } catch {
    message.value = 'The change could not be saved.'
  }
}
</script>

<template>
  <div>
    <div class="row between">
      <h1>Announcements</h1>
      <button class="btn" type="button" @click="startNew">New announcement</button>
    </div>
    <p class="small muted">Only publish information that has been verified. Drafts and archived notices are never shown to residents.</p>
    <p v-if="message" class="success" role="status">{{ message }}</p>

    <section v-if="showForm" class="panel">
      <h2>{{ editing ? 'Edit announcement' : 'New announcement' }}</h2>
      <p v-if="formError" class="error" role="alert">{{ formError }}</p>
      <form @submit.prevent="save('published')">
        <div class="field"><label for="t">Title</label><input id="t" v-model="form.title" type="text" maxlength="150" required /></div>
        <div class="field">
          <label for="c">Type</label>
          <select id="c" v-model="form.category">
            <option v-for="c in ANNOUNCEMENT_CATEGORIES" :key="c" :value="c">{{ CATEGORY_LABEL[c] }}</option>
          </select>
        </div>
        <div class="field"><label for="b">Message</label><textarea id="b" v-model="form.body" maxlength="5000" style="min-height: 140px" required /></div>

        <fieldset v-if="isMuni" class="field" style="border: 0; padding: 0; margin: 0 0 1rem">
          <legend class="lbl">Who is this for?</legend>
          <label class="check"><input v-model="form.wholeMunicipality" type="checkbox" /> Whole municipality</label>
          <div v-if="!form.wholeMunicipality" class="chips mt">
            <label v-for="b in barangays" :key="b.id" class="check badge info" style="font-weight: 600">
              <input v-model="form.selected" type="checkbox" :value="b.id" style="width: 18px; height: 18px" /> {{ b.name }}
            </label>
          </div>
        </fieldset>
        <p v-else class="small muted">This notice will be addressed to {{ scopeBarangayId ? nameOf(scopeBarangayId) : 'your barangay' }}.</p>

        <div class="row">
          <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Publish now' }}</button>
          <button class="btn secondary" type="button" :disabled="busy" @click="save('draft')">Save as draft</button>
          <button class="btn secondary" type="button" @click="showForm = false">Cancel</button>
        </div>
      </form>
    </section>

    <p v-if="error" class="error" role="alert">We could not load announcements.</p>
    <p v-else-if="loading" class="muted">Loading…</p>
    <p v-else-if="!items.length" class="muted">No announcements yet.</p>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Title</th><th>Type</th><th>For</th><th>Status</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          <tr v-for="a in items" :key="a.id">
            <td><strong>{{ a.title }}</strong></td>
            <td>{{ CATEGORY_LABEL[a.category] ?? a.category }}</td>
            <td>{{ coverage(a) }}</td>
            <td><span class="badge" :class="STATUS_TONE[a.status]">{{ a.status }}</span></td>
            <td>{{ fmtDateTime(a.updatedAt) }}</td>
            <td>
              <div v-if="editable(a)" class="row" style="flex-wrap: nowrap">
                <button class="btn sm secondary" type="button" @click="startEdit(a)">Edit</button>
                <button v-if="a.status !== 'published'" class="btn sm" type="button" @click="setStatus(a, 'published')">Publish</button>
                <button v-if="a.status === 'published'" class="btn sm secondary" type="button" @click="setStatus(a, 'archived')">Archive</button>
              </div>
              <span v-else class="small muted">Read only</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
