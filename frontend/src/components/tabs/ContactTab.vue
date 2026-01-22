<script setup>
import { ref, watch } from 'vue'
import { User, Briefcase, Phone, Mail, Save, AlertCircle } from 'lucide-vue-next'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Local form state
const form = ref({
  primary_contact_name: '',
  primary_contact_title: '',
  primary_contact_phone: '',
  primary_contact_email: ''
})

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')

// Watch for county changes to reset form
watch(() => props.county, (newCounty) => {
  if (newCounty) {
    form.value = {
      primary_contact_name: newCounty.primary_contact_name || '',
      primary_contact_title: newCounty.primary_contact_title || '',
      primary_contact_phone: newCounty.primary_contact_phone || '',
      primary_contact_email: newCounty.primary_contact_email || ''
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

function handlePhoneInput(e) {
  form.value.primary_contact_phone = formatPhone(e.target.value)
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
        <h3 class="text-lg font-semibold text-gray-900">Contact Information</h3>
        <p class="text-sm text-gray-500 mt-1">Primary contact details for this jurisdiction</p>
      </div>

      <div class="p-6 space-y-6">
        <!-- Name & Title -->
        <div class="grid grid-cols-2 gap-6">
          <div>
            <label class="input-label">
              <User class="w-4 h-4 inline mr-1.5" />
              Contact Name
            </label>
            <input
              v-model="form.primary_contact_name"
              type="text"
              placeholder="e.g., John Smith"
              class="input"
            />
          </div>

          <div>
            <label class="input-label">
              <Briefcase class="w-4 h-4 inline mr-1.5" />
              Title
            </label>
            <input
              v-model="form.primary_contact_title"
              type="text"
              placeholder="e.g., Treasurer"
              class="input"
            />
          </div>
        </div>

        <!-- Phone & Email -->
        <div class="grid grid-cols-2 gap-6">
          <div>
            <label class="input-label">
              <Phone class="w-4 h-4 inline mr-1.5" />
              Phone Number
            </label>
            <input
              :value="form.primary_contact_phone"
              @input="handlePhoneInput"
              type="tel"
              placeholder="(555) 555-5555"
              class="input"
            />
          </div>

          <div>
            <label class="input-label">
              <Mail class="w-4 h-4 inline mr-1.5" />
              Email Address
            </label>
            <input
              v-model="form.primary_contact_email"
              type="email"
              placeholder="email@example.com"
              class="input"
            />
          </div>
        </div>

        <!-- Contact Card Preview -->
        <div v-if="form.primary_contact_name || form.primary_contact_email" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 class="text-sm font-medium text-gray-700 mb-3">Contact Preview</h4>
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User class="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p class="font-medium text-gray-900">{{ form.primary_contact_name || 'No name provided' }}</p>
              <p class="text-sm text-gray-500">{{ form.primary_contact_title || 'No title' }}</p>
              <div class="mt-2 space-y-1">
                <p v-if="form.primary_contact_phone" class="text-sm text-gray-600 flex items-center gap-2">
                  <Phone class="w-3.5 h-3.5" />
                  {{ form.primary_contact_phone }}
                </p>
                <p v-if="form.primary_contact_email" class="text-sm text-gray-600 flex items-center gap-2">
                  <Mail class="w-3.5 h-3.5" />
                  {{ form.primary_contact_email }}
                </p>
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
