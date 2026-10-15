import axios from 'axios'
import { mockAdapter } from './mock/adapter'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const SAFE_METHODS = ['get', 'head', 'options']

// The session lives in an HttpOnly cookie set by the API, so there is no token to store
// here — `withCredentials` makes the browser send it. State-changing requests also carry
// a CSRF token fetched from GET /auth/csrf.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  ...(USE_MOCK ? { adapter: mockAdapter } : {}),
})

let csrfToken = null
let csrfRequest = null

function getCsrfToken() {
  if (csrfToken) return Promise.resolve(csrfToken)
  csrfRequest ??= api
    .get('/auth/csrf')
    .then((response) => (csrfToken = response.data.csrfToken))
    .finally(() => {
      csrfRequest = null
    })
  return csrfRequest
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  // Public menu endpoints carry no session authority and need no token.
  if (!SAFE_METHODS.includes(method) && !config.url?.startsWith('/public/')) {
    config.headers['X-CSRF-Token'] = await getCsrfToken()
  }
  return config
})

let onUnauthorized = null
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { config, response } = error
    // The CSRF cookie expired or was cleared: fetch a fresh token and retry once.
    if (response?.status === 403 && response.data?.code === 'CSRF_INVALID' && config && !config._csrfRetry) {
      csrfToken = null
      config._csrfRetry = true
      return api(config)
    }
    const isSessionCall = /\/auth\/(login|register|me|logout)$/.test(config?.url || '')
    if (response?.status === 401 && !isSessionCall) onUnauthorized?.()
    return Promise.reject(error)
  },
)

export default api
