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

// Non-input types that don't collect data
const displayOnlyTypes = ['section_header', 'heading', 'paragraph']

function isDisplayOnly(item) {
  return displayOnlyTypes.includes(item.type)
}

// Resolve the HTML input type for a db_field item
function resolveInputType(item) {
  if (item.type === 'db_field') {
    const t = item.inputType || 'text'
    if (t === 'phone') return 'tel'
    return t
  }
  return item.type === 'phone' ? 'tel' : (item.type || 'text')
}

// Check if item should render as a simple input (text, email, phone, url, number, date)
function isSimpleInput(item) {
  if (item.type === 'db_field') {
    const t = item.inputType || 'text'
    return ['text', 'email', 'phone', 'url', 'number', 'date'].includes(t)
  }
  return ['text', 'email', 'phone', 'url', 'number', 'date'].includes(item.type)
}

// Check if item should render as textarea
function isTextarea(item) {
  if (item.type === 'db_field') return item.inputType === 'textarea'
  return item.type === 'textarea'
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
      // Initialize responses
      const config = response.data.config
      if (config?.items) {
        for (let i = 0; i < config.items.length; i++) {
          const item = config.items[i]
          if (isDisplayOnly(item)) continue
          if (item.type === 'due_date_group') {
            // Array of date strings, start with one empty slot
            responses.value[i] = ['']
          } else if (item.type === 'checkbox') {
            responses.value[i] = false
          } else if (item.type === 'checkboxGroup') {
            responses.value[i] = []
          } else {
            responses.value[i] = ''
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

// Validate required fields
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
              {{ survey?.surveyName || 'Survey' }}
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
          {{ survey.config.meta.thankYouMessage }}
        </p>
        <p v-else class="text-gray-500">Your survey response has been submitted successfully.</p>
        <p class="text-sm text-gray-400 mt-2">You may close this page.</p>
      </div>

      <!-- Survey Form -->
      <div v-else-if="survey?.config" class="space-y-6">
        <!-- Survey Title Card -->
        <div v-if="survey.config.meta" class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900">{{ survey.config.meta.title }}</h2>
          <p v-if="survey.config.meta.introduction" class="text-sm text-gray-600 mt-2">
            {{ survey.config.meta.introduction }}
          </p>
          <p v-else-if="survey.config.meta.description" class="text-sm text-gray-500 mt-2">
            {{ survey.config.meta.description }}
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
          <div
            v-for="(item, index) in survey.config.items"
            :key="item.id || index"
            class="p-6"
          >
            <!-- Section Header -->
            <template v-if="item.type === 'section_header'">
              <h3 class="text-lg font-semibold text-gray-900">{{ item.content || item.label }}</h3>
            </template>

            <!-- Heading (legacy) -->
            <template v-else-if="item.type === 'heading'">
              <h3 class="text-lg font-semibold text-gray-900">{{ item.label || item.text }}</h3>
              <p v-if="item.description" class="text-sm text-gray-500 mt-1">{{ item.description }}</p>
            </template>

            <!-- Paragraph (legacy) -->
            <template v-else-if="item.type === 'paragraph'">
              <p class="text-sm text-gray-600 leading-relaxed">{{ item.label || item.text }}</p>
            </template>

            <!-- Due Date Group -->
            <template v-else-if="item.type === 'due_date_group'">
              <label class="block text-sm font-medium text-gray-900 mb-1.5">
                {{ item.customLabel || item.label }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText" class="text-xs text-gray-500 mb-3">{{ item.helpText }}</p>
              <div class="space-y-2">
                <div
                  v-for="dateIdx in visibleDueDates(index, item.maxDates)"
                  :key="dateIdx"
                  class="flex items-center gap-3"
                >
                  <span class="text-xs text-gray-400 w-20 flex-shrink-0">Due Date {{ dateIdx }}</span>
                  <input
                    type="date"
                    :value="(responses[index] || [])[dateIdx - 1] || ''"
                    @input="e => { responses[index][dateIdx - 1] = e.target.value; onDueDateChange(index, dateIdx - 1, item.maxDates) }"
                    class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </template>

            <!-- Simple Input (db_field with text/email/phone/url/number/date, or legacy simple types) -->
            <template v-else-if="isSimpleInput(item)">
              <label class="block text-sm font-medium text-gray-900 mb-1.5">
                {{ item.customLabel || item.label }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ item.helpText || item.description }}
              </p>
              <input
                v-model="responses[index]"
                :type="resolveInputType(item)"
                :placeholder="item.placeholder || ''"
                :required="item.required"
                class="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                :class="[
                  missingRequired.includes(index) ? 'border-red-300 bg-red-50' : 'border-gray-300'
                ]"
              />
            </template>

            <!-- Textarea (db_field with textarea, or legacy textarea type) -->
            <template v-else-if="isTextarea(item)">
              <label class="block text-sm font-medium text-gray-900 mb-1.5">
                {{ item.customLabel || item.label }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ item.helpText || item.description }}
              </p>
              <textarea
                v-model="responses[index]"
                :rows="item.rows || 3"
                :placeholder="item.placeholder || ''"
                :required="item.required"
                class="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                :class="[
                  missingRequired.includes(index) ? 'border-red-300 bg-red-50' : 'border-gray-300'
                ]"
              ></textarea>
            </template>

            <!-- Select / Dropdown -->
            <template v-else-if="item.type === 'select' || item.type === 'dropdown'">
              <label class="block text-sm font-medium text-gray-900 mb-1.5">
                {{ item.customLabel || item.label }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ item.helpText || item.description }}
              </p>
              <select
                v-model="responses[index]"
                :required="item.required"
                class="w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                :class="[
                  missingRequired.includes(index) ? 'border-red-300 bg-red-50' : 'border-gray-300'
                ]"
              >
                <option value="" disabled>{{ item.placeholder || 'Select an option...' }}</option>
                <option v-for="opt in (item.options || [])" :key="opt.value || opt" :value="opt.value || opt">
                  {{ opt.label || opt }}
                </option>
              </select>
            </template>

            <!-- Radio -->
            <template v-else-if="item.type === 'radio'">
              <label class="block text-sm font-medium text-gray-900 mb-2">
                {{ item.customLabel || item.label }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ item.helpText || item.description }}
              </p>
              <div class="space-y-2">
                <label
                  v-for="opt in (item.options || [])"
                  :key="opt.value || opt"
                  class="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="radio"
                    :name="`q_${index}`"
                    :value="opt.value || opt"
                    v-model="responses[index]"
                    class="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700">{{ opt.label || opt }}</span>
                </label>
              </div>
            </template>

            <!-- Checkbox (single) -->
            <template v-else-if="item.type === 'checkbox'">
              <label class="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="responses[index]"
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
                {{ item.customLabel || item.label }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ item.helpText || item.description }}
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
                    v-model="responses[index]"
                    class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700">{{ opt.label || opt }}</span>
                </label>
              </div>
            </template>

            <!-- Fallback: render as text input -->
            <template v-else>
              <label class="block text-sm font-medium text-gray-900 mb-1.5">
                {{ item.customLabel || item.label || item.name || `Question ${index + 1}` }}
                <span v-if="item.required" class="text-red-500 ml-0.5">*</span>
              </label>
              <p v-if="item.helpText || item.description" class="text-xs text-gray-500 mb-2">
                {{ item.helpText || item.description }}
              </p>
              <input
                v-model="responses[index]"
                type="text"
                :placeholder="item.placeholder || ''"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </template>
          </div>
        </div>

        <!-- Submit -->
        <div class="flex items-center justify-between">
          <p v-if="missingRequired.length > 0" class="text-sm text-red-500">
            Please complete all required fields
          </p>
          <div v-else></div>

          <button
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
    </main>

    <!-- Footer -->
    <footer class="max-w-3xl mx-auto px-4 py-8 sm:px-6 text-center">
      <p class="text-xs text-gray-400">Powered by Inveritax Survey System</p>
    </footer>
  </div>
</template>
