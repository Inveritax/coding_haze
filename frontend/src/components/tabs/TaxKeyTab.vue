<script setup>
import { ref, watch } from 'vue'
import { Hash, Save, AlertCircle } from 'lucide-vue-next'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Local form state
const form = ref({
  tax_key_format_masked: '',
  tax_key_format_unmasked: '',
  alt_tax_key_format_masked: '',
  alt_tax_key_format_unmasked: ''
})

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')

// Watch for county changes to reset form
watch(() => props.county, (newCounty) => {
  if (newCounty) {
    form.value = {
      tax_key_format_masked: newCounty.tax_key_format_masked || '',
      tax_key_format_unmasked: newCounty.tax_key_format_unmasked || '',
      alt_tax_key_format_masked: newCounty.alt_tax_key_format_masked || '',
      alt_tax_key_format_unmasked: newCounty.alt_tax_key_format_unmasked || ''
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
</script>

<template>
  <div class="max-w-4xl">
    <!-- Error message -->
    <div v-if="error" class="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
      <AlertCircle class="w-5 h-5 flex-shrink-0" />
      <span class="text-sm">{{ error }}</span>
    </div>

    <div class="space-y-6">
      <!-- Tax Key Format Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Tax Key # Format</h3>
          <p class="text-sm text-gray-500 mt-1">Configure tax key/parcel number formats for this jurisdiction</p>
        </div>

        <div class="p-6 space-y-6">
          <!-- Primary Tax Key Format -->
          <div>
            <h4 class="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Hash class="w-4 h-4" />
              Primary Tax Key # Format
            </h4>
            <div class="grid grid-cols-2 gap-6">
              <div>
                <label class="input-label">Masked (with formatting)</label>
                <input
                  v-model="form.tax_key_format_masked"
                  type="text"
                  placeholder="e.g., XX-XXX-XXXX"
                  class="input font-mono"
                />
                <p class="text-xs text-gray-500 mt-1">Format with dashes, spaces, etc.</p>
              </div>

              <div>
                <label class="input-label">Unmasked (without formatting)</label>
                <input
                  v-model="form.tax_key_format_unmasked"
                  type="text"
                  placeholder="e.g., XXXXXXXXX"
                  class="input font-mono"
                />
                <p class="text-xs text-gray-500 mt-1">Raw format without separators</p>
              </div>
            </div>
          </div>

          <hr class="border-gray-200" />

          <!-- Alternate Tax Key Format -->
          <div>
            <h4 class="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Hash class="w-4 h-4" />
              Alternate Tax Key # Format
            </h4>
            <div class="grid grid-cols-2 gap-6">
              <div>
                <label class="input-label">Masked (with formatting)</label>
                <input
                  v-model="form.alt_tax_key_format_masked"
                  type="text"
                  placeholder="e.g., XX-XXX-XXXX-XX"
                  class="input font-mono"
                />
                <p class="text-xs text-gray-500 mt-1">Alternate format with dashes, spaces, etc.</p>
              </div>

              <div>
                <label class="input-label">Unmasked (without formatting)</label>
                <input
                  v-model="form.alt_tax_key_format_unmasked"
                  type="text"
                  placeholder="e.g., XXXXXXXXXXX"
                  class="input font-mono"
                />
                <p class="text-xs text-gray-500 mt-1">Alternate raw format without separators</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Format Examples Card -->
      <div class="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <h4 class="font-medium text-blue-900 mb-2">Format Examples</h4>
        <div class="text-sm text-blue-700 space-y-1">
          <p><strong>Masked:</strong> 12-345-6789, 123.456.7890, 12 34 56 789</p>
          <p><strong>Unmasked:</strong> 123456789, 1234567890</p>
          <p class="text-xs text-blue-600 mt-2">Use X to represent digits, include any separators (dashes, dots, spaces) in the masked format.</p>
        </div>
      </div>

      <!-- Save Button -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between">
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
