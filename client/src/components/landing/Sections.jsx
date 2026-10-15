import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ChevronDown,
  Clock,
  Palette,
  Play,
  QrCode,
  RefreshCw,
  Smartphone,
  SquarePen,
  Star,
  Store,
  UtensilsCrossed,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { TRIAL_DAYS } from '../../lib/constants'
import { cn } from '../../lib/utils'
import Button from '../ui/Button'
import PhoneMockup from './PhoneMockup'
import PricingCards, { PlanCTA } from './PricingCards'

function SectionHeading({ eyebrow, title, description, className }) {
  return (
    <div className={cn('mx-auto max-w-2xl text-center', className)}>
      <p className="text-sm font-bold tracking-wide text-primary-600 uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance text-ink sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-pretty text-ink-muted sm:text-lg">{description}</p>}
    </div>
  )
}

const HIGHLIGHTS = [
  { icon: SquarePen, title: 'Easy Menu Management', text: 'Update your menu anytime' },
  { icon: QrCode, title: 'QR Code Access', text: 'No app needed' },
  { icon: RefreshCw, title: 'Real-time Updates', text: 'Changes reflect instantly' },
  { icon: BadgeCheck, title: 'Subscription Plans', text: 'Flexible & affordable' },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-[#f5f9fb] to-white">
      <div className="container-page grid items-center gap-12 pt-10 pb-12 lg:grid-cols-[1fr_1.1fr] lg:gap-6 lg:pt-14 lg:pb-16 xl:grid-cols-[auto_1fr] xl:gap-4">
        <div className="animate-fade-in text-center lg:text-left">
          <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-balance text-ink sm:text-5xl xl:text-[3.4rem]">
            Turn Your Menu <br className="hidden sm:block" />
            <span className="xl:whitespace-nowrap">
              into a <span className="text-primary-600">Digital Experience</span>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-pretty text-ink-muted lg:mx-0">
            Let your customers explore your menu with a simple QR scan. Modern, fast and easy digital menu solution for restaurants, cafes and bars.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Button to="/register" size="lg" className="rounded-full px-8">
              Get Started Free
            </Button>
            <Button to="/m/the-food-villa" size="lg" variant="outline" className="rounded-full pr-7 pl-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <Play className="size-3.5 fill-current" aria-hidden />
              </span>
              See Live Demo
            </Button>
          </div>
          <p className="mt-6 text-sm text-ink-muted">
            {TRIAL_DAYS}-day free trial · No credit card required
          </p>
        </div>
        <PhoneMockup />
      </div>

      <div className="container-page pb-14">
        <ul className="grid grid-cols-2 gap-y-8 rounded-3xl border border-line bg-white px-2 py-7 shadow-soft lg:grid-cols-4 lg:divide-x lg:divide-line">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col items-center gap-3 px-4 text-center sm:flex-row sm:text-left lg:justify-center">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <Icon className="size-5.5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{title}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const STATS = [
  { value: '2,000+', label: 'Restaurants onboard' },
  { value: '1.2M', label: 'Menu scans every month' },
  { value: '₹0', label: 'Spent on reprinting' },
  { value: '4.9/5', label: 'Average owner rating' },
]

export function StatsBand() {
  return (
    <section aria-label="Menuo in numbers" className="border-y border-line bg-surface">
      <dl className="container-page grid grid-cols-2 gap-y-8 py-10 md:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col text-center">
            <dt className="order-2 mt-1 text-sm text-ink-muted">{stat.label}</dt>
            <dd className="text-3xl font-extrabold tracking-tight text-ink">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const FEATURES = [
  { icon: UtensilsCrossed, title: 'Drag-free menu builder', text: 'Organise dishes into categories, add photos, prices and dietary tags in a few taps.' },
  { icon: QrCode, title: 'Instant QR codes', text: 'Generate high-resolution QR codes in your brand colours. Download as PNG or SVG and print.' },
  { icon: RefreshCw, title: 'Real-time updates', text: 'Change a price or mark a dish sold out — every table sees it instantly, no reprints.' },
  { icon: Smartphone, title: 'Built for phones', text: 'A fast, beautiful menu that opens in any phone browser. No app download, no login.' },
  { icon: Palette, title: 'Your brand, your colours', text: 'Add your logo, cover photo and brand colour so the menu feels like your restaurant.' },
  { icon: BarChart3, title: 'Menu analytics', text: 'See how many guests view your menu each day and spot your busiest hours.' },
]

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to take your menu online"
          description="Menuo replaces printed menus with a living digital menu that you control from your phone or laptop."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="group card p-6 transition duration-200 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lift">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 transition group-hover:bg-primary-600 group-hover:text-white">
                <Icon className="size-5.5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { icon: Store, title: 'Create your account', text: 'Sign up with your restaurant name. Your menu link is ready instantly.' },
  { icon: UtensilsCrossed, title: 'Add dishes & prices', text: 'Build categories like Starters or Mains and add your items with photos.' },
  { icon: QrCode, title: 'Print your QR code', text: 'Download the QR, place it on tables, and guests start browsing right away.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-night-900 py-20 text-white sm:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold tracking-wide text-mint uppercase">How it works</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Go live before your next service</h2>
          <p className="mt-4 text-lg text-white/65">Three simple steps. No designer, no developer, no printing press.</p>
        </div>
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-7">
              <span className="absolute top-6 right-6 text-5xl font-extrabold text-white/[0.06]">0{index + 1}</span>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-glow">
                <Icon className="size-5.5" aria-hidden />
              </span>
              <h3 className="mt-6 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex justify-center">
          <Button to="/register" size="lg" iconRight={ArrowRight}>
            Start your free trial
          </Button>
        </div>
      </div>
    </section>
  )
}

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing that grows with you"
          description={`Every new restaurant starts with a ${TRIAL_DAYS}-day free trial. Then pick the plan that fits your menu — cancel anytime.`}
        />
        <div className="mt-12">
          <PricingCards renderAction={(plan) => <PlanCTA plan={plan} />} />
        </div>
      </div>
    </section>
  )
}

const TESTIMONIALS = [
  {
    quote: 'We change our specials every day. With Menuo it takes 30 seconds and every table sees it. We stopped printing menus completely.',
    name: 'Priya Nair',
    role: 'Owner, Coastal Curry House · Kochi',
  },
  {
    quote: 'Our guests love the photos and veg/non-veg filters. Average order value went up because people actually see the desserts now.',
    name: 'Rohan Kapoor',
    role: 'Founder, Brew & Bake Café · Delhi',
  },
  {
    quote: 'Setting up three outlets took one evening. The QR codes look premium and match our brand colours perfectly.',
    name: 'Sana Shaikh',
    role: 'Operations Head, Biryani Bros · Pune',
  },
]

export function Testimonials() {
  return (
    <section className="bg-surface/70 py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading eyebrow="Loved by owners" title="Restaurants run smoother with Menuo" />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="card flex flex-col p-7">
              <div className="flex gap-0.5 text-amber-400" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" aria-hidden />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-ink-soft">“{t.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                  {t.name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')}
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">{t.name}</span>
                  <span className="block text-xs text-ink-muted">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

const FAQS = [
  { q: 'Do my customers need to download an app?', a: 'No. Customers simply scan the QR code with their phone camera and your menu opens instantly in the browser. No app and no login needed.' },
  { q: 'Can I update prices after printing the QR code?', a: 'Yes — that is the best part. The QR code always points to your live menu, so any change you make in the dashboard shows up immediately.' },
  { q: 'Is there a free trial?', a: `Yes. Every new restaurant gets a ${TRIAL_DAYS}-day free trial — no credit card needed. After that, Starter is ₹199/month for up to 50 items and Pro is ₹399/month for unlimited items.` },
  { q: 'Can I mark items as sold out?', a: 'Absolutely. Toggle any dish off in one tap and it shows as “Sold out” on your menu until you turn it back on.' },
  { q: 'What payment methods do you accept?', a: 'Plans are billed monthly through Razorpay using UPI AutoPay, credit/debit cards or other supported recurring methods. You can cancel anytime.' },
]

export function FAQ() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Questions? We’ve got answers." />
        <div className="mt-12 divide-y divide-line rounded-3xl border border-line bg-white shadow-soft">
          {FAQS.map((item, index) => {
            const isOpen = open === index
            return (
              <div key={item.q}>
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-${index}`}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-ink transition hover:text-primary-700"
                  >
                    {item.q}
                    <ChevronDown className={cn('size-5 shrink-0 text-ink-muted transition-transform', isOpen && 'rotate-180 text-primary-600')} aria-hidden />
                  </button>
                </h3>
                <div id={`faq-${index}`} hidden={!isOpen} className="px-6 pb-5 text-sm leading-relaxed text-ink-muted">
                  {item.a}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function FinalCTA() {
  return (
    <section className="pb-20 sm:pb-28">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary-600 px-6 py-14 text-center text-white shadow-glow sm:px-12 sm:py-20">
          <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
          <div className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Ready to ditch the printed menu?</h2>
            <p className="mt-4 text-lg text-white/80">Join thousands of restaurants serving smarter menus with Menuo.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button to="/register" size="lg" variant="outline" className="border-white bg-white text-primary-700 hover:bg-primary-50" iconRight={ArrowRight}>
                Start free trial
              </Button>
              <Button to="/m/the-food-villa" size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" icon={Zap}>
                Explore demo menu
              </Button>
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/70">
              <Clock className="size-4" aria-hidden /> Takes less than 5 minutes
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
