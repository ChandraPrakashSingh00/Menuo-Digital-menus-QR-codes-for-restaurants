import api from '../lib/api'

export const authService = {
  me: () => api.get('/auth/me').then((r) => r.data.user),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data.user),
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data.user),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  updateProfile: (payload) => api.patch('/auth/profile', payload).then((r) => r.data.user),
  changePassword: (payload) => api.patch('/auth/password', payload).then((r) => r.data),
}
