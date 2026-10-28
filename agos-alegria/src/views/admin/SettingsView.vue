<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/composables/useAuth'
import { useAppSettings } from '@/composables/useAppSettings'
import type { OfficialContact } from '@/types'

const { profile } = useAuth()
const { settings, loaded } = useAppSettings()

const form = reactive({
  contacts: [] as OfficialContact[],
  maintenanceMode: false,
  maintenanceMessage: '',
  privacyContact: ''
})
const hydrated = ref(false)
const busy = ref(false)
const message = ref('')
const error = ref('')

// Load the saved values once; later live updates must not overwrite what someone is typing.
watch(
  [settings, loaded],
  () => {
    if (hydrated.value || !loaded.value) return
    form.contacts = settings.value.officialContacts.map((c) => ({ ...c }))
    form.maintenanceMode = settings.value.maintenanceMode
    form.maintenanceMessage = settings.value.maintenanceMessage
    form.privacyContact = settings.value.privacyContact
    hydrated.value = true
  },
  { immediate: true }
)

function addContact(): void {
  form.contacts.push({ label: '', phone: '', hours: '' })
}
function removeContact(i: number): void {
  form.contacts.splice(i, 1)
}

async function save(): Promise<void> {
  error.value = ''
  message.value = ''
  if (!profile.value) return
  const contacts = form.contacts
    .map((c) => ({ label: c.label.trim(), phone: c.phone.trim(), hours: (c.hours ?? '').trim() }))
    .filter((c) => c.label || c.phone)
  if (contacts.some((c) => !c.label || !c.phone)) {
    error.value = 'Each contact needs both a name and a phone number.'
    return
  }
  busy.value = true
  try {
    await setDoc(
      doc(db, 'appSettings', 'public'),
      {
        appName: 'AGOS Alegria',
        officialContacts: contacts,
        maintenanceMode: form.maintenanceMode,
        maintenanceMessage: form.maintenanceMessage.trim(),
        privacyContact: form.privacyContact.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: profile.value.uid
      },
      { merge: true }
    )
    message.value = 'Settings saved. Residents see the changes immediately.'
  } catch {
    error.value = 'The settings could not be saved. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h1>Settings</h1>
    <p class="small muted">These details are public. They appear on the Help screen and in the notice banner.</p>
    <p v-if="message" class="success" role="status">{{ message }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <form @submit.prevent="save">
      <section class="panel">
        <div class="row between"><h2>Official contacts</h2><button class="btn sm secondary" type="button" @click="addContact">Add contact</button></div>
        <p class="small muted">
          Include a phone number or in-person option for residents who cannot use the app, for example the Municipal Disaster Risk Reduction and Management Office or each barangay hall.
        </p>
        <p v-if="!form.contacts.length" class="muted">No contacts yet.</p>
        <div v-for="(c, i) in form.contacts" :key="i" class="form-grid" style="align-items: end">
          <div class="field"><label :for="`cl${i}`">Office or person</label><input :id="`cl${i}`" v-model="c.label" type="text" maxlength="80" /></div>
          <div class="field"><label :for="`cp${i}`">Phone</label><input :id="`cp${i}`" v-model="c.phone" type="tel" maxlength="40" /></div>
          <div class="field"><label :for="`ch${i}`">Hours <span class="hint">(optional)</span></label><input :id="`ch${i}`" v-model="c.hours" type="text" maxlength="60" /></div>
          <div class="field"><button class="btn sm danger" type="button" @click="removeContact(i)">Remove</button></div>
        </div>
      </section>

      <section class="panel">
        <h2>Maintenance notice</h2>
        <label class="check mb"><input v-model="form.maintenanceMode" type="checkbox" /> Show a notice banner to residents</label>
        <div class="field">
          <label for="mm">Message</label>
          <input id="mm" v-model="form.maintenanceMessage" type="text" maxlength="200" placeholder="Schedules are being updated. Please check again at 3 PM." />
        </div>
      </section>

      <section class="panel">
        <h2>Privacy contact</h2>
        <div class="field">
          <label for="pc">Who residents should contact about their data</label>
          <input id="pc" v-model="form.privacyContact" type="text" maxlength="200" placeholder="Municipal Data Protection Officer, Municipal Hall, (032) 000 0000" />
        </div>
      </section>

      <button class="btn" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save settings' }}</button>
    </form>
  </div>
</template>
