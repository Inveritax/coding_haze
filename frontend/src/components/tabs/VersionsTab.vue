<script setup>
import { ref, watch, computed } from 'vue'
import { GitBranch, Calendar, CheckCircle, XCircle, RefreshCw, Eye, Clock, Edit3 } from 'lucide-vue-next'
import api from '../../services/api'

const props = defineProps({
  county: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['switch-version'])

const isLoading = ref(false)
const versions = ref([])
const errorMessage = ref('')
const currentResearchId = ref(null)

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }
  } catch {
    // Fall through
  }
  return dateStr
}

// Format datetime for display
function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    let isoStr = dateStr
    if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
      isoStr = dateStr + 'Z'
    }
    const date = new Date(isoStr)
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    }
  } catch {
    // Fall through
  }
  return dateStr
}

// Format method_used for display
function formatMethod(method) {
  if (!method) return 'Unknown'
  const methodLabels = {
    'propagated_from_county': 'Propagated from County',
    'MI_Auto_populated': 'MI Auto-populated',
    'v4_responses': 'V4 Research',
    'csv_import': 'CSV Import',
    'manual': 'Manual Entry'
  }
  return methodLabels[method] || method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// Check if a version is the current one
function isCurrentVersion(version) {
  return version.research_id === currentResearchId.value
}

// Computed: sorted versions with current flag
const sortedVersions = computed(() => {
  return versions.value.map(v => ({
    ...v,
    is_current: isCurrentVersion(v)
  }))
})

// Fetch research versions from API
async function fetchVersions() {
  if (!props.county?.research_id) return

  isLoading.value = true
  errorMessage.value = ''
  try {
    const response = await api.getResearchVersions(props.county.research_id)
    versions.value = response.data.versions || []
    currentResearchId.value = response.data.currentResearchId
  } catch (error) {
    console.error('Failed to fetch versions:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to load research versions'
    versions.value = []
  } finally {
    isLoading.value = false
  }
}

// Switch to a different version
async function switchToVersion(version) {
  if (version.is_current) return

  try {
    const response = await api.getResearchById(version.research_id)
    if (response.data.success && response.data.research) {
      emit('switch-version', response.data.research)
      currentResearchId.value = version.research_id
    }
  } catch (error) {
    console.error('Failed to switch version:', error)
    errorMessage.value = 'Failed to load selected version'
  }
}

// Watch for county changes
watch(() => props.county?.research_id, () => {
  if (props.county?.research_id) {
    fetchVersions()
  }
}, { immediate: true })
</script>

<template>
  <div class="max-w-4xl">
    <!-- Error Notice -->
    <div v-if="errorMessage" class="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
      <GitBranch class="w-5 h-5 flex-shrink-0" />
      <div>
        <p class="text-sm font-medium">Error Loading Versions</p>
        <p class="text-xs mt-0.5 text-red-600">{{ errorMessage }}</p>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Research Versions</h3>
          <p class="text-sm text-gray-500 mt-1">View and compare different research runs for this jurisdiction</p>
        </div>
        <button
          @click="fetchVersions"
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
        <div v-else-if="sortedVersions.length === 0" class="text-center py-12">
          <GitBranch class="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 class="text-lg font-medium text-gray-900 mb-2">No Research Versions</h4>
          <p class="text-gray-500 text-sm">No research records found for this jurisdiction.</p>
        </div>

        <!-- Versions List -->
        <div v-else class="space-y-4">
          <div
            v-for="version in sortedVersions"
            :key="version.research_id"
            :class="[
              'relative rounded-lg border-2 p-4 transition-all',
              version.is_current
                ? 'border-primary-500 bg-primary-50/50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
            ]"
            @click="switchToVersion(version)"
          >
            <!-- Current Badge -->
            <div v-if="version.is_current" class="absolute -top-2 -right-2">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-600 text-white">
                <Eye class="w-3 h-3" />
                Current
              </span>
            </div>

            <div class="flex items-start justify-between gap-4">
              <!-- Version Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <span class="text-sm font-mono text-gray-500">#{{ version.research_id }}</span>
                  <span :class="[
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    version.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  ]">
                    <component :is="version.success ? CheckCircle : XCircle" class="w-3 h-3" />
                    {{ version.success ? 'Success' : 'Failed' }}
                  </span>
                  <span v-if="version.validation_score" class="text-xs text-gray-500">
                    Score: {{ version.validation_score }}%
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div class="flex items-center gap-2">
                    <Calendar class="w-4 h-4 text-gray-400" />
                    <span class="text-gray-600">Research Date:</span>
                    <span class="font-medium text-gray-900">{{ formatDate(version.research_date) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <Clock class="w-4 h-4 text-gray-400" />
                    <span class="text-gray-600">Created:</span>
                    <span class="font-medium text-gray-900">{{ formatDateTime(version.created_at) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <GitBranch class="w-4 h-4 text-gray-400" />
                    <span class="text-gray-600">Method:</span>
                    <span class="font-medium text-gray-900">{{ formatMethod(version.method_used) }}</span>
                  </div>
                  <div v-if="version.edit_count > 0" class="flex items-center gap-2">
                    <Edit3 class="w-4 h-4 text-gray-400" />
                    <span class="text-gray-600">Edits:</span>
                    <span class="font-medium text-gray-900">{{ version.edit_count }}</span>
                  </div>
                </div>

                <!-- Key Data Preview -->
                <div v-if="version.current_tax_year || version.num_installments" class="mt-3 pt-3 border-t border-gray-200">
                  <div class="flex flex-wrap gap-4 text-xs">
                    <div v-if="version.current_tax_year">
                      <span class="text-gray-500">Tax Year:</span>
                      <span class="ml-1 font-medium text-gray-700">{{ version.current_tax_year }}</span>
                    </div>
                    <div v-if="version.num_installments">
                      <span class="text-gray-500">Installments:</span>
                      <span class="ml-1 font-medium text-gray-700">{{ version.num_installments }}</span>
                    </div>
                    <div v-if="version.due_date_1">
                      <span class="text-gray-500">Due Date 1:</span>
                      <span class="ml-1 font-medium text-gray-700">{{ formatDate(version.due_date_1) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- View Button -->
              <div v-if="!version.is_current" class="flex-shrink-0">
                <button class="btn btn-secondary text-xs">
                  <Eye class="w-3.5 h-3.5" />
                  View
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div v-if="sortedVersions.length > 0" class="mt-6 pt-4 border-t border-gray-200 text-center">
          <p class="text-xs text-gray-400">
            {{ sortedVersions.length }} research {{ sortedVersions.length === 1 ? 'version' : 'versions' }} available
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
