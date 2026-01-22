<script setup>
import { ref, watch } from 'vue'
import { Phone, Printer, FileText, Save, AlertCircle } from 'lucide-vue-next'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Local form state
const form = ref({
  general_phone_number: '',
  fax_number: '',
  notes: ''
})

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')

// Watch for county changes to reset form
watch(() => props.county, (newCounty) => {
  if (newCounty) {
    form.value = {
      general_phone_number: newCounty.general_phone_number || '',
      fax_number: newCounty.fax_number || '',
      notes: newCounty.notes || ''
    }
    hasChanges.value = false
  }
}, { immediate: true })

// Watch for form changes
watch(form, () => {
  hasChanges.value = true
}, { deep: true })

// Save handler
async function handleSave() {
  isSaving.value = true
  error.value = ''

  try {
    await emit('save', { ...form.value })
    hasChanges.value = false
  } catch (err) {
    error.value = 'Failed to save changes. Please try again.'
  } finally {
    isSaving.value = false
  }
}

// Format phone number
function formatPhone(value) {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function handlePhoneInput(field, e) {
  form.value[field] = formatPhone(e.target.value)
}
</script>

<template>
  <div class="max-w-3xl">
    <!-- Error message -->
    <div v-if="error" class="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
      <AlertCircle class="w-5 h-5 flex-shrink-0" />
      <span class="text-sm">{{ error }}</span>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Additional Information</h3>
        <p class="text-sm text-gray-500 mt-1">General contact numbers and notes</p>
      </div>

      <div class="p-6 space-y-6">
        <!-- Phone Numbers -->
        <div class="grid grid-cols-2 gap-6">
          <div>
            <label class="input-label">
              <Phone class="w-4 h-4 inline mr-1.5" />
              General Phone Number
            </label>
            <input
              :value="form.general_phone_number"
              @input="handlePhoneInput('general_phone_number', $event)"
              type="tel"
              placeholder="(555) 555-5555"
              class="input"
            />
            <p class="text-xs text-gray-500 mt-1">
              Main office or switchboard number
            </p>
          </div>

          <div>
            <label class="input-label">
              <Printer class="w-4 h-4 inline mr-1.5" />
              Fax Number
            </label>
            <input
              :value="form.fax_number"
              @input="handlePhoneInput('fax_number', $event)"
              type="tel"
              placeholder="(555) 555-5555"
              class="input"
            />
            <p class="text-xs text-gray-500 mt-1">
              Fax number for document submissions
            </p>
          </div>
        </div>

        <!-- Notes -->
        <div>
          <label class="input-label">
            <FileText class="w-4 h-4 inline mr-1.5" />
            Notes
          </label>
          <textarea
            v-model="form.notes"
            rows="6"
            placeholder="Add any additional notes or special instructions for this jurisdiction..."
            class="input resize-none"
          ></textarea>
          <div class="flex justify-between mt-1">
            <p class="text-xs text-gray-500">
              Internal notes and special instructions
            </p>
            <p class="text-xs text-gray-400">
              {{ form.notes.length }} characters
            </p>
          </div>
        </div>

        <!-- Quick Reference -->
        <div v-if="form.general_phone_number || form.fax_number" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 class="text-sm font-medium text-gray-700 mb-3">Quick Reference</h4>
          <div class="grid grid-cols-2 gap-4">
            <div v-if="form.general_phone_number" class="flex items-center gap-3">
              <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Phone class="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p class="text-xs text-gray-500">General</p>
                <p class="text-sm font-medium text-gray-900">{{ form.general_phone_number }}</p>
              </div>
            </div>
            <div v-if="form.fax_number" class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Printer class="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p class="text-xs text-gray-500">Fax</p>
                <p class="text-sm font-medium text-gray-900">{{ form.fax_number }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center justify-between">
        <p v-if="hasChanges" class="text-sm text-amber-600">You have unsaved changes</p>
        <p v-else class="text-sm text-gray-500">All changes saved</p>

        <button
          @click="handleSave"
          :disabled="!hasChanges || isSaving"
          class="btn btn-primary"
        >
          <Save class="w-4 h-4" />
          {{ isSaving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>
