<script setup>
import { computed } from 'vue'
import {
  Calendar,
  Hash,
  User,
  Phone,
  Mail,
  MapPin,
  Building,
  Globe,
  CreditCard,
  Printer,
  FileText,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-vue-next'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['navigate-tab'])

// Computed properties for display
const displayName = computed(() => props.county.municipality_name || props.county.county_name)
const jurisdictionLabel = computed(() => props.county.jurisdiction_type === 'municipality' ? 'Municipality' : 'County')

// Check if data exists
const hasTaxInfo = computed(() => props.county.current_tax_year || props.county.num_installments)
const hasContact = computed(() => props.county.primary_contact_name || props.county.primary_contact_phone || props.county.primary_contact_email)
const hasAddresses = computed(() => props.county.tax_authority_physical_address || props.county.tax_authority_mailing_address)
const hasOnline = computed(() => props.county.web_address || props.county.county_website || props.county.pay_taxes_url)
const hasAdditional = computed(() => props.county.general_phone_number || props.county.fax_number || props.county.notes)

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return ''
  // Check if it's an ISO date string
  if (dateStr.includes('T') || dateStr.includes('-')) {
    try {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
    } catch {
      // Fall through to return original
    }
  }
  // Return as-is if not a parseable date (could be "VARIES", "TBD", etc.)
  return dateStr
}

// Get due dates as array
const dueDates = computed(() => {
  const dates = []
  const num = parseInt(props.county.num_installments) || 0
  for (let i = 1; i <= Math.min(num, 10); i++) {
    if (props.county[`due_date_${i}`]) {
      dates.push({ num: i, date: props.county[`due_date_${i}`], formatted: formatDate(props.county[`due_date_${i}`]) })
    }
  }
  return dates
})

// Completion status with tab navigation
const completionItems = computed(() => {
  return [
    { label: 'Tax Year', complete: !!props.county.current_tax_year, tab: 'tax' },
    { label: 'Installments', complete: !!props.county.num_installments, tab: 'tax' },
    { label: 'Due Dates', complete: dueDates.value.length > 0, tab: 'tax' },
    { label: 'Contact', complete: !!props.county.primary_contact_name, tab: 'contact' },
    { label: 'Phone', complete: !!props.county.primary_contact_phone || !!props.county.general_phone_number, tab: 'additional' },
    { label: 'Email', complete: !!props.county.primary_contact_email, tab: 'contact' },
    { label: 'Address', complete: !!props.county.tax_authority_physical_address, tab: 'address' },
    { label: 'Website', complete: !!props.county.web_address || !!props.county.county_website, tab: 'online' },
    { label: 'Payment URL', complete: !!props.county.pay_taxes_url, tab: 'online' }
  ]
})

// Navigate to tab
function goToTab(tab) {
  emit('navigate-tab', tab)
}

const completionPercentage = computed(() => {
  const complete = completionItems.value.filter(i => i.complete).length
  return Math.round((complete / completionItems.value.length) * 100)
})

// Open URL helper
function openUrl(url) {
  if (!url) return
  const fullUrl = url.startsWith('http') ? url : `https://${url}`
  window.open(fullUrl, '_blank')
}
</script>

<template>
  <div class="max-w-5xl space-y-6">
    <!-- Header Card -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">{{ displayName }}</h2>
          <p class="text-gray-500 mt-1">
            {{ county.state }} · {{ jurisdictionLabel }}
            <span v-if="county.jurisdiction_type === 'municipality'" class="text-gray-400">
              · {{ county.county_name.endsWith(' County') ? county.county_name : county.county_name + ' County' }}
            </span>
          </p>
        </div>

        <!-- Completion Ring -->
        <div class="flex items-center gap-3">
          <div class="relative w-16 h-16">
            <svg class="w-16 h-16 -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke-width="6"
                fill="none"
                class="stroke-gray-200"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke-width="6"
                fill="none"
                :stroke-dasharray="`${completionPercentage * 1.76} 176`"
                :class="[
                  completionPercentage === 100 ? 'stroke-green-500' :
                  completionPercentage >= 70 ? 'stroke-primary-500' :
                  completionPercentage >= 40 ? 'stroke-amber-500' : 'stroke-red-500'
                ]"
                stroke-linecap="round"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-700">
              {{ completionPercentage }}%
            </span>
          </div>
          <div class="text-sm">
            <p class="font-medium text-gray-900">Data Complete</p>
            <p class="text-gray-500">{{ completionItems.filter(i => i.complete).length }}/{{ completionItems.length }} fields</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Reference Cards Grid -->
    <div class="grid grid-cols-2 gap-6">
      <!-- Tax Information Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-4 border-b border-gray-200 flex items-center gap-2">
          <Calendar class="w-5 h-5 text-primary-600" />
          <h3 class="font-semibold text-gray-900">Tax Information</h3>
        </div>
        <div class="p-4">
          <div v-if="hasTaxInfo" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-gray-500 uppercase font-medium">Tax Year</p>
                <p class="text-lg font-semibold text-gray-900">{{ county.current_tax_year || '-' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 uppercase font-medium">Installments</p>
                <p class="text-lg font-semibold text-gray-900">{{ county.num_installments || '-' }}</p>
              </div>
            </div>

            <!-- Due Dates -->
            <div v-if="dueDates.length > 0">
              <p class="text-xs text-gray-500 uppercase font-medium mb-2">Due Dates</p>
              <div class="overflow-x-auto pb-2 -mx-1 px-1">
                <div class="flex gap-2 min-w-max">
                  <span
                    v-for="due in dueDates"
                    :key="due.num"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-primary-50 text-primary-700 text-sm rounded-lg whitespace-nowrap"
                  >
                    <Clock class="w-3.5 h-3.5 flex-shrink-0" />
                    <span class="font-medium">#{{ due.num }}:</span>
                    {{ due.formatted }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-4 text-gray-400 text-sm">
            No tax information available
          </div>
        </div>
      </div>

      <!-- Contact Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-4 border-b border-gray-200 flex items-center gap-2">
          <User class="w-5 h-5 text-primary-600" />
          <h3 class="font-semibold text-gray-900">Primary Contact</h3>
        </div>
        <div class="p-4">
          <div v-if="hasContact" class="space-y-3">
            <div v-if="county.primary_contact_name" class="flex items-start gap-3">
              <div class="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User class="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p class="font-medium text-gray-900">{{ county.primary_contact_name }}</p>
                <p v-if="county.primary_contact_title" class="text-sm text-gray-500">{{ county.primary_contact_title }}</p>
              </div>
            </div>

            <div class="space-y-2 mt-3">
              <div v-if="county.primary_contact_phone" class="flex items-center gap-2 text-sm">
                <Phone class="w-4 h-4 text-gray-400" />
                <span class="text-gray-700">{{ county.primary_contact_phone }}</span>
              </div>
              <div v-if="county.primary_contact_email" class="flex items-center gap-2 text-sm">
                <Mail class="w-4 h-4 text-gray-400" />
                <a :href="`mailto:${county.primary_contact_email}`" class="text-primary-600 hover:underline">
                  {{ county.primary_contact_email }}
                </a>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-4 text-gray-400 text-sm">
            No contact information available
          </div>
        </div>
      </div>

      <!-- Addresses Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-4 border-b border-gray-200 flex items-center gap-2">
          <MapPin class="w-5 h-5 text-primary-600" />
          <h3 class="font-semibold text-gray-900">Addresses</h3>
        </div>
        <div class="p-4">
          <div v-if="hasAddresses" class="grid grid-cols-2 gap-4">
            <div v-if="county.tax_authority_physical_address">
              <p class="text-xs text-gray-500 uppercase font-medium mb-2 flex items-center gap-1">
                <Building class="w-3.5 h-3.5" />
                Physical
              </p>
              <p class="text-sm text-gray-700 whitespace-pre-line">{{ county.tax_authority_physical_address }}</p>
            </div>
            <div v-if="county.tax_authority_mailing_address">
              <p class="text-xs text-gray-500 uppercase font-medium mb-2 flex items-center gap-1">
                <MapPin class="w-3.5 h-3.5" />
                Mailing
              </p>
              <p class="text-sm text-gray-700 whitespace-pre-line">{{ county.tax_authority_mailing_address }}</p>
            </div>
          </div>
          <div v-else class="text-center py-4 text-gray-400 text-sm">
            No address information available
          </div>
        </div>
      </div>

      <!-- Online Resources Card -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div class="p-4 border-b border-gray-200 flex items-center gap-2">
          <Globe class="w-5 h-5 text-primary-600" />
          <h3 class="font-semibold text-gray-900">Online Resources</h3>
        </div>
        <div class="p-4">
          <div v-if="hasOnline" class="space-y-3">
            <button
              v-if="county.web_address"
              @click="openUrl(county.web_address)"
              class="flex items-center gap-3 w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
            >
              <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Globe class="w-5 h-5 text-blue-600" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900">Main Website</p>
                <p class="text-xs text-gray-500 truncate">{{ county.web_address }}</p>
              </div>
              <ExternalLink class="w-4 h-4 text-gray-400" />
            </button>

            <button
              v-if="county.county_website"
              @click="openUrl(county.county_website)"
              class="flex items-center gap-3 w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
            >
              <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building class="w-5 h-5 text-purple-600" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900">County Website</p>
                <p class="text-xs text-gray-500 truncate">{{ county.county_website }}</p>
              </div>
              <ExternalLink class="w-4 h-4 text-gray-400" />
            </button>

            <button
              v-if="county.pay_taxes_url"
              @click="openUrl(county.pay_taxes_url)"
              class="flex items-center gap-3 w-full p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left"
            >
              <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CreditCard class="w-5 h-5 text-green-600" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900">Pay Taxes Online</p>
                <p class="text-xs text-gray-500 truncate">{{ county.pay_taxes_url }}</p>
              </div>
              <ExternalLink class="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div v-else class="text-center py-4 text-gray-400 text-sm">
            No online resources available
          </div>
        </div>
      </div>
    </div>

    <!-- Additional Info Card (Full Width) -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="p-4 border-b border-gray-200 flex items-center gap-2">
        <FileText class="w-5 h-5 text-primary-600" />
        <h3 class="font-semibold text-gray-900">Additional Information</h3>
      </div>
      <div class="p-4">
        <div v-if="hasAdditional">
          <div class="grid grid-cols-3 gap-6">
            <!-- Phone Numbers -->
            <div v-if="county.general_phone_number" class="flex items-center gap-3">
              <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Phone class="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p class="text-xs text-gray-500">General Phone</p>
                <p class="text-sm font-medium text-gray-900">{{ county.general_phone_number }}</p>
              </div>
            </div>

            <div v-if="county.fax_number" class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Printer class="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p class="text-xs text-gray-500">Fax Number</p>
                <p class="text-sm font-medium text-gray-900">{{ county.fax_number }}</p>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="county.notes" class="mt-4 pt-4 border-t border-gray-100">
            <p class="text-xs text-gray-500 uppercase font-medium mb-2">Notes</p>
            <p class="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3">{{ county.notes }}</p>
          </div>
        </div>
        <div v-else class="text-center py-4 text-gray-400 text-sm">
          No additional information available
        </div>
      </div>
    </div>

    <!-- Data Completion Checklist -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="p-4 border-b border-gray-200 flex items-center gap-2">
        <CheckCircle2 class="w-5 h-5 text-primary-600" />
        <h3 class="font-semibold text-gray-900">Data Completion Checklist</h3>
      </div>
      <div class="p-4">
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="item in completionItems"
            :key="item.label"
            @click="goToTab(item.tab)"
            :class="[
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all',
              item.complete
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            ]"
          >
            <CheckCircle2 v-if="item.complete" class="w-4 h-4 text-green-500 flex-shrink-0" />
            <AlertCircle v-else class="w-4 h-4 text-gray-400 flex-shrink-0" />
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
