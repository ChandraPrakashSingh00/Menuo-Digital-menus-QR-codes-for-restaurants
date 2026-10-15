import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import DashboardLayout from './components/layout/DashboardLayout'
import { GuestRoute, ProtectedRoute } from './components/routing/ProtectedRoute'
import ScrollToTop from './components/routing/ScrollToTop'
import { PageLoader } from './components/ui/Spinner'

const Landing = lazy(() => import('./pages/marketing/Landing'))
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const Overview = lazy(() => import('./pages/dashboard/Overview'))
const MenuBuilder = lazy(() => import('./pages/dashboard/MenuBuilder'))
const QRCodes = lazy(() => import('./pages/dashboard/QRCodes'))
const Billing = lazy(() => import('./pages/dashboard/Billing'))
const Settings = lazy(() => import('./pages/dashboard/Settings'))
const PublicMenu = lazy(() => import('./pages/public/PublicMenu'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/m/:slug" element={<PublicMenu />} />

          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Overview />} />
              <Route path="menu" element={<MenuBuilder />} />
              <Route path="qr" element={<QRCodes />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
