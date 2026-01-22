<script setup>
import { ref, watch } from 'vue'
import { Globe, Link, CreditCard, Save, AlertCircle, ExternalLink } from 'lucide-vue-next'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Local form state
const form = ref({
  web_address: '',
  county_website: '',
  pay_taxes_url: ''
})

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')

// Watch for county changes to reset form
watch(() => props.county, (newCounty) => {
  if (newCounty) {
    form.value = {
      web_address: newCounty.web_address || '',
      county_website: newCounty.county_website || '',
      pay_taxes_url: newCounty.pay_taxes_url || ''
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

// Validate URL format
function isValidUrl(url) {
  if (!url) return true
  try {
    new URL(url.startsWith('http') ? url : `https://${url}`)
    return true
  } catch {
    return false
  }
}

// Open URL
function openUrl(url) {
  if (!url) return
  const fullUrl = url.startsWith('http') ? url : `https://${url}`
  window.open(fullUrl, '_blank')
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
        <h3 class="text-lg font-semibold text-gray-900">Online Resources</h3>
        <p class="text-sm text-gray-500 mt-1">Website URLs and online payment portals</p>
      </div>

      <div class="p-6 space-y-6">
        <!-- Main Website -->
        <div>
          <label class="input-label">
            <Globe class="w-4 h-4 inline mr-1.5" />
            Main Website
          </label>
          <div class="flex gap-2">
            <input
              v-model="form.web_address"
              type="url"
              placeholder="https://example.gov"
              :class="[
                'input flex-1',
                !isValidUrl(form.web_address) ? 'border-red-300 focus:ring-red-500' : ''
              ]"
            />
            <button
              v-if="form.web_address && isValidUrl(form.web_address)"
              @click="openUrl(form.web_address)"
              class="btn btn-secondary"
              title="Open in new tab"
            >
              <ExternalLink class="w-4 h-4" />
            </button>
          </div>
          <p v-if="!isValidUrl(form.web_address)" class="text-xs text-red-500 mt-1">
            Please enter a valid URL
          </p>
        </div>

        <!-- County Website -->
        <div>
          <label class="input-label">
            <Link class="w-4 h-4 inline mr-1.5" />
            County Website
          </label>
          <div class="flex gap-2">
            <input
              v-model="form.county_website"
              type="url"
              placeholder="https://county.gov"
              :class="[
                'input flex-1',
                !isValidUrl(form.county_website) ? 'border-red-300 focus:ring-red-500' : ''
              ]"
            />
            <button
              v-if="form.county_website && isValidUrl(form.county_website)"
              @click="openUrl(form.county_website)"
              class="btn btn-secondary"
              title="Open in new tab"
            >
              <ExternalLink class="w-4 h-4" />
            </button>
          </div>
          <p v-if="!isValidUrl(form.county_website)" class="text-xs text-red-500 mt-1">
            Please enter a valid URL
          </p>
        </div>

        <!-- Payment Portal -->
        <div>
          <label class="input-label">
            <CreditCard class="w-4 h-4 inline mr-1.5" />
            Tax Payment Portal
          </label>
          <div class="flex gap-2">
            <input
              v-model="form.pay_taxes_url"
              type="url"
              placeholder="https://pay.county.gov"
              :class="[
                'input flex-1',
                !isValidUrl(form.pay_taxes_url) ? 'border-red-300 focus:ring-red-500' : ''
              ]"
            />
            <button
              v-if="form.pay_taxes_url && isValidUrl(form.pay_taxes_url)"
              @click="openUrl(form.pay_taxes_url)"
              class="btn btn-secondary"
              title="Open in new tab"
            >
              <ExternalLink class="w-4 h-4" />
            </button>
          </div>
          <p v-if="!isValidUrl(form.pay_taxes_url)" class="text-xs text-red-500 mt-1">
            Please enter a valid URL
          </p>
          <p class="text-xs text-gray-500 mt-1">
            The URL where taxpayers can pay their property taxes online
          </p>
        </div>

        <!-- Quick Links Preview -->
        <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 class="text-sm font-medium text-gray-700 mb-3">Quick Links Preview</h4>
          <div class="space-y-2">
            <a
              v-if="form.web_address && isValidUrl(form.web_address)"
              :href="form.web_address.startsWith('http') ? form.web_address : `https://${form.web_address}`"
              target="_blank"
              class="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <Globe class="w-4 h-4" />
              Main Website
              <ExternalLink class="w-3 h-3" />
            </a>
            <a
              v-if="form.county_website && isValidUrl(form.county_website)"
              :href="form.county_website.startsWith('http') ? form.county_website : `https://${form.county_website}`"
              target="_blank"
              class="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <Link class="w-4 h-4" />
              County Website
              <ExternalLink class="w-3 h-3" />
            </a>
            <a
              v-if="form.pay_taxes_url && isValidUrl(form.pay_taxes_url)"
              :href="form.pay_taxes_url.startsWith('http') ? form.pay_taxes_url : `https://${form.pay_taxes_url}`"
              target="_blank"
              class="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <CreditCard class="w-4 h-4" />
              Pay Taxes Online
              <ExternalLink class="w-3 h-3" />
            </a>
            <p v-if="!form.web_address && !form.county_website && !form.pay_taxes_url" class="text-sm text-gray-400">
              No URLs configured
            </p>
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
