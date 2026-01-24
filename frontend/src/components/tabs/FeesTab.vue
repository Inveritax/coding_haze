<script setup>
import { ref, watch, onMounted } from 'vue'
import { DollarSign, Save, AlertCircle, Plus, Trash2 } from 'lucide-vue-next'
import api from '../../services/api'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Fees from the expandable table
const fees = ref([])
const feeTypes = ref([])
const isLoading = ref(false)

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')

// Fee categories
const feeCategories = [
  { value: 'delq', label: 'Delinquent' },
  { value: 'escrow', label: 'Escrow' }
]

// Watch for county changes to reload fees
watch(() => props.county, async (newCounty) => {
  if (newCounty?.research_id) {
    await loadFees(newCounty.research_id)
    hasChanges.value = false
  }
}, { immediate: true })

// Load fees from API
async function loadFees(researchId) {
  isLoading.value = true
  try {
    const response = await api.getFees(researchId)
    fees.value = response.data.fees || []
  } catch (err) {
    console.error('Failed to load fees:', err)
  } finally {
    isLoading.value = false
  }
}

// Load fee types for dropdown
onMounted(async () => {
  try {
    const response = await api.getFeeTypes()
    feeTypes.value = response.data.types || []
  } catch (err) {
    console.error('Failed to load fee types:', err)
  }
})

// Add new fee
async function addFee(category) {
  const existingInCategory = fees.value.filter(f => f.fee_category === category)
  const nextNumber = existingInCategory.length + 1

  try {
    const response = await api.createFee(props.county.research_id, {
      fee_category: category,
      fee_number: nextNumber
    })
    fees.value.push(response.data.fee)
    hasChanges.value = true
  } catch (err) {
    error.value = 'Failed to add fee'
  }
}

// Update fee field
function updateFeeField(fee, field, value) {
  fee[field] = value
  hasChanges.value = true
}

// Delete fee
async function deleteFee(fee) {
  if (!confirm(`Delete this ${fee.fee_category} fee?`)) return

  try {
    await api.deleteFee(fee.id)
    fees.value = fees.value.filter(f => f.id !== fee.id)
    hasChanges.value = true
  } catch (err) {
    error.value = 'Failed to delete fee'
  }
}

// Get fees by category
function getFeesByCategory(category) {
  return fees.value.filter(f => f.fee_category === category)
}

// Save handler
async function handleSave() {
  isSaving.value = true
  error.value = ''

  try {
    // Save all fees
    for (const fee of fees.value) {
      await api.updateFee(fee.id, {
        fee_category: fee.fee_category,
        fee_number: fee.fee_number,
        fee_type: fee.fee_type,
        fee_amount: fee.fee_amount,
        notes: fee.notes
      })
    }

    // Add any new fee types to the list
    const newTypes = fees.value
      .map(f => f.fee_type)
      .filter(t => t && !feeTypes.value.includes(t))
    feeTypes.value = [...feeTypes.value, ...newTypes]

    hasChanges.value = false
  } catch (err) {
    error.value = 'Failed to save changes. Please try again.'
  } finally {
    isSaving.value = false
  }
}

// Format currency
function formatCurrency(value) {
  if (!value) return ''
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return num.toFixed(2)
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
      <!-- Delinquent Fees Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Pass-Through Fees - Delinquent</h3>
            <p class="text-sm text-gray-500 mt-1">Fees passed through for delinquent tax payments</p>
          </div>
          <button
            @click="addFee('delq')"
            class="btn btn-primary btn-sm"
          >
            <Plus class="w-4 h-4" />
            Add Delq Fee
          </button>
        </div>

        <div class="p-6">
          <div v-if="isLoading" class="text-center py-4 text-gray-500">
            Loading fees...
          </div>

          <div v-else-if="getFeesByCategory('delq').length === 0" class="text-center py-4 text-gray-500">
            No delinquent fees configured.
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="(fee, index) in getFeesByCategory('delq')"
              :key="fee.id"
              class="border border-gray-200 rounded-lg p-4"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <label class="input-label">Fee Type</label>
                    <input
                      :value="fee.fee_type"
                      @input="updateFeeField(fee, 'fee_type', $event.target.value)"
                      type="text"
                      list="fee-types"
                      placeholder="e.g., Recording Fee"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">Amount</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        :value="formatCurrency(fee.fee_amount)"
                        @input="updateFeeField(fee, 'fee_amount', $event.target.value)"
                        type="text"
                        placeholder="0.00"
                        class="input pl-7"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="input-label">Notes</label>
                    <input
                      :value="fee.notes"
                      @input="updateFeeField(fee, 'notes', $event.target.value)"
                      type="text"
                      placeholder="Optional notes"
                      class="input"
                    />
                  </div>
                </div>

                <button
                  @click="deleteFee(fee)"
                  class="mt-6 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  title="Delete fee"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Escrow Fees Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Pass-Through Fees - Escrow</h3>
            <p class="text-sm text-gray-500 mt-1">Fees passed through for escrow tax payments</p>
          </div>
          <button
            @click="addFee('escrow')"
            class="btn btn-primary btn-sm"
          >
            <Plus class="w-4 h-4" />
            Add Escrow Fee
          </button>
        </div>

        <div class="p-6">
          <div v-if="isLoading" class="text-center py-4 text-gray-500">
            Loading fees...
          </div>

          <div v-else-if="getFeesByCategory('escrow').length === 0" class="text-center py-4 text-gray-500">
            No escrow fees configured.
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="(fee, index) in getFeesByCategory('escrow')"
              :key="fee.id"
              class="border border-gray-200 rounded-lg p-4"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <label class="input-label">Fee Type</label>
                    <input
                      :value="fee.fee_type"
                      @input="updateFeeField(fee, 'fee_type', $event.target.value)"
                      type="text"
                      list="fee-types"
                      placeholder="e.g., Processing Fee"
                      class="input"
                    />
                  </div>

                  <div>
                    <label class="input-label">Amount</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        :value="formatCurrency(fee.fee_amount)"
                        @input="updateFeeField(fee, 'fee_amount', $event.target.value)"
                        type="text"
                        placeholder="0.00"
                        class="input pl-7"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="input-label">Notes</label>
                    <input
                      :value="fee.notes"
                      @input="updateFeeField(fee, 'notes', $event.target.value)"
                      type="text"
                      placeholder="Optional notes"
                      class="input"
                    />
                  </div>
                </div>

                <button
                  @click="deleteFee(fee)"
                  class="mt-6 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  title="Delete fee"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Datalist for fee types -->
      <datalist id="fee-types">
        <option v-for="type in feeTypes" :key="type" :value="type" />
      </datalist>

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
