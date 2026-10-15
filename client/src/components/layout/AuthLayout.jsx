import Logo from '../ui/Logo'

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef3f6] px-4 py-8 sm:px-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] bg-white shadow-lift lg:min-h-160 lg:grid-cols-[0.85fr_1fr]">
        <aside className="relative hidden overflow-hidden bg-night-900 lg:block">
          <img src="/images/auth-food.webp" alt="" className="absolute inset-x-0 bottom-0 h-[62%] w-full object-cover object-center" />
          <div className="absolute inset-0 bg-linear-to-b from-night-900 from-40% via-night-900/70 via-55% to-transparent" aria-hidden />
          <div className="relative flex h-full flex-col p-10">
            <Logo light />
            <h2 className="mt-14 max-w-xs text-4xl leading-tight font-extrabold tracking-tight text-white">Good Food Leads to Great Moments</h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
              Manage your restaurant menu, update items, track subscriptions and more — all in one place.
            </p>
          </div>
        </aside>

        <div className="flex flex-col px-6 py-8 sm:px-12 sm:py-12">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex flex-1 items-center">
            <div className="mx-auto w-full max-w-md animate-fade-in py-8 lg:py-0">
              <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
              {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
              <div className="mt-8">{children}</div>
              {footer && <div className="mt-8 text-center text-sm text-ink-muted">{footer}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
