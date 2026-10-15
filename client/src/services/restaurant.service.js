import api from '../lib/api'

export const restaurantService = {
  mine: () => api.get('/restaurants/mine').then((r) => r.data.restaurants),
  // Resolves to { restaurant, subscription }.
  create: (payload) => api.post('/restaurants', payload).then((r) => r.data),
  get: (id) => api.get(`/restaurants/${id}`).then((r) => r.data.restaurant),
  update: (id, payload) => api.patch(`/restaurants/${id}`, payload).then((r) => r.data.restaurant),
  remove: (id) => api.delete(`/restaurants/${id}`).then((r) => r.data),
  stats: (id) => api.get(`/restaurants/${id}/stats`).then((r) => r.data),
}
