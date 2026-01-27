import axios from "axios"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api"

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem("refreshToken")
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken
        })

        const newToken = response.data.accessToken
        localStorage.setItem("accessToken", newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`

        return apiClient(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem("accessToken")
        localStorage.removeItem("refreshToken")
        window.location.href = "/login"
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default {
  // Auth
  login(username, password) {
    return axios.post(`${API_BASE_URL}/auth/login`, { username, password })
  },

  register(data) {
    return axios.post(`${API_BASE_URL}/auth/register`, data)
  },

  // Counties
  getCounties(params = {}) {
    const { limit = 50, page = 1, search, state, jurisdictionType, searchMode = "general", hideValidated, countyName } = params
    let url = `/counties?paginate=true&limit=${limit}&page=${page}`
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}&searchMode=${encodeURIComponent(searchMode)}`
    }
    if (state && state.trim()) {
      url += `&state=${encodeURIComponent(state.trim())}`
    }
    if (jurisdictionType && jurisdictionType !== "all") {
      url += `&jurisdictionType=${encodeURIComponent(jurisdictionType)}`
    }
    if (hideValidated) {
      url += `&hideValidated=true`
    }
    if (countyName && countyName.trim()) {
      url += `&countyName=${encodeURIComponent(countyName.trim())}`
    }
    return apiClient.get(url)
  },

  getCounty(researchId) {
    return apiClient.get(`/counties/${researchId}`)
  },

  updateCounty(researchId, data) {
    return apiClient.patch(`/counties/${researchId}`, data)
  },

  getScreenshots(researchId) {
    return apiClient.get(`/screenshots/${researchId}`)
  },

  getSourceData(researchId) {
    return apiClient.get(`/source-data/${researchId}`)
  },

  reResearch(researchId, options = {}) {
    return apiClient.post(`/counties/${researchId}/re-research`, options)
  },

  exportCSV(filters = {}) {
    return apiClient.get("/export/csv", {
      params: filters,
      responseType: "blob"
    })
  },

  propagateCountyData(researchId) {
    return apiClient.post(`/counties/${researchId}/propagate-county-data`)
  },

  getEditHistory(researchId) {
    return apiClient.get(`/counties/${researchId}/edit-history`)
  },

  // Installments (expandable table)
  getInstallments(researchId) {
    return apiClient.get(`/counties/${researchId}/installments`)
  },

  createInstallment(researchId, data) {
    return apiClient.post(`/counties/${researchId}/installments`, data)
  },

  updateInstallment(installmentId, data) {
    return apiClient.put(`/installments/${installmentId}`, data)
  },

  deleteInstallment(installmentId) {
    return apiClient.delete(`/installments/${installmentId}`)
  },

  // Contacts (expandable table)
  getContacts(researchId) {
    return apiClient.get(`/counties/${researchId}/contacts`)
  },

  createContact(researchId, data) {
    return apiClient.post(`/counties/${researchId}/contacts`, data)
  },

  updateContact(contactId, data) {
    return apiClient.put(`/contacts/${contactId}`, data)
  },

  deleteContact(contactId) {
    return apiClient.delete(`/contacts/${contactId}`)
  },

  reorderContacts(researchId, orderedIds) {
    return apiClient.put(`/counties/${researchId}/contacts/reorder`, { orderedIds })
  },

  getContactTypes() {
    return apiClient.get('/contact-types')
  },

  // Fees (expandable table)
  getFees(researchId) {
    return apiClient.get(`/counties/${researchId}/fees`)
  },

  createFee(researchId, data) {
    return apiClient.post(`/counties/${researchId}/fees`, data)
  },

  updateFee(feeId, data) {
    return apiClient.put(`/fees/${feeId}`, data)
  },

  deleteFee(feeId) {
    return apiClient.delete(`/fees/${feeId}`)
  },

  getFeeTypes() {
    return apiClient.get('/fee-types')
  },

  // Research versions
  getResearchVersions(researchId) {
    return apiClient.get(`/counties/${researchId}/versions`)
  },

  getResearchById(researchId) {
    return apiClient.get(`/research/${researchId}`)
  },

  // Survey Configs
  getSurveyConfigs() {
    return apiClient.get('/survey-configs')
  },

  getSurveyConfig(id) {
    return apiClient.get(`/survey-configs/${id}`)
  },

  createSurveyConfig(data) {
    return apiClient.post('/survey-configs', data)
  },

  updateSurveyConfig(id, data) {
    return apiClient.put(`/survey-configs/${id}`, data)
  },

  deleteSurveyConfig(id) {
    return apiClient.delete(`/survey-configs/${id}`)
  },

  // Survey Queue
  getSurveyBatches() {
    return apiClient.get('/survey-queue/batches')
  },

  getSurveyBatch(batchId) {
    return apiClient.get(`/survey-queue/batches/${batchId}`)
  },

  getQueueItems(params = {}) {
    return apiClient.get('/survey-queue/items', { params })
  },

  getQueueStats(batchId = null) {
    const params = batchId ? { batchId } : {}
    return apiClient.get('/survey-queue/stats', { params })
  },

  previewQueueScope(scopeType, scopeFilter = {}) {
    return apiClient.post('/survey-queue/preview', { scopeType, scopeFilter })
  },

  generateQueue(surveyConfigId, scopeType, scopeFilter = {}) {
    return apiClient.post('/survey-queue/generate', { surveyConfigId, scopeType, scopeFilter })
  },

  updateQueueItem(itemId, data) {
    return apiClient.patch(`/survey-queue/items/${itemId}`, data)
  },

  batchQueueAction(batchId, action) {
    return apiClient.post(`/survey-queue/batches/${batchId}/bulk-action`, { action })
  },

  deleteBatch(batchId) {
    return apiClient.delete(`/survey-queue/batches/${batchId}`)
  }
}
