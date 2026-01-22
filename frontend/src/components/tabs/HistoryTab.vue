<script setup>
import { ref, watch, computed } from 'vue'
import { History, User, Calendar, ArrowRight, RefreshCw } from 'lucide-vue-next'
import api from '../../services/api'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const isLoading = ref(false)
const auditEntries = ref([])
const errorMessage = ref('')

// Field name to display label mapping
const fieldLabels = {
  current_tax_year: 'Current Tax Year',
  num_installments: '# of Installments',
  due_date_1: 'Due Date 1',
  due_date_2: 'Due Date 2',
  due_date_3: 'Due Date 3',
  due_date_4: 'Due Date 4',
  due_date_5: 'Due Date 5',
  due_date_6: 'Due Date 6',
  due_date_7: 'Due Date 7',
  due_date_8: 'Due Date 8',
  due_date_9: 'Due Date 9',
  due_date_10: 'Due Date 10',
  primary_contact_name: 'Primary Contact Name',
  primary_contact_title: 'Primary Contact Title',
  primary_contact_phone: 'Primary Contact Phone',
  primary_contact_email: 'Primary Contact Email',
  tax_authority_physical_address: 'Physical Address',
  tax_authority_mailing_address: 'Mailing Address',
  general_phone_number: 'General Phone',
  fax_number: 'Fax Number',
  web_address: 'Website',
  county_website: 'County Website',
  pay_taxes_url: 'Pay Taxes URL',
  notes: 'Notes'
}

function getFieldLabel(fieldName) {
  return fieldLabels[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Parse UTC timestamp from database and return local Date
function parseUTCTimestamp(dateStr) {
  if (!dateStr) return null
  try {
    // If the timestamp doesn't have a timezone indicator, treat it as UTC
    let isoStr = dateStr
    if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      isoStr = dateStr + 'Z'
    }
    const date = new Date(isoStr)
    if (!isNaN(date.getTime())) {
      return date
    }
  } catch {
    // Fall through
  }
  return null
}

// Get date key for grouping (YYYY-MM-DD in local time)
function getDateKey(dateStr) {
  const date = parseUTCTimestamp(dateStr)
  if (date) {
    // Use local date for grouping
    return date.toLocaleDateString('en-CA') // Returns YYYY-MM-DD format
  }
  return dateStr || ''
}

// Format date for display (day header)
function formatDateHeader(dateStr) {
  const date = parseUTCTimestamp(dateStr)
  if (date) {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }
  return dateStr || ''
}

// Format time for display (converts UTC to local)
function formatTime(dateStr) {
  const date = parseUTCTimestamp(dateStr)
  if (date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }
  return ''
}

// Format value for display
function formatValue(value) {
  if (value === null || value === undefined || value === '') {
    return '(empty)'
  }
  // Check if it's an ISO date
  if (typeof value === 'string' && (value.includes('T') || /^\d{4}-\d{2}-\d{2}$/.test(value))) {
    try {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
    } catch {
      // Fall through
    }
  }
  return value
}

// Group entries by date
const groupedEntries = computed(() => {
  const groups = {}

  for (const entry of auditEntries.value) {
    const dateKey = getDateKey(entry.created_at)
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: entry.created_at,
        dateKey,
        entries: []
      }
    }
    // Add display label to entry
    groups[dateKey].entries.push({
      ...entry,
      field_label: getFieldLabel(entry.field_name),
      changed_at: entry.created_at,
      changed_by: entry.username
    })
  }

  // Convert to array and sort by date descending
  return Object.values(groups).sort((a, b) => {
    return new Date(b.date) - new Date(a.date)
  })
})

// Total changes count
const totalChanges = computed(() => {
  return auditEntries.value.length
})

// Fetch edit history from API
async function fetchAuditLog() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const response = await api.getEditHistory(props.county.research_id)
    auditEntries.value = response.data.editHistory || []
  } catch (error) {
    console.error('Failed to fetch audit log:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to load edit history'
    auditEntries.value = []
  } finally {
    isLoading.value = false
  }
}

// Watch for county changes
watch(() => props.county?.research_id, () => {
  if (props.county?.research_id) {
    fetchAuditLog()
  }
}, { immediate: true })
</script>

<template>
  <div class="max-w-4xl">
    <!-- Error Notice -->
    <div v-if="errorMessage" class="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
      <History class="w-5 h-5 flex-shrink-0" />
      <div>
        <p class="text-sm font-medium">Error Loading Edit History</p>
        <p class="text-xs mt-0.5 text-red-600">{{ errorMessage }}</p>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Edit History</h3>
          <p class="text-sm text-gray-500 mt-1">Track all changes made to this jurisdiction's data</p>
        </div>
        <button
          @click="fetchAuditLog"
          :disabled="isLoading"
          class="btn btn-secondary"
        >
          <RefreshCw :class="['w-4 h-4', isLoading ? 'animate-spin' : '']" />
          Refresh
        </button>
      </div>

      <div class="p-6">
        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <RefreshCw class="w-6 h-6 text-primary-600 animate-spin" />
        </div>

        <!-- Empty State -->
        <div v-else-if="groupedEntries.length === 0" class="text-center py-12">
          <History class="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 class="text-lg font-medium text-gray-900 mb-2">No Edit History</h4>
          <p class="text-gray-500 text-sm">No changes have been recorded for this jurisdiction yet.</p>
        </div>

        <!-- Grouped Audit Log Timeline -->
        <div v-else class="space-y-6">
          <div
            v-for="group in groupedEntries"
            :key="group.dateKey"
            class="relative pl-8 border-l-2 border-gray-200 last:border-transparent"
          >
            <!-- Timeline Dot -->
            <div class="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 bg-primary-100 border-2 border-primary-500 rounded-full"></div>

            <!-- Day Card -->
            <div class="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <!-- Day Header -->
              <div class="px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Calendar class="w-4 h-4 text-gray-500" />
                  <span class="font-medium text-gray-900">{{ formatDateHeader(group.date) }}</span>
                </div>
                <span class="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                  {{ group.entries.length }} {{ group.entries.length === 1 ? 'change' : 'changes' }}
                </span>
              </div>

              <!-- Changes List -->
              <div class="divide-y divide-gray-200">
                <div
                  v-for="entry in group.entries"
                  :key="entry.id"
                  class="p-4"
                >
                  <!-- Entry Header -->
                  <div class="flex items-start justify-between mb-3">
                    <div>
                      <p class="font-medium text-gray-900">{{ entry.field_label }}</p>
                      <p class="text-xs text-gray-500 font-mono">{{ entry.field_name }}</p>
                    </div>
                    <div class="text-right text-xs text-gray-500">
                      <div class="flex items-center gap-1.5">
                        <User class="w-3.5 h-3.5" />
                        {{ entry.changed_by }}
                      </div>
                      <div class="mt-0.5">{{ formatTime(entry.changed_at) }}</div>
                    </div>
                  </div>

                  <!-- Value Change -->
                  <div class="flex items-center gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-xs text-gray-500 uppercase font-medium mb-1">Previous</p>
                      <p :class="[
                        'text-sm px-3 py-2 rounded-lg truncate',
                        entry.old_value ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white text-gray-400 italic border border-gray-200'
                      ]">
                        {{ formatValue(entry.old_value) }}
                      </p>
                    </div>

                    <ArrowRight class="w-5 h-5 text-gray-400 flex-shrink-0" />

                    <div class="flex-1 min-w-0">
                      <p class="text-xs text-gray-500 uppercase font-medium mb-1">New</p>
                      <p :class="[
                        'text-sm px-3 py-2 rounded-lg truncate',
                        entry.new_value ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-white text-gray-400 italic border border-gray-200'
                      ]">
                        {{ formatValue(entry.new_value) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div v-if="groupedEntries.length > 0" class="mt-6 pt-4 border-t border-gray-200 text-center">
          <p class="text-xs text-gray-400">
            Showing {{ totalChanges }} {{ totalChanges === 1 ? 'change' : 'changes' }} across {{ groupedEntries.length }} {{ groupedEntries.length === 1 ? 'day' : 'days' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
