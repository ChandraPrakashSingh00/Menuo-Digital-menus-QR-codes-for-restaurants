import api from '../lib/api'

export const categoryService = {
  list: (restaurantId) => api.get(`/menu/${restaurantId}/categories`).then((r) => r.data.categories),
  create: (restaurantId, payload) => api.post(`/menu/${restaurantId}/categories`, payload).then((r) => r.data.category),
  update: (id, payload) => api.patch(`/menu/category/${id}`, payload).then((r) => r.data.category),
  remove: (id) => api.delete(`/menu/category/${id}`),
  reorder: (restaurantId, ids) => api.put(`/menu/${restaurantId}/categories/order`, { ids }).then((r) => r.data.categories),
}

const PAGE_SIZE = 500

export const itemService = {
  /** Every item of a restaurant (follows pagination). `params`: categoryId, search, available. */
  async list(restaurantId, params = {}) {
    const items = []
    for (let page = 1; ; page++) {
      const { data } = await api.get(`/menu/${restaurantId}`, { params: { ...params, page, limit: PAGE_SIZE } })
      items.push(...data.items)
      if (page >= data.pagination.pages) return items
    }
  },
  create: (restaurantId, payload) => api.post(`/menu/${restaurantId}`, payload).then((r) => r.data.item),
  update: (id, payload) => api.patch(`/menu/item/${id}`, payload).then((r) => r.data.item),
  duplicate: (id) => api.post(`/menu/item/${id}/duplicate`).then((r) => r.data.item),
  remove: (id) => api.delete(`/menu/item/${id}`),
}
