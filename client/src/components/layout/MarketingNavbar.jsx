import { ArrowRight, Menu as MenuIcon, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'
import Button from '../ui/Button'
import Logo from '../ui/Logo'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#features', label: 'Features' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#how-it-works', label: 'About' },
]

// "/" alone does not change the URL when already on the landing page, so scroll up by hand.
const scrollTopIfHome = (href) => href === '/' && window.scrollTo({ top: 0, behavior: 'smooth' })

export default function MarketingNavbar() {
  const { isAuthenticated } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-all duration-200',
        scrolled || open ? 'border-b border-line bg-white/90 backdrop-blur-md' : 'border-b border-transparent bg-[#f5f9fb]',
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-18">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => scrollTopIfHome(link.href)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-soft transition hover:text-primary-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2.5 md:flex">
          {isAuthenticated ? (
            <Button to="/dashboard" iconRight={ArrowRight}>
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button to="/login" variant="outline" className="px-5">
                Login
              </Button>
              <Button to="/register" className="px-5">
                Get Started
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-ink md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="size-6" /> : <MenuIcon className="size-6" />}
        </button>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-line bg-white md:hidden">
          <nav aria-label="Mobile" className="container-page flex flex-col gap-1 py-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => {
                  setOpen(false)
                  scrollTopIfHome(link.href)
                }}
                className="rounded-lg px-3 py-3 text-base font-semibold text-ink hover:bg-surface"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {isAuthenticated ? (
                <Button to="/dashboard" className="col-span-2">
                  Go to dashboard
                </Button>
              ) : (
                <>
                  <Button to="/login" variant="outline">
                    Login
                  </Button>
                  <Button to="/register">Get Started</Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
