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

  getInstallmentDetails(researchId) {
    return apiClient.get(`/counties/${researchId}/installments`)
  },

  updateInstallmentDetail(researchId, installmentNumber, data) {
    return apiClient.put(`/counties/${researchId}/installments/${installmentNumber}`, data)
  },

  deleteInstallmentDetail(researchId, installmentNumber) {
    return apiClient.delete(`/counties/${researchId}/installments/${installmentNumber}`)
  },

  getResearchVersions(researchId) {
    return apiClient.get(`/counties/${researchId}/versions`)
  },

  getResearchById(researchId) {
    return apiClient.get(`/research/${researchId}`)
  }
}
