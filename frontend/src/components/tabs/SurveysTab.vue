<script setup>
import { ref, onMounted } from 'vue'
import {
  Upload, Download, Trash2, Eye,
  RefreshCw, AlertCircle, CheckCircle2, Archive,
  Copy, ChevronDown, ClipboardList, X, FileText
} from 'lucide-vue-next'
import api from '../../services/api'

const surveys = ref([])
const isLoading = ref(false)
const error = ref('')
const toast = ref(null)

// Modal state
const showUploadModal = ref(false)
const showViewModal = ref(false)
const showTemplateInfo = ref(false)
const selectedSurvey = ref(null)
const uploadForm = ref({ name: '', description: '', status: 'draft' })
const uploadFile = ref(null)
const uploadPreview = ref(null)
const isUploading = ref(false)

// Template variables definition
const templateVariables = [
  { variable: '{CountyName}', description: 'County name (e.g., "Cook County")', sample: 'Cook County' },
  { variable: '{State}', description: 'State abbreviation (e.g., "IL")', sample: 'IL' },
  { variable: '{StateName}', description: 'Full state name (e.g., "Illinois")', sample: 'Illinois' },
  { variable: '{MunicipalityName}', description: 'Municipality name or county name', sample: 'Chicago' },
  { variable: '{TreasurerName}', description: 'Primary contact name', sample: 'John Smith' },
  { variable: '{TreasurerEmail}', description: 'Primary contact email', sample: 'treasurer@example.com' },
  { variable: '{TreasurerPhone}', description: 'Primary contact phone', sample: '(555) 123-4567' },
  { variable: '{TaxYear}', description: 'Current tax year', sample: '2025' }
]

function statusClass(status) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700'
    case 'archived': return 'bg-gray-100 text-gray-500'
    default: return 'bg-amber-100 text-amber-700'
  }
}

async function loadSurveys() {
  isLoading.value = true
  error.value = ''
  try {
    const response = await api.getSurveyConfigs()
    surveys.value = response.data.configs
  } catch (err) {
    error.value = 'Failed to load surveys'
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  uploadFile.value = file
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result)
      if (!parsed.meta || !Array.isArray(parsed.items)) {
        throw new Error('Invalid survey config format — must have meta and items array')
      }
      uploadPreview.value = parsed
      uploadForm.value.name = parsed.meta.title || file.name.replace('.json', '')
    } catch (err) {
      error.value = 'Invalid JSON file: ' + err.message
      uploadFile.value = null
      uploadPreview.value = null
    }
  }
  reader.readAsText(file)
}

async function submitUpload() {
  if (!uploadPreview.value || !uploadForm.value.name) return
  isUploading.value = true
  try {
    await api.createSurveyConfig({
      name: uploadForm.value.name,
      description: uploadForm.value.description,
      config: uploadPreview.value,
      status: uploadForm.value.status
    })
    showUploadModal.value = false
    resetUploadForm()
    showToast('Survey uploaded successfully')
    await loadSurveys()
  } catch (err) {
    error.value = 'Failed to upload survey'
    console.error(err)
  } finally {
    isUploading.value = false
  }
}

async function viewSurvey(survey) {
  try {
    const response = await api.getSurveyConfig(survey.id)
    selectedSurvey.value = response.data.config
    showViewModal.value = true
  } catch (err) {
    error.value = 'Failed to load survey details'
  }
}

async function downloadSurvey(survey) {
  try {
    const response = await api.getSurveyConfig(survey.id)
    const config = response.data.config.config
    const json = JSON.stringify(config, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${survey.name.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = 'Failed to download survey'
  }
}

async function updateStatus(survey, newStatus) {
  try {
    await api.updateSurveyConfig(survey.id, { status: newStatus })
    showToast(`Survey ${newStatus === 'active' ? 'activated' : newStatus === 'archived' ? 'archived' : 'set to draft'}`)
    await loadSurveys()
  } catch (err) {
    error.value = 'Failed to update survey status'
  }
}

async function deleteSurvey(survey) {
  if (!confirm(`Delete "${survey.name}"? This cannot be undone.`)) return
  try {
    await api.deleteSurveyConfig(survey.id)
    showToast('Survey deleted')
    await loadSurveys()
  } catch (err) {
    error.value = 'Failed to delete survey'
  }
}

function copyJson() {
  if (!selectedSurvey.value) return
  const json = JSON.stringify(selectedSurvey.value.config, null, 2)
  navigator.clipboard.writeText(json).then(() => {
    showToast('JSON copied to clipboard')
  })
}

function resetUploadForm() {
  uploadForm.value = { name: '', description: '', status: 'draft' }
  uploadFile.value = null
  uploadPreview.value = null
}

function showToast(message) {
  toast.value = message
  setTimeout(() => { toast.value = null }, 3000)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

onMounted(loadSurveys)
</script>

<template>
  <div class="max-w-5xl space-y-6">
    <!-- Toast -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="toast" class="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl shadow-lg text-sm font-medium">
        <CheckCircle2 class="w-4 h-4" />
        {{ toast }}
      </div>
    </Transition>

    <!-- Error message -->
    <div v-if="error" class="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
      <AlertCircle class="w-5 h-5 flex-shrink-0" />
      <span class="text-sm">{{ error }}</span>
      <button @click="error = ''" class="ml-auto text-red-400 hover:text-red-600">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Header Card -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="p-6 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList class="w-5 h-5 text-primary-600" />
            Survey Configurations
          </h3>
          <p class="text-sm text-gray-500 mt-1">Upload and manage survey JSON configs exported from the Survey Builder</p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="loadSurveys" class="btn btn-ghost" :disabled="isLoading">
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
            Refresh
          </button>
          <button @click="showUploadModal = true" class="btn btn-primary">
            <Upload class="w-4 h-4" />
            Upload JSON
          </button>
        </div>
      </div>
    </div>

    <!-- Template Variables Info -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <button
        @click="showTemplateInfo = !showTemplateInfo"
        class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors rounded-xl"
      >
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 8l-4 4 4 4"/><path d="M17 8l4 4-4 4"/></svg>
          <span class="text-sm font-semibold text-gray-900">Template Variables Reference</span>
          <span class="text-xs text-gray-400">Use these in the Survey Builder for dynamic content</span>
        </div>
        <ChevronDown class="w-4 h-4 text-gray-400 transition-transform" :class="{ 'rotate-180': showTemplateInfo }" />
      </button>
      <div v-if="showTemplateInfo" class="px-6 pb-4 border-t border-gray-100">
        <table class="w-full mt-3">
          <thead>
            <tr class="text-left text-xs text-gray-500 uppercase tracking-wider">
              <th class="pb-2 font-medium">Variable</th>
              <th class="pb-2 font-medium">Description</th>
              <th class="pb-2 font-medium">Sample Value</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr v-for="tv in templateVariables" :key="tv.variable" class="border-t border-gray-50">
              <td class="py-2">
                <code class="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono">{{ tv.variable }}</code>
              </td>
              <td class="py-2 text-gray-600">{{ tv.description }}</td>
              <td class="py-2 text-gray-500 italic">{{ tv.sample }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Survey List -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div class="p-6 border-b border-gray-200">
        <h4 class="text-sm font-semibold text-gray-900">
          Saved Surveys
          <span class="text-gray-400 font-normal ml-1">({{ surveys.length }})</span>
        </h4>
      </div>

      <!-- Loading state -->
      <div v-if="isLoading && !surveys.length" class="p-12 text-center">
        <RefreshCw class="w-6 h-6 text-gray-300 animate-spin mx-auto mb-2" />
        <p class="text-sm text-gray-400">Loading surveys...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!surveys.length" class="p-12 text-center">
        <FileText class="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p class="text-sm text-gray-500 mb-1">No surveys uploaded yet</p>
        <p class="text-xs text-gray-400">Export a JSON from the Survey Builder and upload it here</p>
      </div>

      <!-- Survey table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <th class="px-6 py-3 font-medium">Name</th>
              <th class="px-4 py-3 font-medium">Items</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Created By</th>
              <th class="px-4 py-3 font-medium">Updated</th>
              <th class="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="survey in surveys" :key="survey.id" class="border-t border-gray-50 hover:bg-gray-50 transition-colors">
              <td class="px-6 py-3">
                <div class="text-sm font-medium text-gray-900">{{ survey.name }}</div>
                <div v-if="survey.config_title && survey.config_title !== survey.name" class="text-xs text-gray-400 mt-0.5">{{ survey.config_title }}</div>
                <div v-if="survey.description" class="text-xs text-gray-400 mt-0.5">{{ survey.description }}</div>
              </td>
              <td class="px-4 py-3">
                <span class="text-sm text-gray-600">{{ survey.item_count || 0 }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex px-2 py-0.5 text-xs font-medium rounded-full" :class="statusClass(survey.status)">
                  {{ survey.status }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span class="text-sm text-gray-600">{{ survey.created_by || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-gray-500">{{ formatDate(survey.updated_at) }}</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <button @click="viewSurvey(survey)" class="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="View">
                    <Eye class="w-4 h-4" />
                  </button>
                  <button @click="downloadSurvey(survey)" class="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Download JSON">
                    <Download class="w-4 h-4" />
                  </button>
                  <button
                    v-if="survey.status !== 'active'"
                    @click="updateStatus(survey, 'active')"
                    class="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Activate"
                  >
                    <CheckCircle2 class="w-4 h-4" />
                  </button>
                  <button
                    v-if="survey.status !== 'archived'"
                    @click="updateStatus(survey, 'archived')"
                    class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Archive"
                  >
                    <Archive class="w-4 h-4" />
                  </button>
                  <button
                    v-if="survey.status === 'archived'"
                    @click="updateStatus(survey, 'draft')"
                    class="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Restore to Draft"
                  >
                    <RefreshCw class="w-4 h-4" />
                  </button>
                  <button @click="deleteSurvey(survey)" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Upload Modal -->
    <Teleport to="body">
      <div v-if="showUploadModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showUploadModal = false">
        <div class="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg">
          <div class="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 class="text-base font-semibold text-gray-900">Upload Survey Config</h3>
            <button @click="showUploadModal = false; resetUploadForm()" class="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="p-6 space-y-4">
            <!-- File Input -->
            <div>
              <label class="input-label">JSON File</label>
              <label class="flex items-center justify-center gap-2 w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors">
                <input type="file" accept=".json" @change="handleFileSelect" class="hidden" />
                <Upload class="w-5 h-5 text-gray-400" />
                <span class="text-sm text-gray-500">
                  {{ uploadFile ? uploadFile.name : 'Click to select a JSON file' }}
                </span>
              </label>
            </div>

            <!-- Preview -->
            <div v-if="uploadPreview" class="bg-green-50 border border-green-200 rounded-xl p-4">
              <div class="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle2 class="w-4 h-4" />
                <span class="text-sm font-medium">Valid survey config</span>
              </div>
              <div class="text-xs text-green-600 space-y-1">
                <p>Title: <strong>{{ uploadPreview.meta?.title || '(untitled)' }}</strong></p>
                <p>Items: <strong>{{ uploadPreview.items?.length || 0 }}</strong></p>
                <p v-if="uploadPreview.meta?.createdAt">Created: {{ formatDate(uploadPreview.meta.createdAt) }}</p>
              </div>
            </div>

            <!-- Name -->
            <div>
              <label class="input-label">Name</label>
              <input v-model="uploadForm.name" type="text" class="input" placeholder="Survey name..." />
            </div>

            <!-- Description -->
            <div>
              <label class="input-label">Description (optional)</label>
              <textarea v-model="uploadForm.description" rows="2" class="input" placeholder="Brief description..."></textarea>
            </div>

            <!-- Status -->
            <div>
              <label class="input-label">Status</label>
              <select v-model="uploadForm.status" class="input">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button @click="showUploadModal = false; resetUploadForm()" class="btn btn-secondary">Cancel</button>
            <button
              @click="submitUpload"
              :disabled="!uploadPreview || !uploadForm.name || isUploading"
              class="btn btn-primary"
            >
              <Upload class="w-4 h-4" />
              {{ isUploading ? 'Uploading...' : 'Upload Survey' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- View Modal -->
    <Teleport to="body">
      <div v-if="showViewModal && selectedSurvey" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" @click.self="showViewModal = false">
        <div class="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-3xl max-h-[80vh] flex flex-col">
          <div class="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <div>
              <h3 class="text-base font-semibold text-gray-900">{{ selectedSurvey.name }}</h3>
              <p v-if="selectedSurvey.description" class="text-xs text-gray-500 mt-0.5">{{ selectedSurvey.description }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button @click="copyJson" class="btn btn-ghost text-xs">
                <Copy class="w-3.5 h-3.5" />
                Copy JSON
              </button>
              <button @click="showViewModal = false" class="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div class="overflow-y-auto p-6 flex-1">
            <!-- Survey Meta -->
            <div class="mb-4 space-y-2">
              <div class="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span class="text-gray-500">Status:</span>
                  <span class="ml-1 inline-flex px-2 py-0.5 text-xs font-medium rounded-full" :class="statusClass(selectedSurvey.status)">
                    {{ selectedSurvey.status }}
                  </span>
                </div>
                <div>
                  <span class="text-gray-500">Created by:</span>
                  <span class="ml-1 text-gray-900">{{ selectedSurvey.created_by || '—' }}</span>
                </div>
                <div>
                  <span class="text-gray-500">Updated:</span>
                  <span class="ml-1 text-gray-900">{{ formatDate(selectedSurvey.updated_at) }}</span>
                </div>
              </div>
            </div>

            <!-- JSON Config -->
            <div class="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Config JSON</h4>
              <pre class="text-xs text-gray-700 font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto">{{ JSON.stringify(selectedSurvey.config, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
