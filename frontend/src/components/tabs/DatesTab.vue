<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { Calendar, Hash, Save, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-vue-next'
import api from '../../services/api'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Local form state for research_results fields
const form = ref({
  current_tax_year: '',
  num_installments: '',
  search_by_installments: false,
  tax_dates_notes: '',
  // Full Year fields
  full_year_due_date: '',
  default_delq_collector: '',
  default_escrow_collector: '',
  delq_search_start_date: '',
  default_escrow_search_start_date: '',
  tax_billing_date: '',
  full_year_precommitment_date: '',
  full_year_finalize_balance_date: '',
  full_year_make_payment_due_date: ''
})

// Installments from the expandable table
const installments = ref([])
const isLoadingInstallments = ref(false)
const expandedInstallments = ref({})

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')

// Watch for county changes to reset form
watch(() => props.county, async (newCounty) => {
  if (newCounty) {
    form.value = {
      current_tax_year: newCounty.current_tax_year || '',
      num_installments: newCounty.num_installments || '',
      search_by_installments: newCounty.search_by_installments || false,
      tax_dates_notes: newCounty.tax_dates_notes || '',
      full_year_due_date: newCounty.full_year_due_date || '',
      default_delq_collector: newCounty.default_delq_collector || '',
      default_escrow_collector: newCounty.default_escrow_collector || '',
      delq_search_start_date: newCounty.delq_search_start_date || '',
      default_escrow_search_start_date: newCounty.default_escrow_search_start_date || '',
      tax_billing_date: newCounty.tax_billing_date || '',
      full_year_precommitment_date: newCounty.full_year_precommitment_date || '',
      full_year_finalize_balance_date: newCounty.full_year_finalize_balance_date || '',
      full_year_make_payment_due_date: newCounty.full_year_make_payment_due_date || ''
    }
    hasChanges.value = false

    // Load installments from new table
    if (newCounty.research_id) {
      await loadInstallments(newCounty.research_id)
    }
  }
}, { immediate: true })

// Watch for form changes
watch(form, () => {
  hasChanges.value = true
}, { deep: true })

// Load installments from API
async function loadInstallments(researchId) {
  isLoadingInstallments.value = true
  try {
    const response = await api.getInstallments(researchId)
    installments.value = response.data.installments || []
  } catch (err) {
    console.error('Failed to load installments:', err)
  } finally {
    isLoadingInstallments.value = false
  }
}

// Toggle installment expansion
function toggleInstallment(id) {
  expandedInstallments.value[id] = !expandedInstallments.value[id]
}

// Add new installment
async function addInstallment() {
  const nextNumber = installments.value.length + 1
  try {
    const response = await api.createInstallment(props.county.research_id, {
      installment_number: nextNumber
    })
    installments.value.push(response.data.installment)
    expandedInstallments.value[response.data.installment.id] = true
    hasChanges.value = true
  } catch (err) {
    error.value = 'Failed to add installment'
  }
}

// Update installment field
async function updateInstallmentField(installment, field, value) {
  installment[field] = value
  hasChanges.value = true
}

// Delete installment
async function deleteInstallment(installment) {
  if (!confirm(`Delete Installment ${installment.installment_number}?`)) return

  try {
    await api.deleteInstallment(installment.id)
    installments.value = installments.value.filter(i => i.id !== installment.id)
    // Renumber remaining installments
    installments.value.forEach((inst, idx) => {
      inst.installment_number = idx + 1
    })
    hasChanges.value = true
  } catch (err) {
    error.value = 'Failed to delete installment'
  }
}

// Save handler
async function handleSave() {
  isSaving.value = true
  error.value = ''

  try {
    // Save main form data
    await emit('save', { ...form.value })

    // Save all installments
    for (const inst of installments.value) {
      await api.updateInstallment(inst.id, {
        due_date: inst.due_date,
        delq_collector: inst.delq_collector,
        escrow_collector: inst.escrow_collector,
        escrow_search_start_date: inst.escrow_search_start_date,
        tax_billing_date: inst.tax_billing_date,
        precommitment_date: inst.precommitment_date,
        finalize_balance_date: inst.finalize_balance_date,
        make_payment_due_date: inst.make_payment_due_date,
        notes: inst.notes
      })
    }

    hasChanges.value = false
  } catch (err) {
    error.value = 'Failed to save changes. Please try again.'
  } finally {
    isSaving.value = false
  }
}

// Collector dropdown options (county name + municipality name if applicable)
const collectorOptions = computed(() => {
  const options = []
  if (props.county?.county_name) {
    options.push(props.county.county_name)
  }
  if (props.county?.municipality_name) {
    options.push(props.county.municipality_name)
  }
  return options
})

// Check if a collector value is a custom "Other" value
function isOtherCollector(value) {
  if (!value) return false
  return !collectorOptions.value.includes(value)
}

// Get the select value for a collector (returns '__other__' if custom)
function getCollectorSelectValue(value) {
  if (!value) return ''
  if (collectorOptions.value.includes(value)) return value
  return '__other__'
}

// Handle collector select change
function handleCollectorChange(inst, field, selectValue) {
  if (selectValue === '__other__') {
    // Keep existing custom value or clear it
    if (!isOtherCollector(inst[field])) {
      updateInstallmentField(inst, field, '')
    }
  } else {
    updateInstallmentField(inst, field, selectValue)
  }
}

// Format date for display
function formatDate(date) {
  if (!date) return ''
  if (typeof date === 'string' && date.includes('T')) {
    return date.split('T')[0]
  }
  return date
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
      <!-- Tax Year & Basic Info Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Tax Dates & Info</h3>
          <p class="text-sm text-gray-500 mt-1">Configure tax year and payment schedule</p>
        </div>

        <div class="p-6 space-y-6">
          <!-- Tax Year & Installments -->
          <div class="grid grid-cols-3 gap-6">
            <div>
              <label class="input-label">
                <Calendar class="w-4 h-4 inline mr-1.5" />
                Tax Year
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
                # Installments
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

            <div>
              <label class="input-label">Search by Installments?</label>
              <div class="mt-2">
                <label class="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="form.search_by_installments"
                    class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span class="text-sm text-gray-700">Yes</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Tax Dates Notes -->
          <div>
            <label class="input-label">Tax Dates Notes</label>
            <textarea
              v-model="form.tax_dates_notes"
              rows="2"
              placeholder="Any notes about tax dates..."
              class="input"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Installments Card (always shown) -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Installments</h3>
            <p class="text-sm text-gray-500 mt-1">Configure each installment's dates and collectors</p>
          </div>
          <button
            @click="addInstallment"
            class="btn btn-primary btn-sm"
          >
            <Plus class="w-4 h-4" />
            Add Installment
          </button>
        </div>

        <div class="p-6">
          <div v-if="isLoadingInstallments" class="text-center py-8 text-gray-500">
            Loading installments...
          </div>

          <div v-else-if="installments.length === 0" class="text-center py-8 text-gray-500">
            No installments configured. Click "Add Installment" to create one.
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="inst in installments"
              :key="inst.id"
              class="border border-gray-200 rounded-lg overflow-hidden"
            >
              <!-- Installment Header -->
              <div
                @click="toggleInstallment(inst.id)"
                class="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100"
              >
                <div class="flex items-center gap-3">
                  <component
                    :is="expandedInstallments[inst.id] ? ChevronUp : ChevronDown"
                    class="w-4 h-4 text-gray-500"
                  />
                  <h4 class="font-medium text-gray-900">Installment {{ inst.installment_number }}</h4>
                  <span v-if="inst.due_date" class="text-sm text-gray-500">
                    Due: {{ formatDate(inst.due_date) }}
                  </span>
                </div>
                <button
                  @click.stop="deleteInstallment(inst)"
                  class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  title="Delete installment"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>

              <!-- Installment Details (expandable) -->
              <div v-if="expandedInstallments[inst.id]" class="p-4 space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="input-label">Due Date</label>
                    <input
                      :value="formatDate(inst.due_date)"
                      @input="updateInstallmentField(inst, 'due_date', $event.target.value)"
                      type="text"
                      placeholder="MM/DD/YYYY"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">Delq Collector</label>
                    <select
                      :value="getCollectorSelectValue(inst.delq_collector)"
                      @change="handleCollectorChange(inst, 'delq_collector', $event.target.value)"
                      class="input"
                    >
                      <option value="">Select collector...</option>
                      <option v-for="opt in collectorOptions" :key="opt" :value="opt">{{ opt }}</option>
                      <option value="__other__">Other...</option>
                    </select>
                    <input
                      v-if="isOtherCollector(inst.delq_collector) || getCollectorSelectValue(inst.delq_collector) === '__other__'"
                      :value="inst.delq_collector"
                      @input="updateInstallmentField(inst, 'delq_collector', $event.target.value)"
                      type="text"
                      placeholder="Enter custom collector..."
                      class="input mt-2"
                    />
                  </div>

                  <div>
                    <label class="input-label">Escrow Collector</label>
                    <select
                      :value="getCollectorSelectValue(inst.escrow_collector)"
                      @change="handleCollectorChange(inst, 'escrow_collector', $event.target.value)"
                      class="input"
                    >
                      <option value="">Select collector...</option>
                      <option v-for="opt in collectorOptions" :key="opt" :value="opt">{{ opt }}</option>
                      <option value="__other__">Other...</option>
                    </select>
                    <input
                      v-if="isOtherCollector(inst.escrow_collector) || getCollectorSelectValue(inst.escrow_collector) === '__other__'"
                      :value="inst.escrow_collector"
                      @input="updateInstallmentField(inst, 'escrow_collector', $event.target.value)"
                      type="text"
                      placeholder="Enter custom collector..."
                      class="input mt-2"
                    />
                  </div>

                  <div>
                    <label class="input-label">Escrow Search Start Date</label>
                    <input
                      :value="formatDate(inst.escrow_search_start_date)"
                      @input="updateInstallmentField(inst, 'escrow_search_start_date', $event.target.value)"
                      type="text"
                      placeholder="MM/DD/YYYY"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">Tax Billing Date</label>
                    <input
                      :value="formatDate(inst.tax_billing_date)"
                      @input="updateInstallmentField(inst, 'tax_billing_date', $event.target.value)"
                      type="text"
                      placeholder="MM/DD/YYYY"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">PreCommitment Date</label>
                    <input
                      :value="formatDate(inst.precommitment_date)"
                      @input="updateInstallmentField(inst, 'precommitment_date', $event.target.value)"
                      type="text"
                      placeholder="MM/DD/YYYY"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">Finalize Balance Date</label>
                    <input
                      :value="formatDate(inst.finalize_balance_date)"
                      @input="updateInstallmentField(inst, 'finalize_balance_date', $event.target.value)"
                      type="text"
                      placeholder="MM/DD/YYYY"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">Make Payment Due Date</label>
                    <input
                      :value="formatDate(inst.make_payment_due_date)"
                      @input="updateInstallmentField(inst, 'make_payment_due_date', $event.target.value)"
                      type="text"
                      placeholder="MM/DD/YYYY"
                      class="input"
                    />
                  </div>
                </div>

                <div>
                  <label class="input-label">Notes</label>
                  <textarea
                    :value="inst.notes"
                    @input="updateInstallmentField(inst, 'notes', $event.target.value)"
                    rows="2"
                    placeholder="Installment notes..."
                    class="input"
                  ></textarea>
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
