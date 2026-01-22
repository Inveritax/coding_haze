<script setup>
import { ref, watch } from 'vue'
import { MapPin, Building, Save, AlertCircle, Copy, Check } from 'lucide-vue-next'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Local form state
const form = ref({
  tax_authority_physical_address: '',
  tax_authority_mailing_address: ''
})

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')
const copiedField = ref(null)

// Watch for county changes to reset form
watch(() => props.county, (newCounty) => {
  if (newCounty) {
    form.value = {
      tax_authority_physical_address: newCounty.tax_authority_physical_address || '',
      tax_authority_mailing_address: newCounty.tax_authority_mailing_address || ''
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

// Copy physical to mailing
function copyToMailing() {
  form.value.tax_authority_mailing_address = form.value.tax_authority_physical_address
}

// Copy to clipboard
async function copyToClipboard(text, field) {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    setTimeout(() => {
      copiedField.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
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
        <h3 class="text-lg font-semibold text-gray-900">Address Information</h3>
        <p class="text-sm text-gray-500 mt-1">Physical and mailing addresses for the tax authority</p>
      </div>

      <div class="p-6 space-y-6">
        <!-- Physical Address -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="input-label mb-0">
              <Building class="w-4 h-4 inline mr-1.5" />
              Physical Address
            </label>
            <button
              v-if="form.tax_authority_physical_address"
              @click="copyToClipboard(form.tax_authority_physical_address, 'physical')"
              class="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1"
            >
              <Check v-if="copiedField === 'physical'" class="w-3.5 h-3.5 text-green-500" />
              <Copy v-else class="w-3.5 h-3.5" />
              {{ copiedField === 'physical' ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <textarea
            v-model="form.tax_authority_physical_address"
            rows="4"
            placeholder="Enter the physical/street address&#10;123 Main Street&#10;City, State ZIP"
            class="input resize-none"
          ></textarea>
        </div>

        <!-- Copy Button -->
        <div class="flex justify-center">
          <button
            @click="copyToMailing"
            :disabled="!form.tax_authority_physical_address"
            class="btn btn-secondary text-xs"
          >
            <Copy class="w-3.5 h-3.5" />
            Copy Physical to Mailing Address
          </button>
        </div>

        <!-- Mailing Address -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="input-label mb-0">
              <MapPin class="w-4 h-4 inline mr-1.5" />
              Mailing Address
            </label>
            <button
              v-if="form.tax_authority_mailing_address"
              @click="copyToClipboard(form.tax_authority_mailing_address, 'mailing')"
              class="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1"
            >
              <Check v-if="copiedField === 'mailing'" class="w-3.5 h-3.5 text-green-500" />
              <Copy v-else class="w-3.5 h-3.5" />
              {{ copiedField === 'mailing' ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <textarea
            v-model="form.tax_authority_mailing_address"
            rows="4"
            placeholder="Enter the mailing address&#10;P.O. Box 123&#10;City, State ZIP"
            class="input resize-none"
          ></textarea>
        </div>

        <!-- Address Comparison -->
        <div v-if="form.tax_authority_physical_address && form.tax_authority_mailing_address" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 class="text-sm font-medium text-gray-700 mb-3">Address Comparison</h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase mb-2">Physical</p>
              <p class="text-sm text-gray-700 whitespace-pre-line">{{ form.tax_authority_physical_address }}</p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase mb-2">Mailing</p>
              <p class="text-sm text-gray-700 whitespace-pre-line">{{ form.tax_authority_mailing_address }}</p>
            </div>
          </div>
          <p
            v-if="form.tax_authority_physical_address === form.tax_authority_mailing_address"
            class="text-xs text-green-600 mt-3 flex items-center gap-1"
          >
            <Check class="w-3.5 h-3.5" />
            Addresses match
          </p>
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
