import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { setUnauthorizedHandler } from '../lib/api'
import { authService } from '../services/auth.service'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // The session is an HttpOnly cookie the app can't read, so ask the API on startup.
  const [status, setStatus] = useState('loading')
  const statusRef = useRef(status)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (statusRef.current === 'authenticated') toast.error('Your session has expired. Please log in again.')
      setUser(null)
      setStatus('guest')
    })
    let cancelled = false
    authService
      .me()
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!cancelled) setStatus('guest')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const startSession = useCallback((nextUser) => {
    setUser(nextUser)
    setStatus('authenticated')
    return nextUser
  }, [])

  const login = useCallback((credentials) => authService.login(credentials).then(startSession), [startSession])
  const register = useCallback((payload) => authService.register(payload).then(startSession), [startSession])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch {
      // Clear the local session even if the network call fails.
    }
    setUser(null)
    setStatus('guest')
  }, [])

  const value = useMemo(
    () => ({ user, status, isAuthenticated: status === 'authenticated', login, register, logout, setUser }),
    [user, status, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
