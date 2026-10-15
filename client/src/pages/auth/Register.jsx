import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../../components/layout/AuthLayout'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { TRIAL_DAYS, getPlan } from '../../lib/constants'
import { cn, getErrorMessage, slugify } from '../../lib/utils'
import { restaurantService } from '../../services/restaurant.service'

function passwordStrength(value = '') {
  let score = 0
  if (value.length >= 8) score++
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  return score
}

const STRENGTH = [
  { label: 'Too short', color: 'bg-slate-200' },
  { label: 'Weak', color: 'bg-red-500' },
  { label: 'Fair', color: 'bg-amber-500' },
  { label: 'Good', color: 'bg-primary-400' },
  { label: 'Strong', color: 'bg-primary-600' },
]

export default function Register() {
  useDocumentTitle('Create account')
  const { register: createAccount } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const plan = getPlan(params.get('plan') || 'starter')
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', restaurantName: '', email: '', password: '', terms: false } })

  const password = watch('password')
  const restaurantName = watch('restaurantName')
  const strength = passwordStrength(password)

  async function onSubmit({ terms: _terms, restaurantName, ...account }) {
    try {
      await createAccount(account)
    } catch (error) {
      toast.error(getErrorMessage(error))
      return
    }
    try {
      await restaurantService.create({ name: restaurantName.trim(), plan: plan.id })
      toast.success('Your account is ready. Let’s build your menu!')
      navigate('/dashboard/menu', { replace: true })
    } catch (error) {
      // The account exists; the dashboard lets the owner create the restaurant again.
      toast.error(`Your account was created, but the restaurant could not be set up: ${getErrorMessage(error)}`)
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={`Start your ${TRIAL_DAYS}-day free trial of ${plan.name}. No credit card required.`}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
            Login
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name" htmlFor="name" error={errors.name?.message}>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Aarav Mehta"
              error={errors.name}
              {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Name is too short' } })}
            />
          </Field>
          <Field label="Restaurant name" htmlFor="restaurantName" error={errors.restaurantName?.message}>
            <Input
              id="restaurantName"
              autoComplete="organization"
              placeholder="The Food Villa"
              error={errors.restaurantName}
              {...register('restaurantName', {
                required: 'Restaurant name is required',
                maxLength: { value: 80, message: 'Keep it under 80 characters' },
                validate: (v) => v.trim().length > 0 || 'Restaurant name is required',
              })}
            />
          </Field>
        </div>
        {restaurantName && slugify(restaurantName) && (
          <p className="-mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-ink-muted">
            Suggested menu link: <span className="font-semibold text-ink">menuo.app/m/{slugify(restaurantName)}</span>
          </p>
        )}
        <Field label="Work email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@restaurant.com"
            error={errors.email}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
            })}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 8 characters"
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
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Use at least 8 characters' },
              maxLength: { value: 72, message: 'Use at most 72 characters' },
            })}
          />
          {password && (
            <div className="mt-2 flex items-center gap-3" aria-live="polite">
              <div className="grid flex-1 grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <span key={step} className={cn('h-1.5 rounded-full transition', strength >= step ? STRENGTH[strength].color : 'bg-slate-200')} />
                ))}
              </div>
              <span className="w-14 text-right text-xs font-medium text-ink-muted">{STRENGTH[strength].label}</span>
            </div>
          )}
        </Field>
        <div>
          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-line accent-primary-600"
              {...register('terms', { required: 'Please accept the terms to continue' })}
            />
            <span>
              I agree to Menuo’s <span className="font-semibold text-ink">Terms of Service</span> and{' '}
              <span className="font-semibold text-ink">Privacy Policy</span>.
            </span>
          </label>
          {errors.terms && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
              {errors.terms.message}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full rounded-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
