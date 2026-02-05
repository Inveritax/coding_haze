<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  ListOrdered, Play, RefreshCw, Trash2, Eye,
  ChevronDown, AlertCircle, CheckCircle2, Clock,
  Send, X, Filter, Ban, RotateCcw, Layers
} from 'lucide-vue-next'
import api from '../../services/api'

// ─── State ───
const activeView = ref('builder')
const isLoading = ref(false)
const error = ref('')
const toast = ref(null)

// Builder state
const surveyConfigs = ref([])
const selectedSurveyId = ref(null)
const selectedStates = ref([])
const jurisdictionType = ref('county_only') // 'county_only' or 'all'
const previewCount = ref(null)
const isGenerating = ref(false)
const showConfirmModal = ref(false)
const batchName = ref('')

// Viewer state
const batches = ref([])
const expandedBatchId = ref(null)
const queueItems = ref([])
const stats = ref(null)
const filterBatchId = ref(null)
const filterStatus = ref('')
const filterState = ref('')
const page = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const isLoadingItems = ref(false)

// Response viewer
const showResponseModal = ref(false)
const selectedItem = ref(null)

const availableStates = ['FL', 'IA', 'IL', 'IN', 'MI', 'MN', 'OH', 'WI']

// ─── Computed ───
const selectedSurvey = computed(() =>
  surveyConfigs.value.find(s => s.id === selectedSurveyId.value)
)

const activeSurveys = computed(() =>
  surveyConfigs.value.filter(s => s.status === 'active')
)

const canGenerate = computed(() =>
  selectedSurveyId.value && selectedStates.value.length > 0 && previewCount.value > 0
)

// ─── Toast ───
function showToast(message, type = 'success') {
  toast.value = { message, type }
  setTimeout(() => { toast.value = null }, 3000)
}

// ─── Builder Methods ───
async function loadSurveyConfigs() {
  try {
    const response = await api.getSurveyConfigs()
    surveyConfigs.value = response.data.configs
  } catch (err) {
    console.error('Failed to load survey configs:', err)
  }
}

async function updatePreview() {
  try {
    const scopeFilter = buildScopeFilter()
    const response = await api.previewQueueScope('state', scopeFilter)
    previewCount.value = response.data.count
  } catch (err) {
    console.error('Failed to preview scope:', err)
    previewCount.value = null
  }
}

function buildScopeFilter() {
  const filter = {}
  if (batchName.value) filter.name = batchName.value
  if (selectedStates.value.length > 0) {
    filter.states = selectedStates.value
  }
  filter.jurisdictionType = jurisdictionType.value
  return filter
}

function openGenerateConfirm() {
  showConfirmModal.value = true
}

async function generateQueue() {
  isGenerating.value = true
  try {
    const scopeFilter = buildScopeFilter()
    const response = await api.generateQueue(selectedSurveyId.value, 'state', scopeFilter)
    showConfirmModal.value = false
    showToast(`Queue generated: ${response.data.batch.total_items} items created`)
    // Reset builder
    selectedSurveyId.value = null
    selectedStates.value = []
    jurisdictionType.value = 'county_only'
    previewCount.value = null
    batchName.value = ''
    // Switch to viewer
    activeView.value = 'viewer'
    await loadBatches()
    await loadStats()
  } catch (err) {
    const msg = err.response?.data?.error || 'Failed to generate queue'
    showToast(msg, 'error')
    console.error(err)
  } finally {
    isGenerating.value = false
  }
}

// ─── Viewer Methods ───
async function loadBatches() {
  isLoading.value = true
  error.value = ''
  try {
    const response = await api.getSurveyBatches()
    batches.value = response.data.batches
  } catch (err) {
    error.value = 'Failed to load batches'
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

async function loadStats(batchId = null) {
  try {
    const response = await api.getQueueStats(batchId)
    stats.value = response.data.stats
  } catch (err) {
    console.error('Failed to load stats:', err)
  }
}

async function loadQueueItems() {
  isLoadingItems.value = true
  try {
    const params = { page: page.value, limit: 50 }
    if (filterBatchId.value) params.batchId = filterBatchId.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterState.value) params.state = filterState.value
    const response = await api.getQueueItems(params)
    queueItems.value = response.data.items
    totalPages.value = response.data.totalPages
    totalItems.value = response.data.total
  } catch (err) {
    console.error('Failed to load queue items:', err)
  } finally {
    isLoadingItems.value = false
  }
}

async function toggleBatchExpand(batchId) {
  if (expandedBatchId.value === batchId) {
    expandedBatchId.value = null
    queueItems.value = []
    filterBatchId.value = null
    return
  }
  expandedBatchId.value = batchId
  filterBatchId.value = batchId
  page.value = 1
  await loadQueueItems()
}

async function retryFailed(batchId) {
  try {
    const response = await api.batchQueueAction(batchId, 'retry-failed')
    showToast(`${response.data.affectedCount} items reset to pending`)
    await loadBatches()
    await loadStats()
    if (expandedBatchId.value === batchId) await loadQueueItems()
  } catch (err) {
    showToast('Failed to retry items', 'error')
    console.error(err)
  }
}

async function cancelPending(batchId) {
  try {
    const response = await api.batchQueueAction(batchId, 'cancel-pending')
    showToast(`${response.data.affectedCount} items cancelled`)
    await loadBatches()
    await loadStats()
    if (expandedBatchId.value === batchId) await loadQueueItems()
  } catch (err) {
    showToast('Failed to cancel items', 'error')
    console.error(err)
  }
}

async function deleteBatch(batchId) {
  if (!confirm('Delete this batch and all its queue items?')) return
  try {
    await api.deleteBatch(batchId)
    showToast('Batch deleted')
    if (expandedBatchId.value === batchId) {
      expandedBatchId.value = null
      queueItems.value = []
    }
    await loadBatches()
    await loadStats()
  } catch (err) {
    showToast('Failed to delete batch', 'error')
    console.error(err)
  }
}

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++
    loadQueueItems()
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--
    loadQueueItems()
  }
}

function getSurveyUrl(uniqueId) {
  return `${window.location.origin}/survey/${uniqueId}`
}

function copySurveyLink(uniqueId) {
  navigator.clipboard.writeText(getSurveyUrl(uniqueId)).then(() => {
    showToast('Survey link copied to clipboard')
  })
}

function viewResponse(item) {
  selectedItem.value = item
  showResponseModal.value = true
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusBadgeClass(status) {
  switch (status) {
    case 'pending': return 'bg-amber-100 text-amber-700'
    case 'sent': return 'bg-blue-100 text-blue-700'
    case 'in_progress': return 'bg-purple-100 text-purple-700'
    case 'completed': return 'bg-green-100 text-green-700'
    case 'failed': return 'bg-red-100 text-red-700'
    case 'cancelled': return 'bg-gray-100 text-gray-500'
    default: return 'bg-gray-100 text-gray-500'
  }
}

function scopeLabel(batch) {
  const filter = typeof batch.scope_filter === 'string' ? JSON.parse(batch.scope_filter) : (batch.scope_filter || {})
  const states = (filter.states || []).join(', ')
  const jt = filter.jurisdictionType
  const jtLabel = jt === 'county_only' ? 'Counties Only' : jt === 'all' ? 'All Jurisdictions' : 'Municipalities'
  return states ? `${states} · ${jtLabel}` : jtLabel
}

// ─── Watchers ───
watch([selectedStates, jurisdictionType], () => {
  updatePreview()
})

// ─── Lifecycle ───
onMounted(async () => {
  await loadSurveyConfigs()
  await updatePreview()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Toast -->
    <Teleport to="body">
      <div v-if="toast" class="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium"
        :class="toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'">
        <AlertCircle v-if="toast.type === 'error'" class="w-4 h-4" />
        <CheckCircle2 v-else class="w-4 h-4" />
        {{ toast.message }}
      </div>
    </Teleport>

    <!-- Header -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <ListOrdered class="w-5 h-5 text-indigo-600" />
          <h2 class="text-lg font-semibold text-gray-900">Survey Queue</h2>
        </div>
        <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button @click="activeView = 'builder'"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
            :class="activeView === 'builder' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'">
            Builder
          </button>
          <button @click="activeView = 'viewer'; loadBatches(); loadStats()"
            class="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
            :class="activeView === 'viewer' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'">
            Viewer
          </button>
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
      <AlertCircle class="w-4 h-4 flex-shrink-0" />
      {{ error }}
    </div>

    <!-- ========== BUILDER VIEW ========== -->
    <template v-if="activeView === 'builder'">
      <!-- Step 1: Select Survey Template -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div class="flex items-center gap-2 mb-4">
          <span class="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">1</span>
          <h3 class="text-sm font-semibold text-gray-900">Select Survey Template</h3>
        </div>
        <select v-model="selectedSurveyId"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
          <option :value="null" disabled>Choose an active survey config...</option>
          <option v-for="s in activeSurveys" :key="s.id" :value="s.id">
            {{ s.name }} ({{ s.config_title || 'Untitled' }} — {{ s.item_count || 0 }} items)
          </option>
        </select>
        <p v-if="activeSurveys.length === 0" class="mt-2 text-xs text-amber-600">
          No active survey configs found. Upload and activate a survey in the Surveys tab first.
        </p>
      </div>

      <!-- Step 2: Select States -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div class="flex items-center gap-2 mb-4">
          <span class="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">2</span>
          <h3 class="text-sm font-semibold text-gray-900">Select States</h3>
        </div>

        <div class="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-lg">
          <label v-for="st in availableStates" :key="st" class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" :value="st" v-model="selectedStates"
              class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span class="text-sm text-gray-700">{{ st }}</span>
          </label>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <button @click="selectedStates = [...availableStates]"
            class="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Select All</button>
          <span class="text-gray-300">|</span>
          <button @click="selectedStates = []"
            class="text-xs text-gray-500 hover:text-gray-700 font-medium">Clear</button>
        </div>
        <p v-if="selectedStates.length === 0" class="mt-2 text-xs text-amber-600">
          Select at least one state to continue.
        </p>
      </div>

      <!-- Step 3: Jurisdiction Type -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div class="flex items-center gap-2 mb-4">
          <span class="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">3</span>
          <h3 class="text-sm font-semibold text-gray-900">Jurisdiction Type</h3>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
            :class="jurisdictionType === 'county_only' ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'">
            <input type="radio" v-model="jurisdictionType" value="county_only"
              class="w-4 h-4 mt-0.5 text-indigo-600 border-gray-300" />
            <div>
              <span class="text-sm font-medium text-gray-900">County Treasurers Only</span>
              <p class="text-xs text-gray-500 mt-0.5">One survey per county — county-level rows only</p>
            </div>
          </label>
          <label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
            :class="jurisdictionType === 'all' ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'">
            <input type="radio" v-model="jurisdictionType" value="all"
              class="w-4 h-4 mt-0.5 text-indigo-600 border-gray-300" />
            <div>
              <span class="text-sm font-medium text-gray-900">All Jurisdictions</span>
              <p class="text-xs text-gray-500 mt-0.5">Every record — counties and all municipalities</p>
            </div>
          </label>
        </div>
      </div>

      <!-- Step 4: Preview + Batch Name -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div class="flex items-center gap-2 mb-4">
          <span class="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">4</span>
          <h3 class="text-sm font-semibold text-gray-900">Preview & Name</h3>
        </div>

        <div class="flex items-center gap-4 mb-4">
          <div class="flex items-center gap-2 px-4 py-2.5 rounded-lg"
            :class="previewCount !== null && previewCount > 0 ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-gray-200'">
            <Layers class="w-4 h-4" :class="previewCount > 0 ? 'text-indigo-600' : 'text-gray-400'" />
            <span class="text-sm font-medium" :class="previewCount > 0 ? 'text-indigo-700' : 'text-gray-500'">
              <template v-if="selectedStates.length === 0">Select states above</template>
              <template v-else-if="previewCount !== null">{{ previewCount.toLocaleString() }} {{ jurisdictionType === 'county_only' ? 'counties' : 'jurisdictions' }} will be queued</template>
              <template v-else>Calculating...</template>
            </span>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Batch Name (optional)</label>
          <input v-model="batchName" type="text" placeholder="e.g., Q1 2026 Treasurer Survey"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
      </div>

      <!-- Step 4: Generate -->
      <div class="flex justify-end">
        <button @click="openGenerateConfirm" :disabled="!canGenerate || isGenerating"
          class="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg text-white transition-colors"
          :class="canGenerate && !isGenerating ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300 cursor-not-allowed'">
          <Play class="w-4 h-4" />
          Generate Queue
        </button>
      </div>
    </template>

    <!-- ========== VIEWER VIEW ========== -->
    <template v-if="activeView === 'viewer'">
      <!-- Stats Bar -->
      <div v-if="stats" class="grid grid-cols-5 gap-3">
        <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
          <div class="text-2xl font-bold text-amber-700">{{ Number(stats.pending || 0).toLocaleString() }}</div>
          <div class="text-xs font-medium text-amber-600">Pending</div>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
          <div class="text-2xl font-bold text-blue-700">{{ Number(stats.sent || 0).toLocaleString() }}</div>
          <div class="text-xs font-medium text-blue-600">Sent</div>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
          <div class="text-2xl font-bold text-green-700">{{ Number(stats.completed || 0).toLocaleString() }}</div>
          <div class="text-xs font-medium text-green-600">Completed</div>
        </div>
        <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
          <div class="text-2xl font-bold text-red-700">{{ Number(stats.failed || 0).toLocaleString() }}</div>
          <div class="text-xs font-medium text-red-600">Failed</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
          <div class="text-2xl font-bold text-gray-500">{{ Number(stats.cancelled || 0).toLocaleString() }}</div>
          <div class="text-xs font-medium text-gray-400">Cancelled</div>
        </div>
      </div>

      <!-- Refresh -->
      <div class="flex justify-end">
        <button @click="loadBatches(); loadStats()" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <RefreshCw class="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="text-center py-12 text-gray-500 text-sm">Loading batches...</div>

      <!-- Empty State -->
      <div v-else-if="batches.length === 0" class="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
        <ListOrdered class="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 class="text-sm font-medium text-gray-700 mb-1">No batches yet</h3>
        <p class="text-xs text-gray-500">Switch to the Builder to generate your first queue.</p>
      </div>

      <!-- Batch List -->
      <div v-else class="space-y-3">
        <div v-for="batch in batches" :key="batch.id"
          class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <!-- Batch Header -->
          <div class="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
            @click="toggleBatchExpand(batch.id)">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <ChevronDown class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0"
                :class="{ 'rotate-180': expandedBatchId === batch.id }" />
              <div class="min-w-0">
                <div class="text-sm font-medium text-gray-900 truncate">{{ batch.name || `Batch #${batch.id}` }}</div>
                <div class="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                  <span>{{ batch.survey_name }}</span>
                  <span class="text-gray-300">|</span>
                  <span>{{ scopeLabel(batch) }}</span>
                  <span class="text-gray-300">|</span>
                  <span>{{ formatDate(batch.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Batch Stats Mini -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs font-medium text-gray-500">{{ Number(batch.total_items).toLocaleString() }} items</span>
              <div class="flex items-center gap-1">
                <span v-if="Number(batch.pending_count) > 0" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">{{ batch.pending_count }}</span>
                <span v-if="Number(batch.sent_count) > 0" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{{ batch.sent_count }}</span>
                <span v-if="Number(batch.completed_count) > 0" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{{ batch.completed_count }}</span>
                <span v-if="Number(batch.failed_count) > 0" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">{{ batch.failed_count }}</span>
              </div>

              <!-- Batch Actions -->
              <div class="flex items-center gap-1 ml-2" @click.stop>
                <button v-if="Number(batch.failed_count) > 0" @click="retryFailed(batch.id)"
                  class="p-1.5 text-gray-400 hover:text-amber-600 transition-colors rounded-lg hover:bg-amber-50" title="Retry failed">
                  <RotateCcw class="w-3.5 h-3.5" />
                </button>
                <button v-if="Number(batch.pending_count) > 0" @click="cancelPending(batch.id)"
                  class="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100" title="Cancel pending">
                  <Ban class="w-3.5 h-3.5" />
                </button>
                <button @click="deleteBatch(batch.id)"
                  class="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50" title="Delete batch">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Expanded: Queue Items -->
          <div v-if="expandedBatchId === batch.id" class="border-t border-gray-100">
            <!-- Filters -->
            <div class="flex items-center gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-100">
              <Filter class="w-3.5 h-3.5 text-gray-400" />
              <select v-model="filterStatus" @change="page = 1; loadQueueItems()"
                class="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select v-model="filterState" @change="page = 1; loadQueueItems()"
                class="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="">All States</option>
                <option v-for="st in availableStates" :key="st" :value="st">{{ st }}</option>
              </select>
              <span class="text-xs text-gray-500 ml-auto">{{ totalItems.toLocaleString() }} items</span>
            </div>

            <!-- Items Table -->
            <div v-if="isLoadingItems" class="text-center py-8 text-gray-500 text-sm">Loading items...</div>
            <div v-else-if="queueItems.length === 0" class="text-center py-8 text-gray-400 text-sm">No items match filters</div>
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-100">
                  <th class="text-left px-5 py-2 text-xs font-medium text-gray-500 uppercase">Municipality</th>
                  <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">State</th>
                  <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">County</th>
                  <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Survey Link</th>
                  <th class="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in queueItems" :key="item.id" class="border-b border-gray-50 hover:bg-gray-50">
                  <td class="px-5 py-2 text-gray-900">{{ item.municipality_name || item.county_name }}</td>
                  <td class="px-3 py-2 text-gray-600">{{ item.state }}</td>
                  <td class="px-3 py-2 text-gray-600">{{ item.county_name }}</td>
                  <td class="px-3 py-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="statusBadgeClass(item.status)">
                      {{ item.status }}
                    </span>
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-1.5">
                      <a :href="getSurveyUrl(item.unique_id)" target="_blank"
                        class="text-xs font-mono text-indigo-600 hover:text-indigo-800 hover:underline">
                        {{ item.unique_id?.slice(0, 8) }}...
                      </a>
                      <button @click="copySurveyLink(item.unique_id)"
                        class="p-0.5 text-gray-400 hover:text-gray-600 rounded" title="Copy link">
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-1">
                      <button v-if="(item.status === 'completed' || item.status === 'in_progress') && item.response_data"
                        @click="viewResponse(item)"
                        :class="item.status === 'in_progress' ? 'text-blue-700 bg-blue-50 hover:bg-blue-100' : 'text-green-700 bg-green-50 hover:bg-green-100'"
                        class="px-2 py-1 text-xs font-medium rounded-md transition-colors"
                        :title="item.status === 'in_progress' ? 'View partial response' : 'View response'">
                        {{ item.status === 'in_progress' ? 'View Partial' : 'View Response' }}
                      </button>
                      <span v-else-if="item.status === 'completed'" class="text-xs text-gray-400">Completed</span>
                      <span v-else-if="item.sent_at" class="text-xs text-gray-400">{{ formatDate(item.sent_at) }}</span>
                      <span v-else class="text-xs text-gray-400">—</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-t border-gray-100">
              <button @click="prevPage" :disabled="page <= 1"
                class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
                :class="page > 1 ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400 cursor-not-allowed'">
                Previous
              </button>
              <span class="text-xs text-gray-500">Page {{ page }} of {{ totalPages }}</span>
              <button @click="nextPage" :disabled="page >= totalPages"
                class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
                :class="page < totalPages ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-400 cursor-not-allowed'">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Response Viewer Modal -->
    <Teleport to="body">
      <div v-if="showResponseModal && selectedItem" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showResponseModal = false">
        <div class="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-2xl max-h-[80vh] flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div>
              <h3 class="text-base font-semibold text-gray-900">Survey Response</h3>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ selectedItem.municipality_name || selectedItem.county_name }}, {{ selectedItem.state }}
                · Completed {{ formatDate(selectedItem.completed_at) }}
              </p>
            </div>
            <button @click="showResponseModal = false" class="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
              <X class="w-5 h-5" />
            </button>
          </div>
          <div class="overflow-y-auto p-6 flex-1">
            <div v-if="selectedItem.response_data" class="space-y-3">
              <div v-for="(value, key) in (typeof selectedItem.response_data === 'string' ? JSON.parse(selectedItem.response_data) : selectedItem.response_data)"
                :key="key"
                class="border border-gray-100 rounded-lg p-3"
              >
                <dt class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ key }}</dt>
                <dd class="mt-1 text-sm text-gray-900">
                  <template v-if="Array.isArray(value)">{{ value.join(', ') }}</template>
                  <template v-else-if="typeof value === 'boolean'">{{ value ? 'Yes' : 'No' }}</template>
                  <template v-else>{{ value || '—' }}</template>
                </dd>
              </div>
            </div>
            <p v-else class="text-sm text-gray-500 text-center py-8">No response data available</p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Generate Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showConfirmModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showConfirmModal = false">
        <div class="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-[28rem] space-y-4">
          <h3 class="text-base font-semibold text-gray-900">Generate Queue</h3>
          <p class="text-sm text-gray-600">
            This will create <strong>{{ previewCount?.toLocaleString() }}</strong> queue items
            for <strong>{{ selectedSurvey?.name }}</strong>.
          </p>
          <p class="text-xs text-gray-500">
            States: <strong>{{ selectedStates.join(', ') }}</strong> ·
            {{ jurisdictionType === 'county_only' ? 'County treasurers only' : 'All jurisdictions (counties + municipalities)' }}
          </p>
          <p class="text-xs text-gray-500">
            Each jurisdiction will get a pending queue entry with a unique survey link.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <button @click="showConfirmModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button @click="generateQueue" :disabled="isGenerating"
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400">
              <Play v-if="!isGenerating" class="w-4 h-4" />
              <RefreshCw v-else class="w-4 h-4 animate-spin" />
              {{ isGenerating ? 'Generating...' : 'Generate' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
