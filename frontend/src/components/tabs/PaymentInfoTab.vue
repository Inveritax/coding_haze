<script setup>
import { ref, watch, computed } from 'vue'
import { Save, AlertCircle, ChevronDown, ChevronUp, Globe, Phone, Mail } from 'lucide-vue-next'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save'])

// Preset options for "dropdown with ability to add values" fields
const preferredMethodOptions = ['Online', 'Phone', 'Email']
const thirdPartyOptions = ['AutoAgent', 'GovTech', 'Tax & Tags']

// Local form state
const form = ref({
  pmt_preferred_method: '',
  pmt_amounts_url: '',
  pmt_amounts_phone: '',
  pmt_amounts_email: '',
  pmt_bulk_upload_allowed: null,
  pmt_bulk_upload_format: '',
  pmt_tax_roll_required: null,
  pmt_tax_roll_cost: '',
  pmt_third_party_name: '',
  pmt_third_party_fee: '',
  pmt_third_party_file_format: '',
  pmt_original_bill_required: null,
  pmt_how_to_obtain_bill: '',
  pmt_duplicate_bill_fee_yn: null,
  pmt_duplicate_bill_fee: '',
  pmt_precommit_required: null,
  pmt_precommit_file_format: '',
  pmt_method_wire: false,
  pmt_method_ach: false,
  pmt_method_check: false,
  pmt_method_other: '',
  pmt_wire_instructions: '',
  pmt_ach_instructions: '',
  pmt_check_instructions: '',
  pmt_other_instructions: '',
  pmt_wire_ach_contact_name: '',
  pmt_wire_ach_contact_info: '',
  pmt_notes: ''
})

// Custom value tracking for "dropdown + other" fields
const customPreferredMethod = ref('')
const customThirdParty = ref('')
const useCustomPreferred = ref(false)
const useCustomThirdParty = ref(false)

const hasChanges = ref(false)
const isSaving = ref(false)
const error = ref('')

// Collapsible sections
const expandedSections = ref({
  amounts: true,
  parcels: true,
  thirdParty: true,
  taxBill: true,
  precommit: true,
  methods: true,
  notes: true
})

function toggleSection(key) {
  expandedSections.value[key] = !expandedSections.value[key]
}

// Determine if the current preferred method value is a preset or custom
function initCustomFields(county) {
  const pm = county.pmt_preferred_method || ''
  if (pm && !preferredMethodOptions.includes(pm)) {
    useCustomPreferred.value = true
    customPreferredMethod.value = pm
  } else {
    useCustomPreferred.value = false
    customPreferredMethod.value = ''
  }

  const tp = county.pmt_third_party_name || ''
  if (tp && !thirdPartyOptions.includes(tp)) {
    useCustomThirdParty.value = true
    customThirdParty.value = tp
  } else {
    useCustomThirdParty.value = false
    customThirdParty.value = ''
  }
}

// Watch for county changes to reset form
watch(() => props.county, (newCounty) => {
  if (newCounty) {
    form.value = {
      pmt_preferred_method: newCounty.pmt_preferred_method || '',
      pmt_amounts_url: newCounty.pmt_amounts_url || '',
      pmt_amounts_phone: newCounty.pmt_amounts_phone || '',
      pmt_amounts_email: newCounty.pmt_amounts_email || '',
      pmt_bulk_upload_allowed: newCounty.pmt_bulk_upload_allowed ?? null,
      pmt_bulk_upload_format: newCounty.pmt_bulk_upload_format || '',
      pmt_tax_roll_required: newCounty.pmt_tax_roll_required ?? null,
      pmt_tax_roll_cost: newCounty.pmt_tax_roll_cost || '',
      pmt_third_party_name: newCounty.pmt_third_party_name || '',
      pmt_third_party_fee: newCounty.pmt_third_party_fee || '',
      pmt_third_party_file_format: newCounty.pmt_third_party_file_format || '',
      pmt_original_bill_required: newCounty.pmt_original_bill_required ?? null,
      pmt_how_to_obtain_bill: newCounty.pmt_how_to_obtain_bill || '',
      pmt_duplicate_bill_fee_yn: newCounty.pmt_duplicate_bill_fee_yn ?? null,
      pmt_duplicate_bill_fee: newCounty.pmt_duplicate_bill_fee || '',
      pmt_precommit_required: newCounty.pmt_precommit_required ?? null,
      pmt_precommit_file_format: newCounty.pmt_precommit_file_format || '',
      pmt_method_wire: newCounty.pmt_method_wire || false,
      pmt_method_ach: newCounty.pmt_method_ach || false,
      pmt_method_check: newCounty.pmt_method_check || false,
      pmt_method_other: newCounty.pmt_method_other || '',
      pmt_wire_instructions: newCounty.pmt_wire_instructions || '',
      pmt_ach_instructions: newCounty.pmt_ach_instructions || '',
      pmt_check_instructions: newCounty.pmt_check_instructions || '',
      pmt_other_instructions: newCounty.pmt_other_instructions || '',
      pmt_wire_ach_contact_name: newCounty.pmt_wire_ach_contact_name || '',
      pmt_wire_ach_contact_info: newCounty.pmt_wire_ach_contact_info || '',
      pmt_notes: newCounty.pmt_notes || ''
    }
    initCustomFields(newCounty)
    hasChanges.value = false
  }
}, { immediate: true })

// Watch for form changes
watch(form, () => {
  hasChanges.value = true
}, { deep: true })

// Handle dropdown with custom "Other" logic
function onPreferredMethodChange(val) {
  if (val === '__custom__') {
    useCustomPreferred.value = true
    form.value.pmt_preferred_method = ''
  } else {
    useCustomPreferred.value = false
    customPreferredMethod.value = ''
    form.value.pmt_preferred_method = val
  }
}

function onThirdPartyChange(val) {
  if (val === '__custom__') {
    useCustomThirdParty.value = true
    form.value.pmt_third_party_name = ''
  } else {
    useCustomThirdParty.value = false
    customThirdParty.value = ''
    form.value.pmt_third_party_name = val
  }
}

// Computed select values for dropdowns
const preferredMethodSelect = computed(() => {
  if (useCustomPreferred.value) return '__custom__'
  return form.value.pmt_preferred_method
})

const thirdPartySelect = computed(() => {
  if (useCustomThirdParty.value) return '__custom__'
  return form.value.pmt_third_party_name
})

// Save handler
async function handleSave() {
  isSaving.value = true
  error.value = ''

  try {
    // Resolve custom dropdown values before saving
    const saveData = { ...form.value }
    if (useCustomPreferred.value && customPreferredMethod.value) {
      saveData.pmt_preferred_method = customPreferredMethod.value
    }
    if (useCustomThirdParty.value && customThirdParty.value) {
      saveData.pmt_third_party_name = customThirdParty.value
    }

    await emit('save', saveData)
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

      <!-- ─── Section 1: Providing Amounts ─── -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button @click="toggleSection('amounts')" class="w-full p-6 flex items-center justify-between text-left">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Providing Amounts</h3>
            <p class="text-sm text-gray-500 mt-1">Preferred method for providing payment amounts</p>
          </div>
          <component :is="expandedSections.amounts ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </button>

        <div v-if="expandedSections.amounts" class="px-6 pb-6 space-y-4">
          <div>
            <label class="input-label">Preferred Method of Providing Amounts</label>
            <div class="flex gap-3">
              <select
                :value="preferredMethodSelect"
                @change="onPreferredMethodChange($event.target.value)"
                class="input flex-1"
              >
                <option value="">Select...</option>
                <option v-for="opt in preferredMethodOptions" :key="opt" :value="opt">{{ opt }}</option>
                <option value="__custom__">Other (specify)</option>
              </select>
              <input
                v-if="useCustomPreferred"
                v-model="customPreferredMethod"
                @input="form.pmt_preferred_method = customPreferredMethod"
                type="text"
                placeholder="Enter custom method..."
                class="input flex-1"
              />
            </div>
          </div>

          <!-- Contact Information for Providing Amounts -->
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="input-label">
                <Globe class="w-4 h-4 inline mr-1.5" />
                URL
              </label>
              <input
                v-model="form.pmt_amounts_url"
                type="url"
                placeholder="https://example.com"
                class="input"
              />
            </div>

            <div>
              <label class="input-label">
                <Phone class="w-4 h-4 inline mr-1.5" />
                Phone
              </label>
              <input
                v-model="form.pmt_amounts_phone"
                type="tel"
                placeholder="(555) 555-5555"
                class="input"
              />
            </div>

            <div>
              <label class="input-label">
                <Mail class="w-4 h-4 inline mr-1.5" />
                Email
              </label>
              <input
                v-model="form.pmt_amounts_email"
                type="email"
                placeholder="email@example.com"
                class="input"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Section 2: Paying on Multiple Parcels ─── -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button @click="toggleSection('parcels')" class="w-full p-6 flex items-center justify-between text-left">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Paying on Multiple Parcels</h3>
            <p class="text-sm text-gray-500 mt-1">Bulk upload and tax roll settings</p>
          </div>
          <component :is="expandedSections.parcels ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </button>

        <div v-if="expandedSections.parcels" class="px-6 pb-6 space-y-4">
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="input-label">Bulk TK# Upload Allowed for Payment?</label>
              <select v-model="form.pmt_bulk_upload_allowed" class="input">
                <option :value="null">Select...</option>
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>

            <div v-if="form.pmt_bulk_upload_allowed === true">
              <label class="input-label">Format of Bulk Upload</label>
              <input v-model="form.pmt_bulk_upload_format" type="text" placeholder="File format or specifications" class="input" />
            </div>
          </div>

          <hr class="border-gray-100" />

          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="input-label">Tax Roll Required for Bulk Payment?</label>
              <select v-model="form.pmt_tax_roll_required" class="input">
                <option :value="null">Select...</option>
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>

            <div v-if="form.pmt_tax_roll_required === true">
              <label class="input-label">Cost of Tax Roll</label>
              <input v-model="form.pmt_tax_roll_cost" type="text" placeholder="e.g., $50.00" class="input" />
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Section 3: Third Party Payment Co. ─── -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button @click="toggleSection('thirdParty')" class="w-full p-6 flex items-center justify-between text-left">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Third Party Payment Company</h3>
            <p class="text-sm text-gray-500 mt-1">Third party agency details, if applicable</p>
          </div>
          <component :is="expandedSections.thirdParty ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </button>

        <div v-if="expandedSections.thirdParty" class="px-6 pb-6 space-y-4">
          <div>
            <label class="input-label">Third Party Agency Name</label>
            <div class="flex gap-3">
              <select
                :value="thirdPartySelect"
                @change="onThirdPartyChange($event.target.value)"
                class="input flex-1"
              >
                <option value="">Select...</option>
                <option v-for="opt in thirdPartyOptions" :key="opt" :value="opt">{{ opt }}</option>
                <option value="__custom__">Other (specify)</option>
              </select>
              <input
                v-if="useCustomThirdParty"
                v-model="customThirdParty"
                @input="form.pmt_third_party_name = customThirdParty"
                type="text"
                placeholder="Enter agency name..."
                class="input flex-1"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="input-label">Fee per Parcel</label>
              <input v-model="form.pmt_third_party_fee" type="text" placeholder="e.g., $0.75/parcel" class="input" />
            </div>

            <div>
              <label class="input-label">File Format</label>
              <input v-model="form.pmt_third_party_file_format" type="text" placeholder="File format or specifications" class="input" />
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Section 4: Tax Bill Requirements ─── -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button @click="toggleSection('taxBill')" class="w-full p-6 flex items-center justify-between text-left">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Tax Bill Requirements</h3>
            <p class="text-sm text-gray-500 mt-1">Original and duplicate tax bill requirements</p>
          </div>
          <component :is="expandedSections.taxBill ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </button>

        <div v-if="expandedSections.taxBill" class="px-6 pb-6 space-y-4">
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="input-label">Original Tax Bill Required for Payment?</label>
              <select v-model="form.pmt_original_bill_required" class="input">
                <option :value="null">Select...</option>
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>

            <div>
              <label class="input-label">How to Obtain the Tax Bill</label>
              <input v-model="form.pmt_how_to_obtain_bill" type="text" placeholder="Instructions for obtaining tax bill" class="input" />
            </div>
          </div>

          <hr class="border-gray-100" />

          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="input-label">Duplicate Tax Bill Fee?</label>
              <select v-model="form.pmt_duplicate_bill_fee_yn" class="input">
                <option :value="null">Select...</option>
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>

            <div v-if="form.pmt_duplicate_bill_fee_yn === true">
              <label class="input-label">Duplicate Tax Bill Fee Amount</label>
              <input v-model="form.pmt_duplicate_bill_fee" type="text" placeholder="e.g., $5.00" class="input" />
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Section 5: PreCommit ─── -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button @click="toggleSection('precommit')" class="w-full p-6 flex items-center justify-between text-left">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">PreCommit</h3>
            <p class="text-sm text-gray-500 mt-1">PreCommit requirements and file format</p>
          </div>
          <component :is="expandedSections.precommit ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </button>

        <div v-if="expandedSections.precommit" class="px-6 pb-6 space-y-4">
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="input-label">PreCommit Required?</label>
              <select v-model="form.pmt_precommit_required" class="input">
                <option :value="null">Select...</option>
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>

            <div v-if="form.pmt_precommit_required === true">
              <label class="input-label">PreCommit File Format</label>
              <input v-model="form.pmt_precommit_file_format" type="text" placeholder="File format or specifications" class="input" />
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Section 6: Payment Methods & Instructions ─── -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button @click="toggleSection('methods')" class="w-full p-6 flex items-center justify-between text-left">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Payment Methods & Instructions</h3>
            <p class="text-sm text-gray-500 mt-1">Accepted payment methods and internal instructions</p>
          </div>
          <component :is="expandedSections.methods ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </button>

        <div v-if="expandedSections.methods" class="px-6 pb-6 space-y-6">
          <!-- Payment Methods Checkboxes -->
          <div>
            <label class="input-label mb-3">Payment Methods Accepted</label>
            <div class="flex flex-wrap gap-6">
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.pmt_method_wire" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span class="text-sm text-gray-700">Wire</span>
              </label>
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.pmt_method_ach" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span class="text-sm text-gray-700">ACH</span>
              </label>
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.pmt_method_check" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span class="text-sm text-gray-700">Check</span>
              </label>
            </div>
            <div class="mt-3">
              <label class="input-label">Other Payment Method</label>
              <input v-model="form.pmt_method_other" type="text" placeholder="e.g., e-Check, Municpay, etc." class="input" />
            </div>
          </div>

          <!-- Conditional Instructions -->
          <div v-if="form.pmt_method_wire || form.pmt_method_ach || form.pmt_method_check || form.pmt_method_other" class="space-y-4">
            <hr class="border-gray-100" />
            <p class="text-xs text-gray-500 uppercase tracking-wide font-semibold">Instructions (internal only)</p>

            <div v-if="form.pmt_method_wire">
              <label class="input-label">Wire Instructions</label>
              <textarea v-model="form.pmt_wire_instructions" rows="3" placeholder="Wire transfer instructions..." class="input"></textarea>
            </div>

            <div v-if="form.pmt_method_ach">
              <label class="input-label">ACH Instructions</label>
              <textarea v-model="form.pmt_ach_instructions" rows="3" placeholder="ACH payment instructions..." class="input"></textarea>
            </div>

            <div v-if="form.pmt_method_check">
              <label class="input-label">Check Instructions</label>
              <textarea v-model="form.pmt_check_instructions" rows="3" placeholder="Check payment instructions..." class="input"></textarea>
            </div>

            <div v-if="form.pmt_method_other">
              <label class="input-label">Other Payment Instructions</label>
              <textarea v-model="form.pmt_other_instructions" rows="3" placeholder="Other payment instructions..." class="input"></textarea>
            </div>
          </div>

          <!-- Payment Contact -->
          <div>
            <hr class="border-gray-100 mb-4" />
            <p class="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Wire / ACH Contact</p>
            <div class="grid grid-cols-2 gap-6">
              <div>
                <label class="input-label">Contact Name</label>
                <input v-model="form.pmt_wire_ach_contact_name" type="text" placeholder="Name of contact for Wire/ACH" class="input" />
              </div>
              <div>
                <label class="input-label">Contact Email or Phone</label>
                <input v-model="form.pmt_wire_ach_contact_info" type="text" placeholder="Email or phone number" class="input" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Section 7: Payment Notes ─── -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button @click="toggleSection('notes')" class="w-full p-6 flex items-center justify-between text-left">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Payment Notes</h3>
            <p class="text-sm text-gray-500 mt-1">General payment-related notes</p>
          </div>
          <component :is="expandedSections.notes ? ChevronUp : ChevronDown" class="w-5 h-5 text-gray-400" />
        </button>

        <div v-if="expandedSections.notes" class="px-6 pb-6">
          <textarea v-model="form.pmt_notes" rows="4" placeholder="Any additional payment notes..." class="input"></textarea>
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
