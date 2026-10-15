import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getPlan } from '../lib/constants'
import { getErrorMessage } from '../lib/utils'
import { billingService } from '../services/billing.service'
import { restaurantService } from '../services/restaurant.service'

const WorkspaceContext = createContext(null)
const ACTIVE_RESTAURANT_KEY = 'menuo_active_restaurant'

function readActiveId() {
  try {
    return localStorage.getItem(ACTIVE_RESTAURANT_KEY)
  } catch {
    return null
  }
}

function writeActiveId(id) {
  try {
    localStorage.setItem(ACTIVE_RESTAURANT_KEY, id)
  } catch {
    // Storage unavailable — the first restaurant is used next time.
  }
}

/**
 * Loads the owner's restaurants, the active one, and its subscription summary
 * ({ subscription, plan, usage, paymentsEnabled }) once for the whole dashboard.
 */
export function WorkspaceProvider({ children }) {
  const [restaurants, setRestaurants] = useState([])
  const [activeId, setActiveId] = useState(readActiveId)
  const [billing, setBilling] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadBilling = useCallback(async (restaurantId) => {
    const next = await billingService.current(restaurantId)
    setBilling(next)
    return next
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await restaurantService.mine()
      setRestaurants(list)
      const active = list.find((r) => r.id === readActiveId()) || list[0]
      if (active) {
        setActiveId(active.id)
        await loadBilling(active.id)
      } else {
        setBilling(null)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [loadBilling])

  useEffect(() => {
    load()
  }, [load])

  const restaurant = restaurants.find((r) => r.id === activeId) || restaurants[0] || null

  const selectRestaurant = useCallback(
    async (id) => {
      writeActiveId(id)
      setActiveId(id)
      setBilling(null)
      setLoading(true)
      try {
        await loadBilling(id)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [loadBilling],
  )

  const createRestaurant = useCallback(
    async (payload) => {
      const { restaurant: created } = await restaurantService.create(payload)
      setRestaurants((list) => [...list, created])
      writeActiveId(created.id)
      setActiveId(created.id)
      await loadBilling(created.id)
      return created
    },
    [loadBilling],
  )

  const setRestaurant = useCallback((updated) => {
    setRestaurants((list) => list.map((r) => (r.id === updated.id ? updated : r)))
  }, [])

  const refreshBilling = useCallback(() => (restaurant ? loadBilling(restaurant.id) : Promise.resolve(null)), [restaurant, loadBilling])

  const value = useMemo(() => {
    const subscription = billing?.subscription || null
    return {
      restaurants,
      restaurant,
      subscription,
      plan: getPlan(subscription?.plan),
      usage: billing?.usage || null,
      paymentsEnabled: Boolean(billing?.paymentsEnabled),
      hasAccess: Boolean(subscription?.hasAccess),
      loading,
      error,
      reload: load,
      refreshBilling,
      setBilling,
      setRestaurant,
      selectRestaurant,
      createRestaurant,
    }
  }, [restaurants, restaurant, billing, loading, error, load, refreshBilling, setRestaurant, selectRestaurant, createRestaurant])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return context
}
