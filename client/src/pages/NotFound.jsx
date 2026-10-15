import { ArrowLeft, Compass } from 'lucide-react'
import Button from '../components/ui/Button'
import Logo from '../components/ui/Logo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="container-page py-6">
        <Logo />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Compass className="size-7" aria-hidden />
        </span>
        <p className="mt-6 text-sm font-bold tracking-wide text-primary-600 uppercase">404 error</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">This page isn’t on the menu</h1>
        <p className="mt-3 max-w-md text-ink-muted">The page you’re looking for doesn’t exist or may have moved.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button to="/" icon={ArrowLeft}>
            Back to home
          </Button>
          <Button to="/dashboard" variant="outline">
            Go to dashboard
          </Button>
        </div>
      </main>
    </div>
  )
}
