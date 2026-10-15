import { ArrowLeft, LifeBuoy } from 'lucide-react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../components/layout/AuthLayout'
import Button from '../../components/ui/Button'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { SUPPORT_EMAIL } from '../../lib/constants'

// Password reset by email needs an email provider, which is not configured yet.
// Until it is, this page says so honestly instead of pretending to send a link.
export default function ForgotPassword() {
  useDocumentTitle('Reset password')

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Self-service password reset is not available yet."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-700">
          <ArrowLeft className="size-4" aria-hidden /> Back to log in
        </Link>
      }
    >
      <div className="rounded-2xl border border-line bg-surface/60 p-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <LifeBuoy className="size-6" aria-hidden />
        </span>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          We can’t send reset emails yet. Write to us from the email address on your account and we’ll help you get back in.
        </p>
        <Button href={`mailto:${SUPPORT_EMAIL}?subject=Menuo%20password%20reset`} variant="outline" className="mt-5">
          Email {SUPPORT_EMAIL}
        </Button>
      </div>
    </AuthLayout>
  )
}
