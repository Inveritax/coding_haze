<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import api from '../services/api.js'
import {
  Building2,
  Calendar,
  Users,
  MapPin,
  Globe,
  FileText,
  LogOut,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Menu,
  ChevronDown,
  Filter,
  FilterX,
  PenLine,
  LayoutGrid,
  History,
  UserSearch,
  Copy,
  RefreshCw,
  GitBranch
} from 'lucide-vue-next'

// Tab components
import OverviewTab from '../components/tabs/OverviewTab.vue'
import TaxInfoTab from '../components/tabs/TaxInfoTab.vue'
import ContactTab from '../components/tabs/ContactTab.vue'
import AddressTab from '../components/tabs/AddressTab.vue'
import OnlineTab from '../components/tabs/OnlineTab.vue'
import AdditionalTab from '../components/tabs/AdditionalTab.vue'
import HistoryTab from '../components/tabs/HistoryTab.vue'
import VersionsTab from '../components/tabs/VersionsTab.vue'

const router = useRouter()
const authStore = useAuthStore()

// State
const counties = ref([])
const selectedCounty = ref(null)
const activeTab = ref('overview')
const searchQuery = ref('')
const isLoading = ref(false)
const isSidebarCollapsed = ref(false)
const isSaving = ref(false)

// Filters
const selectedState = ref('')
const showCounties = ref(true)
const showMunicipalities = ref(true)
const hideEdited = ref(false)
const showFilters = ref(false)

// US States list
const usStates = [
  { code: '', name: 'All States' },
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' }
]

// Computed jurisdiction type for API
const jurisdictionType = computed(() => {
  if (showCounties.value && showMunicipalities.value) return 'all'
  if (showCounties.value) return 'county'
  if (showMunicipalities.value) return 'municipality'
  return 'all'
})

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return selectedState.value || !showCounties.value || !showMunicipalities.value || hideEdited.value
})

// Clear all filters
function clearFilters() {
  selectedState.value = ''
  showCounties.value = true
  showMunicipalities.value = true
  hideEdited.value = false
  searchQuery.value = ''
}

// Pagination
const currentPage = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)
const perPage = ref(25)

// Tab configuration
const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'tax', label: 'Tax Info', icon: Calendar },
  { id: 'contact', label: 'Contact', icon: Users },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'online', label: 'Online', icon: Globe },
  { id: 'additional', label: 'Additional', icon: FileText },
  { id: 'history', label: 'History', icon: History },
  { id: 'versions', label: 'Versions', icon: GitBranch }
]

// Current tab component
const currentTabComponent = computed(() => {
  const components = {
    overview: OverviewTab,
    tax: TaxInfoTab,
    contact: ContactTab,
    address: AddressTab,
    online: OnlineTab,
    additional: AdditionalTab,
    history: HistoryTab,
    versions: VersionsTab
  }
  return components[activeTab.value]
})

// Handle switching to a different research version
function switchVersion(researchData) {
  // Update the selected county with the new research data
  // Map the research result fields to match the county structure
  const updatedCounty = {
    ...selectedCounty.value,
    research_id: researchData.id,
    research_date: researchData.research_date,
    method_used: researchData.method_used,
    success: researchData.success,
    current_tax_year: researchData.current_tax_year,
    num_installments: researchData.num_installments,
    due_date_1: researchData.due_date_1,
    due_date_2: researchData.due_date_2,
    due_date_3: researchData.due_date_3,
    due_date_4: researchData.due_date_4,
    due_date_5: researchData.due_date_5,
    due_date_6: researchData.due_date_6,
    due_date_7: researchData.due_date_7,
    due_date_8: researchData.due_date_8,
    due_date_9: researchData.due_date_9,
    due_date_10: researchData.due_date_10,
    default_delq_collector: researchData.default_delq_collector,
    default_escrow_collector: researchData.default_escrow_collector,
    delq_search_start_date: researchData.delq_search_start_date,
    default_escrow_search_start_date: researchData.default_escrow_search_start_date,
    tax_billing_date: researchData.tax_billing_date,
    primary_contact_name: researchData.primary_contact_name,
    primary_contact_title: researchData.primary_contact_title,
    primary_contact_phone: researchData.primary_contact_phone,
    primary_contact_email: researchData.primary_contact_email,
    tax_authority_physical_address: researchData.tax_authority_physical_address,
    tax_authority_mailing_address: researchData.tax_authority_mailing_address,
    general_phone_number: researchData.general_phone_number,
    fax_number: researchData.fax_number,
    web_address: researchData.web_address,
    county_website: researchData.county_website,
    pay_taxes_url: researchData.pay_taxes_url,
    notes: researchData.notes,
    validation_score: researchData.validation_score
  }
  selectedCounty.value = updatedCounty
}

// Fetch counties
async function fetchCounties() {
  isLoading.value = true
  try {
    const response = await api.getCounties({
      limit: perPage.value,
      page: currentPage.value,
      search: searchQuery.value || undefined,
      state: selectedState.value || undefined,
      jurisdictionType: jurisdictionType.value,
      searchMode: 'name', // Use name search mode for better matching
      hideValidated: hideEdited.value || undefined
    })

    counties.value = response.data.data || []
    totalPages.value = response.data.total_pages || response.data.totalPages || 1
    totalCount.value = response.data.total || response.data.total_count || 0

    // Select first county if none selected
    if (!selectedCounty.value && counties.value.length > 0) {
      selectedCounty.value = counties.value[0]
    }
  } catch (error) {
    console.error('Failed to fetch counties:', error)
  } finally {
    isLoading.value = false
  }
}

// Select a county
function selectCounty(county) {
  selectedCounty.value = county
}

// Open history tab for a county (when clicking pencil icon)
function openHistory(county, event) {
  event.stopPropagation()
  selectedCounty.value = county
  activeTab.value = 'history'
}

// Filter by parent county (when clicking X/X badge)
// Sets state filter, search box to county name, and ensures both checkboxes are checked
function filterByCounty(county, event) {
  event.stopPropagation()
  // Set state filter
  selectedState.value = county.state
  // Set search to county name (without " County" suffix for better matching)
  const countyNameForSearch = county.county_name.replace(/ County$/, '')
  searchQuery.value = countyNameForSearch
  // Ensure both counties and municipalities are shown
  showCounties.value = true
  showMunicipalities.value = true
  // Open filters panel so user can see what's set
  showFilters.value = true
  // Reset to page 1
  currentPage.value = 1
  // Fetch will be triggered by the watch on searchQuery
}

// Save county changes - sends individual field updates to trigger audit logging
async function saveCounty(updates) {
  if (!selectedCounty.value) return

  isSaving.value = true
  try {
    // Send each changed field as a separate request for proper audit logging
    for (const [field, value] of Object.entries(updates)) {
      // Only update if value actually changed
      if (selectedCounty.value[field] !== value) {
        await api.updateCounty(selectedCounty.value.research_id, { field, value })
      }
    }

    // Update local state
    Object.assign(selectedCounty.value, updates)

    // Update in list
    const index = counties.value.findIndex(c => c.research_id === selectedCounty.value.research_id)
    if (index !== -1) {
      Object.assign(counties.value[index], updates)
    }
  } catch (error) {
    console.error('Failed to save:', error)
    throw error
  } finally {
    isSaving.value = false
  }
}

// Logout
function handleLogout() {
  authStore.logout()
  router.push('/login')
}

// Search Treasurer - opens Google search and communicates with extension if available
function searchTreasurer() {
  if (!selectedCounty.value) return

  const county = selectedCounty.value
  const name = county.municipality_name || county.county_name
  const state = county.state
  const searchQuery = `${name} ${state} treasurer contact information`

  // Log county data to console for debugging
  console.log(`🏛️ COUNTY RESEARCH DATA:`)
  console.log(`Jurisdiction: ${name}, ${state}`)
  console.log(`Research ID: ${county.research_id}`)
  console.log(`Type: ${county.jurisdiction_type}`)
  console.log(`TAX INFO:`)
  console.log(`- Tax Year: ${county.current_tax_year || 'Not found'}`)
  console.log(`- Installments: ${county.num_installments || 'Not found'}`)
  console.log(`- Due Date 1: ${county.due_date_1 || 'Not found'}`)
  console.log(`- Due Date 2: ${county.due_date_2 || 'Not found'}`)
  console.log(`CONTACT INFO:`)
  console.log(`- Name: ${county.primary_contact_name || 'Not found'}`)
  console.log(`- Title: ${county.primary_contact_title || 'Not found'}`)
  console.log(`- Phone: ${county.primary_contact_phone || 'Not found'}`)
  console.log(`- Email: ${county.primary_contact_email || 'Not found'}`)
  console.log(`ADDRESSES:`)
  console.log(`- Physical: ${county.tax_authority_physical_address || 'Not found'}`)
  console.log(`- Mailing: ${county.tax_authority_mailing_address || 'Not found'}`)
  console.log(`WEBSITES:`)
  console.log(`- Tax Authority: ${county.web_address || 'Not found'}`)
  console.log(`- County Website: ${county.county_website || 'Not found'}`)
  console.log('📋 Full county object:', county)

  // Build a stable key + record for the extension to store
  const key =
    (county.fips_code && String(county.fips_code).trim()) ||
    [name, state].filter(Boolean).join(', ').toLowerCase()

  const record = {
    ...county,
    jurisdiction_name: name,
    state,
    key,
    lastViewedAt: Date.now()
  }

  // Ask the extension to SAVE & open Google (if installed)
  let acked = false
  const onAck = (evt) => {
    const data = evt?.data
    if (!data || data.source !== 'taxscraper') return
    console.log('📨 Frontend received acknowledgment:', data)
    if (data.type === 'SAVE_RESULT' || data.type === 'OPEN_REFERENCE_RESULT') {
      acked = true
      console.log('✅ Extension acknowledged - preventing fallback')
      window.removeEventListener('message', onAck)
    }
  }
  window.addEventListener('message', onAck, false)

  // Get API configuration for extension
  const apiBase = window.location.origin
  const bearerToken = localStorage.getItem('accessToken') || ''

  // Post to extension (content script listens and relays to background)
  console.log('📤 Frontend sending SAVE_AND_GOOGLE message:', { key, searchQuery, apiBase, bearerToken: bearerToken ? '[PRESENT]' : '[MISSING]' })

  window.postMessage(
    {
      source: 'taxscraper',
      type: 'SAVE_AND_GOOGLE',
      payload: { key, record, searchQuery, apiBase, bearerToken }
    },
    '*'
  )

  // Fallback after 1000ms if no extension responded
  setTimeout(() => {
    if (!acked) {
      console.log('⚠️ Extension did not respond - opening Google search fallback')
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
      window.open(googleUrl, '_blank')
    } else {
      console.log('✅ Extension responded successfully - no fallback needed')
    }
  }, 1000)
}

// Search debounce
let searchTimeout = null
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchCounties()
  }, 500)
})

// Watch filters
watch([selectedState, showCounties, showMunicipalities, hideEdited], () => {
  currentPage.value = 1
  fetchCounties()
})

// Pagination
function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    fetchCounties()
  }
}

onMounted(() => {
  fetchCounties()
})
</script>

<template>
  <div class="h-screen bg-gray-50 flex overflow-hidden">
    <!-- Left Sidebar -->
    <aside
      :class="[
        'bg-white border-r border-gray-200 flex flex-col transition-all duration-300 h-full flex-shrink-0',
        isSidebarCollapsed ? 'w-16' : 'w-80'
      ]"
    >
      <!-- Header -->
      <div :class="['flex-shrink-0 border-b border-gray-200', isSidebarCollapsed ? 'p-2' : 'p-4']">
        <div :class="['flex items-center', isSidebarCollapsed ? 'justify-center' : 'gap-3']">
          <div v-if="!isSidebarCollapsed" class="flex-shrink-0 w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <Building2 class="w-5 h-5 text-white" />
          </div>
          <div v-if="!isSidebarCollapsed" class="flex-1 min-w-0">
            <h1 class="text-lg font-semibold text-gray-900 truncate">County Manager</h1>
          </div>
          <button
            @click="isSidebarCollapsed = !isSidebarCollapsed"
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          >
            <Menu class="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div v-if="!isSidebarCollapsed" class="flex-shrink-0 p-4 border-b border-gray-200 space-y-3">
        <!-- Search -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search counties..."
            class="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <!-- Filter Toggle -->
        <button
          @click="showFilters = !showFilters"
          class="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <span class="flex items-center gap-2">
            <span
              @click.stop="hasActiveFilters ? clearFilters() : null"
              :class="[
                'group relative p-0.5 -m-0.5 rounded transition-colors',
                hasActiveFilters ? 'hover:bg-red-50 cursor-pointer' : ''
              ]"
              :title="hasActiveFilters ? 'Clear all filters' : ''"
            >
              <Filter :class="['w-4 h-4 transition-opacity', hasActiveFilters ? 'group-hover:opacity-0' : '']" />
              <FilterX v-if="hasActiveFilters" class="w-4 h-4 text-red-500 absolute inset-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
            Filters
            <span v-if="hasActiveFilters" class="w-2 h-2 bg-primary-500 rounded-full"></span>
          </span>
          <ChevronDown :class="['w-4 h-4 transition-transform', showFilters ? 'rotate-180' : '']" />
        </button>

        <!-- Filter Panel -->
        <div v-if="showFilters" class="space-y-3 pt-2">
          <!-- State Selector -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">State</label>
            <select
              v-model="selectedState"
              class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              <option v-for="state in usStates" :key="state.code" :value="state.code">
                {{ state.name }}
              </option>
            </select>
          </div>

          <!-- Jurisdiction Type Checkboxes -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-2">Jurisdiction Type</label>
            <div class="space-y-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="showCounties"
                  class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span class="text-sm text-gray-700">Counties</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="showMunicipalities"
                  class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span class="text-sm text-gray-700">Municipalities</span>
              </label>
            </div>
          </div>

          <!-- Hide Validated Toggle -->
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="hideEdited"
                class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700">Hide Validated</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Record Count -->
      <div v-if="!isSidebarCollapsed" class="flex-shrink-0 px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div class="flex items-center justify-center gap-2">
          <p class="text-xs text-gray-500">
            {{ totalCount.toLocaleString() }} records
          </p>
          <button
            @click="fetchCounties"
            :disabled="isLoading"
            class="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw :class="['w-3 h-3', isLoading ? 'animate-spin' : '']" />
          </button>
        </div>
      </div>

      <!-- County List -->
      <div class="flex-1 overflow-y-auto min-h-0">
        <div v-if="isLoading" class="flex items-center justify-center p-8">
          <Loader2 class="w-6 h-6 text-primary-600 animate-spin" />
        </div>

        <div v-else-if="counties.length === 0" class="p-4 text-center text-gray-500 text-sm">
          No counties found
        </div>

        <div v-else class="divide-y divide-gray-100">
          <button
            v-for="county in counties"
            :key="county.research_id"
            @click="selectCounty(county)"
            :class="[
              'w-full text-left transition-all duration-200',
              isSidebarCollapsed ? 'p-2' : 'px-4 py-3',
              selectedCounty?.research_id === county.research_id
                ? 'bg-primary-50 border-l-4 border-primary-600'
                : county.jurisdiction_type === 'county'
                  ? 'bg-amber-50/50 hover:bg-amber-100/50 border-l-4 border-transparent'
                  : 'hover:bg-gray-50 border-l-4 border-transparent'
            ]"
          >
            <div v-if="isSidebarCollapsed" class="flex items-center justify-center">
              <span class="w-7 h-7 rounded flex items-center justify-center text-[10px] font-semibold bg-gray-100 text-gray-600">
                {{ county.state }}
              </span>
            </div>
            <div v-else>
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900">{{ county.municipality_name || county.county_name }}</span>
                <span class="flex-shrink-0 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                  {{ county.state }}
                </span>
                <Copy
                  v-if="county.method_used === 'propagated_from_county'"
                  class="w-3.5 h-3.5 text-blue-500 flex-shrink-0"
                  title="Data propagated from parent county"
                />
                <PenLine
                  v-if="county.has_audit_entries"
                  @click="openHistory(county, $event)"
                  class="w-3.5 h-3.5 text-green-600 flex-shrink-0 hover:text-green-800 cursor-pointer"
                  title="View edit history"
                />
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs text-gray-400">
                  <template v-if="county.jurisdiction_type === 'municipality'">
                    {{ county.county_name }} County
                  </template>
                  <template v-else>
                    County
                  </template>
                </span>
                <!-- Municipality edit count badge for counties -->
                <span
                  v-if="county.jurisdiction_type === 'county' && county.total_municipalities > 0"
                  @click="filterByCounty(county, $event)"
                  :class="[
                    'px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all',
                    county.municipalities_propagated === county.total_municipalities
                      ? 'bg-blue-100 text-blue-700 hover:ring-blue-400'
                      : county.municipalities_with_edits > 0
                        ? 'bg-green-100 text-green-700 hover:ring-green-400'
                        : 'bg-gray-100 text-gray-500 hover:ring-gray-400'
                  ]"
                  :title="county.municipalities_propagated === county.total_municipalities
                    ? `All ${county.total_municipalities} municipalities have propagated data`
                    : `Click to filter: ${county.municipalities_with_edits} of ${county.total_municipalities} municipalities validated`"
                >
                  <template v-if="county.municipalities_propagated === county.total_municipalities">
                    Propagated
                  </template>
                  <template v-else>
                    {{ county.municipalities_with_edits }}/{{ county.total_municipalities }}
                  </template>
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!isSidebarCollapsed && totalPages > 1" class="flex-shrink-0 p-4 border-t border-gray-200">
        <div class="flex items-center justify-between">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-sm text-gray-600">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
        <p class="text-xs text-gray-400 text-center mt-2">{{ totalCount }} total records</p>
      </div>

      <!-- Logout -->
      <div :class="['flex-shrink-0 border-t border-gray-200', isSidebarCollapsed ? 'p-2' : 'p-4']">
        <button
          @click="handleLogout"
          :class="[
            'flex items-center text-gray-600 hover:text-red-600 transition-colors',
            isSidebarCollapsed ? 'justify-center w-full p-2' : 'gap-3'
          ]"
          :title="isSidebarCollapsed ? 'Sign Out' : ''"
        >
          <LogOut class="w-5 h-5" />
          <span v-if="!isSidebarCollapsed" class="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      <!-- Tab Selector Header -->
      <header class="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <div v-if="selectedCounty" class="flex items-center gap-3">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">
                {{ selectedCounty.municipality_name || selectedCounty.county_name }}
              </h2>
              <p class="text-sm text-gray-500">
                {{ selectedCounty.state }} · {{ selectedCounty.jurisdiction_type === 'municipality' ? 'Municipality' : 'County' }}
              </p>
            </div>
            <!-- Search Treasurer Button -->
            <button
              @click="searchTreasurer"
              class="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
              title="Search treasurer info"
            >
              <UserSearch class="w-5 h-5" />
            </button>
          </div>
          <div v-else class="text-gray-500">Select a county to edit</div>

          <!-- Saving indicator -->
          <div v-if="isSaving" class="flex items-center gap-2 text-primary-600">
            <Loader2 class="w-4 h-4 animate-spin" />
            <span class="text-sm">Saving...</span>
          </div>
        </div>

        <!-- Tab Navigation -->
        <nav class="flex gap-1 mt-4 -mb-4 overflow-x-auto">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-colors border-b-2',
              activeTab === tab.id
                ? 'bg-primary-50 text-primary-700 border-primary-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-transparent'
            ]"
          >
            <component :is="tab.icon" class="w-4 h-4" />
            {{ tab.label }}
          </button>
        </nav>
      </header>

      <!-- Tab Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="!selectedCounty" class="flex items-center justify-center h-full">
          <div class="text-center">
            <Building2 class="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 class="text-lg font-medium text-gray-900 mb-2">No County Selected</h3>
            <p class="text-gray-500">Select a county from the sidebar to view and edit its details.</p>
          </div>
        </div>

        <component
          v-else
          :is="currentTabComponent"
          :county="selectedCounty"
          @save="saveCounty"
          @navigate-tab="(tab) => activeTab = tab"
          @switch-version="switchVersion"
        />
      </div>
    </main>
  </div>
</template>
