import api from '../lib/api'

export const publicService = {
  getMenu: (slug) => api.get(`/public/menu/${encodeURIComponent(slug)}`).then((r) => r.data),
  trackView: (slug) => api.post(`/public/menu/${encodeURIComponent(slug)}/views`).catch(() => {}),
}
