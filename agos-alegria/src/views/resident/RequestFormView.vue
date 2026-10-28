<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { locale, t } from '@/i18n'
import {
  CONTACT_METHODS,
  DURATIONS,
  ISSUE_TYPES,
  type ContactMethod,
  type Duration,
  type IssueType
} from '@/lib/constants'
import { errorMessage, submitRequest } from '@/lib/api'
import { useBarangays } from '@/composables/useBarangays'
import { useOnline } from '@/composables/useOnline'
import { useLocalRequests } from '@/composables/useLocalRequests'

const router = useRouter()
const online = useOnline()
const { active: barangays, nameOf } = useBarangays()
const { add } = useLocalRequests()

const form = reactive({
  barangayId: '',
  purok: '',
  issueType: '' as IssueType | '',
  householdMembers: 4,
  duration: '' as Duration | '',
  contactName: '',
  contactMethod: 'phone' as ContactMethod,
  contactValue: '',
  landmark: '',
  description: '',
  consent: false
})
const busy = ref(false)
const error = ref('')

async function onSubmit(): Promise<void> {
  error.value = ''
  // Never pretend a request was received while offline.
  if (!online.value) {
    error.value = t('form.errOffline')
    return
  }
  const needsContact = form.contactMethod !== 'landmark_only'
  const members = Math.round(Number(form.householdMembers))
  if (!form.barangayId || !form.purok.trim() || !form.issueType || !form.duration || !(members >= 1)) {
    error.value = t('form.errRequired')
    return
  }
  if ((needsContact && !form.contactValue.trim()) || (!needsContact && !form.landmark.trim())) {
    error.value = t('form.errContact')
    return
  }
  if (!form.consent) {
    error.value = t('form.errConsent')
    return
  }

  const issueType = form.issueType as IssueType
  const duration = form.duration as Duration
  busy.value = true
  try {
    const res = await submitRequest({
      barangayId: form.barangayId,
      purok: form.purok.trim(),
      issueType,
      householdMembers: members,
      duration,
      contactName: form.contactName.trim(),
      contactMethod: form.contactMethod,
      contactValue: needsContact ? form.contactValue.trim() : '',
      landmark: form.landmark.trim(),
      description: form.description.trim(),
      consent: form.consent,
      locale: locale.value
    })
    add({ ref: res.referenceNumber, barangayName: nameOf(form.barangayId) })
    router.push({ name: 'request-done', params: { reference: res.referenceNumber } })
  } catch (err) {
    error.value = errorMessage(err, t('form.errSend'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form novalidate @submit.prevent="onSubmit">
    <h1>{{ t('form.title') }}</h1>
    <p class="muted">{{ t('form.intro') }}</p>
    <div v-if="error" class="error" role="alert">{{ error }}</div>

    <section class="card">
      <div class="section-head">
        <span class="ico" aria-hidden="true">📍</span>
        <h2>{{ t('form.stepWhere') }}</h2>
      </div>

      <div class="field">
        <label for="brgy">{{ t('form.barangay') }} *</label>
        <select id="brgy" v-model="form.barangayId" required>
          <option value="" disabled>{{ t('form.selectBarangay') }}</option>
          <option v-for="b in barangays" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>

      <div class="field">
        <label for="purok">{{ t('form.purok') }} *</label>
        <input id="purok" v-model="form.purok" type="text" maxlength="60" :placeholder="t('form.purokHint')" required />
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <span class="ico" aria-hidden="true">💧</span>
        <h2>{{ t('form.stepProblem') }}</h2>
      </div>

      <div class="field radio-list" role="radiogroup" aria-labelledby="issue-l">
        <div id="issue-l" class="lbl">{{ t('form.issue') }} *</div>
        <label v-for="i in ISSUE_TYPES" :key="i">
          <input v-model="form.issueType" type="radio" name="issue" :value="i" /> {{ t('issue.' + i) }}
        </label>
      </div>

      <div class="field radio-list" role="radiogroup" aria-labelledby="dur-l">
        <div id="dur-l" class="lbl">{{ t('form.duration') }} *</div>
        <label v-for="d in DURATIONS" :key="d">
          <input v-model="form.duration" type="radio" name="duration" :value="d" /> {{ t('duration.' + d) }}
        </label>
      </div>

      <div class="field">
        <label for="hh">{{ t('form.household') }} *</label>
        <input id="hh" v-model.number="form.householdMembers" type="number" min="1" max="100" inputmode="numeric" required />
      </div>
    </section>

    <section class="card">
      <div class="section-head">
        <span class="ico" aria-hidden="true">📞</span>
        <h2>{{ t('form.stepContact') }}</h2>
      </div>

      <div class="field radio-list" role="radiogroup" aria-labelledby="cm-l">
        <div id="cm-l" class="lbl">{{ t('form.contactMethod') }} *</div>
        <label v-for="c in CONTACT_METHODS" :key="c">
          <input v-model="form.contactMethod" type="radio" name="cm" :value="c" /> {{ t('contact.' + c) }}
        </label>
      </div>

      <div v-if="form.contactMethod !== 'landmark_only'" class="field">
        <label for="cv">{{ t('form.contactValue') }} *</label>
        <input
          id="cv"
          v-model="form.contactValue"
          :type="form.contactMethod === 'phone' ? 'tel' : 'text'"
          :inputmode="form.contactMethod === 'phone' ? 'tel' : 'text'"
          maxlength="100"
          autocomplete="off"
        />
      </div>

      <div class="field">
        <label for="lm">
          {{ t('form.landmark') }}
          <span v-if="form.contactMethod !== 'landmark_only'" class="hint">({{ t('common.optional') }})</span>
          <span v-else>*</span>
        </label>
        <input id="lm" v-model="form.landmark" type="text" maxlength="160" :placeholder="t('form.landmarkHint')" />
      </div>

      <div class="field">
        <label for="cn">{{ t('form.contactName') }} <span class="hint">({{ t('common.optional') }})</span></label>
        <input id="cn" v-model="form.contactName" type="text" maxlength="80" autocomplete="name" />
      </div>

      <div class="field">
        <label for="desc">{{ t('form.description') }} <span class="hint">({{ t('common.optional') }})</span></label>
        <textarea id="desc" v-model="form.description" maxlength="600"></textarea>
      </div>

      <p class="notice small">🔒 {{ t('form.privateNote') }}</p>

      <div class="field">
        <label class="check">
          <input v-model="form.consent" type="checkbox" />
          <span>
            {{ t('form.consent') }}
            <RouterLink to="/privacy" target="_blank">{{ t('form.privacyLink') }}</RouterLink>
          </span>
        </label>
      </div>
    </section>

    <button class="btn block big mt" type="submit" :disabled="busy">
      {{ busy ? t('form.submitting') : t('form.submit') }}
    </button>
  </form>
</template>
