import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PageLoader } from '../ui/Spinner'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <PageLoader label="Checking your session" />
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

/**
 * Keeps signed-in users away from login/register. Only redirects people who
 * arrive already signed in — after a fresh login or sign-up the page itself
 * decides where to go (e.g. back to `state.from`, or the menu builder).
 */
export function GuestRoute() {
  const { status } = useAuth()
  const [arrivedAsGuest, setArrivedAsGuest] = useState(status === 'guest')

  useEffect(() => {
    if (status === 'guest') setArrivedAsGuest(true)
  }, [status])

  if (status === 'loading') return <PageLoader />
  if (status === 'authenticated' && !arrivedAsGuest) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
