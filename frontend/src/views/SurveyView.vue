<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const uniqueId = route.params.uniqueId

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api'

const survey = ref(null)
const isLoading = ref(true)
const error = ref('')
const isSubmitting = ref(false)
const isSubmitted = ref(false)
const alreadyCompleted = ref(false)
const responses = ref({})
const currentPage = ref(0)
const prepopulatedValues = ref({})
const editingPrepopulated = ref({})

// Group survey items into pages, using page_break to split
const surveyPages = computed(() => {
  if (!survey.value?.config?.items) return []

  const pages = []
  let currentPageItems = []

  survey.value.config.items.forEach(item => {
    if (item.type === 'page_break') {
      // Page break encountered - push current page if it has items
      if (currentPageItems.length > 0) {
        pages.push(currentPageItems)
        currentPageItems = []
      }
      // Don't include the page_break item itself in any page
    } else {
      currentPageItems.push(item)
    }
  })

  if (currentPageItems.length > 0) {
    pages.push(currentPageItems)
  }

  return pages.length > 0 ? pages : [[]]
})

const currentItems = computed(() => {
  return surveyPages.value[currentPage.value] || []
})

const totalPages = computed(() => surveyPages.value.length)

// Process survey name to replace template variables
const processedSurveyName = computed(() => {
  if (!survey.value?.surveyName) return 'Survey'

  let name = survey.value.surveyName

  // Replace {CountyName} with actual county/municipality name
  if (survey.value.municipality) {
    name = name.replace(/\{CountyName\}/g, survey.value.municipality)
  } else if (survey.value.county) {
    name = name.replace(/\{CountyName\}/g, survey.value.county)
  }

  // Replace {State} with actual state
  if (survey.value.state) {
    name = name.replace(/\{State\}/g, survey.value.state)
  }

  // Replace {TaxYear} if present in data
  if (survey.value.taxYear) {
    name = name.replace(/\{TaxYear\}/g, survey.value.taxYear)
  }

  return name
})

// Interpolate template variables in any text
function interpolateTemplate(text) {
  if (!text || !survey.value) return text

  let result = text

  // {CountyName} - Use municipality or county name
  if (survey.value.municipality) {
    result = result.replace(/\{CountyName\}/g, survey.value.municipality)
    result = result.replace(/\{MunicipalityName\}/g, survey.value.municipality)
  } else if (survey.value.county) {
    result = result.replace(/\{CountyName\}/g, survey.value.county)
    result = result.replace(/\{MunicipalityName\}/g, survey.value.county)
  }

  // {State} - State abbreviation
  if (survey.value.state) {
    result = result.replace(/\{State\}/g, survey.value.state)
  }

  // {StateName} - Full state name (if available, otherwise use abbreviation)
  if (survey.value.stateName) {
    result = result.replace(/\{StateName\}/g, survey.value.stateName)
  } else if (survey.value.state) {
    result = result.replace(/\{StateName\}/g, survey.value.state)
  }

  // {TaxYear}
  if (survey.value.taxYear) {
    result = result.replace(/\{TaxYear\}/g, survey.value.taxYear)
  }

  // {TreasurerName}
  if (survey.value.treasurerName) {
    result = result.replace(/\{TreasurerName\}/g, survey.value.treasurerName)
  }

  // {TreasurerEmail}
  if (survey.value.treasurerEmail) {
    result = result.replace(/\{TreasurerEmail\}/g, survey.value.treasurerEmail)
  }

  // {TreasurerPhone}
  if (survey.value.treasurerPhone) {
    result = result.replace(/\{TreasurerPhone\}/g, survey.value.treasurerPhone)
  }

  return result
}

async function nextPage() {
  if (missingOnCurrentPage.value.length > 0) return

  // Save progress before moving to next page
  try {
    await axios.patch(`${API_BASE_URL}/survey/${uniqueId}/progress`, {
      responses: buildResponsePayload()
    })
  } catch (err) {
    console.error('Failed to save progress:', err)
    // Continue to next page even if save fails
  }

  if (currentPage.value < totalPages.value - 1) {
    currentPage.value++
  }
}

async function prevPage() {
  // Save progress before moving to previous page
  try {
    await axios.patch(`${API_BASE_URL}/survey/${uniqueId}/progress`, {
      responses: buildResponsePayload()
    })
  } catch (err) {
    console.error('Failed to save progress:', err)
    // Continue to previous page even if save fails
  }

  if (currentPage.value > 0) {
    currentPage.value--
  }
}


// Non-input types that don't collect data
const displayOnlyTypes = ['section_header', 'heading', 'paragraph', 'page_break', 'instructions']

function isDisplayOnly(item) {
  return displayOnlyTypes.includes(item.type)
}

// Prepopulation helpers
function isPrepopulated(item) {
  return item.prepopulated && item.id && prepopulatedValues.value[item.id]
}

function isEditing(item) {
  return editingPrepopulated.value[item.id] || false
}

function toggleEdit(item) {
  if (item.id) {
    editingPrepopulated.value[item.id] = !editingPrepopulated.value[item.id]
  }
}

function isFieldDisabled(item) {
  return isPrepopulated(item) && !isEditing(item)
}

// Resolve the HTML input type for a db_field or custom item
function resolveInputType(item) {
  if (item.type === 'db_field' || item.type === 'custom') {
    const t = item.inputType || 'text'
    if (t === 'phone') return 'tel'
    return t
  }
  return item.type === 'phone' ? 'tel' : (item.type || 'text')
}

// Check if item should render as a simple input (text, email, phone, url, number, date)
function isSimpleInput(item) {
  if (item.type === 'db_field' || item.type === 'custom') {
    const t = item.inputType || 'text'
    return ['text', 'email', 'phone', 'url', 'number', 'date'].includes(t)
  }
  return ['text', 'email', 'phone', 'url', 'number', 'date'].includes(item.type)
}

// Check if item should render as textarea
function isTextarea(item) {
  if (item.type === 'db_field' || item.type === 'custom') return item.inputType === 'textarea' || item.inputType === 'file_upload'
  return item.type === 'textarea' || item.type === 'file_upload'
}

// Check if item should be visible based on conditional visibility rules
function isItemVisible(item) {
  // Safety check - if item is undefined, hide it
  if (!item) return false

  // If no condition, always visible
  if (!item.condition) return true
  if (!item.condition.sourceItemId) return true

  // Find the source item
  const sourceItem = survey.value?.config?.items?.find(i => i.id === item.condition.sourceItemId)
  if (!sourceItem) return true

  // Get the source item's index in the items array
  const sourceIndex = survey.value.config.items.indexOf(sourceItem)
  if (sourceIndex === -1) return true

  // Get the current value of the source item
  const val = responses.value[sourceIndex] || ''
  const cmp = item.condition.value || ''

  // Evaluate the condition
  switch (item.condition.operator) {
    case 'equals': return val === cmp
    case 'not_equals': return val !== cmp
    case 'greater_than': return Number(val) > Number(cmp)
    case 'less_than': return Number(val) < Number(cmp)
    case 'contains': return String(val).toLowerCase().includes(String(cmp).toLowerCase())
    case 'is_empty': return !val
    case 'is_not_empty': return !!val
    default: return true
  }
}

// Load survey
onMounted(async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/survey/${uniqueId}`)
    if (response.data.completed) {
      alreadyCompleted.value = true
      survey.value = response.data
    } else {
      survey.value = response.data

      // Store prepopulated values
      if (response.data.prepopulatedValues) {
        prepopulatedValues.value = response.data.prepopulatedValues
      }

      // Initialize responses
      const config = response.data.config
      if (config?.items) {
        for (let i = 0; i < config.items.length; i++) {
          const item = config.items[i]
          if (isDisplayOnly(item)) continue

          if (item.type === 'due_date_group') {
            // Array of date strings, start with one empty slot
            responses.value[i] = ['']

            // Load prepopulated due dates
            if (item.prepopulated && item.id) {
              const dates = []
              const maxDates = item.maxDates || 10
              for (let j = 1; j <= maxDates; j++) {
                const key = `${item.id}_date_${j}`
                if (prepopulatedValues.value[key]) {
                  dates.push(prepopulatedValues.value[key])
                }
              }
              if (dates.length > 0) {
                responses.value[i] = dates
                // Add empty slot for progressive reveal
                if (dates.length < maxDates) {
                  responses.value[i].push('')
                }
              }
            }
          } else if (item.type === 'checkbox') {
            responses.value[i] = false
          } else if (item.type === 'checkboxGroup') {
            responses.value[i] = []
          } else {
            // Check if this field has a prepopulated value
            if (item.prepopulated && item.id && prepopulatedValues.value[item.id]) {
              responses.value[i] = prepopulatedValues.value[item.id]
            } else {
              responses.value[i] = ''
            }
          }
        }
      }
    }
  } catch (err) {
    if (err.response?.status === 404) {
      error.value = 'Survey not found. The link may be invalid or expired.'
    } else if (err.response?.status === 410) {
      error.value = 'This survey has been cancelled and is no longer accepting responses.'
    } else {
      error.value = 'Failed to load survey. Please try again later.'
    }
  } finally {
    isLoading.value = false
  }
})

// Due date group: how many date slots to show (reveal next when previous is filled)
function visibleDueDates(index, maxDates) {
  const dates = responses.value[index] || ['']
  const max = maxDates || 10
  // Show all filled dates plus one empty slot (up to max)
  const filledCount = dates.filter(d => d && d.trim() !== '').length
  return Math.min(filledCount + 1, max)
}

function onDueDateChange(index, dateIdx, maxDates) {
  const dates = responses.value[index]
  const max = maxDates || 10
  // If user filled the last visible slot, add another empty slot
  if (dateIdx === dates.length - 1 && dates[dateIdx] && dates.length < max) {
    dates.push('')
  }
}

// Validate all required fields in the survey
const missingRequired = computed(() => {
  if (!survey.value?.config?.items) return []
  const missing = []
  for (let i = 0; i < survey.value.config.items.length; i++) {
    const item = survey.value.config.items[i]
    if (isDisplayOnly(item)) continue
    if (item.required) {
      const val = responses.value[i]
      if (item.type === 'due_date_group') {
        const dates = val || []
        const filled = dates.filter(d => d && d.trim() !== '')
        if (filled.length === 0) missing.push(i)
      } else if (val === '' || val === null || val === undefined || (Array.isArray(val) && val.length === 0)) {
        missing.push(i)
      }
    }
  }
  return missing
})

// Validate required fields on the current page
const missingOnCurrentPage = computed(() => {
  if (!survey.value?.config?.items) return []
  const missing = []
  currentItems.value.forEach((item, index) => {
    const originalIndex = survey.value.config.items.indexOf(item)
    if (isDisplayOnly(item)) return
    if (item.required) {
      const val = responses.value[originalIndex]
      if (item.type === 'due_date_group') {
        const dates = val || []
        const filled = dates.filter(d => d && d.trim() !== '')
        if (filled.length === 0) missing.push(originalIndex)
      } else if (val === '' || val === null || val === undefined || (Array.isArray(val) && val.length === 0)) {
        missing.push(originalIndex)
      }
    }
  })
  return missing
})


const canSubmit = computed(() => missingRequired.value.length === 0)

// Build readable response map
function buildResponsePayload() {
  const payload = {}
  if (!survey.value?.config?.items) return payload

  for (let i = 0; i < survey.value.config.items.length; i++) {
    const item = survey.value.config.items[i]
    if (isDisplayOnly(item)) continue

    // Use dbField as key for db_field items, otherwise use label
    const key = item.dbField || item.label || item.name || `Question ${i + 1}`

    if (item.type === 'due_date_group') {
      // Filter out empty dates, store as array
      const dates = (responses.value[i] || []).filter(d => d && d.trim() !== '')
      // Store individual due_date_1..due_date_N fields
      dates.forEach((d, idx) => {
        payload[`due_date_${idx + 1}`] = d
      })
    } else {
      payload[key] = responses.value[i]
    }
  }
  return payload
}

// Submit
async function handleSubmit() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  error.value = ''

  try {
    await axios.post(`${API_BASE_URL}/survey/${uniqueId}/submit`, {
      responses: buildResponsePayload()
    })
    isSubmitted.value = true
  } catch (err) {
    if (err.response?.status === 409) {
      error.value = 'This survey has already been completed.'
    } else {
      error.value = 'Failed to submit survey. Please try again.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-3xl mx-auto px-4 py-4 sm:px-6">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 class="text-lg font-semibold text-gray-900">
              {{ processedSurveyName }}
            </h1>
            <p v-if="survey && !isSubmitted && !alreadyCompleted" class="text-sm text-gray-500">
              {{ survey.municipality }}, {{ survey.state }}
              <span v-if="survey.county && survey.county !== survey.municipality" class="text-gray-400">
                · {{ survey.county }}
              </span>
            </p>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-4 py-8 sm:px-6">
      <!-- Loading -->
      <div v-if="isLoading" class="text-center py-16">
        <div class="inline-flex items-center gap-3 text-gray-500">
          <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" />
            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" class="opacity-75" />
          </svg>
          Loading survey...
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error && !survey" class="bg-white rounded-xl border border-red-200 shadow-sm p-8 text-center">
        <svg class="w-12 h-12 text-red-300 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <h2 class="text-lg font-medium text-gray-900 mb-2">Unable to Load Survey</h2>
        <p class="text-gray-500">{{ error }}</p>
      </div>

      <!-- Already Completed -->
      <div v-else-if="alreadyCompleted" class="bg-white rounded-xl border border-green-200 shadow-sm p-8 text-center">
        <svg class="w-12 h-12 text-green-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <h2 class="text-lg font-medium text-gray-900 mb-2">Survey Already Completed</h2>
        <p class="text-gray-500">
          This survey for <strong>{{ survey.municipality }}, {{ survey.state }}</strong>
          was completed on {{ new Date(survey.completedAt).toLocaleDateString() }}.
        </p>
        <p class="text-sm text-gray-400 mt-2">Thank you for your response.</p>
      </div>

      <!-- Submitted Success -->
      <div v-else-if="isSubmitted" class="bg-white rounded-xl border border-green-200 shadow-sm p-8 text-center">
        <svg class="w-12 h-12 text-green-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <h2 class="text-lg font-medium text-gray-900 mb-2">Thank You!</h2>
        <p v-if="survey?.config?.meta?.thankYouMessage" class="text-gray-500">
          {{ interpolateTemplate(survey.config.meta.thankYouMessage) }}
        </p>
        <p v-else class="text-gray-500">Your survey response has been submitted successfully.</p>
        <p class="text-sm text-gray-400 mt-2">You may close this page.</p>
      </div>

      <!-- Survey Form -->
      <div v-else-if="survey?.config" class="space-y-6">
        <!-- Survey Title Card -->
        <div v-if="survey.config.meta && currentPage === 0" class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900">{{ interpolateTemplate(survey.config.meta.title) }}</h2>
          <p v-if="survey.config.meta.introduction" class="text-sm text-gray-600 mt-2">
            {{ interpolateTemplate(survey.config.meta.introduction) }}
          </p>
          <p v-else-if="survey.config.meta.description" class="text-sm text-gray-500 mt-2">
            {{ interpolateTemplate(survey.config.meta.description) }}
          </p>
          <div class="flex items-center gap-2 mt-3 text-sm text-indigo-600">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {{ survey.municipality }}, {{ survey.state }}
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span class="text-sm">{{ error }}</span>
        </div>

        <!-- Survey Items -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          <template v-for="(item) in currentItems" :key="item.id || survey.config.items.indexOf(item)">
            <div v-if="isItemVisible(item)" class="p-6">
            <!-- Section Header -->
            <template v-if="item.type === 'section_header'">
              <h3 class="text-lg font-semibold text-gray-900">{{ interpolateTemplate(item.content || item.label) }}</h3>
            </template>

            <!-- Heading (legacy) -->
            <template v-else-if="item.type === 'heading'">
              <h3 class="text-lg font-semibold text-gray-900">{{ interpolateTemplate(item.label || item.text) }}</h3>
              <p v-if="item.description" class="text-sm text-gray-500 mt-1">{{ interpolateTemplate(item.description) }}</p>
            </template>

            <!-- Paragraph (legacy) -->
            <template v-else-if="item.type === 'paragraph'">
              <p class="text-sm text-gray-600 leading-relaxed">{{ interpolateTemplate(item.label || item.text) }}</p>
            </template>

            <!-- Instructions -->
            <template v-else-if="item.type === 'instructions'">
              <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <p class="text-sm text-blue-800">{{ interpolateTemplate(item.content || item.label) }}</p>
              </div>
            </template>

            <!-- Due Date Group -->
            <template v-else-if="item.type === 'due_date_group'">
              <label class="block text-sm font-medium text-gray-900 mb-1.5">
                {{ interpolateTemplate(item.customLabel || item.label) }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText" class="text-xs text-gray-500 mb-3">{{ interpolateTemplate(item.helpText) }}</p>
              <div class="space-y-2">
                <div
                  v-for="dateIdx in visibleDueDates(survey.config.items.indexOf(item), item.maxDates)"
                  :key="dateIdx"
                  class="flex items-center gap-3"
                >
                  <span class="text-xs text-gray-400 w-20 flex-shrink-0">Due Date {{ dateIdx }}</span>
                  <input
                    type="date"
                    :value="(responses[survey.config.items.indexOf(item)] || [])[dateIdx - 1] || ''"
                    @input="e => { responses[survey.config.items.indexOf(item)][dateIdx - 1] = e.target.value; onDueDateChange(survey.config.items.indexOf(item), dateIdx - 1, item.maxDates) }"
                    class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </template>

            <!-- Simple Input (db_field with text/email/phone/url/number/date, or legacy simple types) -->
            <template v-else-if="isSimpleInput(item)">
              <div class="flex items-start justify-between mb-1.5">
                <label class="block text-sm font-medium text-gray-900">
                  {{ interpolateTemplate(item.customLabel || item.label) }}
                  <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
                  <span v-if="isPrepopulated(item) && !isEditing(item)" class="inline-flex items-center gap-1 ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    Pre-filled
                  </span>
                </label>
                <button v-if="isPrepopulated(item) && !isEditing(item)" @click="toggleEdit(item)"
                  type="button"
                  class="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Edit
                </button>
                <button v-if="isPrepopulated(item) && isEditing(item)" @click="toggleEdit(item)"
                  type="button"
                  class="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Done
                </button>
              </div>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ interpolateTemplate(item.helpText || item.description) }}
              </p>
              <input
                v-model="responses[survey.config.items.indexOf(item)]"
                :type="resolveInputType(item)"
                :placeholder="isPrepopulated(item) && !isEditing(item) ? 'Auto-filled by system...' : interpolateTemplate(item.placeholder || '')"
                :required="item.required"
                :disabled="isFieldDisabled(item)"
                class="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                :class="[
                  missingOnCurrentPage.includes(survey.config.items.indexOf(item)) ? 'border-red-300 bg-red-50' :
                  isPrepopulated(item) && !isEditing(item) ? 'bg-green-50 border-green-200 text-green-800 font-medium' :
                  'border-gray-300'
                ]"
              />
            </template>

            <!-- Textarea (db_field with textarea, or legacy textarea type) -->
            <template v-else-if="isTextarea(item)">
              <div class="flex items-start justify-between mb-1.5">
                <label class="block text-sm font-medium text-gray-900">
                  {{ interpolateTemplate(item.customLabel || item.label) }}
                  <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
                  <span v-if="isPrepopulated(item) && !isEditing(item)" class="inline-flex items-center gap-1 ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    Pre-filled
                  </span>
                </label>
                <button v-if="isPrepopulated(item) && !isEditing(item)" @click="toggleEdit(item)"
                  type="button"
                  class="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  Edit
                </button>
                <button v-if="isPrepopulated(item) && isEditing(item)" @click="toggleEdit(item)"
                  type="button"
                  class="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Done
                </button>
              </div>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ interpolateTemplate(item.helpText || item.description) }}
              </p>
              <textarea
                v-model="responses[survey.config.items.indexOf(item)]"
                :rows="item.rows || 3"
                :placeholder="isPrepopulated(item) && !isEditing(item) ? 'Auto-filled by system...' : interpolateTemplate(item.placeholder || '')"
                :required="item.required"
                :disabled="isFieldDisabled(item)"
                class="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                :class="[
                  missingOnCurrentPage.includes(survey.config.items.indexOf(item)) ? 'border-red-300 bg-red-50' :
                  isPrepopulated(item) && !isEditing(item) ? 'bg-green-50 border-green-200 text-green-800 font-medium' :
                  'border-gray-300'
                ]"
              ></textarea>
            </template>

            <!-- Select / Dropdown -->
            <template v-else-if="item.type === 'select' || item.type === 'dropdown'">
              <label class="block text-sm font-medium text-gray-900 mb-1.5">
                {{ interpolateTemplate(item.customLabel || item.label) }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ interpolateTemplate(item.helpText || item.description) }}
              </p>
              <select
                v-model="responses[survey.config.items.indexOf(item)]"
                :required="item.required"
                class="w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                :class="[
                  missingOnCurrentPage.includes(survey.config.items.indexOf(item)) ? 'border-red-300 bg-red-50' : 'border-gray-300'
                ]"
              >
                <option value="" disabled>{{ interpolateTemplate(item.placeholder) || 'Select an option...' }}</option>
                <option v-for="opt in (item.options || [])" :key="opt.value || opt" :value="opt.value || opt">
                  {{ opt.label || opt }}
                </option>
              </select>
            </template>

            <!-- Radio -->
            <template v-else-if="item.type === 'radio'">
              <label class="block text-sm font-medium text-gray-900 mb-2">
                {{ interpolateTemplate(item.customLabel || item.label) }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ interpolateTemplate(item.helpText || item.description) }}
              </p>
              <div class="space-y-2">
                <label
                  v-for="opt in (item.options || [])"
                  :key="opt.value || opt"
                  class="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="radio"
                    :name="`q_${survey.config.items.indexOf(item)}`"
                    :value="opt.value || opt"
                    v-model="responses[survey.config.items.indexOf(item)]"
                    class="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700">{{ opt.label || opt }}</span>
                </label>
              </div>
            </template>

            <!-- Yes/No (custom field type) -->
            <template v-else-if="(item.type === 'custom' || item.type === 'db_field') && item.inputType === 'yes_no'">
              <label class="block text-sm font-medium text-gray-900 mb-2">
                {{ interpolateTemplate(item.customLabel || item.label) }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ interpolateTemplate(item.helpText || item.description) }}
              </p>
              <div class="flex gap-4">
                <label class="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    :name="`q_${survey.config.items.indexOf(item)}`"
                    value="Yes"
                    v-model="responses[survey.config.items.indexOf(item)]"
                    class="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700">Yes</span>
                </label>
                <label class="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    :name="`q_${survey.config.items.indexOf(item)}`"
                    value="No"
                    v-model="responses[survey.config.items.indexOf(item)]"
                    class="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700">No</span>
                </label>
              </div>
            </template>

            <!-- Multiple Choice (custom field type) -->
            <template v-else-if="(item.type === 'custom' || item.type === 'db_field') && item.inputType === 'multiple_choice'">
              <label class="block text-sm font-medium text-gray-900 mb-2">
                {{ interpolateTemplate(item.customLabel || item.label) }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ interpolateTemplate(item.helpText || item.description) }}
              </p>
              <div class="space-y-2">
                <label
                  v-for="(opt, oi) in (item.options || [])"
                  :key="oi"
                  class="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="radio"
                    :name="`q_${survey.config.items.indexOf(item)}`"
                    :value="opt"
                    v-model="responses[survey.config.items.indexOf(item)]"
                    class="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700">{{ opt }}</span>
                </label>
              </div>
            </template>

            <!-- Checkbox (single) -->
            <template v-else-if="item.type === 'checkbox'">
              <label class="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="responses[survey.config.items.indexOf(item)]"
                  class="w-4 h-4 mt-0.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <div>
                  <span class="text-sm font-medium text-gray-900">{{ item.label }}</span>
                  <p v-if="item.description" class="text-xs text-gray-500 mt-0.5">{{ item.description }}</p>
                </div>
              </label>
            </template>

            <!-- Checkbox Group -->
            <template v-else-if="item.type === 'checkboxGroup'">
              <label class="block text-sm font-medium text-gray-900 mb-2">
                {{ interpolateTemplate(item.customLabel || item.label) }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ interpolateTemplate(item.helpText || item.description) }}
              </p>
              <div class="space-y-2">
                <label
                  v-for="opt in (item.options || [])"
                  :key="opt.value || opt"
                  class="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    :value="opt.value || opt"
                    v-model="responses[survey.config.items.indexOf(item)]"
                    class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700">{{ opt.label || opt }}</span>
                </label>
              </div>
            </template>

            <!-- Fallback: render as text input -->
            <template v-else>
              <label class="block text-sm font-medium text-gray-900 mb-1.5">
                {{ item.customLabel || item.label || item.name || `Question ${survey.config.items.indexOf(item) + 1}` }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ interpolateTemplate(item.helpText || item.description) }}
              </p>
              <input
                v-model="responses[survey.config.items.indexOf(item)]"
                type="text"
                :placeholder="interpolateTemplate(item.placeholder || '')"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </template>
            </div>
          </template>
        </div>

        <!-- Pagination Controls -->
        <div class="flex items-center justify-between">
          <div>
            <button
              v-if="currentPage > 0"
              @click="prevPage"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Previous
            </button>
          </div>

          <div class="flex items-center gap-4">
            <p v-if="missingOnCurrentPage.length > 0 && currentPage < totalPages -1" class="text-sm text-red-500">
              Please complete all required fields
            </p>
            <span class="text-sm text-gray-500">
              Page {{ currentPage + 1 }} of {{ totalPages }}
            </span>
            <button
              v-if="currentPage < totalPages - 1"
              @click="nextPage"
              :disabled="missingOnCurrentPage.length > 0"
              class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next
            </button>

            <button
              v-if="currentPage === totalPages - 1"
              @click="handleSubmit"
              :disabled="!canSubmit || isSubmitting"
              class="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg text-white transition-colors"
              :class="canSubmit && !isSubmitting
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-gray-300 cursor-not-allowed'"
            >
              <svg v-if="isSubmitting" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" class="opacity-75" />
              </svg>
              <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {{ isSubmitting ? 'Submitting...' : 'Submit Survey' }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="max-w-3xl mx-auto px-4 py-8 sm:px-6 text-center">
      <p class="text-xs text-gray-400">Powered by Inveritax Survey System</p>
    </footer>
  </div>
</template>
