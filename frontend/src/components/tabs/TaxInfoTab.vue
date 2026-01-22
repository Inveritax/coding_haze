<script setup>
import { ref, watch, computed } from 'vue'
import { Calendar, Hash, Save, AlertCircle, RefreshCw } from 'lucide-vue-next'
import api from '../../services/api'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Local form state
const form = ref({
  current_tax_year: '',
  num_installments: '',
  due_date_1: '',
  due_date_2: '',
  due_date_3: '',
  due_date_4: '',
  due_date_5: '',
  due_date_6: '',
  due_date_7: '',
  due_date_8: '',
  due_date_9: '',
  due_date_10: '',
  // General collection settings
  default_delq_collector: '',
  default_escrow_collector: '',
  delq_search_start_date: '',
  default_escrow_search_start_date: '',
  tax_billing_date: ''
})

// Per-installment details
const installmentDetails = ref({})
const isLoadingInstallments = ref(false)

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')

// Compute number of installments to show (minimum 1, maximum 10)
const visibleInstallments = computed(() => {
  const num = parseInt(form.value.num_installments) || 1
  return Math.max(1, Math.min(10, num))
})

// Watch for county changes to reset form
watch(() => props.county, async (newCounty) => {
  if (newCounty) {
    form.value = {
      current_tax_year: newCounty.current_tax_year || '',
      num_installments: newCounty.num_installments || '',
      due_date_1: newCounty.due_date_1 || '',
      due_date_2: newCounty.due_date_2 || '',
      due_date_3: newCounty.due_date_3 || '',
      due_date_4: newCounty.due_date_4 || '',
      due_date_5: newCounty.due_date_5 || '',
      due_date_6: newCounty.due_date_6 || '',
      due_date_7: newCounty.due_date_7 || '',
      due_date_8: newCounty.due_date_8 || '',
      due_date_9: newCounty.due_date_9 || '',
      due_date_10: newCounty.due_date_10 || '',
      // General collection settings
      default_delq_collector: newCounty.default_delq_collector || '',
      default_escrow_collector: newCounty.default_escrow_collector || '',
      delq_search_start_date: newCounty.delq_search_start_date || '',
      default_escrow_search_start_date: newCounty.default_escrow_search_start_date || '',
      tax_billing_date: newCounty.tax_billing_date || ''
    }
    hasChanges.value = false

    // Load installment details
    if (newCounty.research_id) {
      await loadInstallmentDetails(newCounty.research_id)
    }
  }
}, { immediate: true })

// Watch for form changes
watch(form, () => {
  hasChanges.value = true
}, { deep: true })

// Load installment details from API
async function loadInstallmentDetails(researchId) {
  isLoadingInstallments.value = true
  try {
    const response = await api.getInstallmentDetails(researchId)
    const details = {}
    for (const inst of response.data.installments || []) {
      details[inst.installment_number] = {
        delq_collector: inst.delq_collector || '',
        escrow_collector: inst.escrow_collector || '',
        escrow_search_start_date: inst.escrow_search_start_date || '',
        tax_billing_date: inst.tax_billing_date || ''
      }
    }
    installmentDetails.value = details
  } catch (err) {
    console.error('Failed to load installment details:', err)
  } finally {
    isLoadingInstallments.value = false
  }
}

// Update installment detail
function updateInstallmentDetail(installmentNum, field, value) {
  if (!installmentDetails.value[installmentNum]) {
    installmentDetails.value[installmentNum] = {
      delq_collector: '',
      escrow_collector: '',
      escrow_search_start_date: '',
      tax_billing_date: ''
    }
  }
  installmentDetails.value[installmentNum][field] = value
  hasChanges.value = true
}

// Save handler
async function handleSave() {
  isSaving.value = true
  error.value = ''

  try {
    // Save main form data
    await emit('save', { ...form.value })

    // Save installment details
    for (const [numStr, details] of Object.entries(installmentDetails.value)) {
      const num = parseInt(numStr)
      if (num <= visibleInstallments.value) {
        // Only save if there's actual data
        if (details.delq_collector || details.escrow_collector ||
            details.escrow_search_start_date || details.tax_billing_date) {
          await api.updateInstallmentDetail(props.county.research_id, num, details)
        }
      }
    }

    hasChanges.value = false
  } catch (err) {
    error.value = 'Failed to save changes. Please try again.'
  } finally {
    isSaving.value = false
  }
}

// Helper to check if a date is special
function isSpecialDate(date) {
  if (!date) return false
  const upper = String(date).toUpperCase()
  return upper.includes('VARIES') || upper.includes('TBD') || upper.includes('CONTACT') || upper.includes('EST')
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
      <!-- Tax Year & Installments Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Tax Information</h3>
          <p class="text-sm text-gray-500 mt-1">Manage tax year and payment schedule details</p>
        </div>

        <div class="p-6 space-y-6">
          <!-- Tax Year & Installments -->
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="input-label">
                <Calendar class="w-4 h-4 inline mr-1.5" />
                Current Tax Year
              </label>
              <input
                v-model="form.current_tax_year"
                type="text"
                placeholder="e.g., 2024"
                class="input"
              />
            </div>

            <div>
              <label class="input-label">
                <Hash class="w-4 h-4 inline mr-1.5" />
                Number of Installments
              </label>
              <input
                v-model="form.num_installments"
                type="number"
                min="1"
                max="10"
                placeholder="e.g., 2"
                class="input"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- General Collection Settings Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">General Collection Settings</h3>
          <p class="text-sm text-gray-500 mt-1">Default collector and search date settings (apply to all installments unless overridden)</p>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="input-label">Default Delinquent Collector</label>
              <input
                v-model="form.default_delq_collector"
                type="text"
                placeholder="e.g., County Treasurer"
                class="input"
              />
            </div>

            <div>
              <label class="input-label">Default Escrow Collector</label>
              <input
                v-model="form.default_escrow_collector"
                type="text"
                placeholder="e.g., County Treasurer"
                class="input"
              />
            </div>

            <div>
              <label class="input-label">Delinquent Search Start Date</label>
              <input
                v-model="form.delq_search_start_date"
                type="text"
                placeholder="MM/DD/YYYY"
                class="input"
              />
            </div>

            <div>
              <label class="input-label">Default Escrow Search Start Date</label>
              <input
                v-model="form.default_escrow_search_start_date"
                type="text"
                placeholder="MM/DD/YYYY"
                class="input"
              />
            </div>

            <div>
              <label class="input-label">Tax Billing Date</label>
              <input
                v-model="form.tax_billing_date"
                type="text"
                placeholder="MM/DD/YYYY"
                class="input"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Installment Details Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Installment Details</h3>
            <p class="text-sm text-gray-500 mt-1">
              Configure due dates and collection settings per installment.
              <span class="text-xs text-gray-400">(Leave blank to use general defaults)</span>
            </p>
          </div>
          <div v-if="isLoadingInstallments" class="flex items-center gap-2 text-gray-500">
            <RefreshCw class="w-4 h-4 animate-spin" />
            <span class="text-sm">Loading...</span>
          </div>
        </div>

        <div class="p-6 space-y-6">
          <!-- Installment sections -->
          <div v-for="i in visibleInstallments" :key="i" class="border border-gray-200 rounded-lg overflow-hidden">
            <div class="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h4 class="font-medium text-gray-900">Installment {{ i }}</h4>
            </div>

            <div class="p-4 space-y-4">
              <!-- Due Date (editable) -->
              <div>
                <label class="input-label">Due Date {{ i }}</label>
                <input
                  v-model="form[`due_date_${i}`]"
                  type="text"
                  placeholder="MM/DD/YYYY"
                  :class="[
                    'input',
                    isSpecialDate(form[`due_date_${i}`]) ? 'border-amber-300 bg-amber-50' : ''
                  ]"
                />
                <p v-if="isSpecialDate(form[`due_date_${i}`])" class="text-xs text-amber-600 mt-1">
                  Special date value detected
                </p>
              </div>

              <!-- Per-installment override fields -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="input-label text-gray-600 flex items-center gap-1">
                    Delq Collector
                    <span class="text-xs text-gray-400">(override)</span>
                  </label>
                  <input
                    :value="installmentDetails[i]?.delq_collector || ''"
                    @input="updateInstallmentDetail(i, 'delq_collector', $event.target.value)"
                    type="text"
                    :placeholder="form.default_delq_collector || 'Use default'"
                    class="input text-sm"
                  />
                </div>

                <div>
                  <label class="input-label text-gray-600 flex items-center gap-1">
                    Escrow Collector
                    <span class="text-xs text-gray-400">(override)</span>
                  </label>
                  <input
                    :value="installmentDetails[i]?.escrow_collector || ''"
                    @input="updateInstallmentDetail(i, 'escrow_collector', $event.target.value)"
                    type="text"
                    :placeholder="form.default_escrow_collector || 'Use default'"
                    class="input text-sm"
                  />
                </div>

                <div>
                  <label class="input-label text-gray-600 flex items-center gap-1">
                    Escrow Search Start Date
                    <span class="text-xs text-gray-400">(override)</span>
                  </label>
                  <input
                    :value="installmentDetails[i]?.escrow_search_start_date || ''"
                    @input="updateInstallmentDetail(i, 'escrow_search_start_date', $event.target.value)"
                    type="text"
                    :placeholder="form.default_escrow_search_start_date || 'Use default'"
                    class="input text-sm"
                  />
                </div>

                <div>
                  <label class="input-label text-gray-600 flex items-center gap-1">
                    Tax Billing Date
                    <span class="text-xs text-gray-400">(override)</span>
                  </label>
                  <input
                    :value="installmentDetails[i]?.tax_billing_date || ''"
                    @input="updateInstallmentDetail(i, 'tax_billing_date', $event.target.value)"
                    type="text"
                    :placeholder="form.tax_billing_date || 'Use default'"
                    class="input text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
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
