import { Eye, EyeOff, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/layout/AuthLayout'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { USE_MOCK } from '../../lib/api'
import { DEMO_CREDENTIALS } from '../../lib/mock/db'
import { getErrorMessage } from '../../lib/utils'

export default function Login() {
  useDocumentTitle('Log in')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } })

  async function onSubmit(values) {
    try {
      const user = await login(values)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  function fillDemo() {
    setValue('email', DEMO_CREDENTIALS.email, { shouldValidate: true })
    setValue('password', DEMO_CREDENTIALS.password, { shouldValidate: true })
  }

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Login to your account"
      footer={
        <>
          Don’t have an account?{' '}
          <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">
            Sign up
          </Link>
        </>
      }
    >
      {USE_MOCK && (
        <button
          type="button"
          onClick={fillDemo}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-3 text-left transition hover:bg-primary-50"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary-600 shadow-xs">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <span className="text-sm">
            <span className="block font-semibold text-primary-800">Try the demo account</span>
            <span className="block text-primary-700/80">
              {DEMO_CREDENTIALS.email} · {DEMO_CREDENTIALS.password}
            </span>
          </span>
        </button>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field label="Email Address" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
            })}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          action={
            <Link to="/forgot-password" className="mb-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700">
              Forgot password?
            </Link>
          }
        >
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            error={errors.password}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-lg p-2 text-ink-muted hover:bg-surface hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
            {...register('password', { required: 'Password is required' })}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full rounded-full" loading={isSubmitting}>
          Login
        </Button>
      </form>
    </AuthLayout>
  )
}
