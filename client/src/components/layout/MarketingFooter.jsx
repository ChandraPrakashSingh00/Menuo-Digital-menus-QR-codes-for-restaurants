import { Mail, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from '../ui/Logo'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/#features' },
      { label: 'Pricing', to: '/#pricing' },
      { label: 'Live demo menu', to: '/m/the-food-villa' },
      { label: 'QR code generator', to: '/register' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/#how-it-works' },
      { label: 'FAQ', to: '/#faq' },
      { label: 'Contact', to: 'mailto:hello@menuo.app' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', to: '/login' },
      { label: 'Create account', to: '/register' },
      { label: 'Forgot password', to: '/forgot-password' },
    ],
  },
]

export default function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Beautiful digital menus and QR codes for restaurants, cafés and cloud kitchens. Update prices in seconds, no reprinting.
          </p>
          <div className="mt-5 space-y-2 text-sm text-ink-soft">
            <a href="mailto:hello@menuo.app" className="flex items-center gap-2 hover:text-primary-700">
              <Mail className="size-4 text-ink-muted" aria-hidden /> hello@menuo.app
            </a>
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-ink-muted" aria-hidden /> Made in India
            </p>
          </div>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-bold text-ink">{column.title}</h3>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.to.startsWith('mailto:') ? (
                    <a href={link.to} className="text-sm text-ink-muted transition hover:text-primary-700">
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.to} className="text-sm text-ink-muted transition hover:text-primary-700">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-ink-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Menuo. All rights reserved.</p>
          <p>Digital menus that move as fast as your kitchen.</p>
        </div>
      </div>
    </footer>
  )
}
